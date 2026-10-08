import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';
import 'decision_support_service.dart';

enum GeminiAiStatus {
  idle,
  loading,
  ready,
  quotaLimited,
  notConfigured,
  authenticationRequired,
  unavailable,
}

class GeminiAiResult {
  const GeminiAiResult({
    required this.status,
    required this.message,
    this.advice,
    this.model,
    this.retryAfterSeconds,
    this.fromCache = false,
  });

  final GeminiAiStatus status;
  final String message;
  final Map<String, dynamic>? advice;
  final String? model;
  final int? retryAfterSeconds;
  final bool fromCache;

  bool get isSuccess => status == GeminiAiStatus.ready && advice != null;

  GeminiAiResult asCached() => GeminiAiResult(
        status: status,
        message: message,
        advice: advice,
        model: model,
        retryAfterSeconds: retryAfterSeconds,
        fromCache: true,
      );
}

/// Direct Gemini Developer API integration for the live-sensor build.
///
/// The automatic soil-reading request intentionally asks for a small JSON
/// object. Crop-planning requests use a separate focused schema. Keeping the
/// two requests separate makes the mobile AI flow more reliable and prevents a
/// long all-in-one response from being rejected as incomplete.
class GeminiAiService {
  static final Map<String, GeminiAiResult> _cache = <String, GeminiAiResult>{};
  static final Map<String, Future<GeminiAiResult>> _inFlight =
      <String, Future<GeminiAiResult>>{};
  static DateTime? _limitedUntil;
  static GeminiAiResult? _limitResult;

  static const String _persistentCachePrefsKey =
      'soilsense_gemini_ai_cache_v1';
  static const int _maxPersistentCacheEntries = 24;
  static bool _persistentCacheLoaded = false;
  static Future<void>? _persistentCacheLoading;

  // Keep direct REST calls serialized and slightly spaced. Home, Crops and the
  // full Smart Crop Planning page can all become active around the same time;
  // without a gate they can burst multiple requests into the same free-tier
  // rate-limit window.
  static Future<void> _networkQueue = Future<void>.value();
  static DateTime? _lastNetworkRequestAt;
  static const Duration _minimumRequestSpacing = Duration(seconds: 4);

  static void clearCache() {
    // Clear only memory state. The persistent cache is keyed by reading values,
    // selected crop and language, so a valid saved result can still be reused
    // after an app restart without spending another Gemini request.
    _cache.clear();
    _inFlight.clear();
    _limitedUntil = null;
    _limitResult = null;
    _persistentCacheLoaded = false;
    _persistentCacheLoading = null;
  }

  static Future<GeminiAiResult> generateAdvice({
    required Map<String, dynamic> soilData,
    required String readingId,
    String? fieldId,
    String? source,
    List<String>? deterministicTopCrops,
    String? focusCrop,
    String languageCode = 'en',
    bool forceRefresh = false,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const GeminiAiResult(
        status: GeminiAiStatus.authenticationRequired,
        message: 'Sign in again before using AI decision support.',
      );
    }

    if (AppConfig.geminiApiKey.trim().isEmpty) {
      return const GeminiAiResult(
        status: GeminiAiStatus.notConfigured,
        message: 'Gemini API key is missing from the app configuration.',
      );
    }

    await _ensurePersistentCacheLoaded();

    if (_limitedUntil != null &&
        DateTime.now().isBefore(_limitedUntil!) &&
        _limitResult != null) {
      return _limitResult!;
    }

    final cacheKey = _buildCacheKey(
      soilData: soilData,
      readingId: readingId,
      fieldId: fieldId,
      focusCrop: focusCrop,
      languageCode: languageCode,
    );

    if (!forceRefresh && _cache.containsKey(cacheKey)) {
      return _cache[cacheKey]!.asCached();
    }

    if (!forceRefresh && _inFlight.containsKey(cacheKey)) {
      return _inFlight[cacheKey]!;
    }

    final future = _requestAdvice(
      soilData: soilData,
      readingId: readingId,
      fieldId: fieldId,
      source: source,
      deterministicTopCrops: deterministicTopCrops,
      focusCrop: focusCrop,
      languageCode: languageCode,
      cacheKey: cacheKey,
    );
    _inFlight[cacheKey] = future;

    try {
      return await future;
    } finally {
      if (identical(_inFlight[cacheKey], future)) {
        _inFlight.remove(cacheKey);
      }
    }
  }

  static Future<GeminiAiResult> _requestAdvice({
    required Map<String, dynamic> soilData,
    required String readingId,
    required String cacheKey,
    String? fieldId,
    String? source,
    List<String>? deterministicTopCrops,
    String? focusCrop,
    required String languageCode,
  }) async {
    final topCrops = (deterministicTopCrops ?? const <String>[]).join(', ');
    final selectedCrop = (focusCrop ?? '').trim();
    final isPlanningRequest = selectedCrop.isNotEmpty;

    final prompt = isPlanningRequest
        ? _planningPrompt(
            soilData: soilData,
            readingId: readingId,
            fieldId: fieldId,
            source: source,
            selectedCrop: selectedCrop,
            languageCode: languageCode,
          )
        : _recommendationPrompt(
            soilData: soilData,
            readingId: readingId,
            fieldId: fieldId,
            source: source,
            topCrops: topCrops,
            languageCode: languageCode,
          );

    final responseSchema = isPlanningRequest
        ? _planningResponseSchema()
        : _recommendationResponseSchema();

    // Keep the mobile integration deliberately simple: use the documented
    // GenerateContent REST endpoint with x-goog-api-key. The previous build
    // tried both Interactions and GenerateContent with several transport
    // permutations; that made one remote failure fan out into multiple error
    // states. SoilSense now has one primary request path and one schema-format
    // compatibility retry only when Google explicitly rejects the format.
    Future<http.Response> postGenerateContent({
      required String model,
      bool useLegacyStructuredOutput = false,
    }) {
      final endpoint = Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/'
        '$model:generateContent',
      );

      final generationConfig = <String, dynamic>{
        // SoilSense asks for short structured guidance, not long-form prose.
        // Smaller output budgets and minimal thinking reduce token pressure
        // without changing the fields shown in the app.
        'maxOutputTokens': isPlanningRequest ? 3072 : 2048,
        'thinkingConfig': <String, dynamic>{
          'thinkingLevel': model.contains('gemini-3.8') ? 'low' : 'minimal',
        },
        if (useLegacyStructuredOutput) ...<String, dynamic>{
          'responseMimeType': 'application/json',
          'responseSchema': responseSchema,
        } else
          'responseFormat': <String, dynamic>{
            'text': <String, dynamic>{
              'mimeType': 'application/json',
              'schema': responseSchema,
            },
          },
      };

      return _runSerializedHttpRequest(
        () => http
            .post(
              endpoint,
              headers: <String, String>{
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-goog-api-key': AppConfig.geminiApiKey.trim(),
              },
              body: jsonEncode(<String, dynamic>{
                'contents': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'role': 'user',
                    'parts': <Map<String, String>>[
                      <String, String>{'text': prompt},
                    ],
                  },
                ],
                'generationConfig': generationConfig,
              }),
            )
            .timeout(const Duration(seconds: 45)),
      );
    }

    bool isAuthenticationError(http.Response response) =>
        response.statusCode == 401 || response.statusCode == 403;

    bool isStructuredOutputCompatibilityError(http.Response response) {
      if (response.statusCode != 400) return false;
      final lower = response.body.toLowerCase();
      return lower.contains('responseformat') ||
          lower.contains('response_format') ||
          lower.contains('responsemimetype') ||
          lower.contains('responseschema') ||
          lower.contains('unknown field') ||
          lower.contains('unknown name') ||
          lower.contains('invalid json payload');
    }

    bool isModelUnavailable(http.Response response) {
      if (response.statusCode == 404) return true;
      if (response.statusCode != 400) return false;
      final lower = response.body.toLowerCase();
      return lower.contains('model') &&
          (lower.contains('not found') ||
              lower.contains('not supported') ||
              lower.contains('unsupported'));
    }

    Future<http.Response> requestModel(String model) async {
      var response = await postGenerateContent(model: model);
      if (isStructuredOutputCompatibilityError(response)) {
        response = await postGenerateContent(
          model: model,
          useLegacyStructuredOutput: true,
        );
      }
      return response;
    }

    try {
      var modelUsed = AppConfig.geminiModel;
      var response = await requestModel(modelUsed);

      // A missing/unavailable model can fall back once to the stable alternate.
      if (isModelUnavailable(response) &&
          AppConfig.geminiFallbackModel.trim().isNotEmpty &&
          AppConfig.geminiFallbackModel != modelUsed) {
        modelUsed = AppConfig.geminiFallbackModel;
        response = await requestModel(modelUsed);
      }

      // Gemini quotas are model-scoped in many free-tier configurations. If
      // the lightweight primary model is temporarily rate-limited, try the
      // configured alternate exactly once. The serialized request gate above
      // prevents this from becoming a burst/retry loop.
      if (response.statusCode == 429 &&
          AppConfig.geminiFallbackModel.trim().isNotEmpty &&
          AppConfig.geminiFallbackModel != modelUsed) {
        final fallbackModel = AppConfig.geminiFallbackModel.trim();
        final fallbackResponse = await requestModel(fallbackModel);
        if (fallbackResponse.statusCode != 429) {
          modelUsed = fallbackModel;
          response = fallbackResponse;
        }
      }

      if (response.statusCode == 429) {
        final retryAfter = _extractRetryDelaySeconds(response);
        final isDailyQuota = _looksLikeDailyQuota(response.body);
        final waitSeconds = retryAfter ??
            (isDailyQuota
                ? const Duration(hours: 6).inSeconds
                : const Duration(minutes: 10).inSeconds);
        final limited = GeminiAiResult(
          status: GeminiAiStatus.quotaLimited,
          message: isDailyQuota
              ? 'Online AI quota is temporarily exhausted. SoilSense is keeping local guidance available and will not keep retrying in the background.'
              : (retryAfter == null
                  ? 'Online AI is rate-limited right now. SoilSense is keeping local guidance available and will wait before another request.'
                  : 'Online AI is rate-limited right now. Try again after about $retryAfter seconds.'),
          retryAfterSeconds: retryAfter,
        );
        _limitedUntil = DateTime.now().add(Duration(seconds: waitSeconds));
        _limitResult = limited;
        return limited;
      }

      if (isAuthenticationError(response)) {
        final apiMessage = _extractApiError(response.body);
        final lower = response.body.toLowerCase();
        final unsupportedToken =
            lower.contains('access_token_type_unsupported') ||
            lower.contains('token type unsupported');
        debugPrintGemini(
          'Gemini authentication error ${response.statusCode}: $apiMessage',
        );
        return GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: unsupportedToken
              ? 'AI authentication is temporarily unavailable. SoilSense will keep local guidance available and retry automatically.'
              : (apiMessage.isEmpty
                  ? 'AI connection could not be authenticated. SoilSense will retry automatically.'
                  : 'AI connection error: $apiMessage'),
        );
      }

      if (response.statusCode == 400 || response.statusCode == 404) {
        final message = _extractApiError(response.body);
        debugPrintGemini(
          'Gemini request/model error ${response.statusCode}: $message',
        );
        return GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: message.isEmpty
              ? 'AI request or model is temporarily unavailable.'
              : 'Gemini request error: $message',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = _extractApiError(response.body);
        debugPrintGemini(
          'Gemini HTTP ${response.statusCode}: ${message.isEmpty ? response.body : message}',
        );
        return GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: message.isEmpty
              ? 'AI is temporarily unavailable (HTTP ${response.statusCode}).'
              : 'Gemini API error: $message',
        );
      }

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        debugPrintGemini('Gemini returned a non-object response.');
        return const GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: 'Gemini returned an unexpected response.',
        );
      }

      final text = _extractGenerateContentText(decoded);
      if (text == null || text.trim().isEmpty) {
        final blockReason =
            ((decoded['promptFeedback'] as Map?)?['blockReason'] ?? '')
                .toString();
        debugPrintGemini(
          'Gemini returned no text. blockReason=$blockReason',
        );
        return GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: blockReason.isEmpty
              ? 'Gemini returned no usable advice.'
              : 'Gemini did not return advice ($blockReason).',
        );
      }

      final parsed = _parseJsonObject(text);
      final requiredKeys = isPlanningRequest
          ? List<String>.from(_planningRequiredKeys)
          : List<String>.from(_recommendationRequiredKeys);

      // When the deterministic SoilSense ranking finds no suitable crop, the
      // prompt intentionally requires Gemini to return empty cropSuggestion and
      // cropReasoning values. Empty strings are valid in that scenario and must
      // not turn an otherwise successful AI response into AI UNAVAILABLE.
      if (!isPlanningRequest &&
          (deterministicTopCrops == null || deterministicTopCrops.isEmpty)) {
        requiredKeys.remove('cropSuggestion');
        requiredKeys.remove('cropReasoning');
      }

      if (parsed == null || requiredKeys.any((key) => !_hasText(parsed, key))) {
        final missing = parsed == null
            ? 'invalid JSON'
            : requiredKeys.where((key) => !_hasText(parsed, key)).join(', ');
        debugPrintGemini('Gemini structured response problem: $missing');
        return GeminiAiResult(
          status: GeminiAiStatus.unavailable,
          message: parsed == null
              ? 'Gemini returned invalid structured data.'
              : 'Gemini response was incomplete. Missing: $missing',
        );
      }

      final sanitizedAdvice = _sanitizePhilippineAdvice(
        parsed,
        isPlanningRequest: isPlanningRequest,
        deterministicTopCrops: deterministicTopCrops ?? const <String>[],
        selectedCrop: selectedCrop,
      );

      final result = GeminiAiResult(
        status: GeminiAiStatus.ready,
        message: languageCode == 'fil'
            ? (isPlanningRequest
                ? 'Handa na ang AI crop plan para sa $selectedCrop.'
                : 'Handa na ang AI guidance para sa natapos na soil reading.')
            : (isPlanningRequest
                ? 'AI crop plan is ready for $selectedCrop.'
                : 'AI guidance is ready for this completed reading.'),
        advice: sanitizedAdvice,
        model: modelUsed,
      );
      _cache[cacheKey] = result;
      while (_cache.length > _maxPersistentCacheEntries) {
        _cache.remove(_cache.keys.first);
      }
      await _persistSuccessfulCache();
      return result;
    } on TimeoutException {
      return const GeminiAiResult(
        status: GeminiAiStatus.unavailable,
        message: 'AI request timed out. SoilSense will retry automatically.',
      );
    } on SocketException {
      return const GeminiAiResult(
        status: GeminiAiStatus.unavailable,
        message: 'No internet connection for AI guidance.',
      );
    } on FormatException {
      return const GeminiAiResult(
        status: GeminiAiStatus.unavailable,
        message: 'Gemini returned invalid data. SoilSense will retry automatically.',
      );
    } catch (error) {
      final lower = error.toString().toLowerCase();
      if (lower.contains('429') ||
          lower.contains('resource_exhausted') ||
          lower.contains('quota') ||
          lower.contains('rate limit')) {
        return const GeminiAiResult(
          status: GeminiAiStatus.quotaLimited,
          message: 'AI usage limit reached. SoilSense will try again automatically.',
        );
      }
      debugPrintGemini('Gemini request exception: $error');
      return const GeminiAiResult(
        status: GeminiAiStatus.unavailable,
        message: 'AI is temporarily unavailable. SoilSense will retry automatically.',
      );
    }
  }

  static const List<String> _recommendationRequiredKeys = <String>[
    'soilSummary',
    'fertilityInterpretation',
    'cropSuggestion',
    'cropReasoning',
    'fertilizerAdvice',
    'soilManagement',
    'whenToAct',
    'reportSummary',
  ];

  static const List<String> _planningRequiredKeys = <String>[
    'planningGuidance',
    'planningWindow',
    'planningSeason',
    'planningMaturity',
    'planningHarvest',
    'planningHarvestNote',
    'planningWaterGuidance',
    'planningWaterAction',
    'planningBeforePlanting',
    'planningAtPlanting',
    'planningMonitoring',
    'planningBeforeHarvest',
    'rotationCrop1',
    'rotationReason1',
    'rotationCrop2',
    'rotationReason2',
    'rotationCrop3',
    'rotationReason3',
    'soilManagement',
    'whenToAct',
  ];

  static List<String> get _philippineSupportedCrops =>
      DecisionSupportService.supportedCrops;

  static String get _philippineCropListText =>
      _philippineSupportedCrops.join(', ');

  static String _philippineSeasonContext() {
    final month = DateTime.now().month;
    if (month >= 6 && month <= 11) {
      return 'general wetter/rainy-season context (June-November)';
    }
    return 'general drier-season context (December-May)';
  }

  static String _currentMonthName() {
    const names = <String>[
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return names[DateTime.now().month - 1];
  }

  static Map<String, dynamic> _sanitizePhilippineAdvice(
    Map<String, dynamic> parsed, {
    required bool isPlanningRequest,
    required List<String> deterministicTopCrops,
    required String selectedCrop,
  }) {
    final result = Map<String, dynamic>.from(parsed);
    final localTop = deterministicTopCrops
        .where(_philippineSupportedCrops.contains)
        .take(5)
        .toList();

    if (!isPlanningRequest) {
      if (localTop.isEmpty) {
        // The deterministic engine found no crop at or above the minimum
        // suitability threshold. AI must never override that safety gate.
        result['cropSuggestion'] = '';
        result['cropReasoning'] = '';
      } else {
        final aiCrops = _cleanOpenPhilippineCropSuggestion(
          result['cropSuggestion'],
        );
        final allowed = aiCrops.where((candidate) {
          final normalized = candidate.toLowerCase();
          return localTop.any((crop) => crop.toLowerCase() == normalized);
        }).toList();
        result['cropSuggestion'] = allowed.isNotEmpty
            ? allowed.join(', ')
            : localTop.join(', ');
        result['cropReasoning'] = _limitWords(result['cropReasoning'], 48);
      }
      result['fertilizerAdvice'] = _limitWords(result['fertilizerAdvice'], 52);
      result['soilManagement'] = _limitWords(result['soilManagement'], 52);
      result['whenToAct'] = _limitWords(result['whenToAct'], 32);
      result['soilSummary'] = _limitWords(result['soilSummary'], 42);
      result['fertilityInterpretation'] =
          _limitWords(result['fertilityInterpretation'], 42);
    }

    if (isPlanningRequest) {
      // Smart Crop Planning must show the complete AI guidance. Older builds
      // hard-truncated these fields by word count and appended an ellipsis,
      // which made otherwise valid Gemini answers look incomplete in the UI.
      // The prompt/schema already asks Gemini to keep each field concise, so
      // normalize whitespace here without removing any part of the answer.
      result['planningGuidance'] = _cleanPlanningText(result['planningGuidance']);
      result['planningWindow'] = _cleanPlanningText(result['planningWindow']);
      result['planningSeason'] = _cleanPlanningText(result['planningSeason']);
      result['planningMaturity'] = _cleanPlanningText(result['planningMaturity']);
      result['planningHarvest'] = _cleanPlanningText(result['planningHarvest']);
      result['planningHarvestNote'] =
          _cleanPlanningText(result['planningHarvestNote']);
      result['planningWaterGuidance'] =
          _cleanPlanningText(result['planningWaterGuidance']);
      result['planningWaterAction'] =
          _cleanPlanningText(result['planningWaterAction']);
      result['planningBeforePlanting'] =
          _cleanPlanningText(result['planningBeforePlanting']);
      result['planningAtPlanting'] =
          _cleanPlanningText(result['planningAtPlanting']);
      result['planningMonitoring'] =
          _cleanPlanningText(result['planningMonitoring']);
      result['planningBeforeHarvest'] =
          _cleanPlanningText(result['planningBeforeHarvest']);
      result['soilManagement'] = _cleanPlanningText(result['soilManagement']);
      result['whenToAct'] = _cleanPlanningText(result['whenToAct']);
      for (var index = 1; index <= 3; index++) {
        result['rotationReason$index'] =
            _cleanPlanningText(result['rotationReason$index']);
      }
      final fallbackRotation = _philippineSupportedCrops
          .where((crop) => crop.toLowerCase() != selectedCrop.toLowerCase())
          .toList();
      for (var index = 1; index <= 3; index++) {
        final key = 'rotationCrop$index';
        final raw = (result[key] ?? '').toString().trim();
        String? matched;
        for (final crop in _philippineSupportedCrops) {
          if (crop.toLowerCase() == raw.toLowerCase()) {
            matched = crop;
            break;
          }
        }
        if (matched == null && fallbackRotation.isNotEmpty) {
          matched = fallbackRotation[(index - 1) % fallbackRotation.length];
        }
        if (matched != null) result[key] = matched;
      }
    }
    return result;
  }

  static List<String> _cleanOpenPhilippineCropSuggestion(dynamic value) {
    final text = (value ?? '').toString().trim();
    if (text.isEmpty) return const <String>[];

    final parts = text
        .replaceAll(RegExp(r'^[\s\-•\d\.\)]+', multiLine: true), '')
        .split(RegExp(r'[,;\n|]+'));
    final crops = <String>[];
    final seen = <String>{};

    for (final part in parts) {
      var crop = part.trim();
      crop = crop.replaceFirst(
        RegExp(r'^(?:and|or)\s+', caseSensitive: false),
        '',
      );
      crop = crop.replaceAll(RegExp(r'\s+'), ' ').trim();
      if (crop.isEmpty || crop.length > 60) continue;
      final key = crop.toLowerCase();
      if (!seen.add(key)) continue;
      crops.add(crop);
      if (crops.length == 5) break;
    }
    return crops;
  }

  static String _cleanPlanningText(dynamic value) {
    return (value ?? '').toString().replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static String _limitWords(dynamic value, int maxWords) {
    final text = (value ?? '').toString().replaceAll(RegExp(r'\s+'), ' ').trim();
    if (text.isEmpty) return '';
    final words = text.split(' ');
    if (words.length <= maxWords) return text;
    return '${words.take(maxWords).join(' ')}…';
  }

  static Map<String, dynamic> normalizeRecommendationAdvice(
    Map<String, dynamic> advice, {
    required List<String> deterministicTopCrops,
  }) {
    return _sanitizePhilippineAdvice(
      advice,
      isPlanningRequest: false,
      deterministicTopCrops: deterministicTopCrops,
      selectedCrop: '',
    );
  }

  static String _languageInstruction(String languageCode) {
    if (languageCode == 'fil') {
      return 'Write every natural-language value in clear Filipino/Tagalog suitable for Philippine farmers. Keep crop names, numbers, units, JSON property names, and commonly used technical abbreviations such as NPK, pH, EC, and PAGASA unchanged when that is clearer. Do not mix long English sentences into Filipino output.';
    }
    return 'Write every natural-language value in clear, concise English.';
  }

  static String _recommendationPrompt({
    required Map<String, dynamic> soilData,
    required String readingId,
    required String topCrops,
    required String languageCode,
    String? fieldId,
    String? source,
  }) =>
      '''
You are the AI decision-support component of SoilSense, a student capstone soil
monitoring and crop-management system.

${_languageInstruction(languageCode)}

Analyze the completed soil reading below for Philippine farming conditions.
Crop suggestions must stay within the suitable-crop allowlist produced by the
SoilSense deterministic ranking for this exact reading. Never promote a crop
that the local engine classified as Not Recommended.

Use a Philippine tropical-climate context. Current month: ${_currentMonthName()}.
General seasonal context: ${_philippineSeasonContext()}. Seasonal patterns vary
by Philippine region, so treat this as general guidance rather than an exact
local forecast. SoilSense does not receive live weather data, so NEVER invent
current rainfall, storms, temperature, or forecast conditions. If weather is
important, explicitly say to verify the local PAGASA/local forecast before
planting.

Keep the response practical, farmer-friendly, specific, and safe without becoming
wordy. Crop Suggestion is controlled by the SoilSense deterministic suitability
ranking: recommend ONLY crop names present in the local ranking reference below.
Never promote a crop that the local engine classified as Not Recommended. If the
local ranking reference is empty, return an empty cropSuggestion and empty
cropReasoning. When crops are available, return at most FIVE names separated by
commas. For Crop Reasoning, Fertilizer Advice, and Soil Management, give enough
detail to explain WHAT the farmer should do and WHY it fits the measured values,
usually 1–2 clear mobile-friendly sentences. When to Act should state the priority
and practical timing. Mention the important abnormal measurements when relevant,
avoid generic repeated advice, and do not claim laboratory certainty. Avoid exact
fertilizer rates unless verified locally.

Reading ID: $readingId
Farm context: Generalized Philippine farm site
Source: ${source ?? 'Unknown'}
Nitrogen: ${soilData['nitrogen']} mg/kg
Phosphorus: ${soilData['phosphorus']} mg/kg
Potassium: ${soilData['potassium']} mg/kg
pH: ${soilData['ph']}
Moisture: ${soilData['moisture']} %
Soil temperature: ${soilData['soilTemperature'] ?? 'Not available'} °C
Electrical conductivity: ${soilData['electricalConductivity'] ?? 'Not available'} µS/cm
SoilSense suitable-crop allowlist (authoritative for cropSuggestion):
${topCrops.isEmpty ? 'NONE — do not suggest a crop' : topCrops}

Create SoilSense smart recommendations and a short report summary. The crop
suggestion must obey the allowlist above. Prefer clear mobile-friendly
sentences over paragraphs. Use common crop names recognizable to Philippine
users. Use only the fields required by the response schema.
''';

  static String _planningPrompt({
    required Map<String, dynamic> soilData,
    required String readingId,
    required String selectedCrop,
    required String languageCode,
    String? fieldId,
    String? source,
  }) =>
      '''
You are the crop-planning AI component of SoilSense.

${_languageInstruction(languageCode)}

The user selected this SoilSense-supported Philippine crop: "$selectedCrop".
Create a practical plan for that exact crop using the current N, P, K, pH, and
moisture reading. Do not replace it with another crop. Any rotation/cover crop
you mention must also come from this Philippines-supported list:
$_philippineCropListText.

Current month: ${_currentMonthName()}.
General Philippine seasonal context: ${_philippineSeasonContext()}. Seasonal
conditions vary by region. SoilSense has no live weather feed, so never invent
current rainfall, typhoon, temperature, or forecast information. Where weather
matters, tell the user to check a current local forecast before planting.

Reading ID: $readingId
Farm context: Generalized Philippine farm site
Source: ${source ?? 'Unknown'}
Nitrogen: ${soilData['nitrogen']} mg/kg
Phosphorus: ${soilData['phosphorus']} mg/kg
Potassium: ${soilData['potassium']} mg/kg
pH: ${soilData['ph']}
Moisture: ${soilData['moisture']} %
Soil temperature: ${soilData['soilTemperature'] ?? 'Not available'} °C
Electrical conductivity: ${soilData['electricalConductivity'] ?? 'Not available'} µS/cm

Do not claim laboratory certainty. Avoid exact fertilizer rates unless locally
verified. Keep each field to one short sentence or phrase whenever possible.
Avoid paragraphs and repeated explanations. Use only the fields required by
the response schema.
''';

  static Map<String, dynamic> _recommendationResponseSchema() {
    final properties = <String, dynamic>{};
    for (final key in _recommendationRequiredKeys) {
      properties[key] = <String, dynamic>{
        'type': 'string',
        'description': _recommendationDescription(key),
      };
    }
    return <String, dynamic>{
      'type': 'object',
      'properties': properties,
      'required': _recommendationRequiredKeys,
    };
  }

  static Map<String, dynamic> _planningResponseSchema() {
    final properties = <String, dynamic>{};
    for (final key in _planningRequiredKeys) {
      properties[key] = <String, dynamic>{
        'type': 'string',
        'description': _planningDescription(key),
      };
    }
    return <String, dynamic>{
      'type': 'object',
      'properties': properties,
      'required': _planningRequiredKeys,
    };
  }

  static String _recommendationDescription(String key) {
    switch (key) {
      case 'soilSummary':
        return 'A clear 1–2 sentence summary of the overall soil condition, mentioning the most important abnormal or balanced measurements.';
      case 'fertilityInterpretation':
        return 'A clear 1–2 sentence fertility interpretation that connects the measured N, P, K, pH, or moisture values to the main deficiency, excess, or imbalance.';
      case 'cropSuggestion':
        return 'Up to five crop names only, comma-separated, and only from the SoilSense suitable-crop allowlist supplied in the prompt. Empty when no crop is suitable.';
      case 'cropReasoning':
        return 'One or two concise sentences explaining why the leading crops fit the current soil values and any important limitations.';
      case 'fertilizerAdvice':
        return 'One or two practical fertilizer or nutrient-management sentences tied to the measured nutrient levels, without unverified exact application rates.';
      case 'soilManagement':
        return 'One or two practical soil-management sentences tied to pH, moisture, nutrient balance, or other relevant measured conditions.';
      case 'whenToAct':
        return 'A concise priority and timing statement explaining what should be addressed first and when to reassess or scan again.';
      case 'reportSummary':
        return 'Two or three short sentences suitable for a SoilSense PDF executive summary.';
      default:
        return 'Concise SoilSense guidance.';
    }
  }

  static String _planningDescription(String key) {
    switch (key) {
      case 'planningGuidance':
        return 'One concise planning sentence for the exact selected crop.';
      case 'planningWindow':
        return 'Concise planting-window guidance for the selected crop.';
      case 'planningSeason':
        return 'Preferred Philippine season/climate timing for the selected crop; do not invent live weather.';
      case 'planningMaturity':
        return 'Typical days-to-maturity range with a variety/weather caveat.';
      case 'planningHarvest':
        return 'Expected harvest timing relative to planting.';
      case 'planningHarvestNote':
        return 'One short harvest-readiness note.';
      case 'planningWaterGuidance':
        return 'One short irrigation or water requirement statement.';
      case 'planningWaterAction':
        return 'One short water action based on current moisture.';
      case 'planningBeforePlanting':
        return 'One concise action before planting.';
      case 'planningAtPlanting':
        return 'One concise action at planting.';
      case 'planningMonitoring':
        return 'One concise monitoring action during growth.';
      case 'planningBeforeHarvest':
        return 'One concise action before harvest.';
      case 'rotationCrop1':
      case 'rotationCrop2':
      case 'rotationCrop3':
        return 'A rotation crop name only from the approved Philippines-supported SoilSense crop library: $_philippineCropListText.';
      case 'rotationReason1':
      case 'rotationReason2':
      case 'rotationReason3':
        return 'A short reason for the corresponding rotation crop.';
      case 'soilManagement':
        return 'One concise soil-management action for the selected crop.';
      case 'whenToAct':
        return 'A short priority or timing statement for the selected crop.';
      default:
        return 'Concise crop-planning guidance.';
    }
  }

  static String _buildCacheKey({
    required Map<String, dynamic> soilData,
    required String readingId,
    required String languageCode,
    String? fieldId,
    String? focusCrop,
  }) {
    return <Object?>[
      readingId,
      fieldId ?? '',
      soilData['nitrogen'],
      soilData['phosphorus'],
      soilData['potassium'],
      soilData['ph'],
      soilData['moisture'],
      (focusCrop ?? '').trim().toLowerCase(),
      languageCode == 'fil' ? 'fil' : 'en',
    ].join('|');
  }

  static String? _extractInteractionsText(Map<String, dynamic> body) {
    final direct = body['output_text'];
    if (direct is String && direct.trim().isNotEmpty) {
      return direct.trim();
    }

    final chunks = <String>[];
    final steps = body['steps'];
    if (steps is List) {
      for (final step in steps) {
        if (step is! Map) continue;
        final type = (step['type'] ?? '').toString();
        if (type.isNotEmpty && type != 'model_output') continue;
        final content = step['content'];
        if (content is! List) continue;
        for (final part in content) {
          if (part is Map && part['text'] is String) {
            final value = (part['text'] as String).trim();
            if (value.isNotEmpty) chunks.add(value);
          }
        }
      }
    }

    // Compatibility with the pre-June-2026 Interactions response shape.
    final outputs = body['outputs'];
    if (chunks.isEmpty && outputs is List) {
      for (final output in outputs) {
        if (output is! Map) continue;
        if (output['text'] is String) {
          final value = (output['text'] as String).trim();
          if (value.isNotEmpty) chunks.add(value);
        }
        final content = output['content'];
        if (content is List) {
          for (final part in content) {
            if (part is Map && part['text'] is String) {
              final value = (part['text'] as String).trim();
              if (value.isNotEmpty) chunks.add(value);
            }
          }
        }
      }
    }

    return chunks.isEmpty ? null : chunks.join('\n').trim();
  }

  static String? _extractGenerateContentText(Map<String, dynamic> body) {
    final candidates = body['candidates'];
    if (candidates is! List || candidates.isEmpty) return null;

    final chunks = <String>[];
    for (final candidate in candidates) {
      if (candidate is! Map) continue;
      final content = candidate['content'];
      if (content is! Map) continue;
      final parts = content['parts'];
      if (parts is! List) continue;
      for (final part in parts) {
        if (part is Map && part['text'] is String) {
          chunks.add(part['text'] as String);
        }
      }
    }
    return chunks.isEmpty ? null : chunks.join('\n').trim();
  }

  static Future<http.Response> _runSerializedHttpRequest(
    Future<http.Response> Function() request,
  ) {
    final completer = Completer<http.Response>();

    Future<void> run() async {
      try {
        final last = _lastNetworkRequestAt;
        if (last != null) {
          final elapsed = DateTime.now().difference(last);
          final remaining = _minimumRequestSpacing - elapsed;
          if (!remaining.isNegative && remaining.inMilliseconds > 0) {
            await Future<void>.delayed(remaining);
          }
        }
        _lastNetworkRequestAt = DateTime.now();
        final response = await request();
        completer.complete(response);
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    }

    _networkQueue = _networkQueue.then<void>(
      (_) => run(),
      onError: (_) => run(),
    );
    return completer.future;
  }

  static Future<void> _ensurePersistentCacheLoaded() {
    if (_persistentCacheLoaded) return Future<void>.value();
    final existing = _persistentCacheLoading;
    if (existing != null) return existing;

    final future = () async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final raw = prefs.getString(_persistentCachePrefsKey);
        if (raw == null || raw.trim().isEmpty) return;
        final decoded = jsonDecode(raw);
        if (decoded is! Map) return;

        for (final entry in decoded.entries) {
          if (entry.value is! Map) continue;
          final value = Map<String, dynamic>.from(entry.value as Map);
          final adviceRaw = value['advice'];
          if (adviceRaw is! Map) continue;
          final advice = Map<String, dynamic>.from(adviceRaw);
          if (advice.isEmpty) continue;
          _cache[entry.key.toString()] = GeminiAiResult(
            status: GeminiAiStatus.ready,
            message: 'AI guidance restored from this device cache.',
            advice: advice,
            model: (value['model'] ?? '').toString(),
            fromCache: true,
          );
        }

        while (_cache.length > _maxPersistentCacheEntries) {
          _cache.remove(_cache.keys.first);
        }
      } catch (error) {
        debugPrintGemini('Gemini local cache load skipped: $error');
      } finally {
        _persistentCacheLoaded = true;
        _persistentCacheLoading = null;
      }
    }();

    _persistentCacheLoading = future;
    return future;
  }

  static Future<void> _persistSuccessfulCache() async {
    try {
      final payload = <String, dynamic>{};
      for (final entry in _cache.entries) {
        final result = entry.value;
        if (!result.isSuccess || result.advice == null) continue;
        payload[entry.key] = <String, dynamic>{
          'advice': result.advice,
          'model': result.model ?? '',
        };
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_persistentCachePrefsKey, jsonEncode(payload));
    } catch (error) {
      debugPrintGemini('Gemini local cache save skipped: $error');
    }
  }

  static int? _extractRetryDelaySeconds(http.Response response) {
    final header = response.headers['retry-after'];
    final headerSeconds = int.tryParse(header ?? '');
    if (headerSeconds != null && headerSeconds > 0) return headerSeconds;

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map || decoded['error'] is! Map) return null;
      final error = decoded['error'] as Map;
      final details = error['details'];
      if (details is! List) return null;
      for (final detail in details) {
        if (detail is! Map) continue;
        final retryDelay = detail['retryDelay']?.toString() ?? '';
        final match = RegExp(r'(\d+)s').firstMatch(retryDelay);
        if (match != null) {
          final seconds = int.tryParse(match.group(1) ?? '');
          if (seconds != null && seconds > 0) return seconds;
        }
      }
    } catch (_) {}
    return null;
  }

  static bool _looksLikeDailyQuota(String body) {
    final lower = body.toLowerCase();
    return lower.contains('perday') ||
        lower.contains('per day') ||
        lower.contains('requestsperday') ||
        lower.contains('daily quota') ||
        lower.contains('rpd');
  }

  static String _extractApiError(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['error'] is Map) {
        final error = decoded['error'] as Map;
        return (error['message'] ?? error['status'] ?? '').toString();
      }
    } catch (_) {}
    return '';
  }

  static bool _hasText(Map<String, dynamic> value, String key) {
    return value[key] is String && (value[key] as String).trim().isNotEmpty;
  }

  static Map<String, dynamic>? _parseJsonObject(String text) {
    String candidate = text.trim();
    if (candidate.startsWith('```')) {
      candidate = candidate.replaceFirst(RegExp(r'^```(?:json)?\s*'), '');
      candidate = candidate.replaceFirst(RegExp(r'\s*```$'), '');
    }

    try {
      final decoded = jsonDecode(candidate);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {
      final start = candidate.indexOf('{');
      final end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          final decoded = jsonDecode(candidate.substring(start, end + 1));
          if (decoded is Map) return Map<String, dynamic>.from(decoded);
        } catch (_) {}
      }
    }
    return null;
  }

  static void debugPrintGemini(String message) {
    // Kept as print instead of Flutter debugPrint so this service can remain
    // independent from UI imports. It only prints diagnostics, never the key.
    // ignore: avoid_print
    print('[SoilSense Gemini] $message');
  }
}

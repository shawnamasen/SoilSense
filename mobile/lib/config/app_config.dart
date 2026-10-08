class AppConfig {
  static const String appName = 'SoilSense';
  static const String appVersion = '4.4.4';
  static const String environment = 'live';

  // Local demonstration only. Supply --dart-define=GEMINI_API_KEY=... at build time.
  // Client-compiled keys can be extracted from the APK; production use requires
  // a trusted backend proxy and server-side rate limiting.
  static const String geminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );
  static const String geminiModel = 'gemini-3.5-flash-lite';
  static const String geminiFallbackModel = 'gemini-3.8-flash';

  // Firebase Collections
  static const String usersCollection = 'users';
  static const String soilReadingsCollection = 'soil_readings';
  static const String soilAnalysesCollection = 'soil_analyses';
  static const String alertsCollection = 'alerts';
  static const String reportsCollection = 'reports';
  static const String fieldsCollection = 'fields';

  // Nutrient thresholds
  static const Map<String, Map<String, double>> nutrientThresholds = {
    'nitrogen': {'low': 40, 'optimal': 70, 'high': 100},
    'phosphorus': {'low': 50, 'optimal': 80, 'high': 120},
    'potassium': {'low': 100, 'optimal': 200, 'high': 300},
    'ph': {'low': 5.5, 'optimal': 7.0, 'high': 7.5},
    'moisture': {'low': 40, 'optimal': 70, 'high': 90},
  };
}

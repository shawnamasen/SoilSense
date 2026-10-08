# Security review for publishing SoilSense

## Already handled in this prepared repository

- Removed the hardcoded Gemini key from `mobile/lib/config/app_config.dart` while retaining an optional local `--dart-define` configuration hook.
- Added web `.env.example` without credentials; repo ignores real `.env` values.
- Unified the mobile and web Firestore rules into one source of truth to avoid destructive rule deployments.
- Ignored signing keys, service-account JSON, generated builds and local environments.

## Outstanding items — do not claim production security

1. **Rotate the previously committed/embedded Gemini key immediately.** It was in the uploaded mobile source; a clean archive cannot revoke it. Remove it from existing remote Git history if ever published, but still rotate it.
2. **Mobile AI API key exposure.** `--dart-define` inserts strings into client binaries, which can be reverse-engineered. Use an authenticated backend relay, abuse controls, usage quotas and authorization checks before distributing a public APK. The current backend does **not** provide that relay.
3. **Unauthenticated ESP32 write path.** The current firmware creates soil readings and updates device status via unauthenticated REST calls. Firestore rules validate shape and current-owner selection, but another party could forge a conforming request. A secure future version needs per-device identity and a trusted ingestion service, plus coordinated Firebase rules and firmware changes. Do not simply turn off the current write rule without modifying the device, or uploads will stop.
4. **Admin privilege lifecycle.** Verify how the first `admin` account gets assigned; control admin role changes carefully, and assess deletion/privilege escalation through Firebase rules. Never place a Firebase Admin SDK service account in frontend or mobile code.
5. **Firebase client settings.** Firebase `apiKey`, `appId` and `google-services.json` are not service-account secrets, but still apply API restrictions, authorized domains and appropriate security rules. App Check helps reduce abuse but is not a substitute for authenticated ingestion.
6. **Release signing and personal data.** The provided Android project currently uses `debug` signing for release builds. Configure private release signing securely. Strip farmer names, locations and user identifiers from screenshots. Review data retention, privacy notices, and export/deletion behavior.
7. **Verification.** Deploy Firestore rules only after testing user, admin, current-owner, previous-owner, logged-out and invalid-write cases in the Firebase Emulator Suite. Static inspection does not prove correctness.

## Account cleanup and saved AI results

The web admin account-cleanup operation includes the `ai_results` collection in its owned-record deletion list. The shared rules allow *admins only* to query those records for cleanup; mobile accounts still cannot list `ai_results`. Review any remaining support-ticket/audit retention obligations separately.

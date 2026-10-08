# SoilSense setup and deployment guide

This guide explains how to run the SoilSense project locally and how to make the full system work end to end.

## 1. Prerequisites

Install these tools first:

- Git
- Flutter SDK
- Android SDK
- Node.js and npm
- Arduino IDE
- ESP32 board support for Arduino IDE
- Firebase CLI

You also need access to a Firebase project and, if you want AI guidance, a Gemini API key.

## 2. Project structure

```text
SoilSense/
├── mobile/
├── web/
│   ├── frontend/
│   └── backend/
├── iot/
├── docs/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
└── storage.rules
```

## 3. Firebase setup

From the repository root:

```bash
firebase login
firebase use soilsense-db59e
firebase deploy --only firestore:rules,firestore:indexes,storage
```

If you are using another Firebase project, update the project selection first.

### Important

Keep the Firebase settings synchronized across:
- `mobile/lib/firebase_options.dart`
- `mobile/android/app/google-services.json`
- `web/frontend/.env`
- any ESP32 firmware settings that rely on the same Firebase project

## 4. Web platform setup

### Frontend

```bash
cd web/frontend
cp .env.example .env
npm ci
npm run dev
```

Populate the Firebase values in `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL` (optional)

For a production build:

```bash
npm run build
npm run preview
```

### Optional backend

```bash
cd web/backend
cp .env.example .env
node server.js
```

## 5. Mobile app setup

```bash
cd mobile
flutter pub get
flutter run
```

If using AI features in development:

```bash
flutter run --dart-define=GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

To build an APK:

```bash
flutter build apk
```

## 6. ESP32 firmware setup

Open this file in Arduino IDE:

```text
iot/esp32_soilsense/esp32_soilsense.ino
```

### Hardware notes

The firmware is built for an ESP32 with an RS485 soil sensor setup.

Typical pin usage in this project:
- RX2 → GPIO 16
- TX2 → GPIO 17
- RE/DE → GPIO 4
- START button → GPIO 27
- STOP button → GPIO 14
- Blue LED → GPIO 25
- Yellow LED → GPIO 26
- Green LED → GPIO 33
- Red LED → GPIO 32

Verify your wiring and voltage requirements before powering the sensor or board.

## 7. Recommended order to make the project work

For the smoothest setup, follow this order:

1. Clone the repository.
2. Deploy the Firebase rules, indexes, and storage rules.
3. Configure the web frontend `.env`.
4. Verify mobile Firebase files.
5. Run the web frontend.
6. Run the mobile app.
7. Upload the firmware to the ESP32.
8. Use the web admin to assign the device owner.
9. Use the mobile app to set up Wi-Fi on the device.
10. Start a scan and verify the result reaches Firestore.
11. Check the mobile app and web admin for synchronized data.

## 8. Deployment notes

### Web deployment on Vercel

Use these settings:
- Root directory: `web/frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

After deployment, add the deployed domain to Firebase Authentication authorized domains.

### Mobile distribution

Generate an APK locally and configure release signing before distribution.

### Production caution

The current project is an academic prototype. Review authentication, device security, and API-key exposure carefully before public production deployment.

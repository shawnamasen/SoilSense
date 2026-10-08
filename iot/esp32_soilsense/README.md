# SoilSense ESP32 firmware

Open `esp32_soilsense.ino` in Arduino IDE with the ESP32 board package installed.

The firmware communicates with the RS485 soil sensor and Firestore over Wi-Fi. Keep the Firebase project/path constants in sync with your deployment. See `docs/SETUP.md` for the wiring used by this version.

**Security warning:** Current firmware sends unauthenticated REST writes and relies on constrained Firestore rules. Do not consider this design tamper-proof or suitable for a public multi-tenant production deployment. Migrating to per-device authentication requires coordinated firmware and rule updates.

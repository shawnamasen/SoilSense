# SoilSense Admin Web — Final Defense Build

This package contains the SoilSense public landing page and administrator-only web portal. Farmers and technicians remain mobile-app users; the web portal is for system administration, device ownership, support, aggregate analytics, and audit review.

## Final admin experience

The admin portal is now connected to the same Firestore model used by the final SoilSense mobile/ESP32 build. The earlier mock operational records were removed from active admin pages.

### Dashboard
- Live mobile-account totals and active-account count
- Real completed-scan count for the last 24 hours and all time
- Real report count
- Live device online/offline state using the final **60-second heartbeat threshold**
- Current single-owner assignment
- Live RSSI quality
- Device Health card with scan state, configured duration, heartbeat, latest completed scan, firmware metadata, and hardware fingerprint
- Needs Attention panel derived from real system state
- Recent administrator audit activity

### Farmer Management
- Live `users` collection
- Search and filters for account status, role, and device ownership
- Per-account private scan/report/alert/field counts (counts only)
- Edit display name
- Farmer/Technician role changes
- Activate/deactivate accounts
- Filtered CSV export
- Account-data deletion with confirmation and deletion tombstone
- Pagination follows the administrator's saved items-per-page preference

### Device Management
- Live `system/device_status`, `system/device_assignment`, and `system/scan_settings`
- 60-second offline threshold
- Online/offline, RSSI, heartbeat age, scan state, scan duration, Wi-Fi setup state, and hardware fingerprint
- Latest completed-scan metadata and firmware version without showing private nutrient values
- Exactly one Owner at a time
- Custom confirmation dialog before ownership reassignment or unassignment
- Existing private readings remain with their original account when ownership changes

### Support & Diagnostics
- Real Firestore-backed `support_tickets` collection
- Create internal/admin support tickets
- Optional link to an existing farmer/technician account
- Category, priority, status, description, and administrator notes
- Live device/ownership diagnostics that can be turned into a support ticket
- Open / In Progress / Resolved / Closed workflow
- Email Requester opens the administrator's local mail client; the portal does **not** falsely claim to send email automatically
- Ticket changes are recorded in the audit log

### Reports & Analytics
- No invented device/farmer totals
- Real aggregate metrics from Firestore
- Total scans, scans in 24 hours / 7 days / 30 days
- Active/inactive mobile accounts and role distribution
- Reports generated and alert counts
- Open support-ticket count
- Seven-day completed-scan chart
- Scan activity by time-of-day buckets
- Current operational snapshot
- CSV export
- Individual NPK, pH, moisture, temperature, and EC values are intentionally not shown on the admin analytics page

### Admin Activity
- Searchable audit trail
- Action filter
- Pagination
- CSV export
- Ownership, account, support, and settings changes are included

### Settings
- Persistent per-admin Dark Mode
- Persistent table page-size preference (10 / 20 / 50)
- Persistent in-app portal alert preferences
- Portal bell menu for device-offline, missing-owner, support, and inactive-account alerts
- Firebase password-reset flow
- Data/privacy behavior summary

### Navigation cleanup
The mock/demo **Business & Distribution** admin section was removed from the active admin navigation because it used proposed business values rather than operational Firestore data. The public landing page can still present the project's business concept separately.

## Firebase compatibility

The included `firestore.rules` are based on the latest SoilSense mobile rules and retain support for:
- mobile user app preferences (Dark Mode and English/Filipino)
- `scanning` and `scanDurationSeconds` in `system/device_status`
- `system/scan_settings`
- current-owner privacy
- private user readings and reports

The web package additionally adds secure admin-only rules for:
- `admin_preferences/{adminUid}`
- `support_tickets/{ticketId}`

`firebase.json` and `.firebaserc` are included for the SoilSense Firebase project.

From the `soilsense_web` folder, deploy the updated rules with:

```powershell
firebase deploy --only firestore:rules
```

## Run on Windows

From `frontend`:

```powershell
npm install
npm run dev
```

For a production check:

```powershell
npm run build
npm run preview
```

The provided Windows batch launchers can also be used after dependencies are installed.

## Important security note

Firebase Admin/service-account private keys must never be placed in the frontend. The browser therefore cannot securely delete another person's Firebase Authentication identity. The portal's account deletion removes SoilSense Firestore application data and creates a `deleted_accounts/{uid}` tombstone. If the Firebase Authentication identity itself must also be removed, do that from a trusted Firebase Admin environment or Firebase Console.

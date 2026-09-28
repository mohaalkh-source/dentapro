# DentaPro Production Release v1.0

## Release scope

This release is based on Release Candidate v4 and preserves the existing DentaPro UI and business flows while hardening the production boundary.

### Included
- Cloud Function order creation remains the authoritative source for price, discount, delivery and stock.
- Public order tracking validates order ID + phone on the server and does not expose raw Firestore documents to the browser.
- CSP allows the deployed Cloud Functions endpoint and the OpenStreetMap frame used by the store.
- Security response headers include X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and HSTS.
- Firestore rules are explicitly wired through firebase.json.
- Customer-side bridges for Cloudinary optimization and non-authoritative discount preview prevent the runtime errors observed in RC testing.
- Notification code uses ServiceWorkerRegistration.showNotification where supported.
- Server-side order input length limits are enforced for clinic, doctor, phone and address.

## Required deployment validation
1. Deploy Firestore Rules and Cloud Functions from the Firebase project intended for production.
2. Deploy Firebase Hosting from this directory.
3. Test guest order tracking with a valid phone and with an invalid phone.
4. Test signed-in order creation, duplicate submission, stock deduction and discount calculation.
5. Test admin product upload, FCM permission flow, map iframe and mobile layouts.
6. Confirm browser Console has no uncaught exceptions on home, product, cart, checkout and order tracking.

## Important
This archive is a production candidate package, not evidence that the remote Firebase project has been deployed or that third-party services have been authenticated. Those are environment-level release checks.

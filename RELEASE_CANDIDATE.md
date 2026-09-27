# DentaPro Release Candidate — Critical Fixes

## Implemented
1. CSP: added `https://*.cloudfunctions.net` to `connect-src` and `https://www.openstreetmap.org` to `frame-src` in both Firebase Hosting headers and the HTML meta CSP.
2. Guest tracking: removed direct Firestore `get` access for guest orders/quotes. Added callable `trackPublicOrder` that verifies `orderId + phone` on the server and returns only public tracking fields.
3. Output hardening: escaped the audited dynamic HTML sinks for user name, quick-order error message, and product badge. Guest tracking output also escapes dynamic values.
4. Firebase wiring: exposed the new callable as `_fbTrackPublicOrderFn`.

## Verification performed
- Node syntax checks passed for the modified Cloud Function and client files.
- Firestore rules no longer allow direct `get` of guest orders/quotes.
- Both CSP definitions contain the Cloud Functions and OpenStreetMap allowances.

## Required before production
- Deploy Functions and Firestore Rules to the intended Firebase project.
- Test guest order tracking with correct and incorrect phone numbers.
- Test authenticated order tracking and quote tracking.
- Test createOrder from the published Firebase Hosting URL.
- Verify the OpenStreetMap iframe after deployment.
- Run a full acceptance test for auth, checkout, stock, discounts, points, Cloudinary, FCM, and mobile layouts.

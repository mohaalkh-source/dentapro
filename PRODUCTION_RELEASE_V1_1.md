# DentaPro Production Release v1.1

## Final security fix

This release closes the remaining high-priority quote-conversion issue identified in the production audit.

### Guest quote ownership
- Guest quote conversion now requires the submitted phone number to match the phone stored on the accepted quote after normalization.
- Authenticated quote conversion requires the quote `clientUid` to match the authenticated user.
- `clientEmail == "guest"` is no longer treated as proof of ownership.

### Quote item integrity
- When converting an accepted quote, the server ignores the client's `items` list.
- Order items are rebuilt exclusively from the accepted quote document.
- Quote quantities and unit prices are validated server-side.
- Quote prices are treated as negotiated prices and are not subjected to a second general discount.
- Quote delivery fees are taken from the accepted quote when already determined; otherwise delivery is resolved server-side.
- Quote conversion is forced to money payment; client input cannot switch an accepted quote to points payment.
- Standard quote products still undergo server-side existence and stock validation.

## Verification performed
- `node --check` passed for all JavaScript files in the package.
- `firebase.json` and local Firestore rules remain included.
- Existing CSP/security hardening from v1.0 is retained.

## Publish checklist

1. Deploy Firestore Rules and Cloud Functions from the included `firebase.json`.
2. Deploy Firebase Hosting.
3. Test a guest quote with the correct phone: conversion must succeed.
4. Test the same quote with a wrong phone: conversion must fail.
5. Modify the browser request `items`: the server must still create the order from the stored quote only.
6. Try converting the same quote twice: the second attempt must fail.
7. Test an authenticated quote belonging to another account: conversion must fail.
8. Test stock exhaustion during quote conversion.
9. Test Cloudinary, FCM and GPS on real devices.
10. Inspect the production browser console and Firebase Functions logs.

This archive is source-ready for production deployment, but the live Firebase project must still be deployed and acceptance-tested before public launch.

# DentaPro Security Hardening

تم في هذه النسخة:
- تفعيل إنشاء الطلبات عبر Cloud Function `createOrder` فقط.
- إضافة `idempotencyKey` لمنع تكرار الطلب عند إعادة المحاولة.
- منع المتصفح من إنشاء مستندات `orders` مباشرة.
- منع العميل من تعديل مخزون المنتجات مباشرة؛ تعديل المخزون يتم من الخادم.
- حماية `store_data/custom_discount_settings` من القراءة العامة.
- إضافة قواعد آمنة لـ `fcm_tokens`.
- ربط `Firestore Rules` داخل `firebase.json` للنشر.

## مهم قبل النشر
1. انشر Cloud Functions وFirestore Rules.
2. اختبر إنشاء طلب لعميل مسجل وزائر.
3. اختبر قبول عرض سعر وتحويله إلى طلب.
4. اختبر خصم مخصص، التوصيل، ونقص المخزون.
5. راجع Cloud Functions logs بعد أول طلبات إنتاجية.

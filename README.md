# DentaPro

DentaPro هو متجر ثابت لمستلزمات طب الأسنان مبني على HTML وCSS وJavaScript في المتصفح، مع Firebase Authentication/Firestore/Messaging وCloudinary لمعالجة صور المنتجات.

## التشغيل المحلي. 

يمكن تشغيل المشروع من أي خادم ملفات ثابت، لأن JavaScript يستخدم الوحدات القياسية ومسارات نسبية. مثال باستخدام خادم Python:

```bash
python3 -m http.server 4173
```

ثم افتح `http://localhost:4173/`. لا تفتح `index.html` مباشرة عبر `file://` لأن المتصفح يمنع بعض imports والوصول إلى Firebase في هذا الوضع.

## بنية المشروع

يحتوي `index.html` على هيكل الواجهة فقط تقريبًا، بينما توجد قواعد CSS في ملفاتها الوظيفية داخل `css/`. نقطة الدخول هي `js/app.js`، وتوجد تهيئة Firebase في `js/firebase/firebase-init.js` مع واجهة خدمات مشتركة في `js/firebase/firebase-services.js`. ملفات المنتجات والسلة والطلبات والإدارة والرسائل والموقع والتنقل تحتوي على المنطق الفعلي لكل نطاق وتحافظ على ترتيب التهيئة المطلوب للتوافق مع HTML الحالي.

## Firebase

توجد إعدادات Firebase الحالية في `js/firebase/firebase-init.js` كما كانت في المشروع الأصلي. لا تغيّر أسماء collections أو الحقول أو document IDs. يجب أن تبقى Firestore Security Rules هي طبقة الحماية الحقيقية، ولا يجب اعتبار JavaScript في الواجهة حدًا أمنيًا.

## Cloudinary

توجد ثوابت Cloudinary ودوال الرفع والتحسين داخل `js/admin/products.js`. يجب الحفاظ على Upload Preset وإعدادات Cloudinary الحالية، وعدم إضافة مفاتيح سرية أو Service Account credentials إلى ملفات الواجهة.

## النشر

يمكن رفع محتويات المجلد مباشرة إلى GitHub Pages أو Firebase Hosting أو أي static hosting. تأكد من نشر `index.html` و`manifest.json` و`favicon.ico` ومجلدي `css/` و`js/` مع الحفاظ على حالة الأحرف في أسماء الملفات.

## التحقق

شغّل `node --check` على ملفات JavaScript قبل النشر، ثم اختبر تسجيل الدخول والمنتجات والسلة والطلبات والإدارة والرسائل والموقع على بيئة اختبار متصلة بـ Firebase. اختبارات الكتابة والعمليات الإدارية تتطلب حسابات اختبار مناسبة وصلاحيات Firestore صحيحة.

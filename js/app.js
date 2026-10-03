import { APP_CONFIG } from './config.js';
import { APP_NAME } from './constants.js';
import { setState } from './state.js';
import { wait } from './utils.js';
import { waitForFirebase } from './firebase/firebase-services.js';

const CORE_SCRIPTS = [
  './js/products/products.js',
  './js/cart/cart.js',
  './js/location/location.js',
  './js/ui/navigation.js',
  './js/user/auth-ui.js',
  // وظائف الطلبات وطلب عرض السعر مطلوبة من واجهة العميل أيضاً،
  // وليست خاصة بلوحة الإدارة. كانت محمّلة سابقاً للأدمن فقط،
  // لذلك كانت أزرار العميل تستدعي دوال غير موجودة وتبدو وكأنها لا تعمل.
  './js/orders/checkout.js',
  './js/orders/orders.js',
];

// ملفات لوحة الإدارة فقط — لا تُحمّل للعميل العادي.
const ADMIN_SCRIPTS = [
  './js/admin/products.js',
  './js/admin/clients.js',
  './js/messages/messages.js',
  './js/admin/admin.js',
];

const DOMAIN_SCRIPTS = [...CORE_SCRIPTS, ...ADMIN_SCRIPTS]; // يبقى للتوافق مع أي كود يستورد هذا الاسم

function loadDomainScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadDomainScriptOrdered(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // يحافظ على ترتيب التنفيذ الأصلي، بس التحميل نفسه يصير بالتوازي
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

await Promise.all(CORE_SCRIPTS.map(loadDomainScriptOrdered));

// ── تحميل كود لوحة الإدارة (ADMIN_SCRIPTS) فقط إذا كان المستخدم Staff ──
// نتحقق أولاً من الجلسة المحلية الفورية (بلا انتظار شبكة) لتفادي أي تأخير محسوس
// لأدمن يفتح الموقع، ثم نُثبّت القرار لاحقاً عبر onAuthStateChanged الحقيقي في firebase-init.js
let _adminScriptsLoaded = false;
let _adminScriptsLoadingPromise = null;

function loadAdminScriptsOnce() {
  if (_adminScriptsLoaded) return Promise.resolve();
  if (_adminScriptsLoadingPromise) return _adminScriptsLoadingPromise;
  _adminScriptsLoadingPromise = Promise.all(ADMIN_SCRIPTS.map(loadDomainScriptOrdered)).then(() => {
    _adminScriptsLoaded = true;
    document.dispatchEvent(new CustomEvent('dp:admin-scripts-ready'));
  }).catch(err => {
    console.error('فشل تحميل كود لوحة الإدارة:', err);
    _adminScriptsLoadingPromise = null; // يسمح بإعادة المحاولة لاحقاً
  });
  return _adminScriptsLoadingPromise;
}
window.loadAdminScriptsOnce = loadAdminScriptsOnce; // متاحة لـ firebase-init.js وأي كود آخر يحتاج التأكد من جاهزيتها

// فحص أولي سريع من الجلسة المحلية المحفوظة (currentUser تُضبط في auth-ui.js أعلاه بشكل متزامن)
if (typeof window.currentUser !== 'undefined' && window.currentUser &&
    (window.currentUser.role === 'admin' || window.currentUser.role === 'manager')) {
  loadAdminScriptsOnce();
}

// لا ننتظر Firebase أو تهيئة المنتجات قبل إخفاء شاشة البداية.
// أي تأخير أو خطأ في الشبكة يجب ألا يمنع المستخدم من دخول الصفحة الرئيسية.
if (typeof window.initializeProductsModule === 'function') {
  window.initializeProductsModule().catch(err => console.error('Products init:', err));
}

// مؤقت أمان مستقل عن Firebase والمنتجات لإخفاء شاشة البداية دائماً.
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => splash.remove(), 500);
  }
}, 450);

await waitForFirebase();
setState({ initialized: true });
document.documentElement.dataset.app = APP_NAME;
document.documentElement.dataset.language = APP_CONFIG.defaultLanguage;
await wait(0);

export { DOMAIN_SCRIPTS, loadDomainScript };

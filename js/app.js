import { APP_CONFIG } from './config.js';
import { APP_NAME } from './constants.js';
import { setState } from './state.js';
import { wait } from './utils.js';
import { waitForFirebase } from './firebase/firebase-services.js';

const DOMAIN_SCRIPTS = [
  './js/products/products.js',
  './js/cart/cart.js',
  './js/location/location.js',
  './js/ui/navigation.js',
  './js/user/auth-ui.js',
  './js/admin/products.js',
  './js/orders/checkout.js',
  './js/orders/orders.js',
  './js/admin/clients.js',
  './js/messages/messages.js',
  './js/admin/admin.js',
  './js/ui/appendix.js',
];

function loadDomainScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// لا تسمح شاشة البدء بفشل وحدة اختيارية أو مشكلة شبكة بمنع دخول المتجر.
// في الحالة الطبيعية يبقى نفس الانتقال البصري الحالي، وهذا مؤقت أمان إضافي فقط.
let splashHidden = false;
function hideSplashScreen() {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.style.visibility = 'hidden';
  setTimeout(() => splash.remove(), 500);
}
const splashFailsafeTimer = setTimeout(hideSplashScreen, 1500);

for (const src of DOMAIN_SCRIPTS) {
  try {
    await loadDomainScript(src);
  } catch (err) {
    // فشل وحدة فرعية لا يجب أن يحجب الصفحة الرئيسية أو الوحدات الأخرى.
    console.error('Domain script load failed:', src, err);
  }
}

// لا ننتظر Firebase أو تهيئة المنتجات قبل إخفاء شاشة البداية.
// أي تأخير أو خطأ في الشبكة يجب ألا يمنع المستخدم من دخول الصفحة الرئيسية.
if (typeof window.initializeProductsModule === 'function') {
  window.initializeProductsModule().catch(err => console.error('Products init:', err));
}

// المسار الطبيعي يحافظ على زمن الإخفاء الأصلي تقريباً، مع إلغاء المؤقت الاحتياطي.
clearTimeout(splashFailsafeTimer);
setTimeout(hideSplashScreen, 450);

await waitForFirebase();
setState({ initialized: true });
document.documentElement.dataset.app = APP_NAME;
document.documentElement.dataset.language = APP_CONFIG.defaultLanguage;
await wait(0);

export { DOMAIN_SCRIPTS, loadDomainScript };

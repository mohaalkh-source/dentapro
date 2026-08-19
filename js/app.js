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

for (const src of DOMAIN_SCRIPTS) {
  await loadDomainScript(src);
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

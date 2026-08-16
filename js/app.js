import './firebase/firebase-init.js';
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

// products.js يُحمّل مبكراً، لكن تهيئته تعتمد على cart/auth/navigation.
// شغّلها بعد اكتمال تحميل جميع الوحدات حتى لا يفوت الرسم الأول للمنتجات.
if (typeof window.initializeProductsModule === 'function') {
  await window.initializeProductsModule();
}

await waitForFirebase();
setState({ initialized: true });
document.documentElement.dataset.app = APP_NAME;
document.documentElement.dataset.language = APP_CONFIG.defaultLanguage;
await wait(0);

// يحافظ على توقيت شاشة البداية حتى عند تحميل الوحدات ديناميكيًا بعد حدث load.
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => splash.remove(), 500);
  }
}, 1200);

export { DOMAIN_SCRIPTS, loadDomainScript };

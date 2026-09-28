import { APP_CONFIG } from './config.js';
import { APP_NAME } from './constants.js';
import { setState } from './state.js';
import { wait } from './utils.js';
import { waitForFirebase } from './firebase/firebase-services.js';

// Core modules needed by every customer. Admin-only modules are loaded on demand.
const CORE_SCRIPTS = [
  './js/products/products.js',
  './js/cart/cart.js',
  './js/location/location.js',
  './js/ui/navigation.js',
  './js/user/auth-ui.js',
  './js/orders/checkout.js',
  './js/orders/orders.js',
  './js/messages/messages.js',
];

const ADMIN_SCRIPTS = [
  './js/admin/products.js',
  './js/admin/clients.js',
  './js/admin/admin.js',
];

const loadedScripts = new Map();
let adminLoadPromise = null;

// Shared browser-safe helpers required by customer modules. These used to live
// inside admin-only modules, which caused runtime errors after admin lazy-loading.
window.cldOptimize = window.cldOptimize || function cldOptimize(url, width) {
  if (!url || typeof url !== 'string' || !url.includes('/upload/')) return url;
  const w = width ? `,w_${width}` : '';
  return url.replace('/upload/', `/upload/f_auto,q_auto${w}/`);
};

// Customer-side discount preview is intentionally non-authoritative. The server
// remains the source of truth for discounts. Admin modules replace this with the
// full calculator when they are loaded. Returning null avoids breaking cart/checkout
// when the admin-only calculator is not present.
window.computeGeneralDiscountForCart = window.computeGeneralDiscountForCart || async function computeGeneralDiscountForCart() {
  return null;
};

function loadDomainScript(src) {
  if (loadedScripts.has(src)) return loadedScripts.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}

async function loadScripts(scripts) {
  // Keep the historical execution order: some extracted modules depend on
  // globals created by earlier modules.
  for (const src of scripts) await loadDomainScript(src);
}

// Called only when a staff member actually opens the admin area.
async function ensureAdminModules() {
  if (adminLoadPromise) return adminLoadPromise;
  adminLoadPromise = loadScripts(ADMIN_SCRIPTS);
  try {
    await adminLoadPromise;
    return true;
  } catch (error) {
    adminLoadPromise = null;
    console.error('Admin modules load:', error);
    throw error;
  }
}

// Auth/navigation are loaded before the admin modules, so provide temporary
// bridges for inline handlers. admin.js replaces these globals with the real
// implementations once it has loaded.
window.ensureAdminModules = ensureAdminModules;
window.openAccountMenu = async function () {
  await ensureAdminModules();
  return window.openAccountMenu?.();
};
window.handleBottomNavAccount = async function () {
  if (window.currentUser && typeof window.isStaff === 'function' && window.isStaff()) {
    await ensureAdminModules();
    return window.handleBottomNavAccount?.();
  }
  if (typeof window.goHome === 'function') return window.goHome();
};

await loadScripts(CORE_SCRIPTS);

if (typeof window.initializeProductsModule === 'function') {
  window.initializeProductsModule().catch(err => console.error('Products init:', err));
}

// Do not block first paint on Firebase or product initialization.
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

export { CORE_SCRIPTS, ADMIN_SCRIPTS, loadDomainScript, ensureAdminModules };

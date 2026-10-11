// رقم الإصدار الموحّد يُؤخذ من رابط app.js نفسه (index.html?v=...) فيُطبَّق على كل الملفات المحمّلة منه
const _V = new URL(import.meta.url).searchParams.get('v');
const _q = _V ? `?v=${encodeURIComponent(_V)}` : '';
const withVersion = (src) => src + _q;

const { APP_CONFIG } = await import(`./config.js${_q}`);
const { APP_NAME } = await import(`./constants.js${_q}`);
const { setState } = await import(`./state.js${_q}`);
const { wait } = await import(`./utils.js${_q}`);
const { waitForFirebase } = await import(`./firebase/firebase-services.js${_q}`);

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
  // الرسائل مطلوبة لواجهة العميل (زر الرسائل وعدّاد الرسائل)، وليست للإدارة فقط
  './js/messages/messages.js',
];

// ملفات لوحة الإدارة فقط — لا تُحمّل للعميل العادي.
const ADMIN_SCRIPTS = [
  './js/admin/products.js',
  './js/admin/clients.js',
  './js/admin/admin.js',
];

const DOMAIN_SCRIPTS = [...CORE_SCRIPTS, ...ADMIN_SCRIPTS]; // يبقى للتوافق مع أي كود يستورد هذا الاسم

function loadDomainScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = withVersion(src);
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadDomainScriptOrdered(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = withVersion(src);
    script.async = false; // يحافظ على ترتيب التنفيذ الأصلي، بس التحميل نفسه يصير بالتوازي
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// تحميل الملفات الأساسية: إن فشل ملف نعيد المحاولة مرة واحدة بعد لحظة، وإن فشل ثانية
// لا نوقف الموقع كله: نسجّل الخطأ ونُظهر رسالة للزائر ونُكمل تشغيل بقية الأجزاء.
function loadCoreWithRetry(src) {
  return loadDomainScriptOrdered(src).catch(() =>
    new Promise(r => setTimeout(r, 800)).then(() => loadDomainScript(src))
  );
}

function showLoadFailureNotice() {
  if (document.getElementById('dpLoadFailureNotice')) return;
  const en = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const box = document.createElement('div');
  box.id = 'dpLoadFailureNotice';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100000;max-width:92vw;' +
    'display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;border-radius:14px;' +
    'background:#fff7ed;border:2px solid #f59e0b;color:#92400e;font:600 13px inherit;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.2)';
  const msg = document.createElement('span');
  msg.textContent = en ? 'Part of the site failed to load. Check your connection and reload.'
                       : 'تعذّر تحميل جزء من الموقع. تحقق من الاتصال ثم أعد التحميل.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = en ? 'Reload' : 'إعادة التحميل';
  btn.style.cssText = 'padding:6px 14px;border:0;border-radius:50px;background:#0b4f75;color:#fff;font:700 12px inherit;font-family:inherit;cursor:pointer';
  btn.onclick = () => location.reload();
  box.append(msg, btn);
  (document.body || document.documentElement).appendChild(box);
}

const _failedCoreScripts = [];
await Promise.all(CORE_SCRIPTS.map(src =>
  loadCoreWithRetry(src).catch(err => { _failedCoreScripts.push(src); console.error(err); })
));
if (_failedCoreScripts.length) showLoadFailureNotice();

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

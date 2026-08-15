// DentaPro domain module: extracted from the original implementation.
// =====================
// DATA
// =====================
var DEFAULT_CATEGORIES = [
  {id:'all',   icon:'🦷', ar:'الكل',              en:'All'},
  {id:'dev',   icon:'🔬', ar:'أجهزة ومعدات',       en:'Devices'},
  {id:'hand',  icon:'🛠️', ar:'أدوات يدوية',        en:'Instruments'},
  {id:'mat',   icon:'💊', ar:'مواد طبية',           en:'Materials'},
  {id:'prot',  icon:'🧤', ar:'الوقاية والتعقيم',    en:'Protection'},
  {id:'ortho', icon:'🦷', ar:'التقويم',             en:'Orthodontics'},
  {id:'impl',  icon:'🏥', ar:'زراعة الأسنان',       en:'Implants'},
  {id:'home',  icon:'🌟', ar:'العناية المنزلية',     en:'Home Care'},
];
// يبني قائمتي الفئات (نموذج المنتج + فلتر جدول الأدمن) من مصفوفة categories الفعلية
function populateCategorySelects() {
  const realCats = categories.filter(c => c.id !== 'all');

  const pCat = document.getElementById('pCat');
  if (pCat) {
    const currentVal = pCat.value;
    pCat.innerHTML = realCats.map(c => `<option value="${c.id}">${escHtml(c.ar)}</option>`).join('');
    if (realCats.find(c => c.id === currentVal)) pCat.value = currentVal;
  }

  const adminFilter = document.getElementById('adminCatFilter');
  if (adminFilter) {
    const currentVal = adminFilter.value || 'all';
    adminFilter.innerHTML = `<option value="all">كل الفئات</option>` +
      realCats.map(c => `<option value="${c.id}">${escHtml(c.ar)}</option>`).join('');
    if (currentVal === 'all' || realCats.find(c => c.id === currentVal)) adminFilter.value = currentVal;
  }
}

function loadCategories() {
  try {
    const saved = localStorage.getItem('dentapro_categories');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {}
  return DEFAULT_CATEGORIES.map(c => ({...c}));
}

async function loadCategoriesFromFirebase() {
  try {
    for (let i = 0; i < 30; i++) {
      if (window._fbDoc2 && window._fbGetDoc) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!window._fbDoc2 || !window._fbGetDoc) return;

    const snap = await window._fbGetDoc(window._fbDoc2('store_data', 'categories'));
    if (snap.exists()) {
      const list = snap.data().list;
      if (Array.isArray(list) && list.length > 0) {
        categories.length = 0;
        list.forEach(c => categories.push(c));
        localStorage.setItem('dentapro_categories', JSON.stringify(categories));
        clearSearchIndex();
        renderCategories();
        populateCategorySelects();
        renderProducts();
        console.log('✅ تم تحميل الأقسام من Firebase:', categories.length);
      }
    }
    // لا نرفع تلقائياً أي شيء؛ فقط نقرأ. الكتابة تتم فقط عند تعديل فعلي من الأدمن.
  } catch(e) {
    console.warn('Firebase loadCategories:', e.message);
  }
}

async function saveCategories() {
  clearSearchIndex();
  try {
    localStorage.setItem('dentapro_categories', JSON.stringify(categories));
  } catch(e) {}
  try {
    for (let i = 0; i < 15; i++) {
      if (window._fbDoc2 && window._fbSetDoc) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await window._fbSetDoc(
      window._fbDoc2('store_data', 'categories'),
      { list: categories, updatedAt: new Date().toISOString() }
    );
  } catch(e) {
    console.warn('Firebase saveCategories:', e.message);
  }
}

var categories = loadCategories();

// ============================
// HERO TITLE — قابل للتعديل من الأدمن (محفوظ في Firestore: store_data/hero_settings)
// ============================
var heroTitleAr = 'كل ما تحتاجه\nلعيادتك في مكان\nواحد';
var heroTitleEn = 'Everything Your Clinic\nNeeds In One\nPlace';

function renderHeroTitle() {
  const el = document.getElementById('heroTitleEl');
  if (!el) return;
  const raw = currentLang === 'en' ? heroTitleEn : heroTitleAr;
  const lines = raw.split('\n');
  const last = lines.pop();
  el.innerHTML = (lines.length ? lines.map(l => escHtml(l)).join('<br>') + '<br>' : '') + `<span>${escHtml(last)}</span>`;
}

async function loadHeroSettings() {
  try {
    if (!await waitForFirebase(15)) return;
    const snap = await window._fbGetDoc(window._fbDoc2('store_data', 'hero_settings'));
    if (snap.exists()) {
      const d = snap.data();
      if (d.titleAr) heroTitleAr = d.titleAr;
      if (d.titleEn) heroTitleEn = d.titleEn;
      renderHeroTitle();
    }
  } catch(e) {
    console.warn('Firebase loadHeroSettings:', e.message);
  }
}

function openHeroTitleEditModal() {
  if (!isAdmin()) { showToast('⛔ هذا القسم خاص بمدير النظام فقط', 'error'); return; }
  document.getElementById('heroTitleArInput').value = heroTitleAr;
  document.getElementById('heroTitleEnInput').value = heroTitleEn;
  document.getElementById('heroTitleEditModal').classList.add('open');
}
function closeHeroTitleEditModal() {
  document.getElementById('heroTitleEditModal').classList.remove('open');
}

async function saveHeroTitle() {
  const ar = document.getElementById('heroTitleArInput').value.trim();
  const en = document.getElementById('heroTitleEnInput').value.trim();
  if (!ar || !en) { showToast('⚠️ الرجاء تعبئة الحقلين', 'error'); return; }
  heroTitleAr = ar;
  heroTitleEn = en;
  renderHeroTitle();
  closeHeroTitleEditModal();
  showToast('✅ تم حفظ التعديل', 'success');
  try {
    for (let i = 0; i < 15; i++) {
      if (window._fbDoc2 && window._fbSetDoc) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await window._fbSetDoc(
      window._fbDoc2('store_data', 'hero_settings'),
      { titleAr: ar, titleEn: en, updatedAt: new Date().toISOString() }
    );
  } catch(e) {
    console.warn('Firebase saveHeroTitle:', e.message);
    showToast('⚠️ تعذّر الحفظ على السحابة، التعديل ظاهر على جهازك فقط الآن', 'error');
  }
}

var DEFAULT_PRODUCTS = [
  {id:1,  cat:'dev',   icon:'🦷', brand:'ADEC',       ar:'كرسي أسنان احترافي A-dec 500',           en:'A-dec 500 Professional Dental Chair',     price:18500, old:21000, desc_ar:'كرسي متكامل مع وحدة ضوء وشاشة تحكم',       desc_en:'Complete unit with light and control screen',   badge:'الأكثر مبيعاً'},
  {id:2,  cat:'dev',   icon:'📡', brand:'PLANMECA',   ar:'جهاز أشعة بانورامي ProMax',              en:'ProMax Panoramic X-Ray',                  price:32000, old:38000, desc_ar:'أشعة رقمية عالية الدقة بدون فيلم',         desc_en:'Digital high-resolution filmless X-ray',        badge:'جديد'},
  {id:3,  cat:'dev',   icon:'⚡', brand:'SIRONA',     ar:'جهاز الأوتوكلاف DAC Premium',            en:'DAC Premium Autoclave',                   price:8900,  old:null,  desc_ar:'تعقيم بالبخار 17 لتر معتمد Class B',      desc_en:'17L Class B steam sterilizer',                  badge:null},
  {id:4,  cat:'hand',  icon:'🔍', brand:'HU-FRIEDY',  ar:'مجموعة أدوات فحص كاملة',                en:'Complete Examination Kit',                price:480,   old:620,   desc_ar:'مرايا + مجس + ملقط ستانلس ستيل',          desc_en:'Mirrors + probe + stainless forceps',           badge:'خصم 22%'},
  {id:5,  cat:'hand',  icon:'🔧', brand:'DENTSPLY',   ar:'ملفات قنوات روتاري ProTaper Gold',       en:'ProTaper Gold Rotary Files',              price:320,   old:null,  desc_ar:'طقم كامل 6 ملفات NiTi عالي المرونة',      desc_en:'6-file NiTi set, high flexibility',             badge:null},
  {id:6,  cat:'mat',   icon:'💉', brand:'3M ESPE',    ar:'مادة حشو كومبوزيت Filtek Supreme',       en:'Filtek Supreme Composite',                price:185,   old:220,   desc_ar:'كومبوزيت نانو هايبرد شفاف وقوي',           desc_en:'Nano-hybrid composite, translucent & strong',   badge:'الأكثر مبيعاً'},
  {id:7,  cat:'mat',   icon:'🧪', brand:'ULTRADENT',  ar:'جيل تبييض Opalescence 35%',              en:'Opalescence Whitening 35%',               price:145,   old:null,  desc_ar:'تبييض احترافي سريع نتائج فورية',           desc_en:'Professional fast whitening, instant results',  badge:null},
  {id:8,  cat:'mat',   icon:'🧬', brand:'DENTSPLY',   ar:'مادة انطباع سيليكون Aquasil Ultra',      en:'Aquasil Ultra Impression Material',       price:265,   old:310,   desc_ar:'سيليكون VPS دقيق ومريح للمريض',            desc_en:'Precise VPS silicone, patient-friendly',        badge:null},
  {id:9,  cat:'prot',  icon:'🧤', brand:'SEMPERMED',  ar:'قفازات لاتكس طبية - صندوق 100',          en:'Medical Latex Gloves - Box 100',          price:38,    old:null,  desc_ar:'قفازات فحص معقمة مقاس S/M/L/XL',          desc_en:'Sterile examination gloves S/M/L/XL',           badge:null},
  {id:10, cat:'prot',  icon:'😷', brand:'3M',         ar:'كمامة N95 طبية معتمدة - علبة 20',        en:'Certified Medical N95 Mask - Box 20',     price:72,    old:90,    desc_ar:'كمامة N95 معتمدة NIOSH مريحة',             desc_en:'NIOSH-certified N95, comfortable fit',          badge:'خصم 20%'},
  {id:11, cat:'ortho', icon:'🔩', brand:'3M UNITEK',  ar:'براكيت تقويم معدني Mini Diamond',        en:'Mini Diamond Metal Brackets',             price:155,   old:null,  desc_ar:'براكيت MBT/Roth مقاس .022 طقم كامل',      desc_en:'MBT/Roth .022 full kit',                        badge:null},
  {id:12, cat:'impl',  icon:'🔬', brand:'STRAUMANN',  ar:'غرسة تيتانيوم Bone Level RC',           en:'Bone Level RC Titanium Implant',          price:1200,  old:1450,  desc_ar:'نظام BLT/BLC معتمد عالمياً مع أبتمنت',     desc_en:'Globally certified BLT/BLC with abutment',      badge:'الأكثر مبيعاً'},
  {id:13, cat:'home',  icon:'⚡', brand:'ORAL-B',     ar:'فرشاة أسنان كهربائية iO Series 9',       en:'iO Series 9 Electric Toothbrush',         price:620,   old:780,   desc_ar:'تقنية ذكية مع شاشة تتبع النظافة',          desc_en:'Smart tech with cleaning tracker display',      badge:'جديد'},
  {id:14, cat:'home',  icon:'💧', brand:'COLGATE',    ar:'غسول فم طبي Colgate Peroxyl',            en:'Colgate Peroxyl Medical Mouthwash',       price:28,    old:null,  desc_ar:'علاج قرح الفم وتطهير اللثة',               desc_en:'Treats mouth sores and gum disinfection',       badge:null},
  {id:15, cat:'dev',   icon:'📷', brand:'CARESTREAM', ar:'كاميرا داخل الفم CS 1500',              en:'CS 1500 Intraoral Camera',                price:4200,  old:5100,  desc_ar:'كاميرا HD لاسلكية مع برنامج متكامل',       desc_en:'Wireless HD camera with integrated software',   badge:'جديد'},
  {id:16, cat:'mat',   icon:'🩺', brand:'SEPTODONT',  ar:'تخدير موضعي Articaine 4%',              en:'Articaine 4% Local Anesthesia',           price:95,    old:null,  desc_ar:'أمبولات 1.7ml صندوق 50 أمبولة',            desc_en:'1.7ml cartridges, box of 50',                   badge:null},
];

function loadProducts() {
  try {
    const saved = localStorage.getItem('dentapro_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {}
  return DEFAULT_PRODUCTS.map(p => ({...p}));
}

// ============================
// PRODUCTS — Firestore Collection حقيقية (Pagination: limit() + startAfter())
// ============================
var FIRESTORE_PAGE_SIZE = 100;      // حجم كل صفحة تُجلب من Firestore (limit)
var _productsLastDoc = null;          // آخر مستند مُحمّل، يُستخدم في startAfter()
var _productsAllLoaded = false;       // true عند استنفاذ كل صفحات Firestore
var _productsCollectionReady = false; // true إذا كانت Collection الجديدة تحتوي بيانات فعلاً
var _ensureAllPromise = null;

async function waitForFirebase(maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    if (window._fbCollection && window._fbGetDocs && window._fbLimit) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return !!(window._fbCollection && window._fbGetDocs && window._fbLimit);
}

// يجلب صفحة واحدة من Collection "products" باستخدام limit() الحقيقي، ومع startAfter() لما بعد أول صفحة
async function fetchProductsPage() {
  if (_productsAllLoaded) return [];
  if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
  if (!await waitForFirebase()) throw new Error('Firebase غير جاهز');
  // تم إلغاء الاعتماد على orderBy('id') لأنه يستثني بصمت أي منتج
  // ناقصه حقل id أو نوعه مختلف (نص بدل رقم). بدلاً من ذلك نجلب كل
  // المنتجات دفعة واحدة (المجموعة صغيرة) ونرتبها محلياً بالجافاسكربت.
  const q = window._fbCollection(window._db, 'products');
  const snap = await window._fbGetDocs(q);
  _productsAllLoaded = true;
  if (snap.empty) return [];
  const list = snap.docs.map(d => d.data());
  list.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  return list;
}

// التحميل الأولي عند فتح المتجر: أول صفحة فقط من Firestore (لا يتم تحميل كل المنتجات دفعة واحدة)
async function loadProductsFromFirebase() {
  try {
    let firstPage = await fetchProductsPage();
    // إعادة محاولة واحدة: التخزين المحلي لـ Firestore (persistentLocalCache) قد
    // يرجّع نتيجة فارغة للحظة عند أول تحميل قبل اكتمال المزامنة مع السيرفر.
    // لا نعتبرها فارغة فعلياً إلا بعد إعادة محاولة واحدة بعد فاصل قصير.
    if (firstPage.length === 0 && _productsAllLoaded) {
      await new Promise(r => setTimeout(r, 800));
      _productsAllLoaded = false;
      firstPage = await fetchProductsPage();
    }
    if (firstPage.length > 0) {
      products.length = 0;
      firstPage.forEach(p => products.push(p));
      _productsCollectionReady = true;
      cacheProductsLocally();
      renderProducts();
      renderCategories();
      console.log(`✅ تم تحميل أول صفحة (${products.length} منتج) عبر limit()`);
    } else {
      // الـ Collection فاضية أو غير موجودة بعد → نقرأ البنية القديمة (store_data/products) كتوافق رجعي
      await loadProductsLegacyFallback();
    }
    if (typeof updateAdminStats === 'function') updateAdminStats();
    if (typeof renderAdminTable === 'function' && document.getElementById('adminPanel')?.classList.contains('open')) {
      renderAdminTable();
    }
  } catch(e) {
    // فشل تحميل Collection الجديدة → جرّب البنية القديمة صامتاً قبل إظهار أي خطأ
    console.warn('⚠️ Firebase loadProducts (new collection):', e.message);
    try {
      await loadProductsLegacyFallback();
    } catch(e2) {
      console.warn('⚠️ Firebase loadProducts (legacy fallback):', e2.message);
      // لا نُظهر شاشة خطأ إذا كانت المنتجات موجودة محلياً (localStorage) — فقط عند عدم وجود أي بيانات نهائياً
      if (!products.length) {
        showErrorPage({
          icon: '📡',
          title: 'لا يوجد اتصال بالإنترنت',
          message: 'تعذّر تحميل المنتجات لعدم توفر اتصال بالإنترنت. تحقق من الشبكة وأعد المحاولة.',
        });
      }
    }
  }
}

// توافق رجعي: قراءة بنية المستند القديم (list array) وترحيلها تلقائياً لـ Collection عند وجود صلاحية أدمن
async function loadProductsLegacyFallback() {
  try {
    if (!await waitForFirebase(15)) return;
    const snap = await window._fbGetDoc(window._fbDoc2('store_data', 'products'));
    if (snap.exists()) {
      const list = snap.data().list;
      if (Array.isArray(list) && list.length > 0) {
        products.length = 0;
        list.forEach(p => products.push(p));
        cacheProductsLocally();
        renderProducts();
        renderCategories();
        // تم تعطيل الترحيل التلقائي نهائياً لمنع استرجاع بيانات قديمة بالخطأ
      }
    }
  } catch(e) {
    console.warn('⚠️ Firebase loadProducts (legacy fallback):', e.message);
  }
}

// ترحيل لمرة واحدة من البنية القديمة (مستند واحد) إلى Collection حقيقية (كتابات مجمّعة Batched)
async function migrateProductsToCollection(list) {
  try {
    if (!window._fbWriteBatch) return;
    for (let i = 0; i < list.length; i += 400) {
      const batch = window._fbWriteBatch();
      list.slice(i, i + 400).forEach(p => batch.set(window._fbDoc2('products', String(p.id)), p));
      await batch.commit();
    }
    _productsLastDoc = null; _productsAllLoaded = false; _productsCollectionReady = true;
    console.log('✅ تم ترحيل', list.length, 'منتج إلى Collection حقيقية تدعم limit()/startAfter()');
  } catch(e) {
    console.warn('⚠️ فشل ترحيل المنتجات التلقائي:', e.message);
  }
}

// يجلب الصفحة التالية من Firestore (startAfter() حقيقي) ويضيفها للمصفوفة المحلية — تُستخدم في "تحميل المزيد" والتمرير اللامتناهي
async function loadMoreProductsFromServer() {
  if (_productsAllLoaded || !_productsCollectionReady) return false;
  try {
    const nextPage = await fetchProductsPage();
    if (nextPage.length > 0) {
      const existingIds = new Set(products.map(p => p.id));
      nextPage.forEach(p => { if (!existingIds.has(p.id)) products.push(p); });
      cacheProductsLocally();
      return true;
    }
    return false;
  } catch(e) {
    console.warn('⚠️ تحميل المزيد من المنتجات:', e.message);
    showToast('⚠️ تعذّر تحميل المزيد من المنتجات، تحقق من اتصال الإنترنت', 'error');
    return false;
  }
}

// يضمن تحميل كل المنتجات من السيرفر (صفحة تلو الأخرى) — مطلوب عند تفعيل بحث/فلتر/ترتيب أو فتح لوحة التحكم لضمان دقة النتائج على كامل الكتالوج
async function ensureAllProductsLoaded() {
  if (_productsAllLoaded || !_productsCollectionReady) return;
  if (_ensureAllPromise) return _ensureAllPromise;
  _ensureAllPromise = (async () => {
    while (!_productsAllLoaded) {
      const got = await loadMoreProductsFromServer();
      if (!got) break;
    }
  })();
  await _ensureAllPromise;
  _ensureAllPromise = null;
}

// حفظ منتج واحد فقط في Firestore (إضافة/تعديل) — كتابة جزئية بدل إعادة كتابة القائمة كاملة
async function saveProductToFirebase(product) {
  try {
    if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
    if (!await waitForFirebase(15)) throw new Error('Firebase غير جاهز');
    await window._fbSetDoc(window._fbDoc2('products', String(product.id)), product);
  } catch(e) {
    console.error('❌ saveProductToFirebase:', e.message);
    showToast('⚠️ تم الحفظ محلياً فقط، فشل الحفظ في Firebase: ' + e.message, 'error');
  }
}

// حذف منتج واحد فقط من Firestore
async function deleteProductFromFirebase(id) {
  try {
    if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
    if (!await waitForFirebase(15)) throw new Error('Firebase غير جاهز');
    await window._fbDeleteDoc(window._fbDoc2('products', String(id)));
  } catch(e) {
    console.error('❌ deleteProductFromFirebase:', e.message);
    showToast('⚠️ تم الحذف محلياً فقط، فشل الحذف من Firebase: ' + e.message, 'error');
  }
}

// تخزين محلي سريع فقط (لا يلمس Firebase) — يُستخدم بعد كل تعديل لتفادي الوميض عند إعادة فتح الصفحة
function cacheProductsLocally() {
  try { localStorage.setItem('dentapro_products', JSON.stringify(products)); } catch(e) {}
  clearSearchIndex();
}

var products = loadProducts();

// =====================
// OFFERS DATA
// =====================
function loadOffers() {
  try {
    const saved = localStorage.getItem('dentapro_offers');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch(e) {}
  return [];
}

async function loadOffersFromFirebase() {
  try {
    for (let i = 0; i < 30; i++) {
      if (window._fbDoc2 && window._fbGetDoc) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!window._fbDoc2 || !window._fbGetDoc) return;
    const snap = await window._fbGetDoc(window._fbDoc2('store_data', 'offers'));
    if (snap.exists()) {
      const list = snap.data().list;
      if (Array.isArray(list)) {
        offers.length = 0;
        list.forEach(o => offers.push(o));
        localStorage.setItem('dentapro_offers', JSON.stringify(offers));
        renderOffers();
        renderProducts();
        initOffersTicker();
        if (document.getElementById('adminPanel')?.classList.contains('open')) {
          renderAdminOffers();
        }
      }
    }
  } catch(e) {
    console.warn('Firebase loadOffers:', e.message);
  }
}

async function saveOffers() {
  try { localStorage.setItem('dentapro_offers', JSON.stringify(offers)); } catch(e) {}
  try {
    for (let i = 0; i < 15; i++) {
      if (window._fbDoc2 && window._fbSetDoc) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await window._fbSetDoc(
      window._fbDoc2('store_data', 'offers'),
      { list: offers, updatedAt: new Date().toISOString() }
    );
  } catch(e) {
    console.warn('Firebase saveOffers:', e.message);
  }
}

var offers = loadOffers();

// =====================
// QUOTE REQUESTS (عروض الأسعار)
// =====================
function quotesRef() {
  return window._fbCollection(window._db, 'quotes');
}

async function createQuoteRequest(quote) {
  try {
    await window._fbSetDoc(window._fbDoc2('quotes', quote.id), quote);
    return quote.id;
  } catch(e) {
    console.error('createQuoteRequest:', e);
    throw e;
  }
}

async function getClientQuotes(email) {
  try {
    for (let i = 0; i < 20; i++) {
      if (window._fbQuery && window._fbWhere && window._fbGetDocs) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const q = window._fbQuery(quotesRef(), window._fbWhere('clientEmail', '==', email));
    const snap = await window._fbGetDocs(q);
    const list = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  } catch(e) {
    console.error('getClientQuotes:', e);
    return [];
  }
}

async function getAllQuotes() {
  try {
    const q = window._fbQuery(quotesRef(), window._fbOrderBy('createdAt','desc'));
    const snap = await window._fbGetDocs(q);
    return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  } catch(e) {
    console.error('getAllQuotes:', e);
    return [];
  }
}

async function updateQuote(docId, data) {
  try {
    await window._fbUpdateDoc(window._fbDoc2('quotes', docId), data);
  } catch(e) {
    console.error('updateQuote:', e);
    throw e;
  }
}
function quoteFavoritesStorageKey() {
  return `dentapro_quote_favorites_${currentUser?.email || 'guest'}`;
}

function loadQuoteFavorites() {
  try { return JSON.parse(localStorage.getItem(quoteFavoritesStorageKey()) || '[]'); }
  catch (e) { return []; }
}

function saveQuoteFavoriteId(docId) {
  const ids = loadQuoteFavorites();
  if (!ids.includes(docId)) {
    ids.push(docId);
    localStorage.setItem(quoteFavoritesStorageKey(), JSON.stringify(ids));
  }
}

function removeQuoteFavoriteId(docId) {
  const ids = loadQuoteFavorites().filter(id => id !== docId);
  localStorage.setItem(quoteFavoritesStorageKey(), JSON.stringify(ids));
}
var QUOTE_STATUSES = {
  pending:   { label:'قيد المراجعة',     icon:'fa-clock',          color:'#c2410c', bg:'#fff7ed' },
  priced:    { label:'تم تحديد السعر',   icon:'fa-tag',            color:'#1d4ed8', bg:'#eff6ff' },
  accepted:  { label:'تم القبول',        icon:'fa-check-circle',   color:'#15803d', bg:'#f0fdf4' },
  rejected:  { label:'مرفوض',            icon:'fa-times-circle',   color:'#be123c', bg:'#fff1f2' },
  saved:     { label:'محفوظ بالمفضلة',   icon:'fa-bookmark',       color:'#7e22ce', bg:'#fdf4ff' },
};

function quoteStatusBadge(status) {
  const s = QUOTE_STATUSES[status] || QUOTE_STATUSES.pending;
  return `<span class="status-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.color}33">
    <i class="fas ${s.icon}"></i> ${s.label}</span>`;
}

// =====================
// NOTIFICATIONS SYSTEM
// =====================
function notifsRef() {
  return window._fbCollection(window._db, 'notifications');
}

// إنشاء إشعار جديد
// scope: 'client' (لعميل محدد عبر targetEmail) | 'admin' (للأدمن فقط) | 'broadcast' (لكل العملاء)
async function createNotification({ scope, targetEmail = null, icon, title, message, link = null }) {
  try {
    await window._fbAddDoc(notifsRef(), {
      scope, targetEmail, icon, title, message, link,
      createdAt: new Date().toISOString(),
    });
  } catch(e) {
    console.warn('createNotification:', e.message);
  }
}

// جلب إشعارات شخص معيّن (عميل أو أدمن) + البث العام إن كان عميلاً
async function fetchNotificationsFor(email, isAdminUser) {
  try {
    for (let i = 0; i < 20; i++) {
      if (window._fbQuery && window._fbWhere && window._fbGetDocs) break;
      await new Promise(r => setTimeout(r, 200));
    }
    let results = [];
    if (isAdminUser) {
      const q = window._fbQuery(notifsRef(), window._fbWhere('scope', '==', 'admin'));
      const snap = await window._fbGetDocs(q);
      results = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    } else {
      const qClient = window._fbQuery(notifsRef(), window._fbWhere('targetEmail', '==', email));
      const qBroadcast = window._fbQuery(notifsRef(), window._fbWhere('scope', '==', 'broadcast'));
      const [snapClient, snapBroadcast] = await Promise.all([
        window._fbGetDocs(qClient),
        window._fbGetDocs(qBroadcast)
      ]);
      results = [
        ...snapClient.docs.map(d => ({ _docId: d.id, ...d.data() })),
        ...snapBroadcast.docs.map(d => ({ _docId: d.id, ...d.data() }))
      ];
    }
    results.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.slice(0, 30);
  } catch(e) {
    console.warn('fetchNotificationsFor:', e.message);
    return [];
  }
}

function getReadNotifIds() {
  try { return JSON.parse(localStorage.getItem('dentapro_read_notifs') || '[]'); }
  catch(e) { return []; }
}
function markNotifIdRead(id) {
  const list = getReadNotifIds();
  if (!list.includes(id)) { list.push(id); localStorage.setItem('dentapro_read_notifs', JSON.stringify(list)); }
}
function isNotifRead(id) {
  return getReadNotifIds().includes(id);
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
  return `منذ ${Math.floor(diff/86400)} يوم`;
}

var _cachedNotifs = [];

async function loadAndRenderNotifIcon() {
  const btn = document.getElementById('notifBtn');
  const msgBtn = document.getElementById('msgBtn');
  if (!currentUser) { btn.style.display = 'none'; if (msgBtn) msgBtn.style.display = 'none'; return; }
  btn.style.display = 'flex';
  const isAdminUser = isStaff();
  if (msgBtn) {
    msgBtn.style.display = 'flex';
    msgBtn.title = isAdminUser ? 'رسائل العملاء' : 'تواصل مع الإدارة';
    msgBtn.onclick = isAdminUser ? openAdminMessagesPanel : openClientMessages;
  }
  _cachedNotifs = await fetchNotificationsFor(currentUser.email, isAdminUser);
  updateNotifBadge();
  if (isAdminUser) updateHeaderMsgBadge();
  else updateClientMsgBadge();
}

function openAdminMessagesPanel() {
  if (!isStaff()) return;
  document.getElementById('adminPanel').classList.add('open');
  switchAdminTab('messages');
}

// ── تتبّع قراءة محادثات العملاء (للأدمن) ──
function getAdminMsgReadMap() {
  try { return JSON.parse(localStorage.getItem('dentapro_admin_msg_read') || '{}'); }
  catch(e) { return {}; }
}
function markThreadRead(email, ts) {
  const map = getAdminMsgReadMap();
  map[email] = ts;
  localStorage.setItem('dentapro_admin_msg_read', JSON.stringify(map));
}
function isThreadRead(email, ts) {
  const map = getAdminMsgReadMap();
  return map[email] && new Date(map[email]) >= new Date(ts);
}

// ── تتبّع قراءة محادثة العميل مع الإدارة (من طرف العميل) ──
function getClientMsgReadMap() {
  try { return JSON.parse(localStorage.getItem('dentapro_client_msg_read') || '{}'); }
  catch(e) { return {}; }
}
function markClientMsgRead(email, ts) {
  const map = getClientMsgReadMap();
  map[email] = ts;
  localStorage.setItem('dentapro_client_msg_read', JSON.stringify(map));
}
function getClientMsgReadTs(email) {
  return getClientMsgReadMap()[email] || null;
}

async function updateClientMsgBadge() {
  if (!currentUser || isStaff()) return;
  const thread = await getClientMessageThread(currentUser.email);
  window._cachedClientThread = thread;
  const badge = document.getElementById('msgBadge');
  if (!badge) return;
  const readTs = getClientMsgReadTs(currentUser.email);
  const unreadCount = thread.filter(m =>
    m.fromRole === 'admin' && (!readTs || new Date(m.createdAt) > new Date(readTs))
  ).length;
  badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
}
async function updateHeaderMsgBadge() {
  try {
    const grouped = await getAllMessageThreadsForAdmin();
    window._cachedAdminThreads = grouped;
    const emails = Object.keys(grouped);
    const unread = emails.filter(e => {
      const last = grouped[e][grouped[e].length - 1];
      return last.fromRole === 'client' && !isThreadRead(e, last.createdAt);
    }).length;
    const badge = document.getElementById('msgBadge');
    if (badge) {
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.textContent = unread > 9 ? '9+' : unread;
    }
    const adminBadgeEl = document.getElementById('adminMsgBadge');
    if (adminBadgeEl) adminBadgeEl.textContent = unread > 0 ? unread : '';
  } catch(e) { console.warn('updateHeaderMsgBadge:', e.message); }
}

function updateNotifBadge() {
  const unreadCount = _cachedNotifs.filter(n => !isNotifRead(n._docId)).length;
  const badge = document.getElementById('notifBadge');
  if (unreadCount > 0) {
    badge.style.display = 'flex';
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
  } else {
    badge.style.display = 'none';
  }
  if (typeof updateBellState === 'function') updateBellState();
}

function renderNotifList() {
  const list = document.getElementById('notifList');
  if (!_cachedNotifs.length) {
    list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i>لا توجد إشعارات حالياً</div>`;
    return;
  }
  list.innerHTML = _cachedNotifs.map(n => {
    const unread = !isNotifRead(n._docId);
    return `
    <div class="notif-item ${unread?'unread':''}" onclick="onNotifClick('${n._docId}','${n.link||''}')">
      <div class="notif-item-icon">${n.icon || '🔔'}</div>
      <div class="notif-item-content">
        <div class="notif-item-title">${escHtml(n.title)}</div>
        <div class="notif-item-msg">${escHtml(n.message)}</div>
        <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>`;
  }).join('');
}

function onNotifClick(docId, link) {
  markNotifIdRead(docId);
  updateNotifBadge();
  renderNotifList();
  if (!link) return;
  closeNotifDropdown();
  if (link.startsWith('page:')) {
    showPage(link.replace('page:',''));
  } else if (link.startsWith('adminorders:')) {
    if (isStaff()) {
      document.getElementById('adminPanel').classList.add('open');
      switchAdminTab('orders');
    }
  } else if (link.startsWith('adminquotes:')) {
    if (isStaff()) {
      document.getElementById('adminPanel').classList.add('open');
      switchAdminTab('quotes');
    }
  } else if (link.startsWith('product:')) {
    const id = parseInt(link.replace('product:',''));
    showPage('home');
    setTimeout(async () => {
      let p = products.find(x => x.id === id);
      if (!p) { await loadProductsFromFirebase(); p = products.find(x => x.id === id); }
      if (p) openProductDetail(id);
      else showToast('⚠️ هذا المنتج غير متاح حالياً', 'error');
    }, 100);
  } else if (link.startsWith('clientmsg:')) {
    const email = link.replace('clientmsg:','');
    if (isStaff()) {
      document.getElementById('adminPanel').classList.add('open');
      switchAdminTab('messages');
      setTimeout(() => openAdminThreadModal(email), 400);
    }
  }
}

function markAllNotifsRead() {
  _cachedNotifs.forEach(n => markNotifIdRead(n._docId));
  updateNotifBadge();
  renderNotifList();
  showToast('✅ تم تعليم الكل كمقروء', 'success');
}
function markAllNotifsRead() {
  _cachedNotifs.forEach(n => markNotifIdRead(n._docId));
  updateNotifBadge();
  renderNotifList();
  showToast('✅ تم تعليم الكل كمقروء', 'success');
}

// تعليم كل الإشعارات المرتبطة بقسم معيّن كمقروءة، فقط عند فتح ذلك القسم فعلياً
function markNotifsByLinkPrefixRead(prefixes) {
  let changed = false;
  _cachedNotifs.forEach(n => {
    if (!n.link) return;
    if (prefixes.some(p => n.link.startsWith(p)) && !isNotifRead(n._docId)) {
      markNotifIdRead(n._docId);
      changed = true;
    }
  });
  if (changed) {
    updateNotifBadge();
    if (document.getElementById('notifDropdown')?.classList.contains('open')) renderNotifList();
  }
}
async function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  const willOpen = !dd.classList.contains('open');
  if (willOpen && currentUser) {
    _cachedNotifs = await fetchNotificationsFor(currentUser.email, isStaff());
    updateNotifBadge();
  }
  if (willOpen) renderNotifList();
  dd.classList.toggle('open', willOpen);
}
function closeNotifDropdown() {
  document.getElementById('notifDropdown').classList.remove('open');
}
document.addEventListener('click', (e) => {
  const dd = document.getElementById('notifDropdown');
  const btn = document.getElementById('notifBtn');
  if (dd && dd.classList.contains('open') && !dd.contains(e.target) && !btn.contains(e.target)) {
    closeNotifDropdown();
  }
});

// =====================
// OFFERS HELPERS
// =====================
function getActiveQtyOffer(productId) {
  return offers.find(o => o.type === 'qty' && o.active && o.productId === productId && !isOfferExpired(o)) || null;
}

function getEffectiveUnitPrice(product, qty) {
  const offer = getActiveQtyOffer(product.id);
  if (!offer || !offer.tiers || !offer.tiers.length) return product.price;
  let best = null;
  offer.tiers.forEach(t => {
    if (t.qty <= qty && (!best || t.qty > best.qty)) best = t;
  });
  if (!best) return product.price;
  return best.price / best.qty;
}

// ===== OFFER EXPIRY HELPERS =====
function isOfferExpired(o) {
  return !!(o.expiresAt && new Date(o.expiresAt) <= new Date());
}

// يحوّل تاريخ الانتهاء إلى نهاية ذلك اليوم بالتوقيت المحلي إن كان تاريخاً بدون وقت،
// أو يتركه كما هو إن كان يحتوي وقتاً محدداً (datetime-local)
function normalizeOfferExpiry(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('T') && dateStr.split('T')[1]) {
    return new Date(dateStr).toISOString();
  }
  const d = new Date(dateStr + 'T23:59:59');
  return d.toISOString();
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCountdown(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${t('ينتهي خلال','Ends in')} ${days}${t('ي','d')} ${hours}${t('س','h')} ${minutes}${t('د','m')}`;
  if (hours > 0) return `${t('ينتهي خلال','Ends in')} ${hours}${t('س','h')} ${minutes}${t('د','m')} ${seconds}${t('ث','s')}`;
  return `${t('ينتهي خلال','Ends in')} ${minutes}${t('د','m')} ${seconds}${t('ث','s')}`;
}

// يحذف تلقائياً أي عرض انتهى وقته من المصفوفة المحلية ومن Firebase
function cleanupExpiredOffers() {
  const before = offers.length;
  offers = offers.filter(o => !isOfferExpired(o));
  if (offers.length !== before) {
    saveOffers();
    renderOffers();
    renderProducts();
    initOffersTicker();
    if (document.getElementById('adminPanel')?.classList.contains('open')) renderAdminOffers();
  }
}

// يحدّث كل عدّادات الوقت الظاهرة بالصفحة كل ثانية، ويطلق الحذف عند الوصول للصفر
function tickOfferCountdowns() {
  document.querySelectorAll('.offer-countdown[data-expires]').forEach(el => {
    const label = formatCountdown(el.getAttribute('data-expires'));
    if (label === null) {
      cleanupExpiredOffers();
    } else {
      el.textContent = label;
    }
  });
}
setInterval(tickOfferCountdowns, 1000);
setInterval(cleanupExpiredOffers, 30000);

function getBundleOriginalPrice(bundle) {
  return (bundle.items || []).reduce((s, it) => {
    const p = products.find(x => x.id === it.productId);
    return s + (p ? p.price * it.qty : 0);
  }, 0);
}

function isBundleInStock(bundle) {
  return (bundle.items || []).every(it => {
    const p = products.find(x => x.id === it.productId);
    if (!p) return false;
    if (p.stock !== undefined && p.stock !== null && p.stock <= 0) return false;
    return true;
  });
}

function getActiveBundles() {
  return offers.filter(o => o.type === 'bundle' && o.active && !isOfferExpired(o) && isBundleInStock(o));
}

// يجيب فقط المنتجات المطلوبة (بمعرّفاتها) من Firestore مباشرة إذا لم تكن محمّلة أصلاً بالذاكرة —
// بدل تحميل الكتالوج بالكامل، فالأداء يبقى ثابتاً بغض النظر عن حجم المتجر (120 أو 1000 منتج)
async function fetchProductsByIds(ids) {
  const missing = ids.filter(id => !products.find(p => p.id === id));
  if (!missing.length) return;
  await Promise.all(missing.map(async (id) => {
    try {
      const snap = await window._fbGetDoc(window._fbDoc2('products', String(id)));
      if (snap.exists() && !products.find(p => p.id === id)) {
        products.push({ ...snap.data(), id });
      }
    } catch(e) { /* تجاهل بصمت — سيظهر تحذير المطابقة أدناه عند الحاجة */ }
  }));
}

async function getActiveQtyOfferProducts() {
  const activeQtyOffers = offers.filter(o => o.type === 'qty' && o.active && !isOfferExpired(o));
  await fetchProductsByIds(activeQtyOffers.map(o => o.productId));

  const result = activeQtyOffers
    .map(o => products.find(p => p.id === o.productId))
    .filter(p => p && !(p.stock !== undefined && p.stock !== null && p.stock <= 0));
  return result;
}

function renderQtyOfferTableHTML(p) {
  const offer = getActiveQtyOffer(p.id);
  if (!offer) return '';
  const rows = offer.tiers.slice().sort((a,b)=>a.qty-b.qty).map(tr => {
    const unit = tr.price / tr.qty;
    return `
      <tr>
        <td style="padding:8px 10px;text-align:center;font-weight:700">${tr.qty}</td>
        <td style="padding:8px 10px;text-align:center;font-weight:800;color:var(--primary)">${tr.price.toLocaleString()} ${t('د.أ','SAR')}</td>
        <td style="padding:8px 10px;text-align:center;color:var(--text-muted)">${unit.toFixed(2)} ${t('د.أ','SAR')}</td>
      </tr>`;
  }).join('');
  return `
  <div style="margin:16px 0;background:#f0f8ff;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px">
    <div style="font-weight:800;font-size:14px;color:var(--primary-dark);margin-bottom:10px">🏷️ ${t('عرض الكمية','Quantity Offer')}</div>
    ${offer.expiresAt ? `<div class="offer-countdown-badge"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${offer.expiresAt}">${formatCountdown(offer.expiresAt)||''}</span></div>` : ''}
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="font-size:12px;color:var(--text-muted)">
        <th style="padding:6px 10px">${t('الكمية','Qty')}</th>
        <th style="padding:6px 10px">${t('السعر الإجمالي','Total Price')}</th>
        <th style="padding:6px 10px">${t('سعر الوحدة','Unit Price')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// =====================
// STATE
// =====================
function loadCart() {
  try {
    const saved = localStorage.getItem('dentapro_cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch(e) {}
  return [];
}

function saveCart() {
  try { localStorage.setItem('dentapro_cart', JSON.stringify(cart)); } catch(e) {}
}

var cart = loadCart();
var currentLang = 'ar';
var currentCat = 'all';
var currentStep = 1;
var PRODUCTS_PAGE_SIZE = 30;
var productsDisplayLimit = PRODUCTS_PAGE_SIZE;
var locationData = { lat: null, lng: null, address: '', method: '' };
var orderSubmitted = false;

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  renderCategories();
  populateCategorySelects();
  renderProducts();
  renderOffers();
  updateCartUI();
  renderCompareBar();
  renderHeroTitle();

  // تحميل البيانات من Firebase
  // المنتجات أولاً لضمان توافرها قبل فلترة العروض المرتبطة بها
  await Promise.all([
    loadProductsFromFirebase(),
    loadCategoriesFromFirebase(),
    loadHeroSettings()
  ]);
  await loadOffersFromFirebase();

  // مزامنة السلة المحفوظة مع بيانات المنتجات الحالية (أسعار/توفر محدّثة)
  syncCartWithProducts();
  renderProducts();
  renderOffers();
  renderCategories();
  initOffersTicker();

  // دعم فتح منتج مباشرة من رابط مشاركة
  openProductFromUrlIfPresent();

  // إشعار المنتجات الجديدة منذ آخر زيارة
  showNewProductsNotification();
  setLastVisitDate();

  // تحميل باقي المنتجات بالخلفية دون توقيف عرض الصفحة —
  // يضمن أن الأقسام والبحث وزر "عرض المزيد" تعمل على كامل الكتالوج
  renderAdBanner();

  ensureAllProductsLoaded().then(() => {
    renderProducts();
    renderCategories();
    populateCategorySelects();
  });
});

function syncCartWithProducts() {
  if (!cart.length) return;
  let changed = false;
  cart = cart.filter(item => {
    if (item.isBundle) {
      const b = offers.find(o => o.id === item.bundleId && o.type === 'bundle');
      if (!b || !isBundleInStock(b)) { changed = true; return false; }
      if (b.bundlePrice !== item.price) { item.price = b.bundlePrice; changed = true; }
      return true;
    }
    const p = products.find(x => x.id === item.id);
    if (!p) { changed = true; return false; }
    const newUnitPrice = getEffectiveUnitPrice(p, item.qty);
    if (p.price !== item.basePrice || newUnitPrice !== item.price || p.icon !== item.icon || p.image !== item.image) {
      item.basePrice = p.price; item.price = newUnitPrice; item.icon = p.icon; item.image = p.image; item.points = p.points;
      changed = true;
    }
    return true;
  });
  if (changed) {
    updateCartUI();
    renderProducts();
  }
}

// =====================
// LANGUAGE
// =====================
function toggleLang() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  const body = document.body;
  if (currentLang === 'en') {
    body.classList.add('en');
    body.setAttribute('dir','ltr');
    document.documentElement.setAttribute('lang','en');
    document.getElementById('langLabel').textContent = 'AR';
    document.getElementById('checkoutArrow').className = 'fas fa-arrow-right';
    document.getElementById('nextArrow').className = 'fas fa-arrow-right';
    document.getElementById('backArrow').className = 'fas fa-arrow-left';
  } else {
    body.classList.remove('en');
    body.setAttribute('dir','rtl');
    document.documentElement.setAttribute('lang','ar');
    document.getElementById('langLabel').textContent = 'EN';
    document.getElementById('checkoutArrow').className = 'fas fa-arrow-left';
    document.getElementById('nextArrow').className = 'fas fa-arrow-left';
    document.getElementById('backArrow').className = 'fas fa-arrow-right';
  }
  // Update all data-ar / data-en elements
  document.querySelectorAll('[data-ar]').forEach(el => {
    const val = el.getAttribute('data-' + currentLang);
    if (val) el.innerHTML = val;
  });
  // Re-render dynamic content
  renderCategories();
  renderProducts();
  renderOffers();
  updateCartUI();
  initOffersTicker();
  renderHeroTitle();
}
function t(ar, en) {
  return currentLang === 'en' ? en : ar;
}

// =====================
// CATEGORIES
// =====================
async function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  const visibleCats = categories.filter(c =>
    c.id === 'all' || products.filter(p => p.cat === c.id).length > 0
  );

  const qtyProducts = await getActiveQtyOfferProducts();
  const bundles = getActiveBundles();
  const extraCards = [];
  if (bundles.length) {
    extraCards.push({
      id: '__cat_bundles',
      icon: '🎁',
      ar: 'الباقات',
      en: 'Bundles'
    });
  }
  if (qtyProducts.length) {
    extraCards.push({
      id: '__cat_qty_offers',
      icon: '🏷️',
      ar: 'عروض الكمية',
      en: 'Quantity Offers'
    });
  }

  const allCards = [
    ...extraCards,
    ...visibleCats
  ];

  const selectedLabel = currentLang==='en' ? 'Choose a category' : 'اختر القسم ( الكل)';
  const currentLabel = currentCat === 'all'
    ? selectedLabel
    : (allCards.find(c => c.id === currentCat)?.[currentLang==='en'?'en':'ar'] || selectedLabel);
  grid.innerHTML = `
    <select id="categorySelect" aria-label="${selectedLabel}" onchange="filterCat(this.value)">
      <option value="all">${selectedLabel}</option>
      ${allCards.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${currentCat===c.id?'selected':''}>${currentLang==='en'?c.en:c.ar}</option>`).join('')}
    </select>
    <div class="category-picker-label">
      <span>${currentLabel}</span>
      <i class="fas fa-chevron-down" aria-hidden="true"></i>
    </div>
  `;
}

function filterCat(id) {
  currentCat = id;
  productsDisplayLimit = PRODUCTS_PAGE_SIZE;
  renderCategories();
  renderProducts();
  scrollToProducts();
}
function goHome() {
  // إعادة تعيين كل الفلاتر والبحث والعودة الفعلية لأعلى الصفحة الرئيسية
  currentCat = 'all';
  productsDisplayLimit = PRODUCTS_PAGE_SIZE;

  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = '';
  hideSearchSuggestions();

  const priceMinEl = document.getElementById('filterPriceMin');
  const priceMaxEl = document.getElementById('filterPriceMax');
  const brandEl = document.getElementById('filterBrand');
  const inStockEl = document.getElementById('filterInStock');
  const sortEl = document.getElementById('sortSelect');
  if (priceMinEl) priceMinEl.value = '';
  if (priceMaxEl) priceMaxEl.value = '';
  if (brandEl) brandEl.value = 'all';
  if (inStockEl) inStockEl.checked = false;
  if (sortEl) sortEl.value = 'default';

  renderCategories();
  renderProducts();

  showPage('home');
  updateBottomNav('home');
  window.scrollTo(0, 0);
}
function loadMoreProducts() {
  productsDisplayLimit += PRODUCTS_PAGE_SIZE;
  renderProducts();
}

var _infiniteScrollObserver = null;

function setupInfiniteScroll() {
  if (_infiniteScrollObserver) _infiniteScrollObserver.disconnect();

  const sentinel = document.getElementById('loadMoreWrap');
  if (!sentinel) return;

  _infiniteScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const grid = document.getElementById('productsGrid');
        const totalFiltered = parseInt(grid.dataset.totalFiltered || '0');
        if (productsDisplayLimit < totalFiltered) {
          productsDisplayLimit += PRODUCTS_PAGE_SIZE;
          renderProducts();
        }
      }
    });
  }, { rootMargin: '600px' });

  _infiniteScrollObserver.observe(sentinel);
}

document.addEventListener('DOMContentLoaded', () => {
  setupInfiniteScroll();
});

// =====================
// PRODUCTS
// =====================
// تطبيع النص العربي: يوحّد أشكال الألف والهمزة والتاء المربوطة لتحسين دقة البحث
function normalizeArabic(str) {
  if (!str) return '';
  return str.toString().toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '') // إزالة التشكيل
    .trim();
}
// ===== SEARCH INDEX (فهرسة مخزّنة لتسريع البحث في الكتالوجات الكبيرة) =====
var _searchIndexCache = {};

function clearSearchIndex() {
  _searchIndexCache = {};
}
function getProductSearchIndex(p) {
  let idx = _searchIndexCache[p.id];
  if (idx) return idx;
  const cat = categories.find(c => c.id === p.cat);
  idx = {
    nameAr: normalizeArabic(p.ar),
    nameEn: (p.en || '').toLowerCase(),
    brandAr: normalizeArabic(p.brand),
    brandEn: (p.brand || '').toLowerCase(),
    catAr: normalizeArabic(cat ? cat.ar : ''),
    catEn: (cat ? cat.en : '').toLowerCase(),
    descAr: normalizeArabic(p.desc_ar),
    descEn: (p.desc_en || '').toLowerCase(),
  };
  _searchIndexCache[p.id] = idx;
  return idx;
}
function productMatchesQuery(p, rawQuery) {
  const terms = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const idx = getProductSearchIndex(p);
  let score = 0;
  for (const term of terms) {
    const normT = normalizeArabic(term);
    const lowerT = term.toLowerCase();
    if (idx.nameAr.includes(normT) || idx.nameEn.includes(lowerT)) score += 10;
    else if (idx.brandAr.includes(normT) || idx.brandEn.includes(lowerT)) score += 5;
    else if (idx.descAr.includes(normT) || idx.descEn.includes(lowerT)) score += 1;
    else return 0;
  }
  const fullNorm = normalizeArabic(rawQuery);
  const fullLower = rawQuery.trim().toLowerCase();
  if (idx.nameAr.startsWith(fullNorm) || idx.nameEn.startsWith(fullLower)) score += 50;
  return score;
}

function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function populateBrandFilter() {
  const sel = document.getElementById('filterBrand');
  if (!sel) return;
  const currentVal = sel.value || 'all';
  const brands = [...new Set(products.map(p => p.brand))].sort();
  sel.innerHTML = `<option value="all">${t('كل الماركات','All Brands')}</option>` +
    brands.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
  if (brands.includes(currentVal)) sel.value = currentVal;
}

function clearFilters() {
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.getElementById('filterBrand').value = 'all';
  document.getElementById('filterInStock').checked = false;
  document.getElementById('sortSelect').value = 'default';
  productsDisplayLimit = PRODUCTS_PAGE_SIZE;
  renderProducts();
}

function toggleCompactView() {
  const isCompact = document.body.classList.toggle('compact-view');
  const icon = document.getElementById('fabViewToggleIcon');
  if (icon) icon.className = isCompact ? 'fas fa-th' : 'fas fa-th-large';
  localStorage.setItem('dentapro_compact_view', isCompact ? '1' : '0');
}
if (localStorage.getItem('dentapro_compact_view') === '1') {
  document.body.classList.add('compact-view');
}

function productCardHTML(p) {
  const inCart = cart.find(c => c.id === p.id);
  const outOfStock = p.stock !== undefined && p.stock !== null && p.stock <= 0;
  const hasQtyOffer = !!getActiveQtyOffer(p.id);
  const _qOffer = getActiveQtyOffer(p.id);
  const compactOfferPrice = (_qOffer && _qOffer.tiers && _qOffer.tiers.length)
    ? (_qOffer.tiers[_qOffer.tiers.length-1].price / _qOffer.tiers[_qOffer.tiers.length-1].qty)
    : p.price;
  const adminQuickBtns = isStaff() ? `
      <div style="position:absolute;top:12px;right:12px;z-index:3;display:flex;gap:6px">
        <button onclick="event.stopPropagation();openEditProduct(${p.id})" title="تعديل سريع"
          style="width:32px;height:32px;border-radius:50%;background:#0a5c8a;color:#fff;border:2px solid #fff;
                 cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="event.stopPropagation();openDeleteConfirm(${p.id})" title="حذف سريع"
          style="width:32px;height:32px;border-radius:50%;background:#e53e3e;color:#fff;border:2px solid #fff;
                 cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>` : '';
  return `
    <div class="product-card${hasQtyOffer ? ' qty-offer-frame' : ''}" onclick="openProductDetail(${p.id})" style="cursor:pointer">
      ${adminQuickBtns}
      <button class="compare-toggle-btn ${isInCompare(p.id)?'active':''}"
        onclick="event.stopPropagation();toggleCompare(${p.id})" title="${t('أضف للمقارنة','Add to compare')}">
        <i class="fas fa-balance-scale"></i>
      </button>
      <button class="favorite-toggle-btn ${isFavorite(p.id)?'active':''}"
        onclick="event.stopPropagation();toggleFavorite(${p.id})" title="${t('أضف للمفضلة','Add to favorites')}">
        <i class="fas ${isFavorite(p.id)?'fa-heart':'fa-heart'}"></i>
      </button>
      ${isNewProduct(p)
        ? `<div class="product-badge" style="background:linear-gradient(135deg,var(--accent),#00a896)">🆕 ${t('وصل حديثاً','Just Arrived')}</div>`
        : (outOfStock
            ? `<div class="product-badge" style="background:#94a3b8">${t('نفذت الكمية','Out of stock')}</div>`
            : (p.badge ? `<div class="product-badge" style="${p.badge==='الأكثر مبيعاً'?'background:linear-gradient(135deg, var(--gold-light), var(--gold));box-shadow:0 3px 8px rgba(184,134,11,0.35)':''}">${t(escHtml(p.badge), p.badge==='جديد'?'New':p.badge==='الأكثر مبيعاً'?'Best Seller':escHtml(p.badge))}</div>` : ''))}
      <div class="product-img-wrap${hasQtyOffer ? ' qty-offer-icon-pulse' : ''}" onclick="event.stopPropagation();openProductDetail(${p.id})" title="${t('التفاصيل','Details')}" style="position:relative;cursor:pointer;${outOfStock?'opacity:0.5':''}">
        ${p.image
          ? `<img src="${cldOptimize(p.image, 400)}" alt="${escHtml(p.ar)}" loading="lazy" decoding="async" />`
          : `<span class="emoji-fallback">${p.icon}</span>`
        }
        ${hasQtyOffer ? `<div class="qty-offer-ribbon">⏰ ${t('عرض لفترة محدودة','Limited time offer')}</div>` : ''}
        <div class="compact-price-bar">${compactOfferPrice.toFixed(2)} ${t('د.أ','SAR')}</div>
      </div>
      <div class="product-info">
        <div class="product-brand compact-hide">${escHtml(p.brand)}</div>
        <div class="product-name" onclick="event.stopPropagation();openProductDetail(${p.id})" style="cursor:pointer">${escHtml(p.en)}</div>
        <button class="compact-hide" onclick="event.stopPropagation();openProductDetail(${p.id})" style="margin:8px 0 6px;padding:5px 12px;border-radius:50px;background:transparent;border:1.5px solid var(--primary-light);color:var(--primary);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;width:fit-content">
          <i class="fas fa-info-circle"></i> ${t('التفاصيل','Details')}
        </button>
        <div class="product-desc compact-hide">${escHtml(currentLang==='en'?p.desc_en:p.desc_ar)}</div>
        ${hasQtyOffer ? `
        <button class="compact-hide" onclick="event.stopPropagation();openProductDetail(${p.id})" style="margin-bottom:10px;padding:5px 12px;border-radius:50px;
          background:linear-gradient(135deg,rgba(229,62,62,0.1),rgba(229,62,62,0.06));border:1.5px solid #e53e3e;
          color:#e53e3e;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;width:fit-content">
          🏷️ ${t('شاهد العرض','View Offer')}
        </button>` : ''}
        ${p.points ? `
        <div class="compact-hide" style="display:flex;align-items:center;gap:5px;margin-bottom:6px;
                    padding:2px 10px 2px 3px;border-radius:50px;
                    background:linear-gradient(135deg,#fffbeb,#fef3c7);
                    border:1.5px solid #f59e0b;width:fit-content">
          <span style="width:17px;height:17px;border-radius:50%;
                       background:linear-gradient(135deg,#f59e0b,#d97706);
                       display:flex;align-items:center;justify-content:center;
                       font-size:9px;box-shadow:0 1px 3px rgba(0,0,0,0.15)">🏆</span>
          <span style="font-size:11px;font-weight:800;color:#92400e;white-space:nowrap">
            ${p.points} ${t('نقطة','pts')}
          </span>
        </div>` : ''}
        <div class="product-price-row">
          <div>
            <div class="product-price">${compactOfferPrice.toFixed(2)} <small style="font-size:13px">${t('د.أ','SAR')}</small></div>
            ${hasQtyOffer ? `<div class="product-old-price">${p.price.toLocaleString()} ${t('د.أ','SAR')}</div>` : (p.old ? `<div class="product-old-price">${p.old.toLocaleString()} ${t('د.أ','SAR')}</div>` : '')}
          </div>
          <button class="add-to-cart ${inCart?'added':''}" onclick="event.stopPropagation();${outOfStock?'':`addToCart(${p.id})`}"
            ${outOfStock?'disabled style="opacity:0.4;cursor:not-allowed"':''}
            title="${outOfStock?t('نفذت الكمية','Out of stock'):t('أضف للسلة','Add to Cart')}">
            <i class="fas ${inCart?'fa-check':(outOfStock?'fa-ban':'fa-cart-plus')}"></i>
          </button>
        </div>
      </div>
    </div>`;
}

async function renderProducts() {
  populateBrandFilter();

  let list;
  if (currentCat === '__cat_bundles') {
    list = [];
  } else if (currentCat === '__cat_qty_offers') {
    list = await getActiveQtyOfferProducts();
  } else {
    list = currentCat === 'all' ? products : products.filter(p => p.cat === currentCat);
    list = [...list].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return db - da;
    });
  }
  const searchValRaw = document.getElementById('searchInput').value.trim();
  let filtered = list;
  let searchScores = null;
  if (searchValRaw) {
    searchScores = {};
    filtered = list.filter(p => {
      const score = productMatchesQuery(p, searchValRaw);
      if (score > 0) { searchScores[p.id] = score; return true; }
      return false;
    });
  }

  const priceMin = parseFloat(document.getElementById('filterPriceMin')?.value);
  const priceMax = parseFloat(document.getElementById('filterPriceMax')?.value);
  if (!isNaN(priceMin)) filtered = filtered.filter(p => p.price >= priceMin);
  if (!isNaN(priceMax)) filtered = filtered.filter(p => p.price <= priceMax);

  const brandVal = document.getElementById('filterBrand')?.value;
  if (brandVal && brandVal !== 'all') filtered = filtered.filter(p => p.brand === brandVal);

  const inStockOnly = document.getElementById('filterInStock')?.checked;
  if (inStockOnly) filtered = filtered.filter(p => !(p.stock !== undefined && p.stock !== null && p.stock <= 0));

  const sortVal = document.getElementById('sortSelect')?.value || 'default';
  if (sortVal === 'price_asc')    filtered = [...filtered].sort((a,b) => a.price - b.price);
  if (sortVal === 'price_desc')   filtered = [...filtered].sort((a,b) => b.price - a.price);
  if (sortVal === 'newest')       filtered = [...filtered].sort((a,b) => b.id - a.id);
  if (sortVal === 'bestselling')  filtered = [...filtered].sort((a,b) => (b.badge==='الأكثر مبيعاً'?1:0) - (a.badge==='الأكثر مبيعاً'?1:0));
  if (sortVal === 'default' && searchScores) {
    filtered = [...filtered].sort((a,b) => (searchScores[b.id]||0) - (searchScores[a.id]||0));
  }
  if (sortVal === 'default' && !searchScores) {
    const isOut = p => (p.stock !== undefined && p.stock !== null && p.stock <= 0) ? 1 : 0;
    filtered = [...filtered].sort((a,b) => isOut(a) - isOut(b));
  }

  const countEl = document.getElementById('filterResultsCount');
  if (countEl) countEl.textContent = `${filtered.length} ${t('نتيجة','results')}`;

  const grid = document.getElementById('productsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (currentCat === '__cat_bundles') {
    const bundles = getActiveBundles();
    if (!bundles.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:48px;opacity:0.3;margin-bottom:16px;display:block"></i>${t('لا توجد باقات','No bundles found')}</div>`;
    } else {
      grid.innerHTML = bundles.map(bundleCardHTML).join('');
    }
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    renderBestSellers();
    renderLatestProducts();
    return;
  }
  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:48px;opacity:0.3;margin-bottom:16px;display:block"></i>${t('لا توجد نتائج','No results found')}</div>`;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    renderBestSellers();
    renderLatestProducts();
    return;
  }
  const visibleProducts = filtered.slice(0, productsDisplayLimit);
  grid.dataset.totalFiltered = filtered.length;
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  grid.innerHTML = visibleProducts.map(p => productCardHTML(p)).join('');
  renderBestSellers();
  renderLatestProducts();
  setupInfiniteScroll();
}

function renderBestSellers() {
  const section = document.getElementById('bestSellersSection');
  const grid = document.getElementById('bestSellersGrid');
  if (!section || !grid) return;
  const items = products.filter(p => p.badge === 'الأكثر مبيعاً').slice(0, 8);
  if (!items.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  grid.innerHTML = items.map(p => productCardHTML(p)).join('');
}

function renderLatestProducts() {
  const section = document.getElementById('latestProductsSection');
  const grid = document.getElementById('latestProductsGrid');
  if (!section || !grid) return;
  if (!products.length) { section.style.display = 'none'; return; }
  const items = [...products]
    .sort((a,b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return db - da;
    })
    .slice(0, 8);
  section.style.display = 'block';
  grid.innerHTML = items.map(p => productCardHTML(p)).join('');
}

function renderSimilarProducts(product) {
  const wrap = document.getElementById('similarProductsWrap');
  const grid = document.getElementById('similarProductsGrid');
  if (!wrap || !grid) return;
  const sameCat = products.filter(p => p.id !== product.id && p.cat === product.cat);
  let items = sameCat.slice(0, 6);
  if (items.length < 4) {
    const sameBrand = products.filter(p =>
      p.id !== product.id && p.brand === product.brand && !items.find(i => i.id === p.id)
    );
    items = items.concat(sameBrand).slice(0, 6);
  }
  if (!items.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  grid.innerHTML = items.map(p => productCardHTML(p)).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('searchInput');
  const searchBtnEl = document.querySelector('.header-search .search-btn');
  if (searchEl) {
    const debouncedSearchUpdate = debounce(() => {
      productsDisplayLimit = PRODUCTS_PAGE_SIZE;
      renderProducts();
      renderSearchSuggestions();
    }, 120);
    searchEl.addEventListener('input', debouncedSearchUpdate);
    searchEl.addEventListener('focus', renderSearchSuggestions);
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        productsDisplayLimit = PRODUCTS_PAGE_SIZE;
        hideSearchSuggestions();
        renderProducts();
        scrollToProducts();
      }
    });
  }
  if (searchBtnEl) {
    searchBtnEl.addEventListener('click', () => {
      productsDisplayLimit = PRODUCTS_PAGE_SIZE;
      hideSearchSuggestions();
      renderProducts();
      scrollToProducts();
    });
  }
  document.addEventListener('click', (e) => {
    const box = document.getElementById('searchSuggestions');
    if (box && box.style.display === 'block' && !box.contains(e.target) && e.target !== searchEl) {
      hideSearchSuggestions();
    }
  });
});

function renderSearchSuggestions() {
  const box = document.getElementById('searchSuggestions');
  const inputEl = document.getElementById('searchInput');
  if (!box || !inputEl) return;
  const raw = inputEl.value.trim();
  if (!raw) { box.style.display = 'none'; return; }

  const scored = [];
  for (const p of products) {
    const score = productMatchesQuery(p, raw);
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a,b) => b.score - a.score);
  const matches = scored.slice(0, 30).map(s => s.p);

  if (!matches.length) {
    box.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">
      ${t('لا توجد نتائج مطابقة','No matching results')}</div>`;
    box.style.display = 'block';
    return;
  }

  box.innerHTML = matches.map(p => `
    <div onclick="selectSearchSuggestion(${p.id})"
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f4f8"
      onmouseover="this.style.background='#f8fbfd'" onmouseout="this.style.background=''">
      <div style="width:36px;height:36px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#f0f8ff,#e8f3fb);
                  display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden">
        ${p.image ? `<img src="${cldOptimize(p.image,60)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">` : p.icon}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${p.en}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">${p.brand}</div>
      </div>
      <div style="font-weight:800;font-size:13px;color:var(--primary);flex-shrink:0">
        ${p.price.toLocaleString()} ${t('د.أ','SAR')}
      </div>
    </div>`).join('');
  box.style.display = 'block';
}

function hideSearchSuggestions() {
  const box = document.getElementById('searchSuggestions');
  if (box) box.style.display = 'none';
}

function selectSearchSuggestion(id) {
  hideSearchSuggestions();
  document.getElementById('searchInput').value = '';
  renderProducts();
  showPage('home');
  setTimeout(() => openProductDetail(id), 50);
}

// =====================
// RENDER OFFERS SECTION
// =====================
var offersFilterMode = 'all'; // 'all' | 'bundle' | 'qty'

var offersSectionRevealed = true;

function goToOffersFiltered(mode) {
  offersFilterMode = mode;
  offersSectionRevealed = true;
  renderOffers();
  const section = document.getElementById('offersSection');
  if (section) section.scrollIntoView({behavior:'smooth', block:'start'});
}

function bundleCardHTML(b) {
  const original = getBundleOriginalPrice(b);
  const savings = original - b.bundlePrice;
  const miniIcons = (b.items || []).map(it => {
    const p = products.find(x => x.id === it.productId);
    if (!p) return '';
    return p.image
      ? `<img src="${cldOptimize(p.image,60)}" style="width:30px;height:30px;border-radius:7px;object-fit:cover" loading="lazy">`
      : `<span style="font-size:20px">${p.icon}</span>`;
  }).join('');
  return `
    <div class="product-card offer-bundle-card">
      <div class="product-badge" style="background:linear-gradient(135deg,#f59e0b,#d97706)">🎁 ${t('باقة','Bundle')}</div>
      <div class="product-img-wrap" onclick="openBundleDetail(${b.id})" style="cursor:pointer">
        ${b.image ? `<img src="${cldOptimize(b.image,400)}" alt="${escHtml(b.name_ar)}" loading="lazy">` : `<span class="emoji-fallback">${b.icon||'🎁'}</span>`}
        <div class="compact-price-bar">${b.bundlePrice.toLocaleString()} ${t('د.أ','SAR')}</div>
      </div>
      <div class="product-info">
        <div class="product-name" onclick="event.stopPropagation();openBundleDetail(${b.id})" style="cursor:pointer">${escHtml(currentLang==='en'?b.name_en:b.name_ar)}</div>
        <div class="compact-hide" style="display:flex;gap:6px;margin:6px 0">${miniIcons}</div>
        <div class="product-desc compact-hide">${escHtml(currentLang==='en'?(b.desc_en||''):(b.desc_ar||''))}</div>
        <button class="compact-hide" onclick="event.stopPropagation();openBundleDetail(${b.id})" style="margin:8px 0 6px;padding:5px 12px;border-radius:50px;background:transparent;border:1.5px solid var(--primary-light);color:var(--primary);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;width:fit-content">
          <i class="fas fa-info-circle"></i> ${t('التفاصيل','Details')}
        </button>
        ${b.expiresAt ? `<div class="offer-countdown-badge mini compact-hide"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${b.expiresAt}">${formatCountdown(b.expiresAt)||''}</span></div>` : ''}
        <div class="product-price-row">
          <div>
            <div class="product-price">${b.bundlePrice.toLocaleString()} <small style="font-size:13px">${t('د.أ','SAR')}</small></div>
            <div class="product-old-price">${original.toLocaleString()} ${t('د.أ','SAR')}</div>
            ${savings>0?`<div style="font-size:11px;font-weight:800;color:var(--success)">${t('بسعر','Price')} ${b.bundlePrice.toLocaleString()} ${t('د.أ','SAR')} ${t('بدلاً من','instead of')} ${original.toLocaleString()} ${t('د.أ','SAR')}</div>`:''}
          </div>
          <button class="add-to-cart" onclick="event.stopPropagation();addBundleToCart(${b.id})" title="${t('أضف الباقة للسلة','Add bundle to cart')}">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
      </div>
    </div>`;
}

async function renderOffers() {
  const section = document.getElementById('offersSection');
  const grid = document.getElementById('offersGrid');
  const quickAccess = document.getElementById('quickAccessWrap');
  if (!section || !grid) return;

  const bundles = getActiveBundles();
  const qtyProducts = await getActiveQtyOfferProducts();

  // إظهار/إخفاء أزرار الوصول السريع حسب توفر كل نوع
  if (quickAccess) {
    quickAccess.style.display = (bundles.length || qtyProducts.length) ? 'flex' : 'none';
    const bundleCard = quickAccess.querySelector('.bundles');
    const qtyCard = quickAccess.querySelector('.qtyoffers');
    if (bundleCard) bundleCard.style.display = bundles.length ? 'flex' : 'none';
    if (qtyCard) qtyCard.style.display = qtyProducts.length ? 'flex' : 'none';
  }

  if (!bundles.length && !qtyProducts.length) {
    section.style.display = 'none';
    return;
  }

  // لا تُظهر قسم العروض إلا بعد ضغط المستخدم على بطاقة الباقات/العروض
  if (!offersSectionRevealed) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  const showBundles = offersFilterMode === 'all' || offersFilterMode === 'bundle';
  const showQty = offersFilterMode === 'all' || offersFilterMode === 'qty';

  let html = '';

  html += (showBundles ? bundles : []).map(bundleCardHTML).join('');

  html += (showQty ? qtyProducts : []).map(p => {
    const offer = getActiveQtyOffer(p.id);
    const bestTier = offer.tiers[offer.tiers.length-1];
    const unitPrice = bestTier.price / bestTier.qty;
    const allTiersText = offer.tiers.map(tr => `${t('اشتري','Buy')} ${tr.qty} ${t('بسعر','for')} ${tr.price.toLocaleString()} ${t('د.أ','SAR')}`).join(` ${t('أو','or')} `);
    return `
    <div class="product-card qty-offer-frame">
      <div class="product-badge" style="background:linear-gradient(135deg,var(--primary),var(--accent))">🏷️ ${t('عرض كمية','Qty Offer')}</div>
      <div class="product-img-wrap qty-offer-icon-pulse" onclick="openProductDetail(${p.id})" style="cursor:pointer" title="${t('التفاصيل','Details')}">
        ${p.image ? `<img src="${cldOptimize(p.image,400)}" alt="${escHtml(p.ar)}" loading="lazy">` : `<span class="emoji-fallback">${p.icon}</span>`}
        <div class="qty-offer-ribbon compact-hide">⏰ ${t('عرض لفترة محدودة','Limited time offer')}</div>
        <div class="compact-price-bar">${unitPrice.toFixed(2)} ${t('د.أ','SAR')}</div>
      </div>
      <div class="product-info">
        <div class="product-name" onclick="event.stopPropagation();openProductDetail(${p.id})" style="cursor:pointer">${escHtml(p.en)}</div>
        <button class="compact-hide" onclick="event.stopPropagation();openProductDetail(${p.id})" style="margin:8px 0 6px;padding:5px 12px;border-radius:50px;background:transparent;border:1.5px solid var(--primary-light);color:var(--primary);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;width:fit-content">
          <i class="fas fa-info-circle"></i> ${t('التفاصيل','Details')}
        </button>
        <div class="qty-offer-highlight compact-hide">${allTiersText}</div>
        ${offer.expiresAt ? `<div class="offer-countdown-badge mini compact-hide"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${offer.expiresAt}">${formatCountdown(offer.expiresAt)||''}</span></div>` : ''}
        <div class="product-price-row">
          <div>
            <div class="product-price">${unitPrice.toFixed(2)} <small style="font-size:13px">${t('د.أ','SAR')}</small></div>
            <div class="product-old-price">${p.price.toLocaleString()} ${t('د.أ','SAR')}</div>
          </div>
          <button class="add-to-cart" onclick="event.stopPropagation();addToCart(${p.id})" title="${t('أضف للسلة','Add to cart')}">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.innerHTML = html;
}

// =====================
// BUNDLE DETAIL PAGE
// =====================
function openBundleDetail(id) {
  const b = offers.find(o => o.id === id && o.type === 'bundle');
  if (!b) return;

  const activeSection = document.querySelector('.page-section.active');
  lastPageBeforeDetail = activeSection ? activeSection.id : 'homePage';
  lastScrollYBeforeDetail = window.scrollY;

  const original = getBundleOriginalPrice(b);
  const savings = original - b.bundlePrice;
  const itemsRows = (b.items || []).map(it => {
    const p = products.find(x => x.id === it.productId);
    if (!p) return '';
    return `
      <div class="order-item-row">
        <div class="order-item-icon">${p.image ? `<img src="${cldOptimize(p.image,60)}" style="width:100%;height:100%;object-fit:contain" loading="lazy">` : p.icon}</div>
        <div style="flex:1;font-weight:600;color:var(--primary-dark)">${escHtml(p.en)}</div>
        <div style="color:var(--text-muted)">× ${it.qty}</div>
      </div>`;
  }).join('');

  document.getElementById('productDetailContent').innerHTML = `
    <div class="product-detail-grid">
      <div class="product-img-wrap product-detail-img">
        <div class="product-badge" style="background:linear-gradient(135deg,#f59e0b,#d97706)">🎁 ${t('باقة','Bundle')}</div>
        ${b.image ? `<img src="${cldOptimize(b.image,600)}" alt="${b.name_ar}" loading="lazy">` : `<span class="emoji-fallback">${b.icon||'🎁'}</span>`}
      </div>
      <div>
        <div class="product-name" style="font-size:22px;margin-bottom:8px">${escHtml(currentLang==='en'?b.name_en:b.name_ar)}</div>
        <div class="product-desc" style="margin-bottom:16px">${escHtml(currentLang==='en'?(b.desc_en||''):(b.desc_ar||''))}</div>
        <div class="product-price-row" style="margin-bottom:18px">
          <div>
            <div class="product-price" style="font-size:26px">${b.bundlePrice.toLocaleString()} <small style="font-size:14px">${t('د.أ','SAR')}</small></div>
            <div class="product-old-price">${original.toLocaleString()} ${t('د.أ','SAR')}</div>
            ${savings>0?`<div style="font-size:13px;font-weight:800;color:var(--success);margin-top:4px">${t('توفير','You save')} ${savings.toLocaleString()} ${t('د.أ','SAR')}</div>`:''}
          </div>
        </div>
        ${b.expiresAt ? `<div class="offer-countdown-badge"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${b.expiresAt}">${formatCountdown(b.expiresAt)||''}</span></div>` : ''}
        ${b.points?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;padding:6px 12px;border-radius:50px;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05));border:1.5px solid rgba(245,158,11,0.35);width:fit-content"><span style="font-size:14px">🏆</span><span style="font-size:12px;font-weight:800;color:#d97706">${b.points} ${t('نقطة','pts')}</span></div>`:''}
        <div style="font-weight:800;font-size:14px;color:var(--primary-dark);margin-bottom:10px">${t('محتويات الباقة','Bundle Contents')}</div>
        <div class="order-items-list" style="margin-bottom:20px">${itemsRows}</div>
        <button class="btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px" onclick="addBundleToCart(${b.id})">
          <i class="fas fa-cart-plus"></i> ${t('أضف الباقة للسلة','Add bundle to cart')}
        </button>
      </div>
    </div>`;
  showPage('productDetail');
  history.replaceState(null, '', window.location.pathname);
}

// =====================
// NEW PRODUCTS NOTIFICATION
// =====================
function getLastVisitDate() {
  return localStorage.getItem('dentapro_last_visit') || null;
}

function setLastVisitDate() {
  localStorage.setItem('dentapro_last_visit', new Date().toISOString());
}

function getNewProductsSinceLastVisit() {
  const lastVisit = getLastVisitDate();
  if (!lastVisit) return [];
  return products.filter(p => p.createdAt && new Date(p.createdAt) > new Date(lastVisit));
}

function showNewProductsNotification() {
  const newOnes = getNewProductsSinceLastVisit();
  if (!newOnes.length) return;

  const banner = document.createElement('div');
  banner.id = 'newProductsBanner';
  banner.style.cssText = `
    position: fixed; top: 90px; left: 50%; transform: translateX(-50%);
    z-index: 1800; background: linear-gradient(135deg, var(--accent), #00a896);
    color: #fff; padding: 14px 24px; border-radius: 50px;
    box-shadow: 0 8px 24px rgba(0,194,168,0.4);
    display: flex; align-items: center; gap: 12px; cursor: pointer;
    animation: slideIn 0.4s ease; font-weight: 700; font-size: 14px;
  `;
  banner.innerHTML = `
    <i class="fas fa-bell" style="font-size:18px"></i>
    <span>🎉 ${newOnes.length} منتج جديد أُضيف! اضغط للتصفح</span>
    <i class="fas fa-times" style="margin-right:4px;opacity:0.8" onclick="event.stopPropagation();document.getElementById('newProductsBanner').remove()"></i>
  `;
  banner.onclick = () => {
    banner.remove();
    scrollToProducts();
  };
  document.body.appendChild(banner);

  setTimeout(() => { if (document.getElementById('newProductsBanner')) banner.remove(); }, 8000);
}

function isNewProduct(p) {
  const lastVisit = getLastVisitDate();
  if (!lastVisit || !p.createdAt) return false;
  return new Date(p.createdAt) > new Date(lastVisit);
}
// =====================
// USER ACTIVITY LOG
// =====================
async function logActivity(type, details = {}) {
  if (!currentUser) return;
  const entry = {
    email: currentUser.email,
    name: currentUser.name,
    type, // 'login' | 'add_to_cart' | 'order_placed' | 'register' | 'profile_updated'
    details,
    createdAt: new Date().toISOString()
  };
  try {
    if (window._fbAddDoc && window._fbCollection && window._db) {
      await window._fbAddDoc(window._fbCollection(window._db, 'activity_log'), entry);
    }
  } catch(e) {
    console.warn('logActivity:', e.message);
  }
}

var ACTIVITY_LABELS = {
  login: { icon: 'fa-sign-in-alt', label: 'تسجيل دخول', color: '#0a5c8a' },
  register: { icon: 'fa-user-plus', label: 'إنشاء حساب', color: '#00c2a8' },
  add_to_cart: { icon: 'fa-cart-plus', label: 'أضاف منتج للسلة', color: '#1a8bbf' },
  order_placed: { icon: 'fa-shopping-bag', label: 'أرسل طلباً', color: '#22c55e' },
  profile_updated: { icon: 'fa-user-edit', label: 'حدّث ملفه الشخصي', color: '#f59e0b' },
};

function activityLabelHTML(type) {
  const a = ACTIVITY_LABELS[type] || { icon: 'fa-circle', label: type, color: '#5a7a90' };
  return `<i class="fas ${a.icon}" style="color:${a.color}"></i> ${a.label}`;
}
// =====================
// PRODUCT COMPARE
// =====================
function loadCompareList() {
  try {
    const saved = localStorage.getItem('dentapro_compare');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}
var compareList = loadCompareList();

function saveCompareList() {
  localStorage.setItem('dentapro_compare', JSON.stringify(compareList));
}

function isInCompare(id) {
  return compareList.includes(id);
}

function toggleCompare(id) {
  if (isInCompare(id)) {
    compareList = compareList.filter(x => x !== id);
  } else {
    if (compareList.length >= 3) {
      showToast('⚠️ يمكنك مقارنة 3 منتجات كحد أقصى', 'error');
      return;
    }
    compareList.push(id);
  }
  saveCompareList();
  renderProducts();
  renderCompareBar();
}

function clearCompare() {
  compareList = [];
  saveCompareList();
  renderProducts();
  renderCompareBar();
}

function renderCompareBar() {
  const bar = document.getElementById('compareBar');
  const itemsDiv = document.getElementById('compareBarItems');
  if (!compareList.length) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  itemsDiv.innerHTML = compareList.map(id => {
    const p = products.find(x => x.id === id);
    if (!p) return '';
    return `
      <div class="compare-bar-chip">
        ${p.image ? `<img src="${cldOptimize(p.image,60)}" loading="lazy">` : `<span class="emoji-mini">${p.icon}</span>`}
        <span style="font-size:12px;font-weight:600;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.en}</span>
        <button onclick="toggleCompare(${id})"><i class="fas fa-times-circle"></i></button>
      </div>`;
  }).join('');
}

function openComparePage() {
  if (compareList.length < 2) {
    showToast('⚠️ اختر منتجين على الأقل للمقارنة', 'error');
    return;
  }
  renderCompareTable();
  showPage('compare');
}

function renderCompareTable() {
  const wrap = document.getElementById('compareTableWrap');
  const items = compareList.map(id => products.find(x => x.id === id)).filter(Boolean);
  if (!items.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted)">لا توجد منتجات للمقارنة</div>`;
    return;
  }
  const rows = [
    { label: 'الصورة', render: p => p.image ? `<img src="${cldOptimize(p.image,160)}" style="width:80px;height:80px;border-radius:10px;object-fit:cover" loading="lazy">` : `<span style="font-size:40px">${p.icon}</span>` },
    { label: 'الاسم', render: p => escHtml(p.en) },
    { label: 'الماركة', render: p => escHtml(p.brand) },
    { label: 'السعر', render: p => `<strong style="color:var(--primary)">${p.price.toLocaleString()} د.أ</strong>` },
    { label: 'السعر القديم', render: p => p.old ? `${p.old.toLocaleString()} د.أ` : '—' },
    { label: 'الحجم', render: p => p.unitQty ? escHtml(p.unitQty) : '—' },
    { label: 'بلد المنشأ', render: p => escHtml(p.country) || '—' },
    { label: 'نقاط الشراء', render: p => p.points ? `🏆 ${p.points}` : '—' },
    { label: 'المخزون', render: p => (p.stock !== undefined && p.stock !== null) ? p.stock : 'غير محدد' },
    { label: '', render: p => `<button class="btn-primary" style="padding:8px 18px;font-size:12px" onclick="addToCart(${p.id})">
        <i class="fas fa-cart-plus"></i> أضف للسلة</button>` },
  ];

  wrap.innerHTML = `
    <div class="compare-table-wrap">
      <table class="compare-table">
        ${rows.map(row => `
          <tr>
            <th>${row.label}</th>
            ${items.map(p => `<td>${row.render(p)}</td>`).join('')}
          </tr>`).join('')}
      </table>
    </div>`;
}

// =====================
// FAVORITES
// =====================
function loadFavoritesList() {
  try {
    const saved = localStorage.getItem('dentapro_favorites');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}
var favoritesList = loadFavoritesList();

function saveFavoritesList() {
  localStorage.setItem('dentapro_favorites', JSON.stringify(favoritesList));
}

function isFavorite(id) {
  return favoritesList.includes(id);
}

function toggleFavorite(id) {
  if (isFavorite(id)) {
    favoritesList = favoritesList.filter(x => x !== id);
    showToast('💔 تمت الإزالة من المفضلة', '');
  } else {
    favoritesList.push(id);
    showToast('❤️ تمت الإضافة للمفضلة', 'success');
  }
  saveFavoritesList();
  renderProducts();
  if (document.getElementById('favoritesPage')?.classList.contains('active')) {
    renderFavoritesPage();
  }
}

function openFavoritesPage() {
  showPage('favorites');
  renderFavoritesPage();
}

async function renderFavoriteQuotes() {
  const section = document.getElementById('favoriteQuotesSection');
  const list = document.getElementById('favoriteQuotesList');
  if (!section || !list) return;
  if (!currentUser) { section.style.display = 'none'; return; }

  const localIds = loadQuoteFavorites().map(String);
  let quotes = [];
  try {
    quotes = await getClientQuotes(currentUser.email);
    window._cachedMyQuotes = quotes;
  } catch (e) {
    console.warn('renderFavoriteQuotes:', e);
  }
  if (Array.isArray(window._cachedMyQuotes)) {
    const byId = new Map(quotes.map(q => [String(q._docId), q]));
    window._cachedMyQuotes.forEach(q => {
      if (!byId.has(String(q._docId))) quotes.push(q);
    });
  }
  const savedQuotes = quotes.filter(q => q.status === 'saved' || localIds.includes(String(q._docId)));

  if (!savedQuotes.length) { section.style.display = 'none'; list.innerHTML = ''; return; }
  section.style.display = 'block';
  list.innerHTML = savedQuotes.map(q => {
    const total = (q.items || []).reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.qty || 1)), 0);
    const names = (q.items || []).slice(0, 3).map(item => escHtml(item.ar || item.en || '')).join('، ');
    return `<div style="background:#fff;border:1px solid #e9d5ff;border-radius:16px;padding:16px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><strong style="color:#7e22ce">عرض السعر #${escHtml(q.id || q._docId)}</strong>
          <div style="font-size:12px;color:var(--text-muted);margin-top:5px">${names}${(q.items || []).length > 3 ? ' وآخرون' : ''}</div></div>
        <strong style="color:var(--primary)">${total.toLocaleString()} د.أ</strong>
      </div>
      <button class="btn-primary" style="padding:8px 18px;font-size:12px;margin-top:12px" onclick="acceptQuote('${q._docId}')">
        <i class="fas fa-check"></i> أوافق وأكمل الطلب
      </button>
    </div>`;
  }).join('');
}

async function renderFavoriteQuotes() {
  const section = document.getElementById('favoriteQuotesSection');
  const list = document.getElementById('favoriteQuotesList');
  if (!section || !list) return;
  if (!currentUser) { section.style.display = 'none'; return; }

  const localIds = loadQuoteFavorites().map(String);
  let quotes = [];
  try {
    quotes = await getClientQuotes(currentUser.email);
    window._cachedMyQuotes = quotes;
  } catch (e) {
    console.warn('renderFavoriteQuotes:', e);
  }
  if (Array.isArray(window._cachedMyQuotes)) {
    const byId = new Map(quotes.map(q => [String(q._docId), q]));
    window._cachedMyQuotes.forEach(q => {
      if (!byId.has(String(q._docId))) quotes.push(q);
    });
  }
  const savedQuotes = quotes.filter(q => q.status === 'saved' || localIds.includes(String(q._docId)));

  if (!savedQuotes.length) { section.style.display = 'none'; list.innerHTML = ''; return; }
  section.style.display = 'block';
  list.innerHTML = savedQuotes.map(q => {
    const total = (q.items || []).reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.qty || 1)), 0);
    const names = (q.items || []).slice(0, 3).map(item => escHtml(item.ar || item.en || '')).join('، ');
    return `<div style="background:#fff;border:1px solid #e9d5ff;border-radius:16px;padding:16px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><strong style="color:#7e22ce">عرض السعر #${escHtml(q.id || q._docId)}</strong>
          <div style="font-size:12px;color:var(--text-muted);margin-top:5px">${names}${(q.items || []).length > 3 ? ' وآخرون' : ''}</div></div>
        <strong style="color:var(--primary)">${total.toLocaleString()} د.أ</strong>
      </div>
      <button class="btn-primary" style="padding:8px 18px;font-size:12px;margin-top:12px" onclick="acceptQuote('${q._docId}')">
        <i class="fas fa-check"></i> أوافق وأكمل الطلب
      </button>
    </div>`;
  }).join('');
}

async function renderFavoriteQuotes() {
  const section = document.getElementById('favoriteQuotesSection');
  const list = document.getElementById('favoriteQuotesList');
  if (!section || !list) return;
  if (!currentUser) { section.style.display = 'none'; return; }

  const localIds = loadQuoteFavorites().map(String);
  let quotes = [];
  try {
    quotes = await getClientQuotes(currentUser.email);
    window._cachedMyQuotes = quotes;
  } catch (e) {
    console.warn('renderFavoriteQuotes:', e);
  }
  if (Array.isArray(window._cachedMyQuotes)) {
    const byId = new Map(quotes.map(q => [String(q._docId), q]));
    window._cachedMyQuotes.forEach(q => {
      if (!byId.has(String(q._docId))) quotes.push(q);
    });
  }
  const savedQuotes = quotes.filter(q => q.status === 'saved' || localIds.includes(String(q._docId)));

  if (!savedQuotes.length) { section.style.display = 'none'; list.innerHTML = ''; return; }
  section.style.display = 'block';
  list.innerHTML = savedQuotes.map(q => {
    const total = (q.items || []).reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.qty || 1)), 0);
    const names = (q.items || []).slice(0, 3).map(item => escHtml(item.ar || item.en || '')).join('، ');
    return `<div style="background:#fff;border:1px solid #e9d5ff;border-radius:16px;padding:16px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><strong style="color:#7e22ce">عرض السعر #${escHtml(q.id || q._docId)}</strong>
          <div style="font-size:12px;color:var(--text-muted);margin-top:5px">${names}${(q.items || []).length > 3 ? ' وآخرون' : ''}</div></div>
        <strong style="color:var(--primary)">${total.toLocaleString()} د.أ</strong>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn-primary" style="padding:8px 18px;font-size:12px" onclick="acceptQuote('${q._docId}')">
          <i class="fas fa-check"></i> أوافق وأكمل الطلب
        </button>
        <button onclick="removeQuoteFromFavorites('${q._docId}')" style="padding:8px 18px;border-radius:50px;background:#fff5f5;color:var(--danger);border:2px solid #fecaca;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fas fa-trash"></i> حذف من المفضلة
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderFavoritesPage() {
  const wrap = document.getElementById('favoritesGrid');
  if (!wrap) return;
  renderFavoriteQuotes();
  renderFavoriteQuotes();
  renderFavoriteQuotes();
  const items = favoritesList.map(id => products.find(x => x.id === id)).filter(Boolean);
  if (!items.length) {
    wrap.innerHTML = `
      <div class="empty-orders" style="grid-column:1/-1">
        <i class="fas fa-heart"></i>
        <h3>${t('لا توجد منتجات في المفضلة','No favorite products yet')}</h3>
        <p>${t('أضف منتجات للمفضلة بالضغط على القلب','Tap the heart icon to add favorites')}</p>
        <button class="btn-primary" style="margin-top:16px" onclick="showPage('home')">${t('تسوّق الآن','Shop Now')}</button>
      </div>`;
    return;
  }
  wrap.innerHTML = items.map(p => {
    const inCart = cart.find(c => c.id === p.id);
    const outOfStock = p.stock !== undefined && p.stock !== null && p.stock <= 0;
    return `
    <div class="product-card">
      <button class="favorite-toggle-btn active" style="top:12px"
        onclick="toggleFavorite(${p.id})" title="${t('إزالة من المفضلة','Remove from favorites')}">
        <i class="fas fa-heart"></i>
      </button>
      <div class="product-img-wrap" onclick="openProductDetail(${p.id})" style="cursor:pointer;${outOfStock?'opacity:0.5':''}" title="${t('التفاصيل','Details')}">
        ${p.image
          ? `<img src="${cldOptimize(p.image, 400)}" alt="${escHtml(p.ar)}" loading="lazy" decoding="async" />`
          : `<span class="emoji-fallback">${p.icon}</span>`}
      </div>
      <div class="product-info">
        <div class="product-brand">${escHtml(p.brand)}</div>
        <div class="product-name" onclick="openProductDetail(${p.id})" style="cursor:pointer">${escHtml(p.en)}</div>
        <button onclick="openProductDetail(${p.id})" style="margin:8px 0 6px;padding:5px 12px;border-radius:50px;background:transparent;border:1.5px solid var(--primary-light);color:var(--primary);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;width:fit-content">
          <i class="fas fa-info-circle"></i> ${t('التفاصيل','Details')}
        </button>
        <div class="product-desc">${escHtml(currentLang==='en'?p.desc_en:p.desc_ar)}</div>
        <div class="product-price-row">
          <div>
            <div class="product-price">${p.price.toLocaleString()} <small style="font-size:13px">${t('د.أ','SAR')}</small></div>
            ${p.old ? `<div class="product-old-price">${p.old.toLocaleString()} ${t('د.أ','SAR')}</div>` : ''}
          </div>
          <button class="add-to-cart ${inCart?'added':''}" onclick="${outOfStock?'':`addToCart(${p.id})`}"
            ${outOfStock?'disabled style="opacity:0.4;cursor:not-allowed"':''}>
            <i class="fas ${inCart?'fa-check':(outOfStock?'fa-ban':'fa-cart-plus')}"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// =====================
// MY QUOTES PAGE (CLIENT)
// =====================
// =====================
// REORDERED PRODUCTS PAGE (CLIENT)
// =====================
var _reorderSortMode = 'recent';
var _cachedReorderData = null;

async function updateLatestSectionButton() {
  const section = document.getElementById('latestProductsSection');
  const btnText = document.getElementById('reorderEntryBtnText');
  if (!section || !btnText) return;
  if (!currentUser || currentUser.role !== 'client') {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const clinic = currentUser.clinic || currentUser.name || '';
  btnText.textContent = `${t('المنتجات التي طلبتها','Products you ordered from')} ${clinic} ${t('سابقاً','before')}`;
}

async function openReorderedProductsPage() {
  if (!currentUser) { openAuthModal('login'); return; }
  showPage('reordered');
  await renderReorderedProductsPage();
}

async function fetchReorderData() {
  if (_cachedReorderData) return _cachedReorderData;
  const q = window._fbQuery(window._fbOrdersRef(), window._fbWhere('clientEmail', '==', currentUser.email));
  const snap = await window._fbGetDocs(q);
  const myOrders = snap.docs.map(d => d.data());

  const map = {}; // productId -> { product, count, lastDate }
  myOrders.forEach(o => {
    (o.items || []).forEach(item => {
      if (!item.id) return; // تجاهل المواد المخصصة بدون معرّف منتج حقيقي
      const key = String(item.id);
      if (!map[key]) map[key] = { id: item.id, count: 0, lastDate: o.createdAt };
      map[key].count += 1;
      if (new Date(o.createdAt) > new Date(map[key].lastDate)) map[key].lastDate = o.createdAt;
    });
  });

  const ids = Object.keys(map).map(k => isNaN(k) ? k : parseInt(k));
  await fetchProductsByIds(ids);

  const result = Object.values(map)
    .map(entry => {
      const product = products.find(p => String(p.id) === String(entry.id));
      return product ? { product, count: entry.count, lastDate: entry.lastDate } : null;
    })
    .filter(Boolean);

  _cachedReorderData = result;
  return result;
}

function setReorderSort(mode) {
  _reorderSortMode = mode;
  const recentBtn = document.getElementById('reorderSortRecentBtn');
  const freqBtn = document.getElementById('reorderSortFrequentBtn');
  const activeStyle = 'background:var(--primary);color:#fff;border-color:var(--primary-light)';
  const inactiveStyle = 'background:#fff;color:var(--text-muted);border-color:var(--border)';
  if (recentBtn) recentBtn.style.cssText = recentBtn.style.cssText.split(';')[0] + ';padding:8px 16px;border-radius:50px;border:1.5px solid;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;' + (mode==='recent'?activeStyle:inactiveStyle);
  if (freqBtn) freqBtn.style.cssText = freqBtn.style.cssText.split(';')[0] + ';padding:8px 16px;border-radius:50px;border:1.5px solid;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;' + (mode==='frequent'?activeStyle:inactiveStyle);
  renderReorderedProductsPage();
}

async function renderReorderedProductsPage() {
  const grid = document.getElementById('reorderedProductsGrid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:4px"></div>جاري التحميل...</div>`;

  let data = await fetchReorderData();
  if (!data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)"><i class="fas fa-box-open" style="font-size:40px;opacity:0.2;display:block;margin-bottom:12px"></i>لم تطلب أي منتج بعد</div>`;
    return;
  }

  data = [...data].sort((a, b) => _reorderSortMode === 'frequent'
    ? b.count - a.count
    : new Date(b.lastDate) - new Date(a.lastDate));

  grid.innerHTML = data.map(entry => reorderedCardHTML(entry.product)).join('');
}

function reorderedCardHTML(p) {
  const inCart = cart.find(c => String(c.id) === String(p.id));
  const outOfStock = p.stock !== undefined && p.stock !== null && p.stock <= 0;
  return `
    <div class="product-card" onclick="openProductDetail(${p.id})" style="cursor:pointer;height:190px">
      <div class="product-img-wrap" style="height:150px;position:relative">
        ${p.image ? `<img src="${cldOptimize(p.image,300)}" alt="${escHtml(p.en)}" loading="lazy" style="width:100%;height:100%;object-fit:contain">` : `<span class="emoji-fallback">${p.icon}</span>`}
        <div style="position:absolute;bottom:0;left:0;right:0;height:55px;background:linear-gradient(to top, rgba(0,0,0,0.28), transparent);pointer-events:none"></div>
        <div style="position:absolute;bottom:8px;left:8px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;font-weight:800;font-size:12px;padding:5px 12px;border-radius:50px;width:fit-content">
          ${p.price.toLocaleString()} ${t('د.أ','SAR')}
        </div>
        <button onclick="event.stopPropagation();${outOfStock?'':`addToCart(${p.id})`}" ${outOfStock?'disabled style="opacity:0.4"':''}
          style="position:absolute;bottom:8px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;color:var(--primary);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
          <i class="fas ${inCart?'fa-check':(outOfStock?'fa-ban':'fa-cart-plus')}"></i>
        </button>
      </div>
      <div class="product-info" style="padding:8px 10px">
        <div class="product-name" style="font-size:13px;margin:0;line-height:1.25">${escHtml(p.en)}</div>
      </div>
    </div>`;
}

async function openMyQuotesPage() {
  if (!currentUser) { openAuthModal('login'); return; }
  showPage('myQuotes');
  renderMyQuotesPage();
}

async function renderMyQuotesPage() {
  const container = document.getElementById('myQuotesList');
  container.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 14px;width:28px;height:28px;border-width:4px"></div>
      جاري تحميل عروض الأسعار...
    </div>`;

  const quotes = await getClientQuotes(currentUser.email);
  window._cachedMyQuotes = quotes;

  let myOrdersForLink = [];
  try {
    const oq = window._fbQuery(window._fbOrdersRef(), window._fbWhere('clientEmail', '==', currentUser.email));
    const osnap = await window._fbGetDocs(oq);
    myOrdersForLink = osnap.docs.map(d => d.data());
  } catch(e) { myOrdersForLink = []; }
  function findMyLinkedOrder(q) {
    return myOrdersForLink.find(o =>
      o.sourceQuoteId === q.id || o.id === ('DP-' + String(q.id || '').replace('QT-', ''))
    );
  }

  if (!quotes.length) {
    container.innerHTML = `
      <div class="empty-orders">
        <i class="fas fa-file-invoice-dollar"></i>
        <h3>لا توجد طلبات عروض أسعار بعد</h3>
        <p>اطلب عرض سعر لأي مادة من الصفحة الرئيسية</p>
        <button class="btn-primary" style="margin-top:16px" onclick="showPage('home')">تسوّق الآن</button>
      </div>`;
    return;
  }

  container.innerHTML = quotes.map(q => {
    const date = new Date(q.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric' });
    const isPriced = q.status === 'priced';
    const totalPriced = isPriced ? q.items.reduce((s,i) => s + ((i.unitPrice||0) * (i.qty||1)), 0) : 0;

    const itemsHtml = q.items.map(i => `
      <div class="order-item-row">
        <div class="order-item-icon">${i.image ? `<img src="${cldOptimize(i.image,60)}" style="width:100%;height:100%;object-fit:contain" loading="lazy">` : i.icon}</div>
        <div style="flex:1;font-weight:600;color:var(--primary-dark)">${escHtml(i.ar)}</div>
        <div style="color:var(--text-muted)">${i.qty ? `× ${i.qty}` : t('الكمية غير محددة','Qty not specified')}</div>
        ${isPriced ? `<div style="font-weight:800;color:var(--primary)">${(i.unitPrice||0).toLocaleString()} د.أ${i.qty?` × ${i.qty} = ${((i.unitPrice||0)*i.qty).toLocaleString()} د.أ`:''}</div>` : ''}
      </div>`).join('');

    let actionsHtml = '';
    if (q.status === 'priced') {
      actionsHtml = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn-primary" style="padding:9px 20px;font-size:13px" onclick="acceptQuote('${q._docId}')">
            <i class="fas fa-check"></i> أوافق وأكمل الطلب
          </button>
          <button onclick="rejectQuote('${q._docId}')" style="padding:9px 20px;border-radius:50px;background:#fff5f5;color:var(--danger);border:2px solid #fecaca;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            <i class="fas fa-times"></i> رفض العرض
          </button>
          <button onclick="saveQuoteToFavorites('${q._docId}')" style="padding:9px 20px;border-radius:50px;background:#fdf4ff;color:#7e22ce;border:2px solid #e9d5ff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            <i class="fas fa-bookmark"></i> حفظ بالمفضلة لاحقاً
          </button>
        </div>`;
    } else if (q.status === 'saved') {
      actionsHtml = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn-primary" style="padding:9px 20px;font-size:13px" onclick="acceptQuote('${q._docId}')">
            <i class="fas fa-check"></i> أوافق وأكمل الطلب الآن
          </button>
          <button onclick="rejectQuote('${q._docId}')" style="padding:9px 20px;border-radius:50px;background:#fff5f5;color:var(--danger);border:2px solid #fecaca;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            <i class="fas fa-times"></i> رفض العرض
          </button>
        </div>`;
    } else if (q.status === 'accepted') {
      const linkedOrder = findMyLinkedOrder(q);
      const orderStatus = linkedOrder ? (linkedOrder.status || 'pending') : 'pending';
      actionsHtml = `
        <div style="margin-top:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px">
            <div style="font-size:13px;color:#15803d;font-weight:700"><i class="fas fa-check-circle"></i> تمت الموافقة على العرض</div>
            ${statusBadgeHTML(orderStatus)}
          </div>
          ${trackStepsHTML(orderStatus)}
        </div>`;
    } else if (q.status === 'rejected') {
      actionsHtml = `<div style="margin-top:10px;font-size:13px;color:var(--danger);font-weight:700"><i class="fas fa-times-circle"></i> تم رفض هذا العرض</div>`;
    } else if (q.status === 'pending') {
      actionsHtml = `<div style="margin-top:10px;font-size:13px;color:#c2410c;font-weight:700"><i class="fas fa-clock"></i> سيتم الرد على طلبك بعرض السعر قريباً</div>`;
    }

    return `
    <div class="order-track-card">
      <div class="order-track-header">
        <div>
          <div class="order-track-num"><i class="fas fa-file-invoice-dollar" style="color:var(--primary-light)"></i> #${q.id}</div>
          <div class="order-track-date">📅 ${date}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${quoteStatusBadge(q.status)}
          ${isPriced || q.status==='saved' ? `<div class="order-track-total">${totalPriced.toLocaleString()} د.أ</div>` : ''}
        </div>
      </div>
      <div class="order-track-body">
        <div class="order-items-list">${itemsHtml}</div>
        ${q.notes ? `<div style="margin-top:12px;padding:10px 14px;background:#f8fbfd;border-radius:10px;font-size:13px;color:var(--text-muted)"><i class="fas fa-sticky-note" style="color:var(--accent2)"></i> ${escHtml(q.notes)}</div>` : ''}
        ${actionsHtml}
      </div>
    </div>`;
  }).join('');
}

async function acceptQuote(docId) {
  const quotes = window._cachedMyQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) return;
  if (!confirm('سيتم إرسال طلبك للإدارة بناءً على الأسعار المحددة. هل تريد المتابعة؟')) return;

  const items = q.items.map(item => ({
    productId: item.productId,
    ar: item.ar,
    en: item.en,
    icon: item.icon,
    image: item.image || null,
    isCustom: item.isCustom || false,
    qty: item.qty || 1,
    unitPrice: item.unitPrice || 0,
  }));

  window._qoQuoteDocId = docId;
  window._qoQuoteIdStr = q.id;
  proceedQuickOrderCheckout(items, false);
}

async function rejectQuote(docId) {
  if (!confirm('هل أنت متأكد من رفض عرض السعر؟')) return;
  try {
    await updateQuote(docId, { status: 'rejected' });
    showToast('🚫 تم رفض العرض', '');
    renderMyQuotesPage();
  } catch(e) {
    showToast('❌ حدث خطأ، تحقق من الاتصال', 'error');
  }
}

async function saveQuoteToFavorites(docId) {
  if (!navigator.onLine) {
    showToast('❌ لا يوجد اتصال بالإنترنت حالياً', 'error');
    return;
  }
  saveQuoteFavoriteId(String(docId));
  if (Array.isArray(window._cachedMyQuotes)) {
    const cached = window._cachedMyQuotes.find(q => String(q._docId) === String(docId));
    if (cached) cached.status = 'saved';
  }
  let synced = true;
  try {
    await updateQuote(docId, { status: 'saved' });
  } catch(e) {
    synced = false;
    console.warn('تعذر مزامنة حالة العرض مع Firebase، تم حفظه محلياً:', e);
  }
  showToast(synced ? '🔖 تم حفظ عرض السعر في المفضلة' : '🔖 تم حفظ العرض في مفضلتك على هذا الجهاز', 'success');
  await renderMyQuotesPage();
  await renderFavoriteQuotes();
}
  async function removeQuoteFromFavorites(docId) {
  if (!confirm('هل تريد إزالة عرض السعر هذا من المفضلة؟')) return;
  removeQuoteFavoriteId(String(docId));
  if (Array.isArray(window._cachedMyQuotes)) {
    const cached = window._cachedMyQuotes.find(q => String(q._docId) === String(docId));
    if (cached && cached.status === 'saved') cached.status = 'priced';
  }
  try {
    await updateQuote(docId, { status: 'priced' });
  } catch(e) {
    console.warn('تعذر تحديث الحالة على Firebase، تمت الإزالة محلياً فقط:', e);
  }
  showToast('🗑️ تم حذف عرض السعر من المفضلة', '');
  await renderFavoriteQuotes();
}
// =====================
// PRODUCT DETAIL PAGE
// =====================
var lastPageBeforeDetail = 'home';
var lastScrollYBeforeDetail = 0;

function openProductDetail(id, _isRefresh) {
  window.lastViewedProductId = id;
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!_isRefresh) {
    const activeSection = document.querySelector('.page-section.active');
    lastPageBeforeDetail = activeSection ? activeSection.id : 'homePage';
    lastScrollYBeforeDetail = window.scrollY;
  }

  const inCart = cart.find(x => x.id === id);
  const outOfStock = p.stock !== undefined && p.stock !== null && p.stock <= 0;
  const galleryImages = [p.image, ...(p.images||[])].filter(Boolean);
  const container = document.getElementById('productDetailContent');
  container.innerHTML = `
    <div class="product-detail-grid">
      <div>
        <div class="product-img-wrap" id="pdImageWrap" style="height:340px;border-radius:var(--radius);overflow:hidden;position:relative">
          ${p.badge ? `<div class="product-badge">${t(escHtml(p.badge), p.badge==='جديد'?'New':p.badge==='الأكثر مبيعاً'?'Best Seller':escHtml(p.badge))}</div>` : ''}
          ${galleryImages.length
            ? `<img id="pdMainImg" src="${cldOptimize(galleryImages[0], 600)}" alt="${escHtml(p.ar)}" loading="lazy" decoding="async" style="transition:transform .25s ease;transform-origin:center center" />`
            : `<span class="emoji-fallback">${p.icon}</span>`}
        </div>
        ${galleryImages.length > 1 ? `
        <div class="pd-gallery-thumbs">
          ${galleryImages.map((img,idx) => `
            <div class="pd-gallery-thumb ${idx===0?'active':''}" onclick="switchGalleryImage(this,'${img}')">
              <img src="${cldOptimize(img,120)}" loading="lazy">
            </div>`).join('')}
        </div>` : ''}
      </div>
      <div>
        <div class="product-name" style="font-size:22px;margin-bottom:8px">${escHtml(p.en)}</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button onclick="shareProductWhatsApp(${p.id})"
            style="padding:6px 14px;border-radius:50px;background:#e8fdf2;color:#16a34a;
                   border:1.5px solid #bbf7d0;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;
                   display:flex;align-items:center;gap:6px">
            <i class="fab fa-whatsapp"></i> ${t('مشاركة','Share')}
          </button>
          <button onclick="copyProductLink(${p.id})"
            style="padding:6px 14px;border-radius:50px;background:#f0f8ff;color:var(--primary);
                   border:1.5px solid var(--border);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;
                   display:flex;align-items:center;gap:6px">
            <i class="fas fa-link"></i> ${t('نسخ الرابط','Copy Link')}
          </button>
        </div>
        <div class="product-stars" style="margin-bottom:12px">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
          <span>(${20 + (p.id * 17 % 80)})</span>
        </div>
        ${p.points ? `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;
                    padding:6px 12px;border-radius:50px;
                    background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05));
                    border:1.5px solid rgba(245,158,11,0.35);width:fit-content">
          <span style="font-size:14px">🏆</span>
          <span style="font-size:12px;font-weight:800;color:#d97706">
            ${p.points} ${t('نقطة','pts')}
          </span>
        </div>` : ''}
        ${renderQtyOfferTableHTML(p)}
        <div class="product-price-row" style="margin-bottom:18px">
          <div>
            <div class="product-price" style="font-size:26px">${p.price.toLocaleString()} <small style="font-size:14px">${t('د.أ','SAR')}</small></div>
            ${p.unitQty ? `<div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-top:2px">${escHtml(p.unitQty)}</div>` : ''}
            ${p.old ? `<div class="product-old-price">${p.old.toLocaleString()} ${t('د.أ','SAR')}</div>` : ''}
          </div>
        </div>
        ${outOfStock ? `<div style="background:#fff5f5;border:1.5px solid #fecaca;color:#e53e3e;border-radius:10px;
                    padding:10px 14px;margin-bottom:14px;font-weight:800;text-align:center">
          ${t('عذراً، نفذت كمية هذا المنتج حاليًا','Sorry, this product is currently out of stock')}
        </div>` : ''}
        <button class="btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px"
          onclick="${outOfStock?'':`addToCart(${p.id}); openProductDetail(${p.id}, true)`}"
          ${outOfStock&&!inCart?'disabled style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0.5;cursor:not-allowed"':''}>
          <i class="fas ${inCart?'fa-trash-alt':(outOfStock?'fa-ban':'fa-cart-plus')}"></i>
          ${inCart ? t('إزالة من السلة','Remove from cart') : (outOfStock ? t('غير متوفر','Unavailable') : t('أضف للسلة','Add to cart'))}
        </button>

        <div class="pd-tabs">
          <button class="pd-tab-btn active" id="pdTabBtnDesc" onclick="switchProductTab('desc')">
            <i class="fas fa-align-right"></i> ${t('الوصف','Description')}
          </button>
          <button class="pd-tab-btn" id="pdTabBtnSpecs" onclick="switchProductTab('specs')">
            <i class="fas fa-list-ul"></i> ${t('المواصفات','Specifications')}
          </button>
          <button class="pd-tab-btn" id="pdTabBtnReviews" onclick="switchProductTab('reviews')">
            <i class="fas fa-star"></i> ${t('التقييمات','Reviews')}
          </button>
        </div>

        <div class="pd-tab-panel active" id="pdTabPanelDesc">
          <div class="product-desc" style="font-size:14px;line-height:1.9;-webkit-line-clamp:unset;display:block;overflow:visible;white-space:pre-line">${escHtml(currentLang==='en'?p.desc_en:p.desc_ar)}</div>
        </div>

        <div class="pd-tab-panel" id="pdTabPanelSpecs">
          <table class="pd-specs-table">
            <tr><td>${t('الماركة','Brand')}</td><td>${escHtml(p.brand)}</td></tr>
            ${p.country ? `<tr><td>${t('بلد المنشأ','Origin')}</td><td>${escHtml(p.country)}</td></tr>` : ''}
            <tr><td>${t('القسم','Category')}</td><td>${escHtml((categories.find(c=>c.id===p.cat)||{}).ar || p.cat)}</td></tr>
            ${p.unitQty ? `<tr><td>${t('الحجم','Size')}</td><td>${escHtml(p.unitQty)}</td></tr>` : ''}
            ${p.points ? `<tr><td>${t('نقاط الشراء','Purchase Points')}</td><td>🏆 ${p.points}</td></tr>` : ''}
            ${(p.stock !== undefined && p.stock !== null) ? `<tr><td>${t('المخزون','Stock')}</td><td>${p.stock}</td></tr>` : ''}
          </table>
        </div>

        <div class="pd-tab-panel" id="pdTabPanelReviews">
          <div class="pd-rating-summary">
            <div class="pd-rating-num">4.5</div>
            <div>
              <div class="product-stars" style="margin-bottom:4px">
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">${20 + (p.id * 17 % 80)} ${t('تقييم','ratings')}</div>
            </div>
          </div>
          <div class="pd-reviews-empty">
            <i class="fas fa-comment-slash"></i>
            <div style="font-weight:700;color:var(--text)">${t('لا توجد تقييمات مكتوبة بعد','No written reviews yet')}</div>
            <div style="font-size:13px;margin-top:4px">${t('كن أول من يشارك تجربته مع هذا المنتج','Be the first to share your experience')}</div>
          </div>
        </div>
      </div>
    </div>
    <div id="similarProductsWrap" style="display:none;margin-top:40px;max-width:1100px">
      <div class="section-header" style="text-align:right;margin-bottom:20px">
        <div class="section-tag">✨ <span data-ar="قد يعجبك أيضاً" data-en="You May Also Like">قد يعجبك أيضاً</span></div>
        <h2 class="section-title" style="margin-bottom:0;font-size:20px"><span data-ar="منتجات مشابهة" data-en="Similar Products">منتجات مشابهة</span></h2>
      </div>
      <div class="products-grid" id="similarProductsGrid"></div>
    </div>
  `;
  if (!_isRefresh) showPage('productDetail');
  if (!_isRefresh) history.replaceState(null, '', getProductShareUrl(id));
  renderSimilarProducts(p);
}

function closeProductDetail() {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(lastPageBeforeDetail).classList.add('active');
  window.scrollTo(0, lastScrollYBeforeDetail);
  history.replaceState(null, '', window.location.pathname);
}

function switchProductTab(tab) {
  const tabs = { desc:'Desc', specs:'Specs', reviews:'Reviews' };
  Object.keys(tabs).forEach(key => {
    const btn = document.getElementById(`pdTabBtn${tabs[key]}`);
    const panel = document.getElementById(`pdTabPanel${tabs[key]}`);
    if (btn) btn.classList.toggle('active', key === tab);
    if (panel) panel.classList.toggle('active', key === tab);
  });
}

function switchGalleryImage(el, url) {
  const mainImg = document.getElementById('pdMainImg');
  if (mainImg) mainImg.src = cldOptimize(url, 600);
  document.querySelectorAll('.pd-gallery-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function getProductShareUrl(id) {
  return `${window.location.origin}${window.location.pathname}?product=${id}`;
}

function shareProductWhatsApp(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const url = getProductShareUrl(id);
  const text = encodeURIComponent(
    `🦷 ${p.en}\n${p.price.toLocaleString()} ${t('د.أ','SAR')}\n${url}`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

async function copyProductLink(id) {
  const url = getProductShareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    showToast('✅ تم نسخ رابط المنتج', 'success');
  } catch (e) {
    showToast(url, '');
  }
}

// فتح المنتج تلقائياً إذا كان الرابط يحتوي ?product=ID
function openProductFromUrlIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const pid = parseInt(params.get('product'));
  if (pid && products.find(p => p.id === pid)) {
    openProductDetail(pid);
  }
}

// =====================
// إشعار الأدمن بالطلبات المعلّقة عند الدخول
// =====================
async function notifyPendingOrdersOnLogin() {
  try {
    const q = window._fbQuery(window._fbOrdersRef(), window._fbWhere('status', '==', 'pending'));
    const snap = await window._fbGetDocs(q);
    const count = snap.size;
    if (count === 0) return;

    showToast(`🔔 لديك ${count} طلب قيد الانتظار`, 'success');

    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('🔔 طلبات قيد الانتظار', {
        body: `لديك ${count} طلب يحتاج للمراجعة في DentaPro`,
        icon: '🦷'
      });
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('🔔 طلبات قيد الانتظار', {
          body: `لديك ${count} طلب يحتاج للمراجعة في DentaPro`,
          icon: '🦷'
        });
      }
    }
  } catch (e) {
    console.warn('notifyPendingOrdersOnLogin:', e);
  }
}

// =====================
// CART

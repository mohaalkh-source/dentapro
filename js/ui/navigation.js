// DentaPro domain module: extracted from the original implementation.
// CATEGORY MANAGEMENT
// =====================
function openAddCategory() {
  document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-folder-plus"></i> إضافة قسم جديد';
  document.getElementById('catNameAr').value = '';
  document.getElementById('catNameEn').value = '';
  document.getElementById('catId').value     = '';
  document.getElementById('catId').disabled  = false;
  document.getElementById('editCatId').value = '';
  document.getElementById('catFormError').style.display = 'none';
  resetCatImageUpload();
  renderCurrentCatList();
  document.getElementById('addCategoryModal').classList.add('open');
}

function closeAddCategory() {
  document.getElementById('addCategoryModal').classList.remove('open');
}

function renderCurrentCatList() {
  const list = document.getElementById('catCurrentList');
  // استثنِ "الكل"
  const filtered = categories.filter(c => c.id !== 'all');
  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px">لا توجد أقسام</div>`;
    return;
  }
  list.innerHTML = filtered.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 14px;background:#f8fbfd;border-radius:10px;
                border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px">
        ${c.image
          ? `<img src="${cldOptimize(c.image, 64)}" style="width:32px;height:32px;border-radius:8px;object-fit:cover" loading="lazy" decoding="async">`
          : `<span style="font-size:22px">${c.icon || '📁'}</span>`}
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--primary-dark)">${c.ar}</div>
          <div style="font-size:11px;color:var(--text-muted)">${c.en} · ID: ${c.id}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="editCategory('${c.id}')"
          style="padding:5px 12px;border-radius:50px;background:#e8f3fb;color:var(--primary);
                 border:none;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteCategory('${c.id}')"
          style="padding:5px 12px;border-radius:50px;background:#fff5f5;color:var(--danger);
                 border:none;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>`).join('');
}

function editCategory(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل القسم';
  document.getElementById('catNameAr').value = c.ar;
  document.getElementById('catNameEn').value = c.en;
  document.getElementById('catId').value     = c.id;
  document.getElementById('catId').disabled  = true;
  document.getElementById('editCatId').value = c.id;
  document.getElementById('catFormError').style.display = 'none';
  loadCatImagePreview(c.image || null);
}

function deleteCategory(id) {
  const inUse = products.some(p => p.cat === id);
  if (inUse) {
    document.getElementById('catFormErrorMsg').textContent = 'لا يمكن حذف قسم يحتوي على منتجات';
    document.getElementById('catFormError').style.display = 'flex';
    return;
  }
  const idx = categories.findIndex(c => c.id === id);
  if (idx !== -1) categories.splice(idx, 1);
  saveCategories();

  renderCurrentCatList();
  renderCategories();
  populateCategorySelects();
  renderProducts();
  showToast('🗑️ تم حذف القسم بنجاح', 'success');
}
function saveCategory() {
  const ar   = document.getElementById('catNameAr').value.trim();
  const en   = document.getElementById('catNameEn').value.trim();
  const id   = document.getElementById('catId').value.trim().toLowerCase().replace(/\s/g,'');
  const editId = document.getElementById('editCatId').value;
  const image = currentCategoryImage || null;

  const showErr = (msg) => {
    document.getElementById('catFormErrorMsg').textContent = msg;
    document.getElementById('catFormError').style.display = 'flex';
  };

  if (!ar || !en || !id) return showErr('يرجى ملء جميع الحقول المطلوبة');
  if (!/^[a-z0-9]+$/.test(id)) return showErr('المعرّف يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام فقط');

  if (editId) {
    const idx = categories.findIndex(c => c.id === editId);
    if (idx !== -1) { categories[idx] = { ...categories[idx], ar, en, image }; }
    saveCategories();
    document.getElementById('catFormError').style.display = 'none';
    document.getElementById('editCatId').value = '';
    document.getElementById('catId').disabled  = false;
    document.getElementById('catNameAr').value = '';
    document.getElementById('catNameEn').value = '';
    document.getElementById('catId').value     = '';
    resetCatImageUpload();
    document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-folder-plus"></i> إضافة قسم جديد';
    renderCurrentCatList();
    renderCategories();
    populateCategorySelects();
    renderProducts();
    closeAddCategory();
    showToast('✅ تم تعديل القسم بنجاح', 'success');
  } else {
    if (categories.find(c => c.id === id)) return showErr('هذا المعرّف مستخدم مسبقاً');
    categories.push({ id, icon: '📁', image, ar, en });
    const pCat = document.getElementById('pCat');
    const aCat = document.getElementById('adminCatFilter');
    const newOpt = new Option(ar, id);
    pCat.add(newOpt.cloneNode(true));
    aCat.add(new Option(ar, id));
    saveCategories();
    document.getElementById('catFormError').style.display = 'none';
    document.getElementById('editCatId').value = '';
    document.getElementById('catId').disabled  = false;
    document.getElementById('catNameAr').value = '';
    document.getElementById('catNameEn').value = '';
    document.getElementById('catId').value     = '';
    resetCatImageUpload();
    document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-folder-plus"></i> إضافة قسم جديد';
    renderCurrentCatList();
    renderCategories();
    populateCategorySelects();
    renderProducts();
    closeAddCategory();
    showToast('✅ تم إضافة القسم بنجاح', 'success');
  }
}

// =====================
// XSS PROTECTION
// =====================
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// تهريب آمن للنصوص اللي بتنحقن جوا onclick="func('${...}')" — يحمي من كسر
// السمة نفسها (لو فيه ") ومن كسر السلسلة النصية بالجافاسكريبت (لو فيه ')،
// ويمنع تنفيذ أي كود غير مقصود. يُستخدم دايمًا بدل escHtml وحدها بهاي الحالة.
function escAttrJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// =====================
// TOAST
// =====================
function showToast(msg, type='') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(40px)'; setTimeout(()=>toast.remove(),300); }, 3000);
}

function openQuickView(id) {
  window.lastViewedProductId = id;
  const p = products.find(x => x.id === id);
  if (!p) return;
  const body = document.getElementById('quickViewBody');
  body.innerHTML = `
    <img src="${cldOptimize(p.image || '', 600)}" alt="${escHtml(p.ar)}" onerror="this.style.display='none'">
    <div>
      <div style="font-size:18px;font-weight:900;margin-bottom:6px">${escHtml(p.en)}</div>
      <div style="color:var(--text-muted);line-height:1.8">${escHtml(currentLang==='en'?p.desc_en:p.desc_ar)}</div>
      <div style="margin-top:14px;font-size:20px;font-weight:900;color:var(--primary)">${p.price.toLocaleString()} ${t('د.أ','SAR')}</div>
      <button class="btn-primary" style="margin-top:14px;width:100%" onclick="addToCart(${p.id});closeQuickView()">${t('أضف للسلة','Add to cart')}</button>
    </div>`;
  document.getElementById('quickViewModal').classList.add('open');
}
function closeQuickView(){ document.getElementById('quickViewModal').classList.remove('open'); }

var _voiceRec = null;
var _voiceActive = false;

function initVoiceSearch() {
  const search = document.getElementById('searchInput');
  if (!search || document.getElementById('voiceSearchBtn')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-search-btn';
  btn.id = 'voiceSearchBtn';
  btn.innerHTML = '<i class="fas fa-microphone"></i>';
  btn.onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return showToast(t('المتصفح لا يدعم البحث الصوتي','Voice search is not supported'), 'error');
    // منع تشغيل نسخة ثانية أثناء وجود نسخة شغّالة أصلاً (السبب الشائع لخطأ aborted)
    if (_voiceActive) { try { _voiceRec.stop(); } catch(e) {} return; }
    const rec = new SR();
    _voiceRec = rec;
    rec.lang = currentLang === 'en' ? 'en-US' : 'ar-JO';
    rec.onresult = e => { search.value = e.results[0][0].transcript; search.dispatchEvent(new Event('input', {bubbles:true})); };
    rec.onstart = () => { _voiceActive = true; btn.classList.add('listening'); };
    rec.onend = () => { _voiceActive = false; btn.classList.remove('listening'); };
    rec.onerror = (e) => {
      _voiceActive = false;
      console.warn('⚠️ خطأ البحث الصوتي:', e.error);
      const messages = {
        'not-allowed': t('الرجاء السماح باستخدام الميكروفون','Please allow microphone access'),
        'service-not-allowed': t('خدمة البحث الصوتي غير متاحة حاليًا','Voice service unavailable'),
        'no-speech': t('لم يتم رصد أي صوت','No speech detected'),
        'audio-capture': t('تعذّر الوصول للميكروفون','Microphone unavailable'),
        'network': t('تحقق من اتصال الإنترنت','Check your internet connection'),
        'aborted': t('تم إيقاف التسجيل، حاول مجددًا','Recording stopped, try again'),
      };
      showToast(messages[e.error] || (t('تعذّر تشغيل البحث الصوتي','Unable to start voice search') + ' (' + e.error + ')'), 'error');
    };
    try {
      rec.start();
    } catch(e) {
      _voiceActive = false;
      console.warn('⚠️ فشل بدء التسجيل:', e.message);
    }
  };
  search.parentElement.appendChild(btn);
}

function updateBottomNav(page) {
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  // Reflect active state on the fixed bottom nav as well
  const bottomNav = document.getElementById('bottomNavBar');
  if(bottomNav) bottomNav.classList.add('visible');
}

function updateBottomNavStateFromSection() {
  const active = document.querySelector('.page-section.active')?.id || 'homePage';
  const map = { homePage:'home', cartPage:'cart', ordersPage:'orders', favoritesPage:'orders', productDetailPage:'home', comparePage:'home' };
  updateBottomNav(map[active] || 'home');
}

function hookBottomNavIntoPageChanges() {
  const origShowPage = window.showPage;
  window.showPage = function(page, ...rest) {
    const r = origShowPage.apply(this, [page, ...rest]);
    setTimeout(updateBottomNavStateFromSection, 0);
    return r;
  };
  const origOpenProductDetail = window.openProductDetail;
  window.openProductDetail = function(...args) {
    const r = origOpenProductDetail.apply(this, args);
    setTimeout(() => updateBottomNav('home'), 0);
    return r;
  };
}

function setupScrollHideBottomNav() {
  const nav = document.getElementById('bottomNavBar');
  if (!nav) return;
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (window.innerWidth >= 768) return;
    const y = window.scrollY;
    nav.classList.toggle('hidden', y > lastY + 8 && y > 100);
    if (y < lastY - 8) nav.classList.remove('hidden');
    lastY = y;
  }, {passive:true});
}

function initProductZoom() {
  document.addEventListener('mousemove', e => {
    const wrap = document.getElementById('pdImageWrap');
    const img = document.getElementById('pdMainImg');
    if (!wrap || !img || !wrap.contains(e.target) || window.innerWidth < 768) return;
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    img.style.transformOrigin = `${x*100}% ${y*100}%`;
    img.style.transform = 'scale(1.35)';
  });
  document.addEventListener('mouseleave', () => {
    const img = document.getElementById('pdMainImg');
    if (img) img.style.transform = 'scale(1)';
  }, true);
}

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight; canvas.style.display = 'block';
  const pieces = Array.from({length:140}, () => ({x:Math.random()*canvas.width,y:-20,vx:(Math.random()-.5)*6,vy:Math.random()*6+3,r:Math.random()*6+3,c:`hsl(${Math.random()*360},90%,60%)`,rot:Math.random()*360}));
  const step = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .12; p.rot += p.vx; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180); ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.5); ctx.restore(); });
    if (pieces.some(p => p.y < canvas.height + 30)) requestAnimationFrame(step); else canvas.style.display = 'none';
  };
  step();
}

function applySeasonalTheme() {
  const now = new Date();
  const month = now.getMonth()+1, day = now.getDate();
  const ramadanLikely = (month === 3 && day >= 1 && day <= 31) || (month === 4 && day <= 10);
  const eidLikely = (month === 4 && day >= 10 && day <= 20) || (month === 6 && day >= 1 && day <= 15);
  document.body.classList.toggle('seasonal-ramadan', ramadanLikely || eidLikely);
}

var _tickerRAF = null;
var _tickerPaused = false;

async function initOffersTicker() {
  const ticker = document.getElementById('offersTicker');
  const track = document.getElementById('offersTickerTrack');
  if (!ticker || !track) return;

  // نلغي أي حركة سابقة قبل إعادة البناء، لمنع تراكب أكثر من حركة بنفس الوقت
  if (_tickerRAF) { cancelAnimationFrame(_tickerRAF); _tickerRAF = null; }

  const items = [];
  const qtyProducts = await getActiveQtyOfferProducts();
  qtyProducts.forEach(p => {
    const offer = getActiveQtyOffer(p.id);
    if (offer && offer.tiers && offer.tiers.length) {
      const tiersText = offer.tiers.map(tr => `${t('اشترِ','Buy')} ${tr.qty} ${t('بسعر','for')} ${tr.price.toLocaleString()} ${t('د.أ','SAR')}`).join(` ${t('أو','or')} `);
      items.push(`<div class="offers-ticker-item" onclick="openProductDetail(${p.id})">
        <i class="fas fa-tags"></i>
        <span>${t('عرض كمية','Qty offer')}: ${escHtml(p.en)} — ${tiersText}</span>
      </div>`);
    }
  });
  offers.filter(o => o.type === 'text' && o.active && !isOfferExpired(o)).forEach(o => {
    items.push(`<div class="offers-ticker-item">
      <i class="fas fa-bullhorn"></i>
      <span>${escHtml(currentLang==='en' ? (o.textEn || o.text) : o.text)}</span>
    </div>`);
  });
  getActiveBundles().forEach(b => {
    const original = getBundleOriginalPrice(b);
    const price = b.bundlePrice || 0;
    const save = original - price;
    items.push(`<div class="offers-ticker-item" onclick="openBundleDetail(${b.id})">
      <i class="fas fa-box-open"></i>
      <span>${t('باقة','Bundle')}: ${escHtml(currentLang==='en'?b.name_en:b.name_ar)} — ${t('بسعر','for')} ${price.toLocaleString()} ${t('د.أ','SAR')} ${t('بدلاً من','instead of')} ${original.toLocaleString()} ${t('د.أ','SAR')}</span>
    </div>`);
  });

  if (!items.length) {
    ticker.style.display = 'none';
    const spacer = document.getElementById('tickerSpacer');
    if (spacer) spacer.style.height = '0';
    return;
  }

  const MIN_ITEMS = 6;
  let repeated = [...items];
  while (repeated.length < MIN_ITEMS) repeated = repeated.concat(items);

  // تحريك مباشر عبر JS بدل الاعتماد على حركة CSS التلقائية — تحكم كامل بالموضع كل لحظة،
  // بدون أي احتمال "قفزة" أو اختفاء مفاجئ عند إعادة اللف
  track.style.animation = 'none';
  track.innerHTML = repeated.join('') + repeated.join('');
  ticker.style.display = 'block';
  const updateSpacerHeight = () => {
    const spacer = document.getElementById('tickerSpacer');
    if (spacer) spacer.style.height = ticker.offsetHeight + 'px';
  };
  requestAnimationFrame(updateSpacerHeight);
  // إعادة الحساب بعد لحظة إضافية لضمان دقة الارتفاع حتى لو تأخر تخطيط الهيدر (position:sticky)
  setTimeout(updateSpacerHeight, 150);

  requestAnimationFrame(() => runTickerLoop(ticker, track));
}

function runTickerLoop(ticker, track) {
  const PIXELS_PER_SECOND = 55;
  const isEn = currentLang === 'en';
  let pos = 0;
  let lastTime = null;
  _tickerPaused = false;

  ticker.onmouseenter = () => { _tickerPaused = true; };
  ticker.onmouseleave = () => { _tickerPaused = false; };

  function applyTransform() {
    track.style.transform = isEn ? `translateX(${-pos}px)` : `translateX(${pos}px)`;
  }

  // ===== سحب الشريط بالإصبع =====
  let dragging = false;
  let dragStartX = 0;
  let dragStartPos = 0;
  let dragMoved = false;

  ticker.addEventListener('touchstart', (e) => {
    dragging = true;
    _tickerPaused = true;
    dragMoved = false;
    dragStartX = e.touches[0].clientX;
    dragStartPos = pos;
  }, { passive: true });

  ticker.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - dragStartX;
    if (Math.abs(dx) > 4) dragMoved = true;
    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;
    let newPos = dragStartPos + (isEn ? -dx : dx);
    newPos = ((newPos % halfWidth) + halfWidth) % halfWidth;
    pos = newPos;
    applyTransform();
  }, { passive: true });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    _tickerPaused = false;
    if (dragMoved) {
      // إن كانت سحبًا فعليًا، نمنع نقرة الفتح العرضية التي قد تلي الإفلات
      const suppressClick = (e) => { e.preventDefault(); e.stopPropagation(); ticker.removeEventListener('click', suppressClick, true); };
      ticker.addEventListener('click', suppressClick, true);
    }
  };
  ticker.addEventListener('touchend', endDrag, { passive: true });
  ticker.addEventListener('touchcancel', endDrag, { passive: true });

  function step(time) {
    if (lastTime === null) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth > 0 && !_tickerPaused) {
      pos += PIXELS_PER_SECOND * dt;
      if (pos >= halfWidth) pos -= halfWidth;
      applyTransform();
    }
    _tickerRAF = requestAnimationFrame(step);
  }
  _tickerRAF = requestAnimationFrame(step);
}

function setupReorderButtons() {
  const body = document.getElementById('clientOrdersList');
  if (!body) return;
  const mo = new MutationObserver(() => {
    body.querySelectorAll('.reorder-btn').forEach(btn => btn.remove());
    body.querySelectorAll('[data-order-id]').forEach(card => {
      if (card.querySelector('.reorder-btn')) return;
      const order = (window._cachedOrders || []).find(o => String(o._docId || o.id) === String(card.dataset.orderId));
      if (!order) return;
      const btn = document.createElement('button');
      btn.className = 'reorder-btn btn-primary';
      btn.style.marginTop = '12px';
      btn.innerHTML = `<i class="fas fa-redo"></i> ${t('إعادة الطلب','Reorder')}`;
      btn.onclick = () => { (order.items || []).forEach(item => { const p = products.find(x => String(x.id) === String(item.id)); if (p) { const existing = cart.find(x => String(x.id) === String(p.id)); if (!existing) cart.push({...p, qty:item.qty||1, basePrice:p.price, price:p.price}); else existing.qty += item.qty || 1; } }); updateCartUI(); showToast(t('تمت إضافة عناصر الطلب إلى السلة','Order items added to cart'),'success'); };
      card.appendChild(btn);
    });
  });
  mo.observe(body, {childList:true, subtree:true});
}

function enhanceQuickViewAndReorder() {
  initVoiceSearch();
  setupScrollHideBottomNav();
  // No auto-popups or daily-deal banners
  initProductZoom();
  applySeasonalTheme();
  setupReorderButtons();
  hookBottomNavIntoPageChanges();
  updateBottomNavStateFromSection();
  // Reflect cart count on bottom nav badge
  const syncBadge = () => {
    const badge = document.getElementById('bottomNavCartBadge');
    const count = cart.reduce((s,i)=>s+i.qty,0);
    if(badge){ badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
  };
  const origUpdateCartUI = window.updateCartUI;
  window.updateCartUI = function(){
    const r = origUpdateCartUI.apply(this, arguments);
    syncBadge();
    return r;
  };
  syncBadge();
  setTimeout(() => { if (document.getElementById('successScreen')?.classList.contains('show')) triggerConfetti(); }, 500);
  const success = document.getElementById('successScreen');
  if (success) new MutationObserver(() => { if (success.classList.contains('show')) triggerConfetti(); }).observe(success, {attributes:true, attributeFilter:['class']});
}

// =====================
// OFFLINE / ONLINE BANNER
// =====================
function updateOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  if (navigator.onLine) {
    banner.classList.remove('show');
  } else {
    banner.classList.add('show');
  }
}

window.addEventListener('online', () => {
  updateOfflineBanner();
  showToast('✅ تم استعادة الاتصال بالإنترنت', 'success');
});
window.addEventListener('offline', () => {
  updateOfflineBanner();
  showToast('📡 انقطع الاتصال بالإنترنت', 'error');
});

document.addEventListener('DOMContentLoaded', updateOfflineBanner);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceQuickViewAndReorder);
} else {
  enhanceQuickViewAndReorder();
}
// =====================
// HELPERS
// =====================
function scrollToProducts() {
  document.getElementById('productsSection').scrollIntoView({behavior:'smooth', block:'start'});
}

function scrollToProductImage() {
  const el = document.getElementById('pdImageWrap');
  if (!el) { window.scrollTo(0, 0); return; }
  const header = document.querySelector('header');
  const headerH = header ? header.offsetHeight : 0;
  const y = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo(0, Math.max(0, y));
}
async function sendContactMessage() {
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const message = document.getElementById('contactMessage').value.trim();

  if (!name || !email || !message) {
    showToast('❌ يرجى ملء جميع الحقول', 'error');
    return;
  }

  try {
    if (window._fbAddDoc && window._fbCollection && window._db) {
      await window._fbAddDoc(window._fbCollection(window._db, 'contact_messages'), {
        name, email, message, createdAt: new Date().toISOString()
      });
    }
    showToast('✅ تم إرسال رسالتك بنجاح، سنتواصل معك قريبًا', 'success');
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactMessage').value = '';
  } catch (e) {
    console.error(e);
    showToast('❌ فشل إرسال الرسالة، تحقق من الاتصال', 'error');
  }
}
// =====================
// PAGE NAVIGATION HISTORY (لدعم زر الرجوع في WebView)
// =====================
var pageHistory = ['home'];
var isBackNavigation = false;
var _homeGuardArmed = false;
var _exitWarningShown = false;
var _exitWarningTimer = null;

// ============================================================
// [جديد] مكدّس طبقات واجهة المستخدم (مودالات / سلة / لوحة تحكم / إشعارات)
// الفكرة: أي عنصر من هذه الأنواع يُكتشف تلقائياً عند فتحه أو إغلاقه
// (عبر MutationObserver) بدون الحاجة لتعديل أي دالة open*/close* موجودة.
// كل فتح يُسجَّل كـ "طبقة" فوق حالة History الحالية، وزر الرجوع
// يغلق الطبقة الأعلى فقط بدل الانتقال بين الصفحات أو إغلاق التطبيق.
// ============================================================
var uiLayerStack = [];          // {id, el} لكل طبقة مفتوحة حالياً، بترتيب الفتح
var _pendingHistoryCleanup = false; // يمنع أي popstate ناتج عن تنظيفنا التلقائي للسجل من التسبب بتنقل غير مقصود
var _historyLayerCount = 0;     // عدد حالات History المضافة فعلياً لطبقات الواجهة حالياً
var _uiHistoryReconcileScheduled = false; // يمنع جدولة أكثر من تسوية واحدة لنفس اللحظة (tick)
var _historyLayerCount = 0;     // عدد حالات History المضافة فعلياً لطبقات الواجهة حالياً
var _uiHistoryReconcileScheduled = false; // يمنع جدولة أكثر من تسوية واحدة لنفس اللحظة (tick)
var _historyLayerCount = 0;     // عدد حالات History المضافة فعلياً لطبقات الواجهة حالياً
var _uiHistoryReconcileScheduled = false; // يمنع جدولة أكثر من تسوية واحدة لنفس اللحظة (tick)
var _historyLayerCount = 0;     // عدد حالات History المضافة فعلياً لطبقات الواجهة حالياً
var _uiHistoryReconcileScheduled = false; // يمنع جدولة أكثر من تسوية واحدة لنفس اللحظة (tick)
var _historyLayerCount = 0;     // عدد حالات History المضافة فعلياً لطبقات الواجهة حالياً
var _uiHistoryReconcileScheduled = false; // يمنع جدولة أكثر من تسوية واحدة لنفس اللحظة (tick)

// المودالات الثابتة الموجودة أصلاً بالـ HTML (تُغلق بإزالة كلاس open فقط، لا تُحذف من الـ DOM)
var STATIC_MODAL_IDS = new Set([
  'orderModal', 'authModal', 'adminPanel', 'productFormModal', 'addPointsModal',
  'qtyOfferModal', 'bundleModal', 'quoteRequestModal', 'priceQuoteModal',
  'addCategoryModal', 'deleteConfirmModal', 'accountMenuModal', 'quickOrderModal'
]);

// أي عنصر آخر بكلاس modal-overlay (المودالات المُنشأة ديناميكياً بالجافاسكربت مثل
// تعديل الملف الشخصي، حذف الحساب، سجل العميل، محادثة الأدمن، الرسالة الجماعية)
// يُغلق فعلياً بحذفه من الـ DOM، لأن هذا هو نفس سلوك أزرار الإغلاق الأصلية فيها.

function isTrackableUIElement(el) {
  if (!el || !el.classList || !el.id) return false;
  if (el.id === 'cartSidebar' || el.id === 'notifDropdown') return true;
  return el.classList.contains('modal-overlay');
}

function trackUILayerOpen(el) {
  if (uiLayerStack.some(l => l.id === el.id)) return; // مُسجّلة مسبقاً، تجاهل
  uiLayerStack.push({ id: el.id, el });
  scheduleUIHistoryReconcile();
}

function trackUILayerClose(el) {
  const idx = uiLayerStack.findIndex(l => l.id === el.id);
  if (idx === -1) return; // غير مُسجّلة (أو أُغلقت مسبقاً عبر زر الرجوع نفسه)
  uiLayerStack.splice(idx, 1);
  scheduleUIHistoryReconcile();
}

// نؤجل أي تعديل فعلي على History لنهاية نفس اللحظة (microtask)، حتى لو صار
// إغلاق مودال وفتح آخر متتاليين بنفس الاستدعاء المتزامن (زي مسار الطلب السريع
// للزائر: quickOrderModal -> qoInfoModal -> qoLocationModal). هذا يمنع تصادم
// history.back() غير المتزامنة مع history.pushState() الفورية، اللي كانت
// تسبب اختلال سجل المتصفح وتخرج المستخدم من الموقع فعلياً.
function scheduleUIHistoryReconcile() {
  if (_uiHistoryReconcileScheduled) return;
  _uiHistoryReconcileScheduled = true;
  Promise.resolve().then(reconcileUIHistory);
}

function reconcileUIHistory() {
  _uiHistoryReconcileScheduled = false;
  const target = uiLayerStack.length;
  const diff = target - _historyLayerCount;
  if (diff === 0) return; // تعادل الفتح مع الإغلاق ضمن نفس اللحظة — لا حاجة للمس السجل فعلياً
  if (diff > 0) {
    // طبقات صافية جديدة فُتحت: نحجز حالة History واحدة لكل طبقة زيادة
    for (let i = target - diff; i < target; i++) {
      history.pushState({ uiLayer: uiLayerStack[i].id }, '', window.location.href);
    }
  } else {
    // طبقات صافية أُغلقت بدون تعويضها بفتح جديد: نرجع خطوة واحدة فعلية تساوي الفرق
    _pendingHistoryCleanup = true;
    history.go(diff);
  }
  _historyLayerCount = target;
}

// ينفّذ الإغلاق الفعلي لعنصر عندما يكون زر الرجوع هو من طلب الإغلاق
function closeUILayerElement(el) {
  if (!el || !document.body.contains(el)) return;
  if (el.id === 'cartSidebar') { if (typeof closeCart === 'function') closeCart(); return; }
  if (el.id === 'notifDropdown') { if (typeof closeNotifDropdown === 'function') closeNotifDropdown(); return; }
  if (STATIC_MODAL_IDS.has(el.id)) { el.classList.remove('open'); return; }
  // مودال ديناميكي (تم إنشاؤه بالجافاسكربت) → يُحذف من الـ DOM مثل زر إغلاقه تماماً
  el.remove();
}

// مراقب عام يكتشف فتح/إغلاق أي طبقة واجهة تلقائياً دون لمس أي كود موجود
var _uiLayerObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === 'attributes' && m.attributeName === 'class') {
      const el = m.target;
      if (!isTrackableUIElement(el)) continue;
      const isOpenNow = el.classList.contains('open');
      const alreadyTracked = uiLayerStack.some(l => l.id === el.id);
      if (isOpenNow && !alreadyTracked) trackUILayerOpen(el);
      else if (!isOpenNow && alreadyTracked) trackUILayerClose(el);
    } else if (m.type === 'childList') {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (isTrackableUIElement(node) && node.classList.contains('open')) trackUILayerOpen(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('.modal-overlay.open').forEach(child => trackUILayerOpen(child));
        }
      });
      m.removedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (isTrackableUIElement(node)) trackUILayerClose(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('.modal-overlay').forEach(child => trackUILayerClose(child));
        }
      });
    }
  }
});
_uiLayerObserver.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
// ============================================================
// [نهاية الجزء الخاص بمكدّس الطبقات]
// ============================================================

function armHomeGuard() {
  // يضيف "حالة حارسة" فوق السجل الحالي — هذي هي اللي تلتقط أول ضغطة رجوع
  // وأنت بجذر الصفحة الرئيسية، فتمنع خروج التطبيق فوراً وتفسح المجال لعرض التنبيه
  if (_homeGuardArmed) return;
  _homeGuardArmed = true;
  history.pushState({ page: 'home', guard: true }, '', window.location.href);
}

// نبني السجل الأساسي: حالة جذر عادية، وفوقها الحارس مباشرة
history.replaceState({ page: 'home' }, '', window.location.href);
armHomeGuard();

function goBack() {
  if (pageHistory.length > 1) {
    pageHistory.pop();
    isBackNavigation = true;
    showPage(pageHistory[pageHistory.length - 1]);
    isBackNavigation = false;
  }
}

function updateHeaderBackBtn() {
  return; // تم إلغاء زر الرجوع بجانب الشعار نهائياً بناءً على طلب المستخدم
}

// معالج زر الرجوع في Android WebView
window.addEventListener('popstate', (e) => {
  // (1) تجاهل أي popstate ناتج عن تنظيفنا التلقائي للسجل بعد إغلاق طبقة من واجهة المستخدم
  // (مثلاً: ضغط المستخدم زر X لإغلاق مودال، وليس زر الرجوع الفيزيائي)
  if (_pendingHistoryCleanup) {
    _pendingHistoryCleanup = false;
    return;
  }

  // (2) الأولوية دائماً لإغلاق أعلى طبقة مفتوحة (مودال / سلة / لوحة تحكم / إشعارات)
  // قبل أي تنقل بين الصفحات أو محاولة الخروج من التطبيق
  if (uiLayerStack.length > 0) {
    const layer = uiLayerStack.pop();
    closeUILayerElement(layer.el);
    // زر الرجوع الفعلي استهلك حالة History فعلياً بنفسه (المتصفح رجع خطوة تلقائيًا)،
    // فلازم نُنزّل عدّاد الحالات المحجوزة يدويًا هون كمان، وإلا يضل _historyLayerCount
    // "عالق" على رقم أعلى من الواقع، وبيسبب حساب diff غلط لاحقًا عند فتح/إغلاق
    // مودالات تانية بنفس الجلسة (زي الطلب السريع) — وممكن يودّي لخروج من الموقع فعليًا.
    _historyLayerCount = Math.max(0, _historyLayerCount - 1);
    return;
  }

  // حالة: استُهلكت "الحالة الحارسة" ووصلنا فعلياً لجذر الصفحة الرئيسية (لا صفحات أخرى بالسجل الداخلي)
  if (e.state && e.state.page === 'home' && !e.state.guard && pageHistory.length <= 1) {
    _homeGuardArmed = false;
    if (!_exitWarningShown) {
      _exitWarningShown = true;
      showToast('اضغط رجوع مرة أخرى للخروج من التطبيق', '');
      // إن لم يضغط المستخدم رجوع خلال 3 ثوانٍ، نعيد تسليح الحارس ليحميه مرة أخرى لاحقاً
      clearTimeout(_exitWarningTimer);
      _exitWarningTimer = setTimeout(() => {
        _exitWarningShown = false;
        armHomeGuard();
      }, 3000);
    }
    // لا داعي لأي إجراء إضافي هنا: لو ضغط المستخدم رجوع مرة ثانية الآن،
    // WebView سيغلق التطبيق تلقائياً بما إنه ما عاد يوجد سجل أبعد من هذه النقطة
    return;
  }

  if (e.state && e.state.page) {
    // إبقاء سجل الصفحات الداخلي متزامناً مع السجل الفعلي عند استخدام زر الرجوع الفيزيائي
    if (pageHistory.length > 1) pageHistory.pop();
    isBackNavigation = true;
    showPage(e.state.page);
    isBackNavigation = false;
  }
});
// يفعّل ظهور قسم صفحة بحركة انتقال سلسة فعلية (بدل قفزة فجائية)
function activatePageSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('active'));
  });
}
function showPage(page) {
  document.querySelectorAll('.page-section').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  
  // أضيف الصفحة الجديدة للسجل (إذا لم تكن عملية رجوع)
  if (!isBackNavigation && (pageHistory.length === 0 || pageHistory[pageHistory.length - 1] !== page)) {
    pageHistory.push(page);
    window.history.pushState({ page: page }, '', `#${page}`);
  }
  updateHeaderBackBtn();

  // أي صفحة غير الرئيسية تعني أننا غادرنا الجذر، فنسمح بإعادة تسليح الحارس لاحقاً عند العودة إليه
  if (page !== 'home') _homeGuardArmed = false;
  
  if (page === 'home') {
    activatePageSection('homePage');
    // كل مرة نصل فيها فعلياً لجذر الصفحة الرئيسية (تنقل عادي أو رجوع)، نعيد تسليح حارس الخروج
    if (pageHistory.length <= 1) armHomeGuard();
  } else if (page === 'orders') {
    activatePageSection('ordersPage');
    window.scrollTo(0, 0);
    renderClientOrders();
    markNotifsByLinkPrefixRead(['page:orders']);
  } else if (page === 'productDetail') {
    activatePageSection('productDetailPage');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToProductImage());
    });
  } else if (page === 'about') {
    activatePageSection('aboutPage');
    window.scrollTo(0, 0);
  } else if (page === 'compare') {
    activatePageSection('comparePage');
    window.scrollTo(0, 0);
  } else if (page === 'favorites') {
    activatePageSection('favoritesPage');
    window.scrollTo(0, 0);
  } else if (page === 'reordered') {
    activatePageSection('reorderedProductsPage');
    window.scrollTo(0, 0);
  } else if (page === 'myQuotes') {
    activatePageSection('myQuotesPage');
    window.scrollTo(0, 0);
    renderMyQuotesPage();
    markNotifsByLinkPrefixRead(['page:myQuotes']);
  } else if (page === 'messages') {
    activatePageSection('messagesPage');
    renderClientMessagesThread().then(() => {
      const input = document.getElementById('clientMsgInput');
      if (input) input.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    markNotifsByLinkPrefixRead(['page:messages']);
  } else if (page === 'trackOrder') {
    activatePageSection('trackOrderPage');
    window.scrollTo(0, 0);
  } else if (page === 'error') {
    activatePageSection('errorPage');
    window.scrollTo(0, 0);
  }
}

function showErrorPage(options = {}) {
  const icon    = options.icon    || '⚠️';
  const title   = options.title   || 'حدث خطأ ما';
  const message = options.message || 'تعذّر تحميل هذه الصفحة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.';

  document.getElementById('errorPageIcon').textContent = icon;
  document.getElementById('errorPageTitle').textContent = title;
  document.getElementById('errorPageMessage').textContent = message;
  showPage('error');
}
function openTrackOrderPage() {
  document.getElementById('trackOrderId').value = '';
  document.getElementById('trackOrderPhone').value = '';
  document.getElementById('trackErrorBox').style.display = 'none';
  document.getElementById('trackResultBox').innerHTML = '';
  showPage('trackOrder');
}
function showTrackError(msg) {
  document.getElementById('trackResultBox').innerHTML = '';
  document.getElementById('trackErrorMsg').textContent = msg;
  document.getElementById('trackErrorBox').style.display = 'flex';
}

async function trackGuestOrder() {
  const idInput = document.getElementById('trackOrderId').value.trim().toUpperCase();
  const phoneInput = document.getElementById('trackOrderPhone').value.trim();
  document.getElementById('trackErrorBox').style.display = 'none';
  const resultBox = document.getElementById('trackResultBox');

  if (!idInput || !phoneInput) return showTrackError('يرجى إدخال رقم الطلب ورقم الهاتف');

  resultBox.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)">
    <div class="spinner" style="margin:0 auto 14px;width:28px;height:28px;border-width:4px"></div>جاري البحث...</div>`;

  try {
    const isQuote = idInput.startsWith('QT-');
    const colName = isQuote ? 'quotes' : 'orders';
    const snap = await window._fbGetDoc(window._fbDoc2(colName, idInput));

    if (!snap.exists()) return showTrackError('لم يتم العثور على طلب بهذا الرقم، تأكد من كتابته بشكل صحيح');

    const data = snap.data();
    const cleanPhone  = (data.phone || '').replace(/\D/g,'');
    const inputPhone  = phoneInput.replace(/\D/g,'');
    // مقارنة آخر 9 أرقام (تغطي الرقم المحلي الكامل بدون رمز الدولة، أدق من 7 أرقام)
    const matches = cleanPhone.length >= 9 && inputPhone.length >= 9 && cleanPhone.slice(-9) === inputPhone.slice(-9);
    if (!matches) return showTrackError('رقم الهاتف لا يطابق بيانات هذا الطلب');

    const date = new Date(data.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
      { year:'numeric', month:'long', day:'numeric' });

    if (isQuote) {
      const total = (data.items||[]).reduce((s,i)=> s + ((i.unitPrice||0)*(i.qty||1)), 0);
      resultBox.innerHTML = `
        <div class="order-track-card">
          <div class="order-track-header">
            <div>
              <div class="order-track-num"><i class="fas fa-file-invoice-dollar"></i> #${escHtml(data.id)}</div>
              <div class="order-track-date">📅 ${date}</div>
            </div>
            ${quoteStatusBadge(data.status)}
          </div>
          <div class="order-track-body">
            ${data.status==='accepted' ? trackStepsHTML(data.orderStatus||'pending') : ''}
            <div class="order-items-list">
              ${(data.items||[]).map(i=>`
                <div class="order-item-row">
                  <div class="order-item-icon">${i.icon||'📦'}</div>
                  <div style="flex:1;font-weight:600">${escHtml(i.ar)}</div>
                  <div style="color:var(--text-muted)">${i.qty?`× ${i.qty}`:''}</div>
                </div>`).join('')}
            </div>
            ${(data.status==='priced'||data.status==='accepted') ? `<div style="text-align:left;font-weight:900;color:var(--primary);margin-top:10px">الإجمالي: ${total.toLocaleString()} د.أ</div>` : ''}
          </div>
        </div>`;
    } else {
      resultBox.innerHTML = `
        <div class="order-track-card">
          <div class="order-track-header">
            <div>
              <div class="order-track-num"><i class="fas fa-receipt"></i> #${escHtml(data.id)}</div>
              <div class="order-track-date">📅 ${date}</div>
            </div>
            ${statusBadgeHTML(data.status)}
          </div>
          <div class="order-track-body">
            ${trackStepsHTML(data.status)}
            <div class="order-items-list">
              ${(data.items||[]).map(i=>`
                <div class="order-item-row">
                  <div class="order-item-icon">${i.icon}</div>
                  <div style="flex:1;font-weight:600">${escHtml(i.ar)}</div>
                  <div style="color:var(--text-muted)">× ${i.qty}</div>
                </div>`).join('')}
            </div>
            <div style="text-align:left;font-weight:900;color:var(--primary);margin-top:10px">
              الإجمالي: ${data.payMethod==='points' ? `${data.totalPoints||0} نقطة` : `${data.total.toLocaleString()} د.أ`}
            </div>
          </div>
        </div>`;
    }
  } catch(e) {
    console.error(e);
    showTrackError('حدث خطأ أثناء البحث، تحقق من الاتصال بالإنترنت');
  }
}

function skeletonOrderCardsHTML(count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
    <div class="skeleton-order-card">
      <div class="skeleton-block skeleton-line medium"></div>
      <div class="skeleton-block skeleton-line short"></div>
      <div class="skeleton-block skeleton-line long" style="margin-top:16px;height:60px;border-radius:12px"></div>
    </div>`;
  }
  return html;
}
// =====================
// PUSH NOTIFICATIONS (FCM)
// =====================
var _swRegistration = null;

async function registerServiceWorkerForPush() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    if (_swRegistration) return _swRegistration;
    _swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return _swRegistration;
  } catch(e) {
    console.warn('⚠️ فشل تسجيل Service Worker:', e.message);
    return null;
  }
}

async function enablePushNotifications() {
  if (!currentUser) return;
  if (!('Notification' in window)) return;

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const swReg = await registerServiceWorkerForPush();
    if (!swReg) return;

    // ننتظر حتى تصبح دالة جلب التوكن جاهزة (isSupported قد يستغرق لحظة)
    for (let i = 0; i < 20; i++) {
      if (window._fcmGetTokenFn) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!window._fcmGetTokenFn) return;

    const fcmToken = await window._fcmGetTokenFn(swReg);
    if (!fcmToken) return;

    // حفظ التوكن مرتبط بالمستخدم — يسمح بإرسال إشعار له لاحقاً حتى لو أغلق الموقع
    await window._fbSetDoc(
      window._fbDoc2('fcm_tokens', currentUser.uid || currentUser.email),
      {
        token: fcmToken,
        email: currentUser.email,
        role: currentUser.role,
        updatedAt: new Date().toISOString()
      }
    );
    console.log('✅ تم تفعيل الإشعارات الفعلية بنجاح');
  } catch(e) {
    console.warn('⚠️ enablePushNotifications:', e.message);
  }
}

// إشعار يصل والموقع مفتوح بالمقدمة فعلياً — نعرضه toast بدل إشعار نظام مزدوج
window._onForegroundFCMMessage = function(payload) {
  const title = payload.notification?.title || '';
  const body = payload.notification?.body || '';
  showToast(`🔔 ${title}${body ? ' — ' + body : ''}`, 'success');
  if (typeof loadAndRenderNotifIcon === 'function' && currentUser) loadAndRenderNotifIcon();
};

// استقبال نقرة المستخدم على إشعار نظام (يصل من الـ Service Worker بالخلفية)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'notification-click' && event.data.link) {
      if (typeof onNotifClick === 'function') onNotifClick('', event.data.link);
    }
  });
}

// =====================

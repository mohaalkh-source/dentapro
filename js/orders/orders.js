// DentaPro domain module: extracted from the original implementation.
// UNAVAILABLE ITEM REQUEST (طلب/استفسار عن مادة غير متوفرة)
// =====================

function openAddPointsModal(uid, email, name, clinic, currentBalance, mode = 'add') {
  window._pointsMode = mode;
  document.getElementById('pointsTargetUid').value = uid;
  document.getElementById('pointsTargetEmail').value = email;
  document.getElementById('pointsTargetName').textContent = `${name} — ${clinic}`;
  document.getElementById('pointsTargetEmail2').textContent = email;
  document.getElementById('pointsCurrentBalance').textContent = `${currentBalance} 🏆`;
  document.getElementById('pointsAmount').value = '';
  document.getElementById('pointsReason').value = '';
  document.getElementById('pointsModalError').style.display = 'none';

  const modalHeader = document.querySelector('#addPointsModal .modal-header');
  const modalTitle  = document.querySelector('#addPointsModal .modal-title');
  if (mode === 'deduct') {
    modalHeader.style.background = 'linear-gradient(135deg,#c53030,#e53e3e)';
    modalTitle.innerHTML = '<i class="fas fa-minus-circle"></i> تنقيص نقاط من العميل';
    document.getElementById('pointsAmount').placeholder = 'عدد النقاط المخصومة';
  } else {
    modalHeader.style.background = 'linear-gradient(135deg,#d97706,#f59e0b)';
    modalTitle.innerHTML = '<i class="fas fa-star"></i> إضافة نقاط للعميل';
    document.getElementById('pointsAmount').placeholder = 'مثال: 100';
  }
  document.getElementById('addPointsModal').classList.add('open');
}

function closeAddPointsModal() {
  document.getElementById('addPointsModal').classList.remove('open');
}

async function confirmAddPoints() {
  const uid     = document.getElementById('pointsTargetUid').value;
  const email   = document.getElementById('pointsTargetEmail').value;
  const amount  = parseInt(document.getElementById('pointsAmount').value);
  const mode    = window._pointsMode || 'add';
  const defaultReason = mode === 'deduct' ? 'خصم يدوي من الأدمن' : 'إضافة يدوية من الأدمن';
  const reason  = document.getElementById('pointsReason').value.trim() || defaultReason;

  if (!amount || amount < 1) {
    document.getElementById('pointsModalError').style.display = 'flex';
    return;
  }
  document.getElementById('pointsModalError').style.display = 'none';

  const currentBalance = await getClientPoints(uid);

  if (mode === 'deduct' && amount > currentBalance) {
    document.getElementById('pointsModalError').style.display = 'flex';
    document.getElementById('pointsModalError').innerHTML =
      '<i class="fas fa-exclamation-circle"></i> لا يمكن خصم أكثر من الرصيد الحالي (' + currentBalance + ' نقطة)';
    return;
  }

  const newBalance = mode === 'deduct' ? currentBalance - amount : currentBalance + amount;

  const log = {
    type: mode === 'deduct' ? 'deduct' : 'add',
    amount,
    reason,
    balance: newBalance,
    date: new Date().toISOString(),
    by: 'admin'
  };

  await saveClientPoints(uid, email, newBalance, log);
  closeAddPointsModal();
  showToast(
    mode === 'deduct'
      ? `✅ تم خصم ${amount} نقطة بنجاح`
      : `✅ تم إضافة ${amount} نقطة بنجاح`,
    'success'
  );
  renderAdminPoints();
}
// =====================
// ORDER TRACKING SYSTEM
// =====================
var ORDER_STATUSES = [
  { key:'pending',   label:'في الانتظار',  icon:'fa-clock',          class:'status-pending'   },
  { key:'confirmed', label:'تم التأكيد',   icon:'fa-check-circle',   class:'status-confirmed' },
  { key:'preparing', label:'جاري التجهيز', icon:'fa-box-open',       class:'status-preparing' },
  { key:'shipped',   label:'في الشحن',     icon:'fa-shipping-fast',  class:'status-shipped'   },
  { key:'delivered', label:'تم التسليم',   icon:'fa-hand-holding',   class:'status-delivered' },
  { key:'cancelled', label:'ملغي',          icon:'fa-times-circle',   class:'status-cancelled' },
];

var TRACK_FLOW = ['pending','confirmed','preparing','shipped','delivered'];
// تحديد رابط خريطة من بيانات الطلب
function getOrderMapLink(order) {
  if (order.locationLat && order.locationLng) {
    return `https://www.google.com/maps/search/?api=1&query=${order.locationLat},${order.locationLng}`;
  }
  if (order.address) {
    // استخراج إحداثيات (أرقام عشرية) من نص العنوان إن وُجدت، حتى لو مكتوبة بصيغة عربية
    const coordsMatch = order.address.match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
    if (coordsMatch) {
      return `https://www.google.com/maps/search/?api=1&query=${coordsMatch[1]},${coordsMatch[2]}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  }
  return null;
}
function getStatusObj(key) {
  return ORDER_STATUSES.find(s => s.key === key) || ORDER_STATUSES[0];
}

function statusBadgeHTML(key) {
  const s = getStatusObj(key);
  return `<span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.label}</span>`;
}

function trackStepsHTML(currentStatus) {
  if (currentStatus === 'cancelled') {
    return `<div style="text-align:center;padding:16px;color:var(--danger);font-weight:700">
      <i class="fas fa-times-circle" style="font-size:28px;margin-bottom:6px;display:block"></i>
      تم إلغاء الطلب
    </div>`;
  }
  const currentIdx = TRACK_FLOW.indexOf(currentStatus);
  return `<div class="track-steps">` +
    TRACK_FLOW.map((key, i) => {
      const s = getStatusObj(key);
      const isDone   = i < currentIdx;
      const isActive = i === currentIdx;
      const cls = isDone ? 'done' : isActive ? 'active' : '';
      return `<div class="track-step ${cls}">
        <div class="track-step-icon"><i class="fas ${s.icon}"></i></div>
        <div class="track-step-label">${s.label}</div>
      </div>`;
    }).join('') +
  `</div>`;
}

// ── CLIENT ORDERS ──
function openClientOrders() {
  if (!currentUser) { openAuthModal('login'); return; }
  showPage('orders');
  renderClientOrders();
  renderPointsInHeader();
}
async function renderClientOrders() {
  const container = document.getElementById('clientOrdersList');
  container.innerHTML = skeletonOrderCardsHTML(3);

  try {
    // انتظر حتى يصبح Firebase جاهزاً
    for (let i = 0; i < 30; i++) {
      if (window._fbQuery && window._fbOrdersRef && window._fbGetDocs) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!window._fbQuery) throw new Error('Firebase غير جاهز');

    let q;
    if (isStaff()) {
      q = window._fbQuery(window._fbOrdersRef(), window._fbOrderBy('createdAt','desc'));
    } else {
      // لازم نفلتر من السيرفر عبر where() حتى تتوافق مع قواعد Firestore
      q = window._fbQuery(
        window._fbOrdersRef(),
        window._fbWhere('clientEmail', '==', currentUser.email)
      );
    }
    const snap = await window._fbGetDocs(q);
    let orders = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    if (currentUser.role !== 'admin') {
      orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    window._cachedOrders = orders;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-orders">
          <i class="fas fa-box-open"></i>
          <h3>لا توجد طلبات بعد</h3>
          <p>ابدأ تسوقك الآن وستجد طلباتك هنا</p>
          <button class="btn-primary" style="margin-top:16px"
            onclick="showPage('home')">تسوّق الآن</button>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
        { year:'numeric', month:'long', day:'numeric' });
      return `
      <div class="order-track-card">
        <div class="order-track-header">
          <div>
            <div class="order-track-num">
              <i class="fas fa-receipt" style="color:var(--primary-light)"></i> #${order.id}
            </div>
            <div class="order-track-date">📅 ${date} · ${escHtml(order.clinic)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            ${statusBadgeHTML(order.status)}
            ${order.payMethod === 'points'
              ? `<div class="order-track-total" style="background:#fffbeb;color:#92400e;border:1.5px solid #f59e0b">🏆 ${t('دُفع بالنقاط','Paid with Points')} (${order.totalPoints || 0})</div>`
              : `<div class="order-track-total">${order.total.toLocaleString()} د.أ</div>`}
            <button onclick="printOrderInvoice('${order.id}')"
              style="padding:6px 16px;border-radius:50px;background:#f0f8ff;color:#0a5c8a;
                     border:1.5px solid #d0e4ef;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
              <i class="fas fa-print"></i> طباعة
            </button>
          </div>
        </div>
        <div class="order-track-body">
          ${trackStepsHTML(order.status)}
          <div class="order-items-list">
            ${order.items.map(item => `
              <div class="order-item-row">
                <div class="order-item-icon">${item.icon}</div>
                <div style="flex:1;font-weight:600;color:var(--primary-dark)">${item.ar}</div>
                <div style="color:var(--text-muted)">× ${item.qty}</div>
                <div style="font-weight:800;color:${order.payMethod === 'points' ? '#d97706' : 'var(--primary)'}">
                  ${order.payMethod === 'points'
                    ? `🏆 ${(item.points||0)*item.qty} نقطة`
                    : `${(item.price*item.qty).toLocaleString()} د.أ`}
                </div>
              </div>`).join('')}
          </div>
          ${order.notes ? `
            <div style="margin-top:12px;padding:10px 14px;background:#f8fbfd;
                        border-radius:10px;font-size:13px;color:var(--text-muted)">
              <i class="fas fa-sticky-note" style="color:var(--accent2)"></i> ${escHtml(order.notes)}
            </div>` : ''}
        </div>
      </div>`;
    }).join('');

  } catch(e) {
    console.error(e);
    container.innerHTML = `
      <div class="empty-orders">
        <i class="fas fa-triangle-exclamation" style="color:var(--danger)"></i>
        <h3>تعذّر تحميل الطلبات</h3>
        <p>يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً</p>
        <button class="btn-primary" style="margin-top:16px" onclick="renderClientOrders()">إعادة المحاولة</button>
      </div>`;
  }
}
// ── ADMIN ORDERS ──
var ADMIN_TAB_TITLES = {
  products: 'المنتجات', orders: 'الطلبات', points: 'النقاط', offers: 'العروض',
  quotes: 'عروض الأسعار', messages: 'الرسائل', roles: 'الصلاحيات'
};

function switchAdminTab(tab) {
  const isProducts = tab === 'products';
  const isOrders   = tab === 'orders';
  const isPoints   = tab === 'points';
  const isOffers   = tab === 'offers';
  const isQuotes   = tab === 'quotes';
  const isMessages = tab === 'messages';
  const isRoles    = tab === 'roles';

  if (isRoles && !isAdmin()) { showToast('⛔ هذا القسم خاص بمدير النظام فقط', 'error'); return; }

  const titleEl = document.getElementById('adminPanelTitle');
  if (titleEl) titleEl.textContent = ADMIN_TAB_TITLES[tab] || 'المنتجات';

  const statsGrid = document.getElementById('adminStatTotal').closest('div[style*="grid"]');
  if (statsGrid) statsGrid.style.display = isProducts ? 'grid' : 'none';

  const filterBar = document.getElementById('adminFilterBar');
  if (filterBar) filterBar.style.display = isProducts ? 'flex' : 'none';

  const productsToolbar = document.getElementById('adminProductsToolbar');
  if (productsToolbar) productsToolbar.style.display = isProducts ? 'flex' : 'none';

  const prodWrap = document.getElementById('adminProductsWrap');
  if (prodWrap) prodWrap.style.display = isProducts ? 'block' : 'none';

  const ordersWrap = document.getElementById('adminOrdersWrap');
  if (ordersWrap) ordersWrap.style.display = isOrders ? 'block' : 'none';

  const pointsWrap = document.getElementById('adminPointsWrap');
  if (pointsWrap) pointsWrap.style.display = isPoints ? 'block' : 'none';

  const offersWrap = document.getElementById('adminOffersWrap');
  if (offersWrap) offersWrap.style.display = isOffers ? 'block' : 'none';

  const quotesWrap = document.getElementById('adminQuotesWrap');
  if (quotesWrap) quotesWrap.style.display = isQuotes ? 'block' : 'none';

  const messagesWrap = document.getElementById('adminMessagesWrap');
  if (messagesWrap) messagesWrap.style.display = isMessages ? 'block' : 'none';

  const rolesWrap = document.getElementById('adminRolesWrap');
  if (rolesWrap) rolesWrap.style.display = isRoles ? 'block' : 'none';

  if (isOrders)   { renderAdminOrders(); markNotifsByLinkPrefixRead(['adminorders:']); }
  if (isPoints)   renderAdminPoints();
  if (isOffers)   renderAdminOffers();
  if (isQuotes)   { renderAdminQuotes(); markNotifsByLinkPrefixRead(['adminquotes:']); }
  if (isMessages) { renderAdminMessages(); markNotifsByLinkPrefixRead(['clientmsg:']); }
  if (isRoles)    renderAdminStaffList();
}

// يُخفي عناصر الأدمن الحصرية (تبويب الصلاحيات + زر إعادة التعيين) عن Manager
function applyAdminUIPermissions() {
  const adminOnly = isAdmin();
  const rolesTabBtn = document.getElementById('adminTabRoles');
  if (rolesTabBtn) rolesTabBtn.style.display = adminOnly ? 'inline-block' : 'none';
}

// ── إدارة الصلاحيات: البحث عن مستخدم بالبريد أو بالاسم وتعيين دوره ──
function roleBadgeChip(role) {
  const roleLabel = role === 'admin' ? 'مدير النظام' : role === 'manager' ? 'مدير فرعي' : 'عميل';
  const roleColor = role === 'admin' ? '#e53e3e' : role === 'manager' ? '#d97706' : '#0a5c8a';
  return `<span style="padding:3px 12px;border-radius:50px;background:${roleColor}1a;color:${roleColor};font-size:11px;font-weight:800">${roleLabel}</span>`;
}

function roleActionButtonsHTML(uid, email) {
  return `
    <button onclick="assignUserRole('${uid}','admin','${escHtml(email)}')"
      style="padding:7px 14px;border-radius:50px;background:#e53e3e;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
      مدير نظام
    </button>
    <button onclick="assignUserRole('${uid}','manager','${escHtml(email)}')"
      style="padding:7px 14px;border-radius:50px;background:#d97706;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
      مدير فرعي
    </button>
    <button onclick="revokeUserRole('${uid}','${escHtml(email)}')"
      style="padding:7px 14px;border-radius:50px;background:#fff5f5;color:var(--danger);border:1.5px solid #fecaca;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
      <i class="fas fa-trash-alt"></i> إزالة الصلاحية
    </button>`;
}

async function fetchAllUsersList() {
  const snap = await window._fbGetDocs(window._fbCollection(window._db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

async function searchUserForRole() {
  const term = document.getElementById('roleSearchEmail').value.trim();
  const resultBox = document.getElementById('roleSearchResult');
  if (!term) { showToast('يرجى إدخال البريد الإلكتروني أو اسم المستخدم', 'error'); return; }
  if (!navigator.onLine) { showToast('📡 لا يوجد اتصال بالإنترنت', 'error'); return; }
  resultBox.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> جاري البحث...</div>`;
  try {
    const allUsers = await fetchAllUsersList();
    const normTerm = normalizeArabic(term);
    const matches = allUsers.filter(u =>
      (u.email || '').toLowerCase().includes(term.toLowerCase()) ||
      normalizeArabic(u.firstName || u.name || '').includes(normTerm)
    );

    if (!matches.length) {
      resultBox.innerHTML = `<div style="color:var(--danger);font-size:13px;padding:10px 0"><i class="fas fa-exclamation-circle"></i> لا يوجد مستخدم مطابق (يجب أن يكون قد أنشأ حساباً أولاً)</div>`;
      return;
    }

    resultBox.innerHTML = matches.map(data => {
      const currentRole = data.role || 'client';
      return `
      <div style="padding:14px;background:#f8fbfd;border-radius:12px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-weight:800">${escHtml(data.firstName || data.name || data.email)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escHtml(data.email)}${data.clinic?' · '+escHtml(data.clinic):''}</div>
          </div>
          ${roleBadgeChip(currentRole)}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${roleActionButtonsHTML(data.uid, data.email)}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('searchUserForRole:', e.message);
    resultBox.innerHTML = `<div style="color:var(--danger);font-size:13px"><i class="fas fa-exclamation-circle"></i> حدث خطأ أثناء البحث، تحقق من اتصالك وحاول مجدداً</div>`;
  }
}

// ── عرض قائمة كل المدراء (admin) والمدراء الفرعيين (manager) الحاليين ──
async function renderAdminStaffList() {
  const container = document.getElementById('adminStaffList');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>`;
  try {
    const allUsers = await fetchAllUsersList();
    let staff = allUsers.filter(u => u.role === 'admin' || u.role === 'manager');

    // ضمان ظهور مدير النظام الرئيسي (البريد الثابت) حتى لو لم يكن له مستند users/{uid} بعد
    if (!staff.find(u => u.email === ADMIN_EMAIL)) {
      staff.unshift({ uid: null, email: ADMIN_EMAIL, firstName: 'المدير الرئيسي', role: 'admin', isBootstrap: true });
    }

    // ترتيب: مدير النظام أولاً ثم المدراء الفرعيون
    staff.sort((a,b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1));

    if (!staff.length) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">لا يوجد مدراء حالياً</div>`;
      return;
    }

    container.innerHTML = staff.map(u => {
      const avatarBg = u.role === 'admin' ? 'linear-gradient(135deg,#e53e3e,#c53030)' : 'linear-gradient(135deg,#d97706,#b45309)';
      const isSelf = currentUser && u.email === currentUser.email;
      const actions = u.isBootstrap
        ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic">حساب المدير الأساسي — لا يمكن تعديله من هنا</span>`
        : isSelf
          ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic">هذا حسابك الحالي</span>`
          : roleActionButtonsHTML(u.uid, u.email);
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
                  background:#fff;border:1px solid #e2eaf0;border-radius:14px;padding:14px 18px">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px">
          <div style="width:40px;height:40px;border-radius:50%;background:${avatarBg};color:#fff;
                      display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">
            ${escHtml((u.firstName||u.name||'؟').charAt(0))}
          </div>
          <div style="min-width:0">
            <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">${escHtml(u.firstName || u.name || 'بدون اسم')}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escHtml(u.email)}</div>
          </div>
          ${roleBadgeChip(u.role)}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${actions}</div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('renderAdminStaffList:', e.message);
    container.innerHTML = `<div style="color:var(--danger);font-size:13px;text-align:center;padding:16px"><i class="fas fa-exclamation-circle"></i> تعذّر تحميل القائمة، تحقق من اتصالك</div>`;
  }
}

async function assignUserRole(uid, role, email) {
  if (!isAdmin()) { showToast('⛔ غير مصرح', 'error'); return; }
  const label = role === 'admin' ? 'مدير نظام' : role === 'manager' ? 'مدير فرعي' : 'عميل';
  if (!confirm(`تأكيد: تعيين ${email} كـ "${label}"؟`)) return;
  if (!navigator.onLine) { showToast('📡 لا يوجد اتصال بالإنترنت، حاول مجدداً', 'error'); return; }
  try {
    await window._fbUpdateDoc(window._fbDoc2('users', uid), { role });
    showToast('✅ تم تحديث الصلاحية بنجاح', 'success');
    searchUserForRole();
    renderAdminStaffList();
  } catch(e) {
    console.error('assignUserRole:', e.message);
    showToast('❌ فشل تحديث الصلاحية، تحقق من اتصالك وحاول مجدداً', 'error');
  }
}

// إزالة صلاحية مدير/مدير فرعي وإعادته لدور "عميل" — ملاحظة: هذا لا يحذف حساب المستخدم نفسه
// (حذف حساب Firebase Authentication يتطلب صلاحيات Admin SDK من الخادم، غير متاحة من المتصفح)
async function revokeUserRole(uid, email) {
  if (!isAdmin()) { showToast('⛔ غير مصرح', 'error'); return; }
  if (!confirm(`سيتم إزالة صلاحية الإدارة عن ${email} وتحويله إلى "عميل". هل تريد المتابعة؟`)) return;
  if (!navigator.onLine) { showToast('📡 لا يوجد اتصال بالإنترنت، حاول مجدداً', 'error'); return; }
  try {
    await window._fbUpdateDoc(window._fbDoc2('users', uid), { role: 'client' });
    showToast('✅ تمت إزالة الصلاحية بنجاح', 'success');
    searchUserForRole();
    renderAdminStaffList();
  } catch(e) {
    console.error('revokeUserRole:', e.message);
    showToast('❌ فشل تنفيذ العملية، تحقق من اتصالك وحاول مجدداً', 'error');
  }
}

async function renderAdminOrders() {
  const body = document.getElementById('adminOrdersBody');
  if (!body) return;

  body.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 14px;width:28px;height:28px;border-width:4px"></div>
      جاري تحميل الطلبات...
    </div>`;

  try {
    const q    = window._fbQuery(window._fbOrdersRef(), window._fbOrderBy('createdAt','desc'));
    const snap = await window._fbGetDocs(q);
    const orders = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    window._cachedOrders = orders;

    const pending = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
    const ordersBadge = document.getElementById('adminOrdersBadge');
    if (ordersBadge) ordersBadge.textContent = pending > 0 ? pending : '';

    if (!orders.length) {
      body.innerHTML = `
        <div style="text-align:center;padding:56px 24px;color:var(--text-muted)">
          <i class="fas fa-inbox" style="font-size:52px;opacity:0.15;display:block;margin-bottom:16px"></i>
          <h3 style="font-weight:800;font-size:17px;color:var(--text);margin-bottom:8px">لا توجد طلبات بعد</h3>
          <p style="font-size:14px">ستظهر هنا فور إرسالها من العملاء</p>
        </div>`;
      return;
    }

    body.innerHTML = orders.map(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
        { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const itemsSummary = order.items.slice(0,2)
        .map(i => `${i.icon} ${i.ar.substring(0,12)}`).join(' · ')
        + (order.items.length > 2 ? ` +${order.items.length - 2}` : '');
      const statusOpts = ORDER_STATUSES.map(s =>
        `<option value="${s.key}" ${order.status===s.key?'selected':''}>${s.label}</option>`
      ).join('');

      return `
      <div class="admin-order-row">
        <div>
          <div style="font-weight:800;color:var(--primary-dark);font-size:13px">#${escHtml(order.id)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            👤 ${escHtml(order.clientName)} · ${escHtml(order.clinic)}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">📞 ${escHtml(order.phone)}</div>
        </div>
        <div class="admin-order-field" data-label="المنتجات:" style="font-size:12px;color:var(--text-muted);line-height:1.7">
          ${itemsSummary}<br>
          <span style="color:var(--primary-light);font-weight:700">${order.items.length} منتج</span>
        </div>
        <div class="admin-order-field" data-label="الإجمالي:" style="font-weight:900;color:${order.payMethod==='points'?'#d97706':'var(--primary)'}">
          ${order.payMethod==='points'
            ? `🏆 ${order.totalPoints||0} نقطة`
            : `${order.total.toLocaleString()} د.أ`}
        </div>
        <div class="admin-order-field" data-label="التاريخ:" style="font-size:12px;color:var(--text-muted)">${date}</div>
        <div class="admin-order-field" data-label="الحالة:">
          <select class="status-select"
            onchange="updateOrderStatus('${order._docId}','${order.id}',this.value)">
            ${statusOpts}
          </select>
        </div>
        <div>
          <button onclick="showAdminOrderDetail('${order.id}')"
            style="padding:6px 12px;border-radius:50px;background:#e8f3fb;color:var(--primary);
                   border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
            <i class="fas fa-eye"></i> عرض
          </button>
        </div>
      </div>`;
    }).join('');

  } catch(e) {
    console.error(e);
    body.innerHTML = `
      <div style="text-align:center;padding:32px;color:var(--danger)">
        <i class="fas fa-exclamation-circle" style="font-size:32px;display:block;margin-bottom:12px"></i>
        خطأ في الاتصال بقاعدة البيانات
      </div>`;
  }
}
async function updateOrderStatus(docId, orderId, newStatus) {
  try {
    const order = (window._cachedOrders || []).find(o => o._docId === docId) || {};
    await window._fbUpdateDoc(window._fbDoc(docId), { status: newStatus });

    if (order.clientEmail && order.clientEmail !== 'guest') {
      const s = getStatusObj(newStatus);
      createNotification({
        scope: 'client',
        targetEmail: order.clientEmail,
        icon: s.icon === 'fa-clock' ? '⏳' : s.icon === 'fa-check-circle' ? '✅' : s.icon === 'fa-box-open' ? '📦' : s.icon === 'fa-shipping-fast' ? '🚚' : s.icon === 'fa-hand-holding' ? '🎉' : '🚫',
        title: `تحديث طلبك #${order.id || orderId}`,
        message: `حالة طلبك الآن: ${s.label}`,
        link: 'page:orders',
      });
    }
// خصم المخزون تلقائياً عند التسليم، فقط إذا لم يُخصم من قبل
    const orderForStock = (window._cachedOrders || []).find(o => o._docId === docId);
    if (newStatus === 'delivered' && orderForStock && !orderForStock.stockDeducted) {
      await ensureAllProductsLoaded(); // نضمن أن كل المنتجات محمّلة محلياً قبل تعديل مخزونها
      const changedProducts = [];
      (orderForStock.items || []).forEach(item => {
        if (item.isBundle && item.bundleItems) {
          item.bundleItems.forEach(bi => {
            const prod = products.find(x => x.id === bi.productId);
            if (prod && prod.stock !== undefined && prod.stock !== null) {
              prod.stock = Math.max(0, prod.stock - (bi.qty * item.qty));
              changedProducts.push(prod);
            }
          });
        } else {
          const prod = products.find(x => x.id === item.id);
          if (prod && prod.stock !== undefined && prod.stock !== null) {
            prod.stock = Math.max(0, prod.stock - item.qty);
            changedProducts.push(prod);
          }
        }
      });
      if (changedProducts.length) {
        cacheProductsLocally();
        try {
          await Promise.all(changedProducts.map(p => saveProductToFirebase(p)));
        } catch(stockErr) {
          console.warn('⚠️ خطأ أثناء تحديث المخزون في Firebase:', stockErr.message);
        }
      }
      await window._fbUpdateDoc(window._fbDoc(docId), { stockDeducted: true });
    }
    // خصم النقاط تلقائياً فقط عند التسليم، وفقط إذا لم تُخصم من قبل
    if (newStatus === 'delivered' && order.payMethod === 'points' && !order.pointsDeducted) {
      const currentBalance = await getClientPoints(order.clientUid);
      const newBalance = currentBalance - (order.totalPoints || 0);
      const log = {
        type: 'spend',
        amount: order.totalPoints || 0,
        reason: `شراء بالنقاط — طلب #${order.id || orderId}`,
        balance: newBalance,
        date: new Date().toISOString(),
      };
      await saveClientPoints(order.clientUid, order.clientEmail, newBalance, log);
      await window._fbUpdateDoc(window._fbDoc(docId), { pointsDeducted: true });
    }

    const s = getStatusObj(newStatus);
    showToast(`✅ طلب #${orderId} → ${s.label}`, 'success');
    if (document.getElementById('ordersPage').classList.contains('active')) {
      renderClientOrders();
    }
  } catch(e) {
    console.error(e);
    showToast('❌ فشل تحديث الحالة، تحقق من الاتصال', 'error');
  }
}

// =====================
// طباعة الفاتورة
// =====================
function printOrderInvoice(orderId) {
  const orders = window._cachedOrders || [];
  const order = orders.find(o => o.id === orderId);
  if (!order) { showToast('❌ لم يتم العثور على الطلب', 'error'); return; }

  const date = new Date(order.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
    { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

  const rows = order.items.map(item => `
    <tr>
      <td>${escHtml(item.ar)}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:center">${order.payMethod==='points'
        ? `${(item.points||0)} نقطة`
        : `${item.price.toLocaleString()} د.أ`}</td>
      <td style="text-align:center;font-weight:700">${order.payMethod==='points'
        ? `${(item.points||0)*item.qty} نقطة`
        : `${(item.price*item.qty).toLocaleString()} د.أ`}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>فاتورة طلب #${order.id}</title>
    <style>
      body{font-family:'Cairo',Arial,sans-serif;padding:32px;color:#0f2133}
      h1{color:#0a5c8a;margin-bottom:4px}
      .muted{color:#5a7a90;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:24px}
      th,td{padding:10px 12px;border-bottom:1px solid #e2eaf0;text-align:right;font-size:14px}
      th{background:#f0f8ff;color:#0a5c8a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
      .box{background:#f8fbfd;border-radius:8px;padding:12px}
      .total{margin-top:16px;text-align:left;font-size:18px;font-weight:900;color:#0a5c8a}
      @media print{ body{padding:0} }
    </style></head>
    <body>
      <h1>🦷 DentaPro</h1>
      <div class="muted">فاتورة طلب رقم #${order.id} — ${date}</div>
      <div class="grid">
        <div class="box"><strong>العميل:</strong> ${escHtml(order.clientName)}</div>
        <div class="box"><strong>العيادة:</strong> ${escHtml(order.clinic) || '—'}</div>
        <div class="box"><strong>الهاتف:</strong> ${escHtml(order.phone)}</div>
        <div class="box"><strong>العنوان:</strong> ${escHtml(order.address) || '—'}</div>
      </div>
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">
        الإجمالي الكلي: ${order.payMethod==='points' ? `${order.totalPoints||0} نقطة` : `${order.total.toLocaleString()} د.أ`}
        ${order.payMethod==='points' ? ' (دفع بالنقاط)' : ''}
      </div>
      <script>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

function showAdminOrderDetail(orderId) {
  const orders = window._cachedOrders || [];
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const date = new Date(order.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
  document.querySelector('#deleteConfirmModal .modal-header').style.background = 'linear-gradient(135deg,#0a5c8a,#1a8bbf)';
  document.querySelector('#deleteConfirmModal .modal-title').innerHTML = `<i class="fas fa-receipt"></i> تفاصيل الطلب #${order.id}`;
  document.querySelector('#deleteConfirmModal .modal-body').innerHTML = `
    <div style="text-align:right">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">العميل</div>
          <div style="font-weight:700;font-size:14px">${escHtml(order.clientName)}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">العيادة</div>
          <div style="font-weight:700;font-size:14px">${escHtml(order.clinic)}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">الهاتف</div>
          <div style="font-weight:700;font-size:14px">${escHtml(order.phone)}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">التاريخ</div>
          <div style="font-weight:700;font-size:13px">${date}</div>
        </div>
      </div>
      <div style="background:#f0f8ff;border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700">📍 الموقع</div>
        <div style="font-size:13px;font-weight:600">
          ${getOrderMapLink(order)
            ? `<a href="${getOrderMapLink(order)}" target="_blank" style="color:var(--primary);text-decoration:underline;display:flex;align-items:center;gap:6px">
                 <i class="fas fa-map-marked-alt"></i> ${escHtml(order.address)} (افتح في الخريطة)
               </a>`
            : escHtml(order.address)}
        </div>
      </div>
      ${order.payMethod === 'points' ? `
      <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;padding:10px 14px;margin-bottom:12px;
                  font-weight:800;color:#92400e;text-align:center">
        🏆 الدفع بالنقاط — ${order.totalPoints || 0} نقطة
        ${order.pointsDeducted ? ' (تم الخصم)' : ' (سيتم الخصم عند التسليم)'}
      </div>` : ''}
      <div style="margin-bottom:12px">
        ${order.items.map(item=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px">
            <span style="font-size:22px">${item.icon}</span>
            <span style="flex:1;font-weight:600">${item.ar}</span>
            <span style="color:var(--text-muted)">× ${item.qty}</span>
            <span style="font-weight:800;color:${order.payMethod==='points'?'#d97706':'var(--primary)'}">
              ${order.payMethod==='points'
                ? `🏆 ${(item.points||0)*item.qty} نقطة`
                : `${(item.price*item.qty).toLocaleString()} د.أ`}
            </span>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:900;font-size:16px;color:var(--primary)">
          <span>الإجمالي</span>
          <span>${order.payMethod==='points' ? `🏆 ${order.totalPoints||0} نقطة` : `${order.total.toLocaleString()} د.أ`}</span>
        </div>
      </div>
      ${order.notes?`<div style="background:#fffbeb;border-radius:10px;padding:10px 14px;font-size:13px"><i class="fas fa-sticky-note" style="color:var(--accent2)"></i> ${escHtml(order.notes)}</div>`:''}
      <div style="margin-top:16px;text-align:center">${statusBadgeHTML(order.status)}</div>
      ${trackStepsHTML(order.status)}
    </div>`;
  document.querySelector('#deleteConfirmModal .modal-footer').innerHTML = `
    <button class="btn-back" onclick="closeDeleteConfirm();renderAdminOrders()">
      <i class="fas fa-arrow-right"></i> رجوع
    </button>
    <button onclick="sendWhatsAppAdmin('${order.id}')" style="padding:12px 20px;border-radius:50px;background:#25d366;color:#fff;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
      <i class="fab fa-whatsapp"></i> تواصل مع العميل
    </button>
    <button onclick="printOrderInvoice('${order.id}')" style="padding:12px 20px;border-radius:50px;background:#0a5c8a;color:#fff;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
      <i class="fas fa-print"></i> طباعة الفاتورة
    </button>`;
  document.getElementById('deleteConfirmModal').classList.add('open');
}

// =====================
// ADMIN: QUOTES MANAGEMENT
// =====================

// ─── عداد طلبات عروض الأسعار (يستثني ما تم تصفيره يدويًا) ───
function resetQuotesBadgeCounter() {
  if (!confirm('سيتم تصفير عداد "طلبات عروض الأسعار" بحيث لا تُحتسب الطلبات الحالية بعد الآن (تبقى الطلبات نفسها موجودة كما هي، فقط لن تُحسب ضمن العداد). هل تريد المتابعة؟')) return;
  localStorage.setItem('dp_quotesBadgeResetAt', new Date().toISOString());
  renderAdminQuotes();
  refreshAdminMenuBadges();
  showToast('تم تصفير العداد بنجاح', 'success');
}
function computeQuotesBadgeCount(quotes) {
  const resetAt = localStorage.getItem('dp_quotesBadgeResetAt');
  const countable = resetAt ? quotes.filter(q => new Date(q.createdAt) > new Date(resetAt)) : quotes;
  return countable.filter(q => q.status === 'pending').length;
}

async function renderAdminQuotes() {
  const container = document.getElementById('adminQuotesList');
  container.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 14px;width:28px;height:28px;border-width:4px"></div>
      جاري تحميل طلبات عروض الأسعار...
    </div>`;

  const quotes = await getAllQuotes();
  window._cachedAdminQuotes = quotes;

  const pendingCount = computeQuotesBadgeCount(quotes);
  const badge = document.getElementById('adminQuotesBadge');
  if (badge) badge.textContent = pendingCount > 0 ? pendingCount : '';

  let ordersForLink = window._cachedOrders;
  if (!ordersForLink) {
    try {
      const snap = await window._fbGetDocs(window._fbOrdersRef());
      ordersForLink = snap.docs.map(d => d.data());
      window._cachedOrders = ordersForLink;
    } catch(e) { ordersForLink = []; }
  }
  function findLinkedOrder(q) {
    return ordersForLink.find(o =>
      o.sourceQuoteId === q.id || o.id === ('DP-' + String(q.id || '').replace('QT-', ''))
    );
  }

  if (!quotes.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:56px 24px;color:var(--text-muted)">
        <i class="fas fa-file-invoice-dollar" style="font-size:52px;opacity:0.15;display:block;margin-bottom:16px"></i>
        <h3 style="font-weight:800;font-size:17px;color:var(--text);margin-bottom:8px">لا توجد طلبات عروض أسعار</h3>
        <p style="font-size:14px">ستظهر هنا فور إرسالها من العملاء</p>
      </div>`;
    return;
  }

  container.innerHTML = quotes.map(q => {
    const date = new Date(q.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const linkedOrder = q.status === 'accepted' ? findLinkedOrder(q) : null;
    const itemsHtml = q.items.map(i => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px">
        <span style="font-size:18px">${i.icon}</span>
        <span style="flex:1;font-weight:600">${escHtml(i.ar)}</span>
        ${i.isCustom ? `<span style="font-size:10px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:50px;padding:2px 8px;font-weight:700;flex-shrink:0">⚠️ غير مدرجة بالمتجر</span>` : ''}
        <span style="color:var(--text-muted)">${i.qty ? `× ${i.qty}` : 'كمية غير محددة'}</span>
        ${i.unitPrice ? `<span style="font-weight:800;color:var(--primary)">${i.unitPrice.toLocaleString()} د.أ</span>` : ''}
      </div>`).join('');

    return `
    <div class="points-admin-card" style="flex-direction:column;align-items:stretch;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">📄 #${q.id}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">👤 ${escHtml(q.clientName)} ${q.clinic?'· '+escHtml(q.clinic):''} · ${escHtml(q.clientEmail)}</div>
          <div style="font-size:11px;color:var(--text-muted)">📅 ${date}</div>
        </div>
        <div>${quoteStatusBadge(q.status)}</div>
      </div>
      <div style="background:#f8fbfd;border-radius:10px;padding:10px 14px">${itemsHtml}</div>
      ${q.attachedImage ? `
      <div>
        <img src="${cldOptimize(q.attachedImage,200)}" loading="lazy" onclick="window.open('${q.attachedImage}','_blank')"
          style="max-width:120px;max-height:120px;border-radius:10px;border:2px solid var(--border);cursor:pointer" title="اضغط لعرض الصورة بالحجم الكامل">
      </div>` : ''}
      ${q.notes ? `<div style="font-size:13px;color:var(--text-muted);background:#fffbeb;padding:8px 12px;border-radius:8px"><i class="fas fa-sticky-note" style="color:var(--accent2)"></i> ${escHtml(q.notes)}</div>` : ''}
      ${q.status === 'accepted' ? `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:700;color:var(--text-muted)">حالة تنفيذ الطلب:</span>
        ${linkedOrder ? statusBadgeHTML(linkedOrder.status || 'pending') : `<span style="font-size:12px;color:var(--text-muted);font-style:italic">تعذر إيجاد الطلب المرتبط</span>`}
        <span style="font-size:11px;color:var(--text-muted)">(تُحدَّث من صفحة "الطلبات")</span>
      </div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(q.status === 'pending' || q.status === 'priced') ? `
        <button onclick="openPriceQuoteModal('${q._docId}')" style="padding:8px 18px;border-radius:50px;background:linear-gradient(135deg,#0a5c8a,#1a8bbf);color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fas fa-tag"></i> ${q.status === 'pending' ? 'تحديد السعر وإرسال العرض' : 'تعديل السعر'}
        </button>` : ''}
        <button onclick="sendWhatsAppQuote('${q._docId}')" style="padding:8px 18px;border-radius:50px;background:#e8fdf2;color:#16a34a;border:1.5px solid #bbf7d0;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fab fa-whatsapp"></i> تواصل مع العميل
        </button>
        ${q.status === 'accepted' ? `
        <button onclick="showQuoteOrderDetail('${q._docId}')" style="padding:8px 18px;border-radius:50px;background:#e8f3fb;color:var(--primary);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
          <i class="fas fa-eye"></i> عرض التفاصيل
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function updateQuoteOrderStatus(docId, quoteIdStr, newStatus) {
  try {
    await updateQuote(docId, { orderStatus: newStatus });
    const cached = (window._cachedAdminQuotes || []).find(x => x._docId === docId);
    if (cached) cached.orderStatus = newStatus;
    const s = getStatusObj(newStatus);
    showToast(`✅ طلب العرض #${quoteIdStr} → ${s.label}`, 'success');
  } catch(e) {
    showToast('❌ فشل تحديث الحالة، تحقق من الاتصال', 'error');
  }
}

function openPriceQuoteModal(docId) {
  const quotes = window._cachedAdminQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) return;
  document.getElementById('priceQuoteDocId').value = docId;
  document.getElementById('priceQuoteError').style.display = 'none';
  const form = document.getElementById('priceQuoteItemsForm');
  form.innerHTML = q.items.map((i, idx) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fbfd;border-radius:10px;border:1px solid var(--border)">
      <span style="font-size:22px;flex-shrink:0">${i.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px">${escHtml(i.ar)} ${i.isCustom ? `<span style="font-size:10px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:50px;padding:2px 8px;font-weight:700;margin-right:6px">⚠️ غير مدرجة بالمتجر</span>` : ''}</div>
        <div style="font-size:11px;color:var(--text-muted)">${i.qty ? `الكمية المطلوبة: ${i.qty}` : 'الكمية غير محددة من العميل'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input type="number" min="1" placeholder="الكمية" value="${i.qty || ''}" id="quoteItemQty_${idx}" style="width:80px;padding:7px 8px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:13px;text-align:center">
        <input type="number" min="0" step="0.01" placeholder="سعر الوحدة" value="${i.unitPrice || ''}" id="quoteItemPrice_${idx}" style="width:100px;padding:7px 8px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:13px;text-align:center">
      </div>
    </div>`).join('');
  document.getElementById('priceQuoteModal').classList.add('open');
}

function closePriceQuoteModal() {
  document.getElementById('priceQuoteModal').classList.remove('open');
}

async function sendQuotePricing() {
  const docId = document.getElementById('priceQuoteDocId').value;
  const quotes = window._cachedAdminQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) return;

  const updatedItems = q.items.map((item, idx) => {
    const qtyVal = document.getElementById(`quoteItemQty_${idx}`).value;
    const priceVal = document.getElementById(`quoteItemPrice_${idx}`).value;
    return {
      ...item,
      qty: qtyVal ? parseInt(qtyVal) : null,
      unitPrice: priceVal ? parseFloat(priceVal) : null,
    };
  });

  const allValid = updatedItems.every(i => i.qty && i.unitPrice && i.unitPrice > 0);
  if (!allValid) {
    document.getElementById('priceQuoteError').style.display = 'block';
    return;
  }
  document.getElementById('priceQuoteError').style.display = 'none';

  try {
    await updateQuote(docId, { items: updatedItems, status: 'priced' });
    if (q.clientEmail && q.clientEmail !== 'guest') {
      createNotification({
        scope: 'client',
        targetEmail: q.clientEmail,
        icon: '💰',
        title: 'عرض السعر جاهز',
        message: `تم تحديد سعر طلبك #${q.id}، يمكنك مراجعته الآن`,
        link: 'page:myQuotes',
      });
    }
    closePriceQuoteModal();
    showToast('✅ تم إرسال عرض السعر للعميل', 'success');
    renderAdminQuotes();
  } catch(e) {
    showToast('❌ حدث خطأ، تحقق من الاتصال', 'error');
  }
}

function sendWhatsAppQuote(docId) {
  const quotes = window._cachedAdminQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) return;
  const itemsTxt = q.items.map(i => `• ${i.ar}${i.qty?` × ${i.qty}`:''}`).join('\n');
  const msg = encodeURIComponent(
    `🦷 *DentaPro — بخصوص طلب عرض السعر #${q.id}*\n\nمرحباً ${q.clientName}،\n\n` +
    `بخصوص طلبك لعرض سعر المواد:\n${itemsTxt}\n\nسنوافيك بالتفاصيل قريباً.`
  );
  const phone = formatPhoneForWhatsApp(q.phone);
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

function getQuoteTotal(q) {
  return q.items.reduce((s,i) => s + ((i.unitPrice||0) * (i.qty||1)), 0);
}

function showQuoteOrderDetail(docId) {
  const quotes = window._cachedAdminQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) return;
  const date = new Date(q.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const total = getQuoteTotal(q);
  const linkedOrderForDetail = (window._cachedOrders || []).find(o =>
    o.sourceQuoteId === q.id || o.id === ('DP-' + String(q.id || '').replace('QT-', ''))
  );
  const orderStatus = linkedOrderForDetail ? (linkedOrderForDetail.status || 'pending') : 'pending';

  document.querySelector('#deleteConfirmModal .modal-header').style.background = 'linear-gradient(135deg,#0a5c8a,#1a8bbf)';
  document.querySelector('#deleteConfirmModal .modal-title').innerHTML = `<i class="fas fa-file-invoice-dollar"></i> تفاصيل طلب عرض السعر #${q.id}`;
  document.querySelector('#deleteConfirmModal .modal-body').innerHTML = `
    <div style="text-align:right">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">العميل</div>
          <div style="font-weight:700;font-size:14px">${escHtml(q.clientName)}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">العيادة</div>
          <div style="font-weight:700;font-size:14px">${escHtml(q.clinic||'—')}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">الهاتف</div>
          <div style="font-weight:700;font-size:14px">${escHtml(q.phone||'—')}</div>
        </div>
        <div style="background:#f8fbfd;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">التاريخ</div>
          <div style="font-weight:700;font-size:13px">${date}</div>
        </div>
      </div>
      <div style="margin-bottom:12px">
        ${q.items.map(i=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px">
            <span style="font-size:22px">${i.icon}</span>
            <span style="flex:1;font-weight:600">${escHtml(i.ar)}</span>
            <span style="color:var(--text-muted)">× ${i.qty||1}</span>
            <span style="font-weight:800;color:var(--primary)">${((i.unitPrice||0)*(i.qty||1)).toLocaleString()} د.أ</span>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:900;font-size:16px;color:var(--primary)">
          <span>الإجمالي</span>
          <span>${total.toLocaleString()} د.أ</span>
        </div>
      </div>
      ${q.attachedImage ? `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px"><i class="fas fa-image" style="color:var(--primary-light)"></i> صورة مرفقة من العميل</div>
        <img src="${cldOptimize(q.attachedImage,400)}" loading="lazy" onclick="window.open('${q.attachedImage}','_blank')"
          style="max-width:220px;max-height:220px;border-radius:12px;border:2px solid var(--border);cursor:pointer" title="اضغط لعرض الصورة بالحجم الكامل">
      </div>` : ''}
      ${q.notes?`<div style="background:#fffbeb;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:12px"><i class="fas fa-sticky-note" style="color:var(--accent2)"></i> ${escHtml(q.notes)}</div>`:''}
      <div style="margin-top:16px;text-align:center">${statusBadgeHTML(orderStatus)}</div>
      ${trackStepsHTML(orderStatus)}
    </div>`;
  document.querySelector('#deleteConfirmModal .modal-footer').innerHTML = `
    <button class="btn-back" onclick="closeDeleteConfirm();renderAdminQuotes()">
      <i class="fas fa-arrow-right"></i> رجوع
    </button>
    <button onclick="sendWhatsAppQuote('${q._docId}')" style="padding:12px 20px;border-radius:50px;background:#25d366;color:#fff;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
      <i class="fab fa-whatsapp"></i> تواصل مع العميل
    </button>
    <button onclick="printQuoteInvoice('${q._docId}')" style="padding:12px 20px;border-radius:50px;background:#0a5c8a;color:#fff;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
      <i class="fas fa-print"></i> طباعة الفاتورة
    </button>`;
  document.getElementById('deleteConfirmModal').classList.add('open');
}

function printQuoteInvoice(docId) {
  const quotes = window._cachedAdminQuotes || [];
  const q = quotes.find(x => x._docId === docId);
  if (!q) { showToast('❌ لم يتم العثور على الطلب', 'error'); return; }

  const date = new Date(q.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
    { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const total = getQuoteTotal(q);

  const rows = q.items.map(item => `
    <tr>
      <td>${escHtml(item.ar)}</td>
      <td style="text-align:center">${item.qty||1}</td>
      <td style="text-align:center">${(item.unitPrice||0).toLocaleString()} د.أ</td>
      <td style="text-align:center;font-weight:700">${((item.unitPrice||0)*(item.qty||1)).toLocaleString()} د.أ</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>فاتورة عرض سعر #${q.id}</title>
    <style>
      body{font-family:'Cairo',Arial,sans-serif;padding:32px;color:#0f2133}
      h1{color:#0a5c8a;margin-bottom:4px}
      .muted{color:#5a7a90;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:24px}
      th,td{padding:10px 12px;border-bottom:1px solid #e2eaf0;text-align:right;font-size:14px}
      th{background:#f0f8ff;color:#0a5c8a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
      .box{background:#f8fbfd;border-radius:8px;padding:12px}
      .total{margin-top:16px;text-align:left;font-size:18px;font-weight:900;color:#0a5c8a}
      @media print{ body{padding:0} }
    </style></head>
    <body>
      <h1>🦷 DentaPro</h1>
      <div class="muted">فاتورة عرض سعر رقم #${q.id} — ${date}</div>
      <div class="grid">
        <div class="box"><strong>العميل:</strong> ${escHtml(q.clientName)}</div>
        <div class="box"><strong>العيادة:</strong> ${escHtml(q.clinic||'—')}</div>
        <div class="box"><strong>الهاتف:</strong> ${escHtml(q.phone||'—')}</div>
      </div>
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">الإجمالي الكلي: ${total.toLocaleString()} د.أ</div>
      <script>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

function sendWhatsAppAdmin(orderId) {
  const orders = window._cachedOrders || [];
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const s = getStatusObj(order.status);
  const msg = encodeURIComponent(
    `🦷 *DentaPro — تحديث طلبك*\n\nمرحباً ${order.clientName}،\n` +
    `طلبك رقم *#${order.id}* الآن في مرحلة: *${s.label}*\n\n` +
    `شكراً لثقتك بـ DentaPro 💙`
  );
  const clean = formatPhoneForWhatsApp(order.phone);
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
}
// =====================
// AUTO FILL FROM PROFILE
// =====================
function autoFillFromProfile() {
  if (!currentUser) return;
  if (currentUser.clinic)  document.getElementById('clinicName').value  = currentUser.clinic;
  if (currentUser.name)    document.getElementById('doctorName').value   = currentUser.name;
  if (currentUser.phone)   document.getElementById('phoneNumber').value  = currentUser.phone.replace(/^\+\d+/, '');
  // إزالة أي أخطاء تحقق
  ['clinicName','doctorName','phoneNumber'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
  ['clinicNameError','doctorNameError','phoneError'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
  showToast('✅ تم ملء البيانات من ملفك الشخصي', 'success');
}

// =====================
// EDIT PROFILE MODAL
// =====================
function openEditProfile() {
  // أغلق modal الطلب مؤقتاً وافتح modal التعديل
  const existing = document.getElementById('editProfileModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'editProfileModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '4000';
  modal.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header" style="background:linear-gradient(135deg,var(--primary-dark),var(--primary))">
        <div class="modal-title"><i class="fas fa-user-edit"></i> <span data-ar="تعديل الملف الشخصي" data-en="Edit Profile">تعديل الملف الشخصي</span></div>
        <button class="close-btn" aria-label="إغلاق" onclick="document.getElementById('editProfileModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الاسم <span class="required">*</span></label>
            <input type="text" class="form-input" id="epName" value="${escHtml(currentUser.name||'')}" placeholder="اسمك">
          </div>
          <div class="form-group">
            <label class="form-label">اسم العيادة <span class="required">*</span></label>
            <input type="text" class="form-input" id="epClinic" value="${escHtml(currentUser.clinic||'')}" placeholder="عيادة...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">رقم الهاتف</label>
          <input type="tel" class="form-input" id="epPhone" value="${escHtml(currentUser.phone||'')}" placeholder="05xxxxxxxx">
        </div>
        <div class="form-group">
          <label class="form-label"><i class="fas fa-map-marker-alt" style="color:var(--primary-light)"></i> وصف الموقع اليدوي <small style="color:var(--text-muted);font-weight:500">(اختياري)</small></label>
          <textarea class="form-textarea" id="epLocationText" placeholder="مثال: عمّان، الدوار السابع، مقابل...">${escHtml(currentUser.profileLocationText||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label"><i class="fas fa-map-marked-alt" style="color:var(--primary-light)"></i> تحديد الموقع عبر خرائط جوجل <small style="color:var(--text-muted);font-weight:500">(اختياري)</small></label>
          <input type="hidden" id="epLocationLat" value="${currentUser.profileLocationLat||''}">
          <input type="hidden" id="epLocationLng" value="${currentUser.profileLocationLng||''}">
          <button type="button" onclick="detectProfileLocation()" style="width:100%;padding:11px;border-radius:var(--radius-sm);
            background:#f0f8ff;color:var(--primary);border:1.5px dashed var(--border);font-family:inherit;
            font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            <i class="fas fa-crosshairs"></i> تحديد موقعي الحالي
          </button>
          <div id="epLocationStatus" style="margin-top:8px;font-size:12px;font-weight:600;${currentUser.profileLocationLat ? '' : 'display:none;'}">
            ${currentUser.profileLocationLat ? `<i class="fas fa-check-circle" style="color:var(--success)"></i> <a href="https://www.google.com/maps?q=${currentUser.profileLocationLat},${currentUser.profileLocationLng}" target="_blank" style="color:var(--primary);text-decoration:underline">عرض الموقع المحفوظ على خرائط جوجل</a>` : ''}
          </div>
        </div>
        <div id="epError" style="display:none;color:var(--danger);font-size:13px;font-weight:700;
          padding:10px;background:#fff5f5;border-radius:8px;margin-top:8px">
          <i class="fas fa-exclamation-circle"></i> يرجى ملء الحقول المطلوبة
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        <button class="btn-back" onclick="document.getElementById('editProfileModal').remove()">
          <i class="fas fa-times"></i> إلغاء
        </button>
        <button class="btn-submit" onclick="saveProfile()">
          <i class="fas fa-save"></i> حفظ التعديلات
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function detectProfileLocation() {
  if (!navigator.geolocation) {
    showToast(t('المتصفح لا يدعم تحديد الموقع','Browser does not support location'), 'error');
    return;
  }
  const statusEl = document.getElementById('epLocationStatus');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري تحديد موقعك...`;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      document.getElementById('epLocationLat').value = lat;
      document.getElementById('epLocationLng').value = lng;
      statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:var(--primary);text-decoration:underline">عرض الموقع على خرائط جوجل</a>`;
      showToast(t('✅ تم تحديد موقعك بنجاح','✅ Location detected!'), 'success');
    },
    err => {
      statusEl.innerHTML = `<span style="color:var(--danger)"><i class="fas fa-exclamation-circle"></i> تعذر تحديد الموقع، حاول مجدداً</span>`;
    }
  );
}

async function saveProfile() {
  const name   = document.getElementById('epName').value.trim();
  const clinic = document.getElementById('epClinic').value.trim();
  const phone  = document.getElementById('epPhone').value.trim();
  const locationText = document.getElementById('epLocationText').value.trim();
  const locationLat  = document.getElementById('epLocationLat').value || null;
  const locationLng  = document.getElementById('epLocationLng').value || null;
  if (!name || !clinic) {
    document.getElementById('epError').style.display = 'flex';
    return;
  }
  currentUser.name   = name;
  currentUser.clinic = clinic;
  currentUser.phone  = phone;
  currentUser.profileLocationText = locationText;
  currentUser.profileLocationLat  = locationLat;
  currentUser.profileLocationLng  = locationLng;
  localStorage.setItem('dentapro_session', JSON.stringify(currentUser));

  // حفظ في Firestore
  try {
    if (currentUser.uid && window._fbDoc2 && window._fbSetDoc) {
      await window._fbUpdateDoc(
        window._fbDoc2('users', currentUser.uid),
        { firstName: name, clinic, phone, email: currentUser.email,
          profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng,
          updatedAt: new Date().toISOString() }
      );
    }
    // حفظ محلي
    const users = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
    const idx = users.findIndex(u => u.email === currentUser.email);
    if (idx !== -1) { users[idx] = { ...users[idx], firstName: name, clinic, phone, profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng }; }
    else { users.push({ firstName: name, clinic, phone, email: currentUser.email, profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng }); }
    localStorage.setItem('dentapro_users', JSON.stringify(users));
  } catch(e) { console.warn('saveProfile Firebase:', e); }

  document.getElementById('editProfileModal').remove();
  renderAuthHeader();
  showToast('✅ تم حفظ الملف الشخصي', 'success');
  logActivity('profile_updated');
}

// =====================
// DELETE ACCOUNT
// =====================
function openDeleteAccountModal() {
  const existing = document.getElementById('deleteAccountModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deleteAccountModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '4500';
  modal.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header" style="background:linear-gradient(135deg,#be123c,#e53e3e)">
        <div class="modal-title"><i class="fas fa-user-times"></i> <span data-ar="حذف الحساب نهائياً" data-en="Delete Account">حذف الحساب نهائياً</span></div>
        <button class="close-btn" aria-label="إغلاق" onclick="document.getElementById('deleteAccountModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="background:#fff5f5;border:1.5px solid #fecdd3;border-radius:12px;padding:14px;margin-bottom:18px;
          display:flex;align-items:flex-start;gap:10px">
          <i class="fas fa-exclamation-triangle" style="color:var(--danger);margin-top:2px"></i>
          <div style="font-size:13px;color:#7f1d1d;line-height:1.7">
            هذا الإجراء <strong>نهائي ولا يمكن التراجع عنه</strong>. سيتم حذف حسابك وبيانات ملفك الشخصي وقائمة مفضلاتك بشكل كامل.
            سجل طلباتك السابقة سيبقى محفوظاً لدينا لأغراض إدارية فقط، وليس مرتبطاً بحسابك بعد الحذف.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label"><i class="fas fa-lock" style="color:var(--primary-light)"></i> أدخل كلمة المرور لتأكيد هويتك <span class="required">*</span></label>
          <div class="input-with-icon">
            <input type="password" class="form-input" id="delAccPassword" placeholder="كلمة المرور الحالية">
            <i class="fas fa-eye input-icon" style="cursor:pointer;pointer-events:all" onclick="togglePassVis('delAccPassword',this)"></i>
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-muted);cursor:pointer;margin-top:6px">
          <input type="checkbox" id="delAccConfirmCheck" style="width:16px;height:16px;cursor:pointer">
          أفهم أن هذا الإجراء نهائي ولا يمكن التراجع عنه
        </label>

        <div id="delAccError" style="display:none;color:var(--danger);font-size:13px;font-weight:700;
          padding:10px;background:#fff5f5;border-radius:8px;margin-top:12px">
          <i class="fas fa-exclamation-circle"></i> <span id="delAccErrorMsg"></span>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        <button class="btn-back" onclick="document.getElementById('deleteAccountModal').remove()">
          <i class="fas fa-times"></i> إلغاء
        </button>
        <button class="btn-submit" id="delAccConfirmBtn" onclick="confirmDeleteAccount()"
          style="background:linear-gradient(135deg,#be123c,#e53e3e)">
          <i class="fas fa-user-times"></i> نعم، احذف حسابي نهائياً
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function confirmDeleteAccount() {
  const password = document.getElementById('delAccPassword').value;
  const confirmed = document.getElementById('delAccConfirmCheck').checked;
  const showErr = msg => {
    document.getElementById('delAccErrorMsg').textContent = msg;
    document.getElementById('delAccError').style.display = 'flex';
  };
  document.getElementById('delAccError').style.display = 'none';

  if (!password) return showErr('يرجى إدخال كلمة المرور لتأكيد هويتك');
  if (!confirmed) return showErr('يرجى تأكيد أنك تفهم أن هذا الإجراء نهائي');
  if (!navigator.onLine) return showErr('📡 لا يوجد اتصال بالإنترنت، تحقق من الشبكة');

  const btn = document.getElementById('delAccConfirmBtn');
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحذف...';

  try {
    const fbUser = window._auth.currentUser;
    if (!fbUser) throw { code: 'no-user' };

    // إعادة تأكيد الهوية (مطلوبة من Firebase لأي عملية حذف حساب)
    const credential = window._fbEmailAuthProvider.credential(fbUser.email, password);
    await window._fbReauthenticate(fbUser, credential);

    // حذف مستند بيانات المستخدم من Firestore
    try {
      await window._fbDeleteDoc(window._fbDoc2('users', fbUser.uid));
    } catch(e) { console.warn('تعذر حذف مستند المستخدم من Firestore:', e); }

    // حذف حساب المصادقة نفسه من Firebase Auth
    await window._fbDeleteUser(fbUser);

    // تنظيف كامل للبيانات المحلية المرتبطة بالحساب
    currentUser = null;
    cart = [];
    favoritesList = [];
    localStorage.removeItem('dentapro_session');
    localStorage.removeItem('dentapro_cart');
    localStorage.removeItem('dentapro_favorites');

    document.getElementById('deleteAccountModal').remove();
    renderAuthHeader();
    updateCartUI();
    document.getElementById('notifBtn').style.display = 'none';
    const msgBtn = document.getElementById('msgBtn');
    if (msgBtn) msgBtn.style.display = 'none';
    showPage('home');
    showToast('✅ تم حذف حسابك نهائياً، نأسف لرؤيتك تغادر', 'success');

  } catch(e) {
    console.error('Delete account error:', e.code || e.message);
    let msg = 'حدث خطأ أثناء حذف الحساب، حاول مرة أخرى';
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = '❌ كلمة المرور غير صحيحة';
    else if (e.code === 'auth/too-many-requests') msg = '⏳ محاولات كثيرة، حاول لاحقاً';
    else if (e.code === 'auth/network-request-failed') msg = '📡 تعذّر الاتصال، تحقق من الإنترنت';
    else if (e.code === 'no-user') msg = 'يرجى إعادة تسجيل الدخول والمحاولة مجدداً';
    showErr(msg);
    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;
  }
}

// =====================
// CLIENT RECORD (ADMIN)
// =====================
// ============================
// إرسال طلبية يدوية للعميل (هاتف / واتساب)
// ============================
var _sendOrderItems = [];
var _sendOrderPayMethod = 'money';

function openAdminSendOrderModal(email, uid, name, clinic, phone) {
  _sendOrderItems = [];
  _sendOrderPayMethod = 'money';
  document.getElementById('sendOrderClientEmail').value = email;
  document.getElementById('sendOrderClientUid').value = uid || '';
  document.getElementById('sendOrderClientPhone').value = phone || '';
  document.getElementById('sendOrderClientClinic').value = clinic || '';
  document.getElementById('sendOrderClientName').textContent = name || 'العميل';
  document.getElementById('sendOrderProductSearch').value = '';
  document.getElementById('sendOrderSearchResults').style.display = 'none';
  document.getElementById('sendOrderCustomForm').style.display = 'none';
  document.getElementById('sendOrderCustomName').value = '';
  document.getElementById('sendOrderCustomPrice').value = '';
  document.getElementById('sendOrderError').style.display = 'none';
  setSendOrderPayMethod('money');
  renderSendOrderItems();
  document.getElementById('adminSendOrderModal').classList.add('open');
}
function closeAdminSendOrderModal() {
  document.getElementById('adminSendOrderModal').classList.remove('open');
}

function toggleSendOrderCustomForm() {
  const el = document.getElementById('sendOrderCustomForm');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function searchSendOrderProducts() {
  const term = document.getElementById('sendOrderProductSearch').value.trim().toLowerCase();
  const box = document.getElementById('sendOrderSearchResults');
  if (!term) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const matches = products.filter(p =>
    (p.ar && p.ar.toLowerCase().includes(term)) || (p.en && p.en.toLowerCase().includes(term))
  ).slice(0, 15);
  if (!matches.length) {
    box.innerHTML = `<div style="padding:14px;color:var(--text-muted);font-size:13px;text-align:center">لا توجد نتائج</div>`;
    box.style.display = 'block';
    return;
  }
  box.innerHTML = matches.map(p => `
    <div onclick="addSendOrderProduct(${p.id})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#f8fbfd;display:flex;align-items:center;justify-content:center">
        ${p.image ? `<img src="${cldOptimize(p.image,80)}" style="width:100%;height:100%;object-fit:contain">` : `<span>${p.icon||'📦'}</span>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--primary-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.ar||p.en)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${(p.price||0).toLocaleString()} د.أ</div>
      </div>
    </div>`).join('');
  box.style.display = 'block';
}

function addSendOrderProduct(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const existing = _sendOrderItems.find(i => i.kind === 'catalog' && i.id === productId);
  if (existing) { existing.qty += 1; }
  else {
    _sendOrderItems.push({
      kind: 'catalog', id: p.id, ar: p.ar, en: p.en, icon: p.icon || '📦',
      price: p.price, points: p.points || 0, qty: 1
    });
  }
  document.getElementById('sendOrderProductSearch').value = '';
  document.getElementById('sendOrderSearchResults').style.display = 'none';
  renderSendOrderItems();
}

function addSendOrderCustomItem() {
  const name = document.getElementById('sendOrderCustomName').value.trim();
  const price = parseFloat(document.getElementById('sendOrderCustomPrice').value);
  if (!name || isNaN(price) || price < 0) {
    showToast('⚠️ أدخل اسم المادة وسعرًا صحيحًا', 'error');
    return;
  }
  _sendOrderItems.push({
    kind: 'custom', id: `custom-${Date.now()}`, ar: name, en: name, icon: '📦',
    price, points: 0, qty: 1
  });
  document.getElementById('sendOrderCustomName').value = '';
  document.getElementById('sendOrderCustomPrice').value = '';
  document.getElementById('sendOrderCustomForm').style.display = 'none';
  renderSendOrderItems();
}

function updateSendOrderQty(index, delta) {
  const item = _sendOrderItems[index];
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderSendOrderItems();
}
function updateSendOrderPrice(index, value) {
  const item = _sendOrderItems[index];
  if (!item) return;
  const v = parseFloat(value);
  item.price = isNaN(v) ? 0 : v;
  updateSendOrderTotalDisplay();
}
function removeSendOrderItem(index) {
  _sendOrderItems.splice(index, 1);
  renderSendOrderItems();
}

function renderSendOrderItems() {
  const list = document.getElementById('sendOrderItemsList');
  const empty = document.getElementById('sendOrderEmptyState');
  if (!_sendOrderItems.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    updateSendOrderTotalDisplay();
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = _sendOrderItems.map((item, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--border);border-radius:12px">
      <div style="display:flex;align-items:center;gap:4px;background:#f8fbfd;border-radius:50px;padding:4px;flex-shrink:0">
        <button type="button" onclick="updateSendOrderQty(${i},-1)" style="width:26px;height:26px;border-radius:50%;border:none;background:#fff;cursor:pointer;font-weight:900;color:var(--primary)">−</button>
        <span style="min-width:20px;text-align:center;font-weight:800;font-size:13px">${item.qty}</span>
        <button type="button" onclick="updateSendOrderQty(${i},1)" style="width:26px;height:26px;border-radius:50%;border:none;background:#fff;cursor:pointer;font-weight:900;color:var(--primary)">+</button>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--primary-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.ar)}</div>
      </div>
      <input type="number" value="${item.price}" min="0" step="0.01" oninput="updateSendOrderPrice(${i}, this.value)"
        style="width:72px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:13px;text-align:center">
      <button type="button" onclick="removeSendOrderItem(${i})" style="width:28px;height:28px;border-radius:50%;border:none;background:#fff5f5;color:var(--danger);cursor:pointer;flex-shrink:0">
        <i class="fas fa-times" style="font-size:11px"></i>
      </button>
    </div>`).join('');
  updateSendOrderTotalDisplay();
}

function setSendOrderPayMethod(method) {
  _sendOrderPayMethod = method;
  document.querySelectorAll('#sendOrderPayMethodGroup .pay-method-mini').forEach(btn => {
    const active = btn.dataset.val === method;
    btn.style.background = active ? 'var(--primary)' : '#f8fbfd';
    btn.style.color = active ? '#fff' : 'var(--text-muted)';
  });
  updateSendOrderTotalDisplay();
}

function updateSendOrderTotalDisplay() {
  const total = _sendOrderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const totalPoints = _sendOrderItems.reduce((s, i) => s + (i.points || 0) * i.qty, 0);
  const disp = document.getElementById('sendOrderTotalDisplay');
  if (_sendOrderPayMethod === 'points') {
    disp.textContent = `${totalPoints} نقطة`;
  } else if (_sendOrderPayMethod === 'free') {
    disp.innerHTML = `<span style="text-decoration:line-through;color:var(--text-muted);font-size:14px">${total.toLocaleString()} د.أ</span> مجانًا`;
  } else {
    disp.textContent = `${total.toLocaleString()} د.أ`;
  }
}

async function submitAdminSendOrder() {
  if (!_sendOrderItems.length) {
    document.getElementById('sendOrderError').style.display = 'flex';
    return;
  }
  document.getElementById('sendOrderError').style.display = 'none';

  const btn = document.getElementById('sendOrderSubmitBtn');
  btn.disabled = true;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

  const email  = document.getElementById('sendOrderClientEmail').value;
  const uid    = document.getElementById('sendOrderClientUid').value || null;
  const phone  = document.getElementById('sendOrderClientPhone').value;
  const clinic = document.getElementById('sendOrderClientClinic').value;
  const name   = document.getElementById('sendOrderClientName').textContent;

  const total       = _sendOrderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const totalPoints = _sendOrderItems.reduce((s, i) => s + (i.points || 0) * i.qty, 0);

  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  const orderNum = `DP-${ts}-${rand}`;

  const order = {
    id: orderNum,
    clientName: name,
    clientEmail: email,
    clientUid: uid,
    clinic: clinic,
    doctor: name,
    phone: phone,
    address: '',
    notes: 'طلبية أُدخلت يدوياً من الأدمن (هاتف/واتساب)',
    items: _sendOrderItems.map(i => ({
      id: i.id, ar: i.ar, en: i.en, icon: i.icon, price: i.price, qty: i.qty, points: i.points || 0
    })),
    total,
    totalPoints,
    payMethod: _sendOrderPayMethod,
    pointsDeducted: false,
    status: 'confirmed',
    createdByAdmin: true,
    createdAt: new Date().toISOString(),
  };

  function stripUndefinedDeep(obj) {
    if (Array.isArray(obj)) {
      return obj.map(stripUndefinedDeep);
    } else if (obj !== null && typeof obj === 'object') {
      const clean = {};
      Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val === undefined) return;
        clean[key] = stripUndefinedDeep(val);
      });
      return clean;
    }
    return obj;
  }
  const cleanOrder = stripUndefinedDeep(order);

  try {
    await window._fbSetDoc(window._fbDoc2('orders', orderNum), cleanOrder);
  } catch (e) {
    console.error('❌ Firebase error:', e.code || e.message, e);
    showToast('❌ تعذّر إرسال الطلبية، تحقق من الاتصال', 'error');
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    return;
  }

  if (email && email !== 'guest') {
    createNotification({
      scope: 'client',
      targetEmail: email,
      icon: '🛒',
      title: 'طلبية جديدة',
      message: `تم تجهيز طلبية لك بقيمة ${_sendOrderPayMethod === 'points' ? totalPoints + ' نقطة' : total.toLocaleString() + ' د.أ'}`,
      link: 'page:orders',
    });
  }

  showToast('✅ تم إرسال الطلبية بنجاح', 'success');
  closeAdminSendOrderModal();
  btn.disabled = false;
  btn.innerHTML = originalHTML;

  if (email) showClientRecord(uid, email); // تحديث فوري لعدد الطلبات في سجل العميل
}

// ============================
// تقرير تفاصيل طلبات العميل (فلترة بالتاريخ + الحالة، مع طباعة)
// ============================
function openClientOrdersReportModal(email, name, clinic, phone = '') {
  document.getElementById('reportClientEmail').value = email;
  document.getElementById('reportClientName').value = name;
  document.getElementById('reportClientClinic').value = clinic;
  window._clientOrdersReportPhone = phone || '';
  document.getElementById('reportFromDate').value = '';
  document.getElementById('reportToDate').value = '';
  document.getElementById('reportStatusFilter').value = 'all';
  document.getElementById('reportPayMethodFilter').value = 'all';
  document.getElementById('clientOrdersReportBody').innerHTML = '';
  document.getElementById('clientOrdersReportModal').classList.add('open');
  runClientOrdersReport();
}
function closeClientOrdersReportModal() {
  document.getElementById('clientOrdersReportModal').classList.remove('open');
}

async function runClientOrdersReport() {
  const email  = document.getElementById('reportClientEmail').value;
  const name   = document.getElementById('reportClientName').value;
  const clinic = document.getElementById('reportClientClinic').value;
  const reportPhone = window._clientOrdersReportPhone || '';
  const normalizeReportPhone = value => String(value || '').replace(/\D/g, '').slice(-9);
  const reportPhoneKey = normalizeReportPhone(reportPhone);
  const fromVal = document.getElementById('reportFromDate').value;
  const toVal   = document.getElementById('reportToDate').value;
  const statusFilter = document.getElementById('reportStatusFilter').value;
  const payMethodFilter = document.getElementById('reportPayMethodFilter').value;
  const body = document.getElementById('clientOrdersReportBody');
  body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 12px;width:26px;height:26px;border-width:4px"></div>جاري تجهيز التقرير...</div>`;

  try {
    const [ordersSnap, allQuotes] = await Promise.all([
      window._fbGetDocs(window._fbOrdersRef()),
      getAllQuotes()
    ]);
    let orders = ordersSnap.docs.map(d => d.data()).filter(o =>
      o.clientEmail === email ||
      (reportPhoneKey && o.clientEmail === 'guest' && normalizeReportPhone(o.phone) === reportPhoneKey)
    );
    let quoteOrders = (allQuotes || [])
      .filter(q =>
        (q.clientEmail === email ||
          (reportPhoneKey && q.clientEmail === 'guest' && normalizeReportPhone(q.phone) === reportPhoneKey)) &&
        q.status === 'accepted'
      )
      .filter(q => !orders.some(o =>
        o.sourceQuoteId === q.id || o.id === ('DP-' + String(q.id || '').replace('QT-', ''))
      ))
      .map(q => ({
        id: q.id || q._docId,
        createdAt: q.createdAt,
        status: 'pending',
        items: q.items || [],
      }));
    let all = [...orders, ...quoteOrders];

    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate   = toVal ? new Date(toVal + 'T23:59:59') : null;
    all = all.filter(o => {
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    if (statusFilter !== 'all') {
      all = all.filter(o => (o.status || 'pending') === statusFilter);
    }

    if (payMethodFilter !== 'all') {
      all = all.filter(o => (o.payMethod || 'money') === payMethodFilter);
    }

    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!all.length) {
      body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)">لا توجد طلبات ضمن هذه الفترة/الحالة</div>`;
      return;
    }

    let grandTotal = 0;
    let invoicesHTML = '';
    all.forEach(order => {
      const isCancelled = (order.status || 'pending') === 'cancelled';
      const items = order.items || [];
      let invoiceTotal = 0;
      const rowsHTML = items.map((it, idx) => {
        const lineTotal = (it.price || 0) * (it.qty || 1);
        invoiceTotal += lineTotal;
        return `
          <tr>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eef2f6">${idx + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #eef2f6">${escHtml(it.ar || it.en || '—')}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eef2f6">${it.qty || 1}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eef2f6">${(it.price || 0).toFixed(2)}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eef2f6;font-weight:700">${lineTotal.toFixed(2)}</td>
          </tr>`;
      }).join('');
      if (!isCancelled) grandTotal += invoiceTotal;

      const dateStr = new Date(order.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
      const s = getStatusObj(order.status || 'pending');

      invoicesHTML += `
        <div style="margin-bottom:24px;border:1.5px solid var(--border);border-radius:14px;overflow:hidden;${isCancelled ? 'opacity:0.6' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f8fbfd;flex-wrap:wrap;gap:8px">
            <div style="font-weight:800;color:var(--primary-dark);font-size:13px">
              <i class="fas fa-file-invoice"></i> فاتورة #${escHtml(String(order.id || ''))} — ${dateStr}
            </div>
            <span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.label}${isCancelled ? ' (ملغاة)' : ''}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#fff">
                <th style="padding:8px;text-align:center;color:var(--text-muted);font-size:11px">#</th>
                <th style="padding:8px;text-align:right;color:var(--text-muted);font-size:11px">المادة</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted);font-size:11px">الكمية</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted);font-size:11px">سعر الوحدة</th>
                <th style="padding:8px;text-align:center;color:var(--text-muted);font-size:11px">الإجمالي</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;padding:10px 16px;background:#f8fbfd;font-weight:900;color:var(--primary)">
            إجمالي الفاتورة: ${invoiceTotal.toFixed(2)} د.أ
          </div>
        </div>`;
    });

    body.innerHTML = `
      <div id="clientOrdersReportPrintArea">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-weight:900;font-size:17px;color:var(--primary-dark)">${escHtml(name)}</div>
          <div style="font-size:13px;color:var(--text-muted)">${escHtml(clinic || '—')}</div>
        </div>
        ${invoicesHTML}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:linear-gradient(135deg,var(--primary-dark),var(--primary));border-radius:14px;color:#fff;margin-top:8px">
          <span style="font-weight:800">الإجمالي العام لكل الفواتير</span>
          <strong style="font-size:20px">${grandTotal.toFixed(2)} د.أ</strong>
        </div>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger)">خطأ: ${e.message}</div>`;
  }
}

function printClientOrdersReport() {
  const printArea = document.getElementById('clientOrdersReportPrintArea');
  if (!printArea) { showToast('⚠️ لا يوجد تقرير لطباعته', 'error'); return; }
  const win = window.open('', '_blank');
  win.document.write(`
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير طلبات العميل</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#1a2332}
        table{width:100%;border-collapse:collapse}
        .status-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:50px;font-size:11px;font-weight:700;background:#eef2f6}
      </style>
    </head>
    <body>${printArea.innerHTML}</body>
    </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

async function showClientRecord(uid, email) {
  const existing = document.getElementById('clientRecordModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'clientRecordModal';
  modal.className = 'modal-overlay open';
  modal.style.cssText = 'z-index:4000;align-items:flex-start;padding:20px;overflow-y:auto';
  modal.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-header" style="background:linear-gradient(135deg,var(--primary-dark),var(--primary))">
        <div class="modal-title"><i class="fas fa-folder-open"></i> سجل العميل</div>
        <button class="close-btn" aria-label="إغلاق" onclick="document.getElementById('clientRecordModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" id="clientRecordBody">
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          <div class="spinner" style="margin:0 auto 14px;width:28px;height:28px;border-width:4px"></div>
          جاري تحميل السجل...
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  try {
    // جلب بيانات العميل
    const usersSnap = await window._fbGetDocs(window._fbCollection(window._db, 'users'));
    const userDoc   = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })).find(u => u.email === email);
    const localUsers = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
    const localUser  = localUsers.find(u => u.email === email);
    const u = userDoc || localUser || { email, firstName: 'عميل', clinic: '', phone: '' };

    // جلب طلباته
    const ordersSnap = await window._fbGetDocs(window._fbOrdersRef());
    const orders = ordersSnap.docs.map(d => d.data())
      .filter(o => o.clientEmail === email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalSpent  = orders.reduce((s, o) => s + (o.total || 0), 0);
    const balance     = await getClientPoints(uid);

    document.getElementById('clientRecordBody').innerHTML = `
      <!-- بطاقة العميل -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px;
        background:linear-gradient(135deg,rgba(10,92,138,0.06),rgba(0,194,168,0.04));
        border-radius:14px;border:1px solid var(--border);margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:50%;
          background:linear-gradient(135deg,var(--primary),var(--accent));
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:24px;font-weight:900;flex-shrink:0">
          ${(u.firstName||u.name||'؟').charAt(0)}
        </div>
        <div style="flex:1">
          <div style="font-weight:900;font-size:16px;color:var(--primary-dark)">${escHtml(u.firstName||u.name||'عميل')}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${escHtml(u.clinic||'')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(u.email)} ${u.phone ? '· '+escHtml(u.phone) : ''}</div>
        </div>
      </div>

      <!-- إحصائيات -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:#f0f8ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #cce4f6">
          <div style="font-size:24px;font-weight:900;color:var(--primary)">${orders.length}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">إجمالي الطلبات</div>
        </div>
        <div style="background:#f0fff4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0">
          <div style="font-size:22px;font-weight:900;color:#15803d">${totalSpent.toLocaleString()}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">إجمالي المشتريات (د.أ)</div>
        </div>
        <div style="background:#fffbeb;border-radius:12px;padding:16px;text-align:center;border:1px solid #fde68a">
          <div style="font-size:24px;font-weight:900;color:#d97706">${balance}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">🏆 رصيد النقاط</div>
        </div>
      </div>

      <!-- قائمة الطلبات -->
      <div style="font-weight:800;font-size:14px;color:var(--primary-dark);margin-bottom:12px;
        display:flex;align-items:center;gap:8px">
        <i class="fas fa-history" style="color:var(--primary-light)"></i> سجل الطلبات
      </div>
      ${!orders.length ? `
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          <i class="fas fa-box-open" style="font-size:36px;opacity:0.2;display:block;margin-bottom:12px"></i>
          لا توجد طلبات بعد
        </div>` :
        orders.map(o => {
          const date = new Date(o.createdAt).toLocaleDateString('ar-SA-u-ca-gregory',
            { year:'numeric', month:'short', day:'numeric' });
          const s = getStatusObj(o.status);
          return `
          <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border);
            margin-bottom:8px;background:#fafcfe">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-weight:800;font-size:13px;color:var(--primary-dark)">#${o.id}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">📅 ${date}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.label}</span>
                <span style="font-weight:900;color:var(--primary);font-size:14px">
                  ${o.total.toLocaleString()} د.أ
                </span>
              </div>
            </div>
            <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
              ${o.items.map(i => `${i.icon} ${escHtml(i.ar)} ×${i.qty}`).join(' &nbsp;·&nbsp; ')}
            </div>
          </div>`;
        }).join('')
      }`;
  } catch(e) {
    document.getElementById('clientRecordBody').innerHTML = `
      <div style="text-align:center;padding:32px;color:var(--danger)">
        خطأ في تحميل البيانات: ${e.message}
      </div>`;
  }
}

// =====================

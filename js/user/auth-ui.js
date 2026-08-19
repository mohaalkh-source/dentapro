// DentaPro domain module: extracted from the original implementation.
// AUTH SYSTEM
// =====================
var currentUser = null;


// هوية العميل الآمنة: لا نعتبر جلسة الإدارة عميلًا عند إرسال طلبات المتجر.
function getActiveClientSession() {
  return currentUser && currentUser.role === 'client' ? currentUser : null;
}

// توحيد الهاتف للمطابقة مع أرقام العملاء المسجلة بصيغ مختلفة.
function normalizeClientPhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-9);
}

// البحث عن عميل مسجل برقم الهاتف، مع دعم Firestore والتخزين المحلي القديم.
async function findRegisteredClientByPhone(phone) {
  const normalized = normalizeClientPhone(phone);
  if (!normalized) return null;

  try {
    if (window._fbGetDocs && window._fbCollection && window._db) {
      const snap = await window._fbGetDocs(window._fbCollection(window._db, 'users'));
      const doc = snap.docs
        .map(d => ({ ...d.data(), uid: d.id }))
        .find(u => u.role === 'client' && normalizeClientPhone(u.phone) === normalized);
      if (doc) {
        return {
          role: 'client', uid: doc.uid, email: doc.email || '',
          name: doc.firstName || doc.name || 'عميل', clinic: doc.clinic || '',
          phone: doc.phone || phone,
          profileLocationText: doc.profileLocationText || '',
          profileLocationLat: doc.profileLocationLat || null,
          profileLocationLng: doc.profileLocationLng || null
        };
      }
    }
  } catch (e) {
    console.warn('Phone client lookup failed:', e.message);
  }

  const localUsers = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
  const local = localUsers.find(u => u.role === 'client' && normalizeClientPhone(u.phone) === normalized);
  return local ? {
    role: 'client', uid: local.uid || null, email: local.email || '',
    name: local.firstName || local.name || 'عميل', clinic: local.clinic || '',
    phone: local.phone || phone,
    profileLocationText: local.profileLocationText || '',
    profileLocationLat: local.profileLocationLat || null,
    profileLocationLng: local.profileLocationLng || null
  } : null;
}

// يستدعى عند مغادرة حقل الهاتف لتعبئة بيانات العضو تلقائيًا دون تسجيل دخول.
async function autofillClientByPhone(phoneId, nameId, clinicId) {
  const phoneEl = document.getElementById(phoneId);
  if (!phoneEl || normalizeClientPhone(phoneEl.value).length < 7) return null;
  const client = await findRegisteredClientByPhone(phoneEl.value.trim());
  window._guestResolvedClient = client || null;
  if (!client) return null;
  const nameEl = document.getElementById(nameId);
  const clinicEl = document.getElementById(clinicId);
  if (nameEl && !nameEl.value.trim()) nameEl.value = client.name || '';
  if (clinicEl && !clinicEl.value.trim()) clinicEl.value = client.clinic || '';
  showToast('✅ تم التعرف على بياناتك من رقم الهاتف', 'success');
  return client;
}

// مراقب حالة الجلسة - Firebase Auth
window.addEventListener('load', () => {
  window._fbAuthState(window._auth, async (fbUser) => {
    if (fbUser) {
      let resolved;
      try {
        resolved = await resolveUserRole(fbUser);
      } catch(e) {
        console.warn('⚠️ تعذّر تحديد صلاحية المستخدم، سيتم اعتباره عميلاً:', e.message);
        resolved = { role: 'client', name: fbUser.displayName || 'عميل', clinic: '', phone: '' };
      }
      currentUser = { ...resolved, email: fbUser.email, uid: fbUser.uid };
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        notifyPendingOrdersOnLogin();
      }
      localStorage.setItem('dentapro_session', JSON.stringify(currentUser));
      renderAuthHeader();
      loadAndRenderNotifIcon();
      enablePushNotifications();
      if (currentUser.role === 'client') { renderPointsInHeader(); updateLatestSectionButton(); }
    } else {
      currentUser = null;
      localStorage.removeItem('dentapro_session');
      renderAuthHeader();
      document.getElementById('notifBtn').style.display = 'none';
    }
  });
});

// يحدد دور المستخدم الحقيقي (admin / manager / client) من مستند Firestore users/{uid}
// البريد الإداري الثابت يبقى كحساب احتياطي (bootstrap) لضمان وجود أدمن دائماً حتى لو فشلت قراءة Firestore
async function resolveUserRole(fbUser) {
  if (fbUser.email === ADMIN_EMAIL) {
    return { role: 'admin', name: 'المدير' };
  }
  try {
    const snap = await window._fbGetDoc(window._fbDoc2('users', fbUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      const role = (data.role === 'admin' || data.role === 'manager') ? data.role : 'client';
      return {
        role,
        name: data.firstName || fbUser.displayName || (role==='manager' ? 'مدير فرعي' : 'عميل'),
        clinic: data.clinic || '',
        phone: data.phone || '',
        profileLocationText: data.profileLocationText || '',
        profileLocationLat: data.profileLocationLat || null,
        profileLocationLng: data.profileLocationLng || null
      };
    }
  } catch(e) {
    console.warn('⚠️ Firestore users/{uid}:', e.message);
  }
  // احتياطي: نسخة محلية قديمة (تتوافق مع البيانات السابقة فقط، لا تُستخدم لتحديد صلاحيات حساسة)
  const users = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
  const profile = users.find(u => u.email === fbUser.email) || {};
  return {
    role: 'client',
    name: profile.firstName || fbUser.displayName || 'عميل',
    clinic: profile.clinic || '',
    phone: profile.phone || '',
    profileLocationText: profile.profileLocationText || '',
    profileLocationLat: profile.profileLocationLat || null,
    profileLocationLng: profile.profileLocationLng || null
  };
}

// اختصارات للتحقق من الصلاحيات تُستخدم في كل الواجهة
function isAdmin()   { return !!currentUser && currentUser.role === 'admin'; }
function isManager()  { return !!currentUser && currentUser.role === 'manager'; }
function isStaff()    { return isAdmin() || isManager(); }

// تحميل الجلسة المحلية فوراً (لتجنب الوميض)
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('dentapro_session');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      renderAuthHeader();
      loadAndRenderNotifIcon();
      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        showClientWelcome(currentUser);
        renderPointsInHeader();
      }
    } catch(e) {}
  } else { renderAuthHeader(); }
});

function renderAuthHeader() {
  const area = document.getElementById('authHeaderArea');
  if (!currentUser) {
    area.innerHTML = `
      <button class="auth-btn filled" onclick="openAuthModal('login')">
        <i class="fas fa-sign-in-alt"></i>
        <span>دخول</span>
      </button>`;
    return;
  }
  const isAdminRole = currentUser.role === 'admin';
  const isManagerRole = currentUser.role === 'manager';
  const avatarBg = isAdminRole ? 'linear-gradient(135deg,#0a5c8a,#062f45)' : (isManagerRole ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#0a5c8a,#00c2a8)');
  const avatarIcon = isAdminRole ? '🔧' : (isManagerRole ? '🗂️' : '👤');
  const roleLabel = isAdminRole ? 'مدير النظام' : (isManagerRole ? 'مدير فرعي' : 'عميل');

  area.innerHTML = '';
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('loginIdentifier').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('regError').style.display = 'none';
  document.getElementById('authModal').classList.add('open');
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register')));
  document.getElementById('authLoginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('authRegisterForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('authModalTitle').textContent = tab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
}
var ADMIN_EMAIL = 'moh.a.alkh@gmail.com';
var ADMIN_CREDENTIALS = { email: ADMIN_EMAIL, role: 'admin', name: 'المدير' };

async function doLogin() {
  const id = document.getElementById('loginIdentifier').value.trim();
  const pass = document.getElementById('loginPassword').value;
  document.getElementById('loginError').style.display = 'none';

  if (!id || !pass) {
    document.getElementById('loginErrorMsg').textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
    document.getElementById('loginError').style.display = 'flex';
    return;
  }

  if (!navigator.onLine) {
    document.getElementById('loginErrorMsg').textContent = '📡 لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
    document.getElementById('loginError').style.display = 'flex';
    return;
  }

  try {
    const cred = await window._fbSignIn(window._auth, id, pass);
    const fbUser = cred.user;
    const resolved = await resolveUserRole(fbUser);
    loginSuccess({ ...resolved, email: fbUser.email, uid: fbUser.uid });
  } catch(e) {
    console.error('Login error:', e.code || e.message);
    let msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    if (e.code === 'auth/too-many-requests') msg = '⏳ محاولات كثيرة، حاول لاحقاً';
    else if (e.code === 'auth/network-request-failed') msg = '📡 تعذّر الاتصال بالخادم، تحقق من اتصال الإنترنت';
    else if (e.code === 'auth/user-disabled') msg = '🚫 هذا الحساب معطّل، تواصل مع الإدارة';
    else if (e.code === 'auth/invalid-email') msg = 'صيغة البريد الإلكتروني غير صحيحة';
    document.getElementById('loginErrorMsg').textContent = msg;
    document.getElementById('loginError').style.display = 'flex';
  }
}

async function sendPasswordReset(){
  const email = document.getElementById('loginIdentifier')?.value.trim();
  const errorBox = document.getElementById('loginError');
  const errorMsg = document.getElementById('loginErrorMsg');
  if (!email || !email.includes('@')) {
    if (errorMsg) errorMsg.textContent = 'أدخل البريد الإلكتروني أولاً ثم اضغط استعادة كلمة المرور';
    if (errorBox) errorBox.style.display = 'flex';
    return;
  }
  try {
    if (typeof window._fbSendPasswordResetEmail !== 'function') throw new Error('Firebase Auth غير جاهز');
    await window._fbSendPasswordResetEmail(window._auth, email);
    if (errorMsg) errorMsg.textContent = 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني';
    if (errorBox) { errorBox.style.display = 'flex'; errorBox.style.color = '#087f85'; }
  } catch(e) {
    if (errorMsg) errorMsg.textContent = e.code === 'auth/user-not-found' ? 'لا يوجد حساب بهذا البريد في Firebase' : 'تعذّر إرسال رابط الاستعادة، تحقق من البريد وإعدادات Firebase';
    if (errorBox) { errorBox.style.display = 'flex'; errorBox.style.color = ''; }
  }
}

function loginSuccess(user) {
  currentUser = user;
  localStorage.setItem('dentapro_session', JSON.stringify(user));
  closeAuthModal();
  renderAuthHeader();
  loadAndRenderNotifIcon();
  showToast(`👋 أهلاً ${user.name}!`, 'success');
  if (user.role === 'admin' || user.role === 'manager') {
    setTimeout(async () => {
      document.getElementById('adminPanel').classList.add('open');
      applyAdminUIPermissions();
      await ensureAllProductsLoaded();
      updateAdminStats();
      renderAdminTable();
    }, 400);
  } else {
    showClientWelcome(user);
    renderPointsInHeader();
    logActivity('login');
  }
}

function showClientWelcome(user) {
  const existing = document.getElementById('clientWelcomeBanner');
  if (existing) existing.remove();
  const hero = document.querySelector('.hero-content');
  if (!hero) return;
  const banner = document.createElement('div');
  banner.id = 'clientWelcomeBanner';
  banner.className = 'welcome-banner';
  banner.innerHTML = `
    <i class="fas fa-hand-sparkles"></i>
    <div>
      <div style="font-weight:800;font-size:15px;color:var(--primary-dark)">أهلاً بك ${user.name}! ${user.clinic ? '— ' + user.clinic : ''}</div>
      <div style="font-size:13px;color:#fff;margin-top:2px">تمتع بأسعار العيادات الحصرية وتتبع طلباتك</div>
    </div>`;
  hero.insertBefore(banner, hero.firstChild);
}

function detectRegLocation() {
  if (!navigator.geolocation) {
    showToast(t('المتصفح لا يدعم تحديد الموقع','Browser does not support location'), 'error');
    return;
  }
  const statusEl = document.getElementById('regLocationStatus');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري تحديد موقعك...`;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      document.getElementById('regLocationLat').value = lat;
      document.getElementById('regLocationLng').value = lng;
      statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:var(--primary);text-decoration:underline">عرض الموقع على خرائط جوجل</a>`;
      showToast(t('✅ تم تحديد موقعك بنجاح','✅ Location detected!'), 'success');
    },
    err => {
      statusEl.innerHTML = `<span style="color:var(--danger)"><i class="fas fa-exclamation-circle"></i> تعذر تحديد الموقع، حاول مجدداً</span>`;
    }
  );
}

async function doRegister() {
  const firstName = document.getElementById('regFirstName').value.trim();
  const clinic    = document.getElementById('regClinic').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const phone     = document.getElementById('regPhone').value.trim();
  const password  = document.getElementById('regPassword').value;
  const locationText = document.getElementById('regLocationText').value.trim();
  const locationLat  = document.getElementById('regLocationLat').value || null;
  const locationLng  = document.getElementById('regLocationLng').value || null;

  const showRegError = (msg) => {
    document.getElementById('regErrorMsg').textContent = msg;
    document.getElementById('regError').style.display = 'flex';
  };

  if (!firstName || !clinic || !email || !phone || !password) return showRegError('يرجى ملء جميع الحقول المطلوبة');
  if (!/\S+@\S+\.\S+/.test(email)) return showRegError('البريد الإلكتروني غير صحيح');
  if (password.length < 8) return showRegError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');

  try {
    const cred = await window._fbCreateUser(window._auth, email, password);
    const fbUser = cred.user;

    await window._fbUpdateProfile(fbUser, { displayName: firstName });

    // حفظ بيانات العميل الإضافية في Firestore
    await window._fbSetDoc(
      window._fbDoc2('users', fbUser.uid),
      { firstName, clinic, email, phone, role: 'client',
        profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng,
        createdAt: new Date().toISOString() }
    );

    // حفظ محلي أيضاً للتوافق
    const users = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
    if (!users.find(u => u.email === email)) {
      users.push({ firstName, clinic, email, phone, role: 'client', uid: fbUser.uid,
        profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng,
        createdAt: Date.now() });
      localStorage.setItem('dentapro_users', JSON.stringify(users));
    }

    document.getElementById('regError').style.display = 'none';
    loginSuccess({ role: 'client', name: firstName, clinic, email, phone,
      profileLocationText: locationText, profileLocationLat: locationLat, profileLocationLng: locationLng,
      uid: fbUser.uid });
    logActivity('register');

  } catch(e) {
    console.error('Register error:', e.code);
    let msg = 'حدث خطأ، حاول مرة أخرى';
    if (e.code === 'auth/email-already-in-use') msg = 'هذا البريد مسجل مسبقاً';
    if (e.code === 'auth/weak-password') msg = 'كلمة المرور ضعيفة جداً';
    if (e.code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صحيح';
    showRegError(msg);
  }
}

async function doLogout() {
  try {
    await window._fbSignOut(window._auth);
  } catch(e) { console.warn('Signout error:', e); }
  currentUser = null;
  localStorage.removeItem('dentapro_session');
  renderAuthHeader();
  document.getElementById('notifBtn').style.display = 'none';
  const msgBtn = document.getElementById('msgBtn');
  if (msgBtn) msgBtn.style.display = 'none';
  closeNotifDropdown();
  const banner = document.getElementById('clientWelcomeBanner');
  if (banner) banner.remove();
  showToast('👋 تم تسجيل الخروج', '');
}

async function openAdminDirect() {
  if (!isStaff()) {
    showToast('⛔ غير مصرح لك بالدخول', 'error'); return;
  }
  document.getElementById('adminPanel').classList.add('open');
  applyAdminUIPermissions();
  showToast('🔄 جاري تحميل كل المنتجات...', '');
  await ensureAllProductsLoaded(); // لوحة التحكم تحتاج كل المنتجات (إحصائيات/جدول/بحث دقيق)
  updateAdminStats();
  renderAdminTable();
}

function togglePassVis(fieldId, icon) {
  const field = document.getElementById(fieldId);
  const isPass = field.type === 'password';
  field.type = isPass ? 'text' : 'password';
  icon.className = `fas fa-${isPass ? 'eye-slash' : 'eye'} input-icon`;
  icon.style.cssText = 'cursor:pointer;pointer-events:all';
}

function checkPassStrength(val) {
  const fill = document.getElementById('passStrengthFill');
  const text = document.getElementById('passStrengthText');
  if (!val) { fill.style.width='0'; text.textContent=''; return; }
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w:'25%', color:'#e53e3e', label:'ضعيفة' },
    { w:'50%', color:'#f59e0b', label:'مقبولة' },
    { w:'75%', color:'#3b82f6', label:'جيدة' },
    { w:'100%', color:'#22c55e', label:'قوية 💪' },
  ];
  const lvl = levels[score - 1] || levels[0];
  fill.style.width = lvl.w;
  fill.style.background = lvl.color;
  text.textContent = `قوة كلمة المرور: ${lvl.label}`;
  text.style.color = lvl.color;
}
// =====================

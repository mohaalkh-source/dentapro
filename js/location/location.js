// DentaPro domain module: extracted from the original implementation.
// LOCATION
// =====================
function switchLocMethod(method) {
  document.querySelectorAll('.loc-method-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn' + method.charAt(0).toUpperCase() + method.slice(1))?.classList.add('active');
}

function onAddressType() {
  const val = document.getElementById('addressInput').value.trim();
  if (val.length > 5) {
    locationData.address = val;
    locationData.method = 'manual';
    document.getElementById('locationConfirm').classList.add('show');
    document.getElementById('locationConfirmText').textContent = `📍 ${val}`;
    document.getElementById('locationError').classList.remove('show');
  }
}

function getGPSLocation() {
  switchLocMethod('GPS');
  if (!navigator.geolocation) {
    showToast(t('المتصفح لا يدعم GPS','Browser does not support GPS'), 'error');
    return;
  }
  document.getElementById('gpsLoading').classList.add('show');
  document.getElementById('locationConfirm').classList.remove('show');
  navigator.geolocation.getCurrentPosition(
    pos => {
      locationData.lat = pos.coords.latitude.toFixed(5);
      locationData.lng = pos.coords.longitude.toFixed(5);
      locationData.address = `${t('خط العرض','Lat')}: ${locationData.lat}, ${t('خط الطول','Lng')}: ${locationData.lng}`;
      locationData.method = 'gps';
      document.getElementById('gpsLoading').classList.remove('show');
      showLocationOnMap(locationData.lat, locationData.lng);
      document.getElementById('locationConfirm').classList.add('show');
      document.getElementById('locationConfirmText').textContent = `✅ ${t('تم تحديد موقعك بنجاح!','Location detected successfully!')}`;
      document.getElementById('locationError').classList.remove('show');
      showToast(t('✅ تم تحديد موقعك بنجاح','✅ Location detected!'), 'success');
    },
    err => {
      document.getElementById('gpsLoading').classList.remove('show');
      showToast(t('تعذر الحصول على الموقع. يرجى إدخاله يدوياً.','Could not get location. Please enter manually.'), 'error');
    }
  );
}

// يعرض الموقع فعلياً على خريطة داخل المربع بدل نص "تم تحديد الموقع"
function showLocationOnMap(lat, lng) {
  const box = document.getElementById('mapPreview');
  box.classList.add('located');
  box.style.padding = '0';
  box.style.overflow = 'hidden';
  const la = parseFloat(lat), ln = parseFloat(lng);
  box.innerHTML = `
    <iframe
      src="https://www.openstreetmap.org/export/embed.html?bbox=${(ln-0.006)}%2C${(la-0.004)}%2C${(ln+0.006)}%2C${(la+0.004)}&layer=mapnik&marker=${la}%2C${ln}"
      style="width:100%;height:100%;border:0;pointer-events:none"
      loading="lazy" title="map"></iframe>`;
}

var _pickerMap = null;
var _pickerMarker = null;

var _leafletLoaded = false;
function loadLeafletIfNeeded() {
  if (_leafletLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => { _leafletLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
}

async function openMapPicker() {
  await loadLeafletIfNeeded();
  switchLocMethod('MapPick');
  document.getElementById('mapPickerModal').classList.add('open');
  setTimeout(initPickerMap, 150);
}

function closeMapPicker() {
  document.getElementById('mapPickerModal').classList.remove('open');
}

function initPickerMap() {
  const defaultLat = locationData.lat ? parseFloat(locationData.lat) : 31.9539;
  const defaultLng = locationData.lng ? parseFloat(locationData.lng) : 35.9106;
  if (!_pickerMap) {
    _pickerMap = L.map('leafletPickerMap').setView([defaultLat, defaultLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(_pickerMap);
    _pickerMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(_pickerMap);
    _pickerMap.on('click', (e) => { _pickerMarker.setLatLng(e.latlng); });
  } else {
    _pickerMap.invalidateSize();
    _pickerMap.setView([defaultLat, defaultLng], 13);
    _pickerMarker.setLatLng([defaultLat, defaultLng]);
  }
}

function confirmMapPick() {
  const pos = _pickerMarker.getLatLng();
  locationData.lat = pos.lat.toFixed(5);
  locationData.lng = pos.lng.toFixed(5);
  locationData.address = `${t('خط العرض','Lat')}: ${locationData.lat}, ${t('خط الطول','Lng')}: ${locationData.lng}`;
  locationData.method = 'map';
  showLocationOnMap(locationData.lat, locationData.lng);
  document.getElementById('locationConfirm').classList.add('show');
  document.getElementById('locationConfirmText').textContent = `✅ ${t('تم تحديد موقعك من الخريطة','Location selected from map')}`;
  document.getElementById('locationError').classList.remove('show');
  closeMapPicker();
  showToast(t('✅ تم تحديد الموقع من الخريطة','✅ Location selected from map'), 'success');
}

function updateCharCount() {
  const val = document.getElementById('orderNotes').value;
  document.getElementById('charCount').textContent = val.length;
}

// =====================
// SUBMIT ORDER
// =====================
async function submitOrder() {
  if (!validateStep(3)) { currentStep=3; renderModalStep(); return; }

  const btn = document.getElementById('btnSubmit');
  if (btn.disabled) return; // منع النقر المتكرر أثناء تنفيذ الطلب

  btn.disabled = true;
  const btnOriginalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

  try {

  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  const orderNum = `DP-${ts}-${rand}`;

  const totalPoints = cart.reduce((s, i) => s + ((i.points || 0) * i.qty), 0);
  const payWithPoints = window._selectedPayMethod === 'points';

  // ملاحظة: لم نعد نخصم النقاط هنا — تُخصم تلقائياً فقط عند تأكيد التسليم من الأدمن

  const submittedPhone = formatPhoneForWhatsApp(document.getElementById('countryCode').value + document.getElementById('phoneNumber').value);
  const matchedClient = (!currentUser && typeof findRegisteredClientByPhone === 'function')
    ? await findRegisteredClientByPhone(submittedPhone) : null;
  const linkedClient = currentUser || matchedClient || null;

  const orderClientEmail = linkedClient ? (linkedClient.email || 'guest') : 'guest';
  const orderPhone = linkedClient ? (linkedClient.phone || submittedPhone) : submittedPhone;

  // لو الدفع بالنقاط: المبلغ النقدي المطلوب فعلياً هو بس قيمة المواد
  // اللي ما بتدعم الدفع بالنقاط (مو مجموع السلة الكامل) — لتفادي "تهريب"
  // مواد بالمجان تحت غطاء الدفع بالنقاط
  const cashOnlyItems = payWithPoints ? cart.filter(i => !i.points || i.points === 0) : cart;
  const rawTotal = payWithPoints
    ? cashOnlyItems.reduce((s, i) => s + i.price * i.qty, 0)
    : getTotal();
  const discountResult = await computeGeneralDiscountForCart(cashOnlyItems, orderClientEmail, orderPhone);

  const order = {
    id:          orderNum,
    clientName:  linkedClient ? (linkedClient.name || document.getElementById('doctorName').value) : document.getElementById('doctorName').value,
    clientEmail: orderClientEmail,
    clientUid:   linkedClient ? (linkedClient.uid || null) : null,
    clinic:      linkedClient ? (linkedClient.clinic || document.getElementById('clinicName').value) : document.getElementById('clinicName').value,
    doctor:      linkedClient ? (linkedClient.name || document.getElementById('doctorName').value) : document.getElementById('doctorName').value,
    phone:       orderPhone,
    address:     locationData.address || document.getElementById('addressInput').value,
    locationLat: locationData.lat || null,
    locationLng: locationData.lng || null,
    notes:       document.getElementById('orderNotes').value,
    items:       cart.map(i => ({
      id:i.id, ar:i.ar, en:i.en, icon:i.icon, price:i.price, qty:i.qty, points:i.points||0,
      isBundle: i.isBundle || false,
      bundleItems: i.isBundle ? i.bundleItems : undefined
    })),
    total:       discountResult ? discountResult.total : rawTotal,
    totalPoints: totalPoints,
    payMethod:   payWithPoints ? 'points' : 'money',
    pointsDeducted: false,
    status:      'pending',
    createdAt:   new Date().toISOString(),
    ...(discountResult ? { originalTotal: discountResult.originalTotal, discountPercent: discountResult.discountPercent } : {})
  };

  // محاولة الحفظ في Firebase — إن فشلت نعيد المحاولة مرة واحدة بعد تأخير بسيط
  // تنظيف الـ order من أي قيم undefined — Firestore يرفضها تماماً
  function stripUndefinedDeep(obj) {
    if (Array.isArray(obj)) {
      return obj.map(stripUndefinedDeep);
    } else if (obj !== null && typeof obj === 'object') {
      const clean = {};
      Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val === undefined) return; // نتجاهل الحقل بدل ما نرسله undefined
        clean[key] = stripUndefinedDeep(val);
      });
      return clean;
    }
    return obj;
  }
  const cleanOrder = stripUndefinedDeep(order);

  // مع تفعيل persistentLocalCache، عملية addDoc تنجح فوراً محلياً حتى بدون إنترنت
  // وتُرسل تلقائياً لـ Firebase بمجرد عودة الاتصال — لا داعي لاعتبارها فشلاً
  try {
    await window._fbSetDoc(window._fbDoc2('orders', orderNum), cleanOrder);
    console.log(navigator.onLine ? '✅ تم الحفظ في Firebase' : '📦 تم حفظ الطلب محلياً، سيُرسل تلقائياً عند عودة الاتصال');
  } catch(e) {
    console.error('❌ Firebase error:', e.code || e.message, e);
    showToast('❌ تعذّر إرسال الطلب، تحقق من اتصال الإنترنت وحاول مجدداً', 'error');
    btn.disabled = false;
    btn.innerHTML = btnOriginalHTML;
    return;
  }

  createNotification({
    scope: 'admin',
    icon: '🛒',
    title: 'طلب جديد',
    message: `طلب جديد من ${order.clinic || order.doctor} بقيمة ${order.total.toLocaleString()} د.أ`,
    link: 'adminorders:open',
  });
logActivity('order_placed', { orderId: orderNum, total: getTotal() });
  document.getElementById('orderNumberDisplay').textContent = '#' + orderNum;
  document.getElementById('orderTotalDisplay').innerHTML = discountResult
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:13px;font-weight:600;margin-inline-end:6px">${discountResult.originalTotal.toLocaleString()} ${t('د.أ','SAR')}</span>${discountResult.total.toLocaleString()} ${t('د.أ','SAR')} <span style="font-size:11px;color:#e53e3e;font-weight:800">(${t('خصم','off')} ${discountResult.discountPercent}%)</span>`
    : `${t('الإجمالي','Total')}: ${rawTotal.toLocaleString()} ${t('د.أ','SAR')}`;
  document.getElementById('orderTotalDisplay').innerHTML = discountResult
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:13px;font-weight:600;margin-inline-end:6px">${discountResult.originalTotal.toLocaleString()} ${t('د.أ','SAR')}</span>${discountResult.total.toLocaleString()} ${t('د.أ','SAR')} <span style="font-size:11px;color:#e53e3e;font-weight:800">(${t('خصم','off')} ${discountResult.discountPercent}%)</span>`
    : `${t('الإجمالي','Total')}: ${rawTotal.toLocaleString()} ${t('د.أ','SAR')}`;
  document.getElementById('orderTotalDisplay').innerHTML = discountResult
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:13px;font-weight:600;margin-inline-end:6px">${discountResult.originalTotal.toLocaleString()} ${t('د.أ','SAR')}</span>${discountResult.total.toLocaleString()} ${t('د.أ','SAR')} <span style="font-size:11px;color:#e53e3e;font-weight:800">(${t('خصم','off')} ${discountResult.discountPercent}%)</span>`
    : `${t('الإجمالي','Total')}: ${rawTotal.toLocaleString()} ${t('د.أ','SAR')}`;
  document.querySelector('.modal-steps').style.display = 'none';
  ['modalStep1','modalStep2','modalStep3','modalStep4'].forEach(id =>
    document.getElementById(id).style.display = 'none'
  );
  document.getElementById('modalFooter').style.display  = 'none';
  document.getElementById('successScreen').classList.add('show');
  orderSubmitted = true;
  clearCart();
  showToast(t('🎉 تم إرسال طلبك بنجاح!','🎉 Order submitted successfully!'), 'success');

  } finally {
    btn.disabled = false;
    btn.innerHTML = btnOriginalHTML;
  }
}

// ينظف رقم الهاتف ليكون بصيغة دولية صحيحة لرابط واتساب
// يتعامل مع: +962..., 00962..., 962... (بدون رمز)، 0790408680 (محلي أردني بصفر)، 790408680 (محلي بدون صفر)
function formatPhoneForWhatsApp(fullPhone) {
  if (!fullPhone) return '';
  let clean = fullPhone.replace(/[^\d+]/g, ''); // إزالة كل شيء غير الأرقام و +

  // تحويل صيغة "00" الدولية إلى "+" أولاً (مثال: 00962... → +962...)
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2);
  }

  const knownCodes = ['962','966','971','965','973','974','968','213','216','212'];

  // لو الرقم يحتوي على + (رمز دولة مدمج بالبداية زي +962...)
  if (clean.startsWith('+')) {
    clean = clean.slice(1);
    for (const code of knownCodes) {
      if (clean.startsWith(code)) {
        let rest = clean.slice(code.length);
        if (rest.startsWith('0')) rest = rest.slice(1);
        return code + rest;
      }
    }
    return clean;
  }

  // لو الرقم ما فيه + أو 00 لكنه يبدأ برمز دولة معروف مباشرة (مثال: 962790408680)
  for (const code of knownCodes) {
    if (clean.startsWith(code)) {
      let rest = clean.slice(code.length);
      if (rest.startsWith('0')) rest = rest.slice(1);
      return code + rest;
    }
  }

  // رقم محلي أردني مجرد بدون أي رمز دولة (مثال: 0790408680 أو 790408680)
  // نفترض رمز الأردن تلقائياً بما أن معظم العملاء أردنيون
  if (clean.startsWith('0') && clean.length === 10) {
    return '962' + clean.slice(1);
  }
  if (!clean.startsWith('0') && clean.length === 9) {
    return '962' + clean;
  }

  return clean;
}

function sendWhatsApp() {
  const clinic = document.getElementById('clinicName').value;
  const doctor = document.getElementById('doctorName').value;
  const phone = document.getElementById('countryCode').value + document.getElementById('phoneNumber').value;
  const addr = locationData.address || document.getElementById('addressInput').value;
  const notes = document.getElementById('orderNotes').value;
  const items = cart.map(i=>`• ${currentLang==='en'?i.en:i.ar} × ${i.qty} = ${(i.price*i.qty).toLocaleString()} ${t('د.أ','SAR')}`).join('\n');
  const msg = encodeURIComponent(
    `🦷 *DentaPro - ${t('طلب جديد','New Order')}*\n\n` +
    `🏥 ${t('العيادة','Clinic')}: ${clinic}\n` +
    `👨‍⚕️ ${t('الطبيب','Doctor')}: ${doctor}\n` +
    `📞 ${t('الهاتف','Phone')}: ${phone}\n` +
    `📍 ${t('الموقع','Location')}: ${addr}\n` +
    `${notes ? `🗒️ ${t('ملاحظات','Notes')}: ${notes}\n` : ''}` +
    `\n📦 ${t('المنتجات','Products')}:\n${items}\n\n` +
    `💰 ${t('الإجمالي','Total')}: ${getTotal().toLocaleString()} ${t('د.أ','SAR')}`
  );
  window.open(`https://wa.me/962790408680?text=${msg}`, '_blank');
}
// =====================

// DentaPro domain module: extracted from the original implementation.
// CLIENTS LIST & DETAIL (ADMIN)
// =====================
var _cachedClientsList = [];

// يوحّد رقم الهاتف لآخر 9 أرقام (يتجاهل رمز الدولة والأصفار البادئة) لمطابقة دقيقة
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-9);
}

async function openClientsListModal() {
  document.getElementById('clientsListModal').classList.add('open');
  document.getElementById('clientsListSearch').value = '';
  document.getElementById('clientsListSort').value = 'name';
  document.getElementById('clientsListType').value = 'all';
  document.getElementById('clientsListBody').innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:4px"></div>جاري تحميل العملاء...</div>`;
  try {
    const allUsers = await fetchAllUsersList();
    let users = allUsers.filter(u => u.role === 'client');
    const localUsers = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
    localUsers.forEach(lu => { if (!users.find(u => u.email === lu.email)) users.push(lu); });

    const [ordersSnap, allQuotes] = await Promise.all([
      window._fbGetDocs(window._fbOrdersRef()),
      getAllQuotes()
    ]);
    const allOrders = ordersSnap.docs.map(d => d.data());

    // خريطة أرقام هواتف العملاء المسجّلين، لربط طلبات الزوار المطابقة بحسابهم تلقائياً بدل اعتبارها منفصلة
    const phoneToUser = {};
    users.forEach(u => { const p = normalizePhone(u.phone); if (p) phoneToUser[p] = u; });

    // حساب مشتريات كل عميل مسجّل من طلباته المرتبطة بإيميله
    users.forEach(u => {
      u.totalSpent = allOrders.filter(o => o.clientEmail === u.email).reduce((s,o) => s + (o.total||0), 0);
    });

    // تجميع طلبات وعروض أسعار الزوار (clientEmail === 'guest') حسب رقم الهاتف
    const guestGroups = {};
    const guestItems = [
      ...allOrders.filter(o => o.clientEmail === 'guest').map(o => ({...o, _kind:'order'})),
      ...(allQuotes || []).filter(q => q.clientEmail === 'guest').map(q => ({...q, _kind:'quote'}))
    ];
    guestItems.forEach(item => {
      const p = normalizePhone(item.phone);
      if (!p) return;
      if (!guestGroups[p]) guestGroups[p] = [];
      guestGroups[p].push(item);
    });

    Object.keys(guestGroups).forEach(phone => {
      const items = guestGroups[phone];
      const spent = items.filter(i => i._kind === 'order').reduce((s,o) => s + (o.total||0), 0);
      const matchedUser = phoneToUser[phone];
      if (matchedUser) {
        // رقم هاتف الزائر يطابق عميل مسجّل فعلياً — يُحسب ضمن مشترياته، مو كعميل منفصل
        matchedUser.totalSpent = (matchedUser.totalSpent || 0) + spent;
        return;
      }
      // زائر جديد بالكامل — يُعرض كـ"عميل" مؤقت بالقائمة
      const latest = [...items].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      users.push({
        uid: '',
        email: 'guest:' + phone,
        firstName: latest.clientName || latest.doctor || 'زائر',
        clinic: latest.clinic || '',
        phone: latest.phone || phone,
        isGuest: true,
        totalSpent: spent,
      });
    });

    users.sort((a,b) => (a.firstName||a.name||'').localeCompare(b.firstName||b.name||'', 'ar'));
    _cachedClientsList = users;
    renderClientsList();
  } catch(e) {
    document.getElementById('clientsListBody').innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger)">تعذر تحميل العملاء: ${e.message}</div>`;
  }
}
function closeClientsListModal() {
  document.getElementById('clientsListModal').classList.remove('open');
}

function renderClientsList() {
  const rawSearch = document.getElementById('clientsListSearch').value;
  const term = normalizeArabic(rawSearch);
  const termDigits = rawSearch.replace(/\D/g,'');
  const sortMode = document.getElementById('clientsListSort').value;
  const typeMode = document.getElementById('clientsListType').value;

  let list = _cachedClientsList.filter(u => {
    const isMember = !u.isGuest;
    if (typeMode === 'members' && !isMember) return false;
    if (typeMode === 'guests' && isMember) return false;
    if (!rawSearch.trim()) return true;
    const searchableName = normalizeArabic(u.firstName||u.name||'');
    const searchableClinic = normalizeArabic(u.clinic||'');
    const normalizedPhone = normalizePhone(u.phone || '');
    const nameMatch = searchableName.includes(term) || searchableClinic.includes(term);
    const phoneMatch = termDigits.length > 0 && (normalizedPhone.includes(termDigits) || (u.phone||'').replace(/\D/g,'').includes(termDigits));
    return nameMatch || phoneMatch;
  });

  if (sortMode === 'spent') {
    list = [...list].sort((a,b) => (b.totalSpent||0) - (a.totalSpent||0));
  } else {
    list = [...list].sort((a,b) => (a.firstName||a.name||'').localeCompare(b.firstName||b.name||'', 'ar'));
  }

  const typeLabel = typeMode === 'members' ? 'الأعضاء' : (typeMode === 'guests' ? 'غير الأعضاء' : 'الكل');
  document.getElementById('clientsListCount').textContent = `${typeLabel}: ${list.length}`;
  const body = document.getElementById('clientsListBody');
  if (!list.length) {
    body.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fas fa-user-slash" style="font-size:40px;opacity:0.2;display:block;margin-bottom:12px"></i>لا يوجد عملاء مطابقون</div>`;
    return;
  }

  const showSpentCol = sortMode === 'spent';
  const gridCols = showSpentCol ? '50px 1fr 1fr 130px' : '50px 1fr 1fr';

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:${gridCols};gap:12px;padding:12px 18px;background:#f8fbfd;border-bottom:2px solid #e2eaf0;font-size:12px;font-weight:700;color:var(--text-muted)">
      <div>#</div><div>اسم الطبيب</div><div>اسم العيادة</div>${showSpentCol ? '<div>مجموع المشتريات</div>' : ''}
    </div>` +
    list.map((u, idx) => `
    <div onclick="openClientDetailModal('${u.uid||''}','${u.email}')" style="display:grid;grid-template-columns:${gridCols};gap:12px;padding:14px 18px;border-bottom:1px solid #f0f4f8;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#f8fbfd'" onmouseout="this.style.background=''">
      <div style="font-weight:800;color:var(--text-muted)">${idx+1}</div>
      <div style="font-weight:700;color:var(--primary-dark)">${escHtml(u.firstName||u.name||'—')} ${u.isGuest ? '<span style="font-size:10px;background:#fff7ed;color:#c2410c;border-radius:50px;padding:2px 8px;font-weight:800;margin-right:4px">غير مسجّل</span>' : ''}</div>
      <div style="color:var(--text-muted)">${escHtml(u.clinic||'—')}</div>
      ${showSpentCol ? `<div style="font-weight:800;color:var(--primary)">${(u.totalSpent||0).toLocaleString()} د.أ</div>` : ''}
    </div>`).join('');
}

async function openClientDetailModal(uid, email) {
  document.getElementById('clientDetailModal').classList.add('open');
  document.getElementById('clientDetailBody').innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:4px"></div>جاري التحميل...</div>`;

  const isGuest = email.startsWith('guest:');
  const guestPhone = isGuest ? email.slice(6) : null;

  try {
    let u = _cachedClientsList.find(x => x.email === email);
    if (!u && !isGuest) {
      const allUsers = await fetchAllUsersList();
      u = allUsers.find(x => x.email === email) || { email, firstName:'عميل', clinic:'' };
    }
    if (!uid) uid = u ? u.uid : '';

    const [ordersSnap, allQuotes, balance] = await Promise.all([
      window._fbGetDocs(window._fbOrdersRef()),
      getAllQuotes(),
      isGuest ? Promise.resolve(0) : getClientPoints(uid)
    ]);

    let allOrders, clientQuotes;
    if (isGuest) {
      allOrders = ordersSnap.docs.map(d => d.data()).filter(o => o.clientEmail === 'guest' && normalizePhone(o.phone) === guestPhone);
      clientQuotes = (allQuotes || []).filter(q => q.clientEmail === 'guest' && normalizePhone(q.phone) === guestPhone);
    } else {
      const uPhone = normalizePhone(u.phone);
      allOrders = ordersSnap.docs.map(d => d.data()).filter(o =>
        o.clientEmail === email || (uPhone && o.clientEmail === 'guest' && normalizePhone(o.phone) === uPhone)
      );
      clientQuotes = (allQuotes || []).filter(q =>
        q.clientEmail === email || (uPhone && q.clientEmail === 'guest' && normalizePhone(q.phone) === uPhone)
      );
    }
    const totalSpent = allOrders.reduce((s,o) => s + (o.total||0), 0);

    let regDate = '—';
    if (u && u.createdAt) {
      const d = typeof u.createdAt === 'number' ? new Date(u.createdAt) : new Date(u.createdAt);
      if (!isNaN(d)) regDate = d.toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric' });
    }

    const gpsLink = (u && u.profileLocationLat && u.profileLocationLng)
      ? `<a href="https://www.google.com/maps?q=${u.profileLocationLat},${u.profileLocationLng}" target="_blank" style="color:var(--primary);text-decoration:underline"><i class="fas fa-map-marked-alt"></i> عرض على خرائط جوجل</a>`
      : `<span style="color:var(--text-muted)">غير محدد</span>`;

    const nameDisplay = u ? (u.firstName||u.name||'عميل') : 'زائر';
    const clinicDisplay = u ? (u.clinic||'') : '';
    const phoneDisplay = u ? (u.phone||'') : ((allOrders[0]&&allOrders[0].phone) || (clientQuotes[0]&&clientQuotes[0].phone) || guestPhone);
    const waLink = phoneDisplay ? `https://wa.me/${phoneDisplay.replace(/\D/g,'')}` : null;

    document.getElementById('clientDetailBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;padding:20px;background:linear-gradient(135deg,rgba(10,92,138,0.06),rgba(0,194,168,0.04));border-radius:16px;border:1px solid var(--border);margin-bottom:20px">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:900;flex-shrink:0">
          ${escHtml((nameDisplay||'؟').charAt(0))}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:18px;color:var(--primary-dark)">${escHtml(nameDisplay)} ${isGuest ? '<span style="font-size:11px;background:#fff7ed;color:#c2410c;border-radius:50px;padding:3px 10px;font-weight:800;margin-right:6px">غير مسجّل — عبر الهاتف</span>' : ''}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${isGuest ? escHtml(phoneDisplay||'') : escHtml(email)}</div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;border:1px solid #e2eaf0;padding:20px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px">اسم الطبيب</div>
            <div style="font-weight:700;font-size:14px;color:var(--text)">${escHtml(nameDisplay||'—')}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px">اسم العيادة</div>
            <div style="font-weight:700;font-size:14px;color:var(--text)">${escHtml(clinicDisplay||'—')}</div>
          </div>
          ${!isGuest ? `
          <div style="grid-column:1/-1">
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px"><i class="fas fa-map-marker-alt"></i> موقع العيادة (وصف يدوي)</div>
            <div style="font-size:13px">${u.profileLocationText ? escHtml(u.profileLocationText) : '<span style="color:var(--text-muted)">غير محدد</span>'}</div>
          </div>
          <div style="grid-column:1/-1">
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px"><i class="fas fa-map-marked-alt"></i> موقع GPS</div>
            <div style="font-size:13px">${gpsLink}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px">تاريخ التسجيل</div>
            <div style="font-weight:700;font-size:13px;color:var(--text)">${regDate}</div>
          </div>
          ` : `
          <div style="grid-column:1/-1">
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px"><i class="fas fa-phone-alt"></i> رقم الهاتف</div>
            <div style="font-size:13px;font-weight:700">${escHtml(phoneDisplay||'—')}</div>
          </div>
          `}
          <div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:4px">إجمالي المشتريات</div>
            <div style="font-weight:900;font-size:16px;color:var(--primary)">${totalSpent.toLocaleString()} د.أ</div>
          </div>
        </div>
      </div>

      ${!isGuest ? `
      <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:16px;padding:18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:12px;color:#92400e;font-weight:700;margin-bottom:4px">🏆 رصيد النقاط</div>
          <div style="font-size:24px;font-weight:900;color:#d97706">${balance} نقطة</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="add-points-btn" onclick="openAddPointsModal('${uid}','${email}','${escHtml(nameDisplay)}','${escHtml(clinicDisplay)}',${balance},'add')">
            <i class="fas fa-plus"></i> إضافة
          </button>
          <button class="add-points-btn" style="background:linear-gradient(135deg,#e53e3e,#c53030)" onclick="openAddPointsModal('${uid}','${email}','${escHtml(nameDisplay)}','${escHtml(clinicDisplay)}',${balance},'deduct')">
            <i class="fas fa-minus"></i> خصم
          </button>
        </div>
      </div>
      ` : ''}

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${!isGuest ? `
        <button onclick="openAdminThreadModal('${email}')" style="flex:1;min-width:160px;padding:14px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <i class="fas fa-comment-dots"></i> مراسلة العميل
        </button>
        ` : (waLink ? `
        <a href="${waLink}" target="_blank" style="flex:1;min-width:160px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none">
          <i class="fab fa-whatsapp"></i> تواصل عبر واتساب
        </a>
        ` : '')}
        <button onclick="openClientAllOrdersModal('${email}')" style="flex:1;min-width:160px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#0a5c8a,#1a8bbf);color:#fff;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <i class="fas fa-receipt"></i> طلباته (${allOrders.length + clientQuotes.length})
        </button>
        ${!isGuest ? `
        <button onclick="openAdminSendOrderModal('${email}','${uid||''}','${escHtml(nameDisplay)}','${escHtml(clinicDisplay)}','${escHtml(phoneDisplay||'')}')" style="flex:1;min-width:160px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <i class="fas fa-paper-plane"></i> إرسال طلبية
        </button>
        <button onclick="openClientOrdersReportModal('${email}','${escHtml(nameDisplay)}','${escHtml(clinicDisplay)}','${escHtml(phoneDisplay||'')}')" style="flex:1;min-width:160px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#7e22ce,#a855f7);color:#fff;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <i class="fas fa-file-invoice"></i> تفاصيل طلبات العميل
        </button>
        ` : ''}
      </div>
    `;

    window._cachedClientDetailOrders = allOrders;
    window._cachedClientDetailQuotes = clientQuotes;
    const existingCachedOrders = window._cachedOrders || [];
    allOrders.forEach(o => { if (!existingCachedOrders.find(x => x.id === o.id)) existingCachedOrders.push(o); });
    window._cachedOrders = existingCachedOrders;

    const existingCachedQuotes = window._cachedAdminQuotes || [];
    clientQuotes.forEach(q => { if (!existingCachedQuotes.find(x => x._docId === q._docId)) existingCachedQuotes.push(q); });
    window._cachedAdminQuotes = existingCachedQuotes;
  } catch(e) {
    document.getElementById('clientDetailBody').innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger)">خطأ: ${e.message}</div>`;
  }
}
function closeClientDetailModal() {
  document.getElementById('clientDetailModal').classList.remove('open');
}

function openClientAllOrdersModal(email) {
  const orders = (window._cachedClientDetailOrders || []).map(o => ({...o, _kind:'order'}));
  const quotes = (window._cachedClientDetailQuotes || []).map(q => ({...q, _kind:'quote'}));
  const all = [...orders, ...quotes].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const existing = document.getElementById('clientAllOrdersModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'clientAllOrdersModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '4500';
  modal.innerHTML = `
    <div class="modal" style="max-width:640px;max-height:85vh">
      <div class="modal-header" style="background:linear-gradient(135deg,#0a5c8a,#1a8bbf)">
        <div class="modal-title"><i class="fas fa-receipt"></i> جميع طلبات العميل</div>
        <button class="close-btn" onclick="document.getElementById('clientAllOrdersModal').remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        ${!all.length ? `<div style="text-align:center;padding:32px;color:var(--text-muted)">لا توجد طلبات بعد</div>` :
          all.map(item => {
            const date = new Date(item.createdAt).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' });
            if (item._kind === 'order') {
              return `
              <div onclick="showAdminOrderDetail('${item.id}')" style="padding:14px;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;background:#fafcfe;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background='#fafcfe'">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div>
                    <span style="font-size:11px;background:#e8f3fb;color:var(--primary);padding:2px 10px;border-radius:50px;font-weight:800">طلب</span>
                    <span style="font-weight:800;font-size:13px;margin-right:6px">#${escHtml(item.id)}</span>
                  </div>
                  ${statusBadgeHTML(item.status)}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:6px">📅 ${date} · ${item.items.length} مادة</div>
                <div style="font-weight:900;color:var(--primary);margin-top:6px">${item.payMethod==='points' ? `🏆 ${item.totalPoints||0} نقطة` : `${item.total.toLocaleString()} د.أ`}</div>
                <div style="font-size:11px;color:var(--primary-light);margin-top:6px;font-weight:700"><i class="fas fa-eye"></i> اضغط لعرض التفاصيل الكاملة</div>
              </div>`;
            } else {
              return `
              <div onclick="showQuoteOrderDetail('${item._docId}')" style="padding:14px;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;background:#fafcfe;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background='#fafcfe'">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div>
                    <span style="font-size:11px;background:#fdf4ff;color:#7e22ce;padding:2px 10px;border-radius:50px;font-weight:800">عرض سعر</span>
                    <span style="font-weight:800;font-size:13px;margin-right:6px">#${escHtml(item.id)}</span>
                  </div>
                  ${quoteStatusBadge(item.status)}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:6px">📅 ${date} · ${item.items.length} مادة</div>
                <div style="font-size:11px;color:var(--primary-light);margin-top:6px;font-weight:700"><i class="fas fa-eye"></i> اضغط لعرض التفاصيل الكاملة</div>
              </div>`;
            }
          }).join('')
        }
      </div>
      <div class="modal-footer" style="justify-content:center">
        <button class="btn-back" onclick="document.getElementById('clientAllOrdersModal').remove()">إغلاق</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// =====================
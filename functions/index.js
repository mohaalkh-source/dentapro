const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// حدود صارمة تمنع طلبات غير منطقية أو محاولات استنزاف
const MAX_DISTINCT_ITEMS = 30;
const MAX_QTY_PER_ITEM = 200;
const MAX_TOTAL_RESERVED_QTY = 1000;

// =====================================================
// أدوات مساعدة — نسخة خادمية مطابقة لمنطق العميل في
// js/admin/clients.js و js/products/products.js
// =====================================================

function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '').replace(/^0+/, '');
}

function isOfferExpired(offer) {
  return !!(offer && offer.expiresAt && new Date(offer.expiresAt) <= new Date());
}

async function loadCustomDiscountConfig() {
  const snap = await db.doc('store_data/custom_discount_settings').get();
  return snap.exists ? snap.data() : null;
}

async function computeCustomDiscount(rawTotal, clientEmail, clientPhone) {
  const cfg = await loadCustomDiscountConfig();
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.tiers)) return null;

  const isEligible = (tier) => {
    if (tier.expiresAt && new Date(tier.expiresAt) <= new Date()) return false;
    if (tier.scope === 'all') return true;
    if (!tier.targetIds || !tier.targetIds.length) return false;
    return tier.targetIds.some((id) => {
      if (id.startsWith('guest:')) return normalizePhone(clientPhone) === normalizePhone(id.slice(6));
      return id === clientEmail;
    });
  };

  const eligibleTiers = cfg.tiers.filter(isEligible).sort((a, b) => a.amount - b.amount);
  if (!eligibleTiers.length) return null;

  let matchedTier = null;
  for (const tItem of eligibleTiers) {
    if (rawTotal >= tItem.amount) matchedTier = tItem;
  }
  if (!matchedTier || matchedTier.percent <= 0) return null;

  const discounted = Math.max(0, rawTotal - (rawTotal * matchedTier.percent) / 100);
  return {
    originalTotal: rawTotal,
    total: Math.round(discounted * 100) / 100,
    discountPercent: matchedTier.percent,
  };
}

async function computeGeneralDiscountForCart(cartItems, clientEmail, clientPhone) {
  const cfg = await loadCustomDiscountConfig();
  if (!cfg || !cfg.enabled) return null;

  const isOfferItem = (item) => item.isBundle || (item.basePrice && item.price < item.basePrice);

  if (cfg.applyToOffers !== false) {
    const rawTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    return computeCustomDiscount(rawTotal, clientEmail, clientPhone);
  }

  const offerTotal = cartItems.filter(isOfferItem).reduce((s, i) => s + i.price * i.qty, 0);
  const normalTotal = cartItems.filter((i) => !isOfferItem(i)).reduce((s, i) => s + i.price * i.qty, 0);
  if (normalTotal <= 0) return null;

  const discountOnNormal = await computeCustomDiscount(normalTotal, clientEmail, clientPhone);
  if (!discountOnNormal) return null;

  return {
    originalTotal: offerTotal + normalTotal,
    total: Math.round((discountOnNormal.total + offerTotal) * 100) / 100,
    discountPercent: discountOnNormal.discountPercent,
  };
}

async function loadGlobalDeliverySettings() {
  const snap = await db.doc('delivery_settings/_global').get();
  return snap.exists ? snap.data() : null;
}

async function loadClientDeliverySettings(uid) {
  if (!uid) return null;
  const snap = await db.doc(`delivery_settings/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

function computeGlobalDeliveryFee(globalSettings, subtotal) {
  const tiers = Array.isArray(globalSettings.tiers) ? globalSettings.tiers : [];
  const applicable = tiers.filter((tItem) => subtotal >= tItem.minTotal).sort((a, b) => b.minTotal - a.minTotal)[0];
  if (!applicable) return { fee: null, determined: false };
  if (applicable.type === 'free') return { fee: 0, determined: true };
  return { fee: applicable.value, determined: true };
}

function computeDeliveryFee(deliverySettings, subtotal) {
  if (!deliverySettings || !deliverySettings.enabled) return { fee: 0, determined: true };
  const fee = deliverySettings.fee;
  if (fee === null || fee === undefined) return { fee: null, determined: false };
  return { fee, determined: true };
}

async function resolveDeliveryFee(uid, subtotal) {
  const globalSettings = await loadGlobalDeliverySettings();
  if (globalSettings && globalSettings.discountEnabled) {
    const globalResult = computeGlobalDeliveryFee(globalSettings, subtotal);
    if (globalResult.determined) return globalResult;
  }
  const clientSettings = uid ? await loadClientDeliverySettings(uid) : null;
  return computeDeliveryFee(clientSettings, subtotal);
}

// =====================================================
// createOrder — الدالة الرئيسية
// تستقبل من العميل فقط: معرّفات المنتجات/الباقات + الكميات + بيانات التواصل
// وتحسب كل شيء آخر (سعر، خصم، توصيل، نقاط، مخزون) من الخادم
// =====================================================
exports.createOrder = onCall({ region: 'us-central1' }, async (request) => {
  const auth = request.auth; // قد تكون null لطلب زائر — هذا مسموح به تجارياً هنا
  const data = request.data || {};

  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length) throw new HttpsError('invalid-argument', 'السلة فارغة');
  if (rawItems.length > MAX_DISTINCT_ITEMS) {
    throw new HttpsError('invalid-argument', `عدد العناصر أكبر من الحد المسموح (${MAX_DISTINCT_ITEMS})`);
  }

  const payMethod = data.sourceQuoteId ? 'money' : (data.payMethod === 'points' ? 'points' : 'money');
  const clinic = String(data.clinic || '').trim();
  const doctor = String(data.doctor || '').trim();
  const phone = String(data.phone || '').trim();
  const address = String(data.address || '').trim();
  if (clinic.length > 200 || doctor.length > 120 || phone.length > 30 || address.length > 500) {
    throw new HttpsError('invalid-argument', 'بيانات الطلب تتجاوز الحدود المسموحة');
  }
  const locationLat = typeof data.locationLat === 'number' ? data.locationLat : null;
  const locationLng = typeof data.locationLng === 'number' ? data.locationLng : null;
  const notes = String(data.notes || '').slice(0, 1000);
  const sourceQuoteId = data.sourceQuoteId ? String(data.sourceQuoteId) : null;
  const quotePhone = String(data.quotePhone || '').trim();

  // مفتاح تكرار إلزامي: العميل يولّده مرة واحدة لكل محاولة شراء ويعيد إرساله نفسه عند أي إعادة محاولة تلقائية
  const idempotencyKey = String(data.idempotencyKey || '').trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw new HttpsError('invalid-argument', 'idempotencyKey مطلوب وغير صالح');
  }

  if (!clinic || !doctor || !phone) {
    throw new HttpsError('invalid-argument', 'بيانات العيادة/الطبيب/الهاتف مطلوبة');
  }

  // تحديد هوية العميل: مسجّل عبر auth.uid، أو زائر
  let clientDoc = null;
  let clientUid = null;
  if (auth && auth.uid) {
    clientUid = auth.uid;
    const uSnap = await db.doc(`users/${clientUid}`).get();
    clientDoc = uSnap.exists ? uSnap.data() : null;
  }
  const clientEmail = clientDoc ? (clientDoc.email || 'guest') : 'guest';
  const clientName = clientDoc ? (clientDoc.name || doctor) : doctor;

  // تحقق مبدئي من صيغة العناصر (قبل الدخول بالمعاملة).
  // عند تحويل Quote: عناصر الطلب لا تأتي من العميل إطلاقاً؛ ستُبنى لاحقاً من quote.items.
  const requestedItems = [];
  for (const raw of rawItems) {
    const id = raw.id !== undefined && raw.id !== null ? raw.id : raw.productId;
    const qty = Number(raw.qty) || 0;
    if (id === undefined || id === null || id === '' || qty <= 0 || !Number.isInteger(qty)) {
      throw new HttpsError('invalid-argument', `كمية أو معرف عنصر غير صالح: ${id}`);
    }
    if (qty > MAX_QTY_PER_ITEM) {
      throw new HttpsError('invalid-argument', `الكمية المطلوبة من "${id}" أكبر من الحد المسموح (${MAX_QTY_PER_ITEM})`);
    }
    // isBundle/bundleItems القادمة من العميل تُستخدم فقط لتحديد "هل هذا معرّف باقة" —
    // محتوى الباقة الفعلي (المنتجات والكميات والسعر) يُقرأ حصراً من store_data/offers داخل المعاملة
    requestedItems.push({ id, qty, isBundle: !!raw.isBundle });
  }

  const orderNum = sourceQuoteId
    ? `DP-${sourceQuoteId.replace('QT-', '')}`
    : `DP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const idempotencyRef = db.doc(`order_idempotency/${idempotencyKey}`);
  const orderRef = db.doc(`orders/${orderNum}`);

  const result = await db.runTransaction(async (tx) => {
    // 0) تحقق من التكرار أولاً — لو نفس المفتاح استُخدم قبل، نرجّع نتيجة الطلب الأصلي بدل إنشاء طلب ثانٍ
    const idemSnap = await tx.get(idempotencyRef);
    if (idemSnap.exists) {
      const existing = idemSnap.data();
      return { orderNum: existing.orderNum, total: existing.total, totalPoints: existing.totalPoints, duplicate: true };
    }

    // 1) لو الطلب مبني على عرض سعر مقبول، تحقق من صحة العرض وملكيته وحالته أولاً
    let quoteSnap = null;
    if (sourceQuoteId) {
      quoteSnap = await tx.get(db.doc(`quotes/${sourceQuoteId}`));
      if (!quoteSnap.exists) throw new HttpsError('failed-precondition', 'عرض السعر غير موجود');
      const q = quoteSnap.data();
      if (q.status !== 'accepted') {
        throw new HttpsError('failed-precondition', 'عرض السعر ليس بحالة مقبولة');
      }
      if (q.orderCreated) {
        throw new HttpsError('failed-precondition', 'تم إنشاء طلب من هذا العرض مسبقاً');
      }
      if (clientUid) {
        if (q.clientUid !== clientUid) throw new HttpsError('permission-denied', 'هذا العرض لا يخص هذا الحساب');
      } else {
        if (!quotePhone || normalizePhone(q.phone) !== normalizePhone(quotePhone)) {
          throw new HttpsError('permission-denied', 'رقم الهاتف لا يطابق صاحب عرض السعر');
        }
      }
    }

    // إذا كان التحويل من Quote، نعيد بناء العناصر من العرض المقبول فقط.
    // لا نثق إطلاقاً بقائمة items المرسلة من المتصفح.
    let quoteOrderItems = null;
    if (sourceQuoteId) {
      const q = quoteSnap.data();
      const qItems = Array.isArray(q.items) ? q.items : [];
      if (!qItems.length || qItems.length > MAX_DISTINCT_ITEMS) {
        throw new HttpsError('failed-precondition', 'عرض السعر لا يحتوي على عناصر صالحة');
      }
      quoteOrderItems = qItems.map((it, idx) => {
        const qty = Number(it.qty);
        const unitPrice = Number(it.unitPrice);
        if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY_PER_ITEM) {
          throw new HttpsError('failed-precondition', `كمية غير صالحة في عرض السعر عند العنصر ${idx + 1}`);
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new HttpsError('failed-precondition', `سعر غير صالح في عرض السعر عند العنصر ${idx + 1}`);
        }
        return {
          id: it.productId || null,
          ar: String(it.ar || '').slice(0, 200),
          en: String(it.en || '').slice(0, 200),
          icon: String(it.icon || '📦').slice(0, 20),
          qty,
          price: unitPrice,
          basePrice: null,
          points: 0,
          isCustom: !!it.isCustom,
        };
      });
      if (quoteOrderItems.some(it => !it.id && !it.isCustom)) {
        throw new HttpsError('failed-precondition', 'يوجد عنصر غير صالح في عرض السعر');
      }
    }

    const effectiveRequestedItems = sourceQuoteId
      ? quoteOrderItems.filter((it) => it.id).map((it) => ({ id: it.id, qty: it.qty, isBundle: false }))
      : requestedItems;

    // 2) نجيب تعريفات الباقات الحقيقية (store_data/offers) لأي عنصر isBundle، ونتجاهل أي بيانات باقة من العميل تماماً
    const bundleRequests = effectiveRequestedItems.filter((i) => i.isBundle);
    let offersDoc = null;
    if (bundleRequests.length) {
      const offersSnap = await tx.get(db.doc('store_data/offers'));
      offersDoc = offersSnap.exists ? offersSnap.data() : null;
    }

    const resolvedBundles = {};
    for (const bi of bundleRequests) {
      const list = (offersDoc && Array.isArray(offersDoc.list)) ? offersDoc.list
                 : (offersDoc && Array.isArray(offersDoc.offers)) ? offersDoc.offers
                 : Array.isArray(offersDoc) ? offersDoc : [];
      const def = list.find((o) => String(o.id) === String(bi.id) && o.type === 'bundle');
      if (!def) throw new HttpsError('failed-precondition', `باقة غير موجودة: ${bi.id}`);
      if (def.active === false) throw new HttpsError('failed-precondition', `الباقة "${def.name_ar || bi.id}" غير مفعّلة`);
      if (isOfferExpired(def)) throw new HttpsError('failed-precondition', `الباقة "${def.name_ar || bi.id}" منتهية`);
      const items = Array.isArray(def.items) ? def.items : [];
      if (!items.length) throw new HttpsError('failed-precondition', `الباقة "${def.name_ar || bi.id}" بلا محتوى معرّف`);
      resolvedBundles[bi.id] = {
        name_ar: def.name_ar || '', name_en: def.name_en || '', icon: def.icon || '🎁',
        price: Number(def.bundlePrice) || 0, points: Number(def.points) || 0,
        items: items.map((it) => ({ productId: it.productId, qty: Number(it.qty) || 1 })),
      };
    }

    // 3) نبني خريطة خصم المخزون الفعلي (بعد توسيع الباقات لمنتجاتها الحقيقية)
    const merged = {};
    let totalReservedQty = 0;
    for (const ri of effectiveRequestedItems) {
      if (ri.isBundle) {
        const b = resolvedBundles[ri.id];
        for (const bi of b.items) {
          const addQty = bi.qty * ri.qty;
          merged[bi.productId] = (merged[bi.productId] || 0) + addQty;
          totalReservedQty += addQty;
        }
      } else {
        merged[ri.id] = (merged[ri.id] || 0) + ri.qty;
        totalReservedQty += ri.qty;
      }
    }
    if (totalReservedQty > MAX_TOTAL_RESERVED_QTY) {
      throw new HttpsError('invalid-argument', `إجمالي الكمية المطلوبة أكبر من الحد المسموح (${MAX_TOTAL_RESERVED_QTY})`);
    }

    const plainProductIds = effectiveRequestedItems.filter((i) => !i.isBundle).map((i) => i.id);
    const allProductIds = Array.from(new Set([...Object.keys(merged), ...plainProductIds]));

    // 4) نقرأ كل مستندات المنتجات المطلوبة فعلياً (من مصدر الحقيقة الوحيد: products)
    const productRefs = allProductIds.map((id) => db.doc(`products/${id}`));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    const productById = {};
    productSnaps.forEach((snap, idx) => {
      if (!snap.exists) throw new HttpsError('failed-precondition', `منتج غير موجود: ${allProductIds[idx]}`);
      productById[allProductIds[idx]] = snap.data();
    });

    // 5) نتحقق من كفاية المخزون لكل منتج فعلي (بعد توسيع الباقات)
    for (const [productId, qty] of Object.entries(merged)) {
      const p = productById[productId];
      if (p.stock === undefined || p.stock === null) continue;
      if (p.stock - qty < 0) {
        throw new HttpsError('resource-exhausted', `الكمية المتوفرة من "${p.ar || productId}" غير كافية (متبقي ${p.stock})`);
      }
    }

    // 6) نعيد بناء عناصر الطلب بالسعر الحقيقي (من products أو من تعريف الباقة الحقيقي) — نتجاهل أي سعر أرسله العميل
    const orderItems = sourceQuoteId ? quoteOrderItems : requestedItems.map((ri) => {
      if (ri.isBundle) {
        const b = resolvedBundles[ri.id];
        return {
          id: ri.id, ar: b.name_ar, en: b.name_en, icon: b.icon,
          price: b.price, basePrice: null, qty: ri.qty, points: b.points,
          isBundle: true, bundleItems: b.items,
        };
      }
      const p = productById[ri.id];
      return {
        id: ri.id, ar: p.ar || '', en: p.en || '', icon: p.icon || '',
        price: p.price, basePrice: p.basePrice || null, qty: ri.qty, points: p.points || 0,
      };
    });

    // 7) الدفع بالنقاط: المبلغ النقدي المطلوب هو فقط قيمة المواد التي لا تدعم الدفع بالنقاط
    const cashOnlyItems = payMethod === 'points' ? orderItems.filter((i) => !i.points) : orderItems;
    const rawTotal = cashOnlyItems.reduce((s, i) => s + i.price * i.qty, 0);
    const totalPointsNeeded = orderItems.reduce((s, i) => s + (i.points || 0) * i.qty, 0);

    let pointsDeducted = false;
    if (payMethod === 'points') {
      if (!clientUid) throw new HttpsError('failed-precondition', 'الدفع بالنقاط متاح فقط للعملاء المسجلين');
      const ptsRef = db.doc(`points/${clientUid}`);
      const ptsSnap = await tx.get(ptsRef);
      const balance = ptsSnap.exists ? (ptsSnap.data().balance || 0) : 0;
      if (balance < totalPointsNeeded) {
        throw new HttpsError('failed-precondition', `رصيد النقاط (${balance}) لا يكفي — المطلوب ${totalPointsNeeded}`);
      }
      tx.update(ptsRef, {
        balance: balance - totalPointsNeeded,
        logs: FieldValue.arrayUnion({
          type: 'order_deduct', orderId: orderNum, amount: -totalPointsNeeded,
          at: new Date().toISOString(),
        }),
      });
      pointsDeducted = true;
    }

    // 8) Quote مقبول هو سعر تفاوضي مثبت من الإدارة؛ لا نعيد تطبيق خصم عام عليه.
    const discountResult = sourceQuoteId ? null : await computeGeneralDiscountForCart(cashOnlyItems, clientEmail, phone);
    const subtotalForDelivery = sourceQuoteId
      ? Math.round(rawTotal * 100) / 100
      : (discountResult ? discountResult.total : Math.round(rawTotal * 100) / 100);

    // 9) عند Quote: نستخدم أجور التوصيل المثبتة في العرض إن كانت محددة، وإلا نحسبها خادمياً.
    const quoteData = sourceQuoteId ? quoteSnap.data() : null;
    const deliveryResult = sourceQuoteId && quoteData.deliveryDetermined
      ? { determined: true, fee: Math.max(0, Number(quoteData.deliveryFee) || 0) }
      : await resolveDeliveryFee(clientUid, subtotalForDelivery);
    const finalTotal = deliveryResult.determined ? subtotalForDelivery + (deliveryResult.fee || 0) : subtotalForDelivery;

    // 10) نخصم المخزون فعلياً (نفس المعاملة — ذرّي بالكامل مع إنشاء الطلب)
    for (const [productId, qty] of Object.entries(merged)) {
      const p = productById[productId];
      if (p.stock === undefined || p.stock === null) continue;
      tx.update(db.doc(`products/${productId}`), { stock: p.stock - qty });
    }

    // 11) لو الطلب مرتبط بعرض سعر، نعلّمه كمُحوَّل لطلب حتى لا يُستخدم مرة ثانية
    if (sourceQuoteId) {
      tx.update(db.doc(`quotes/${sourceQuoteId}`), { orderCreated: true, orderId: orderNum });
    }

    const order = {
      id: orderNum,
      clientName, clientEmail, clientUid,
      clinic, doctor, phone, address, locationLat, locationLng, notes,
      sourceQuoteId,
      items: orderItems,
      total: finalTotal,
      totalPoints: payMethod === 'points' ? totalPointsNeeded : 0,
      payMethod, pointsDeducted,
      deliveryFee: deliveryResult.determined ? (deliveryResult.fee || 0) : null,
      deliveryDetermined: deliveryResult.determined,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      stockReserved: true,
      ...(discountResult ? { originalTotal: discountResult.originalTotal, discountPercent: discountResult.discountPercent } : {}),
    };

    tx.set(orderRef, order);

    tx.set(idempotencyRef, {
      orderNum, total: finalTotal, totalPoints: order.totalPoints,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { orderNum, total: finalTotal, totalPoints: order.totalPoints, duplicate: false };
  });

  return result;
});
// تتبع عام آمن للطلبات/عروض الأسعار: لا يعيد المستند الخام ولا يسمح
// بقراءة Firestore قبل التحقق من رقم الهاتف على الخادم.
exports.trackPublicOrder = onCall({ region: 'us-central1' }, async (request) => {
  const data = request.data || {};
  const id = String(data.id || '').trim().toUpperCase();
  const phone = String(data.phone || '').trim();
  if (!id || !phone || phone.length < 6 || phone.length > 30) {
    throw new HttpsError('invalid-argument', 'رقم الطلب ورقم الهاتف مطلوبان');
  }
  const isQuote = id.startsWith('QT-');
  const isOrder = id.startsWith('DP-');
  if (!isQuote && !isOrder) throw new HttpsError('invalid-argument', 'رقم الطلب غير صالح');

  const snap = await db.doc(`${isQuote ? 'quotes' : 'orders'}/${id}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'لم يتم العثور على الطلب');
  const raw = snap.data();
  if (normalizePhone(raw.phone) !== normalizePhone(phone)) {
    throw new HttpsError('permission-denied', 'بيانات التحقق غير صحيحة');
  }

  const items = Array.isArray(raw.items) ? raw.items.slice(0, 50).map((item) => ({
    ar: String(item.ar || '').slice(0, 200),
    en: String(item.en || '').slice(0, 200),
    qty: Number.isInteger(item.qty) ? item.qty : 0,
    icon: String(item.icon || '📦').slice(0, 20),
  })) : [];

  return {
    id,
    type: isQuote ? 'quote' : 'order',
    status: String(raw.status || 'pending'),
    orderStatus: raw.orderStatus ? String(raw.orderStatus) : null,
    createdAt: raw.createdAt && typeof raw.createdAt.toDate === 'function'
      ? raw.createdAt.toDate().toISOString() : (raw.createdAt || null),
    items,
    total: isOrder ? Number(raw.total || 0) : null,
    totalPoints: isOrder ? Number(raw.totalPoints || 0) : null,
    payMethod: isOrder ? String(raw.payMethod || 'money') : null,
    quoteTotal: isQuote ? items.reduce((sum, item, idx) => {
      const original = Array.isArray(raw.items) ? raw.items[idx] : {};
      return sum + Number(original.unitPrice || 0) * item.qty;
    }, 0) : null,
  };
});

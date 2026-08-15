import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { initializeFirestore, persistentLocalCache, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, onSnapshot, limit, startAfter, writeBatch }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
           signOut, onAuthStateChanged, updateProfile,
           deleteUser, EmailAuthProvider, reauthenticateWithCredential }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { getMessaging, getToken, onMessage, isSupported }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDVVEzXPlfJAD7NSV0tGHzzsx8LiyK2i4w",
    authDomain: "dentapro-db2f6.firebaseapp.com",
    projectId: "dentapro-db2f6",
    storageBucket: "dentapro-db2f6.firebasestorage.app",
    messagingSenderId: "834989089132",
    appId: "1:834989089132:web:91172f8e00c616fa291349",
    measurementId: "G-HTL7R7C59S"
  };

  const app  = initializeApp(firebaseConfig);
  const db   = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
  const auth = getAuth(app);

  window._auth            = auth;
  window._fbCreateUser    = createUserWithEmailAndPassword;
  window._fbSignIn        = signInWithEmailAndPassword;
  window._fbSignOut       = signOut;
  window._fbAuthState     = onAuthStateChanged;
  window._fbUpdateProfile = updateProfile;
  window._fbDeleteUser        = deleteUser;
  window._fbEmailAuthProvider = EmailAuthProvider;
  window._fbReauthenticate    = reauthenticateWithCredential;

  // إعداد Firebase Cloud Messaging (إشعارات فعلية حتى عند إغلاق المتصفح)
  const FCM_VAPID_KEY = "BEOJcmas6Rpa_BT3UXB4d3Sjx9dNuAa4-N6s7Fm2MsjCoHudMD46W3wWEzZmUSapX4DSuN7Tt6QLtAxBBW91CPw";
  window._fcmGetTokenFn = null;
  isSupported().then((supported) => {
    if (!supported) { console.warn('⚠️ هذا المتصفح لا يدعم Firebase Messaging'); return; }
    const messaging = getMessaging(app);
    window._fcmMessaging = messaging;
    window._fcmGetTokenFn = async (swRegistration) => {
      try {
        return await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swRegistration });
      } catch(e) {
        console.warn('⚠️ فشل جلب FCM token:', e.message);
        return null;
      }
    };
    onMessage(messaging, (payload) => {
      // إشعار يصل والموقع مفتوح فعلياً بالمقدمة — نعرضه كـ toast بدل إشعار نظام مكرر
      if (typeof window._onForegroundFCMMessage === 'function') {
        window._onForegroundFCMMessage(payload);
      }
    });
  }).catch(e => console.warn('⚠️ isSupported check failed:', e.message));

  window._db           = db;
  window._fbGetDoc     = getDoc;
  window._fbSetDoc     = setDoc;
  window._fbDeleteDoc  = deleteDoc;
  window._fbDoc2       = (col, id) => doc(db, col, id);
  window._fbCollection = collection;
  window._fbOrdersRef  = () => collection(db, 'orders');
  window._fbAddDoc     = addDoc;
  window._fbGetDocs    = getDocs;
  window._fbDoc        = (id) => doc(db, 'orders', id);
  window._fbUpdateDoc  = updateDoc;
  window._fbQuery      = query;
  window._fbOrderBy    = orderBy;
  window._fbWhere      = where;
  window._fbOnSnapshot = onSnapshot;
  window._fbLimit      = limit;
  window._fbStartAfter = startAfter;
  window._fbWriteBatch = () => writeBatch(db);
  window._fbIsOnline   = () => navigator.onLine;

  // التخزين المحلي مُفعَّل تلقائياً عبر persistentLocalCache() في إعداد Firestore

  let _ordersUnsub = null;
  let _messagesUnsub = null;
  let _notifsUnsub = [];

  window.addEventListener('load', () => {
    onAuthStateChanged(auth, async (fbUser) => {
      if (_ordersUnsub)   { _ordersUnsub();   _ordersUnsub = null; }
      if (_messagesUnsub) { _messagesUnsub(); _messagesUnsub = null; }
      if (_notifsUnsub.length) { _notifsUnsub.forEach(u => u()); _notifsUnsub = []; }
      if (!fbUser) { window._currentRole = null; return; }
      try {
        // جلب الدور الحقيقي من Firestore (users/{uid}.role) — البريد الإداري يبقى كحساب احتياطي فقط
        let role = 'customer';
        if (fbUser.email === 'moh.a.alkh@gmail.com') {
          role = 'admin';
        } else {
          try {
            const uSnap = await getDoc(doc(db, 'users', fbUser.uid));
            if (uSnap.exists() && uSnap.data().role) role = uSnap.data().role;
          } catch(roleErr) {
            console.warn('⚠️ تعذّر جلب صلاحية المستخدم من Firestore:', roleErr.message);
          }
        }
        window._currentRole = role;
        const isStaffUser = (role === 'admin' || role === 'manager');
        const q = isStaffUser
          ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
          : query(collection(db, 'orders'), where('clientEmail', '==', fbUser.email));
        _ordersUnsub = onSnapshot(q, (snap) => {
          const adminOpen  = document.getElementById('adminPanel')?.classList.contains('open');
          const ordersOpen = document.getElementById('ordersPage')?.classList.contains('active');
          if (adminOpen  && typeof renderAdminOrders  === 'function') renderAdminOrders();
          if (ordersOpen && typeof renderClientOrders === 'function') renderClientOrders();
          const pending = snap.docs.filter(d => !['delivered','cancelled'].includes(d.data().status)).length;
          const badge = document.getElementById('adminOrdersBadge');
          if (badge) badge.textContent = pending > 0 ? pending : '';
        }, (err) => console.warn('⚠️ مراقبة الطلبات:', err.message));

        // مراقبة الرسائل لحظياً (لتحديث شارة الإشعار فوراً)
        const msgsQ = isStaffUser
          ? collection(db, 'messages')
          : query(collection(db, 'messages'), where('clientEmail', 'in', [fbUser.email, 'broadcast']));
        _messagesUnsub = onSnapshot(msgsQ, () => {
          if (typeof window._onMessagesUpdate === 'function') window._onMessagesUpdate();
        }, (err) => console.warn('⚠️ مراقبة الرسائل:', err.message));

        // مراقبة جرس الإشعارات لحظياً (طلب جديد / تغيير حالة / منتج جديد)
        _notifsUnsub.forEach(u => u());
        _notifsUnsub = [];
        if (isStaffUser) {
          const nq = query(collection(db, 'notifications'), where('scope', '==', 'admin'));
          _notifsUnsub.push(onSnapshot(nq, () => {
            if (typeof window._onNotificationsUpdate === 'function') window._onNotificationsUpdate();
          }, (err) => console.warn('⚠️ مراقبة الإشعارات:', err.message)));
        } else {
          const nq1 = query(collection(db, 'notifications'), where('targetEmail', '==', fbUser.email));
          const nq2 = query(collection(db, 'notifications'), where('scope', '==', 'broadcast'));
          _notifsUnsub.push(onSnapshot(nq1, () => {
            if (typeof window._onNotificationsUpdate === 'function') window._onNotificationsUpdate();
          }, (err) => console.warn('⚠️ مراقبة الإشعارات:', err.message)));
          _notifsUnsub.push(onSnapshot(nq2, () => {
            if (typeof window._onNotificationsUpdate === 'function') window._onNotificationsUpdate();
          }, (err) => console.warn('⚠️ مراقبة الإشعارات:', err.message)));
        }
      } catch(e) { console.warn('Listener:', e); }
    });
  });

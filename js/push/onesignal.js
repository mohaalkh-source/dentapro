// إشعارات الدفع عبر OneSignal — تعمل للزوار والمسجلين حتى بعد إغلاق الموقع.
// ضع App ID الخاص بتطبيقك من لوحة OneSignal (Settings ← Keys & IDs). اتركه فارغاً لتعطيل الميزة.
(function () {
  var ONESIGNAL_APP_ID = '';
  if (!ONESIGNAL_APP_ID) { console.warn('[push] ONESIGNAL_APP_ID فارغ — الإشعارات معطلة'); return; }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: new URL('OneSignalSDKWorker.js', document.baseURI).pathname,
        serviceWorkerParam: { scope: new URL('./', document.baseURI).pathname },
        notifyButton: { enable: false },
      });
      console.log('[push] OneSignal init OK | supported:', OneSignal.Notifications.isPushSupported(), '| permission:', OneSignal.Notifications.permission);
    } catch (e) { console.error('[push] OneSignal init FAILED:', e && (e.message || e)); return; }

    // ربط الجهاز بحساب العميل (للإشعارات الموجهة له) وفصله عند الخروج
    window.storePushLogin = function (email) { try { OneSignal.login(String(email).toLowerCase()); } catch (e) {} };
    window.storePushLogout = function () { try { OneSignal.logout(); } catch (e) {} };

    // عند النقر على إشعار نفتح الرابط الداخلي (مثل adminorders:open) إن وُجد
    OneSignal.Notifications.addEventListener('click', function (event) {
      var link = event && event.notification && event.notification.additionalData && event.notification.additionalData.link;
      if (link && typeof onNotifClick === 'function') onNotifClick('', link);
    });

    // زر "فعّل الإشعارات" — المتصفحات تشترط أن يكون طلب الإذن بنقرة من المستخدم
    if (!OneSignal.Notifications.isPushSupported() || OneSignal.Notifications.permission) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🔔 فعّل الإشعارات';
    btn.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9998;padding:10px 14px;border:0;border-radius:999px;' +
      'background:#0b4f75;color:#fff;font:600 14px inherit;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer';
    btn.onclick = async function () {
      try {
        await OneSignal.Notifications.requestPermission();
        console.log('[push] permission:', OneSignal.Notifications.permission, '| subscription id:', OneSignal.User.PushSubscription.id);
        if (Notification.permission === 'denied') alert('الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (أيقونة القفل بجانب الرابط).');
      } catch (e) { console.error('[push] requestPermission failed:', e); }
    };
    document.body.appendChild(btn);
    OneSignal.Notifications.addEventListener('permissionChange', function () { btn.remove(); });
  });
})();

// إشعارات الدفع عبر OneSignal — تعمل للزوار والمسجلين حتى بعد إغلاق الموقع.
(function () {
  var ONESIGNAL_APP_ID = '6a34da22-3ce1-4c0a-ac2c-86625674a5da';
  if (!ONESIGNAL_APP_ID) { console.warn('[push] ONESIGNAL_APP_ID فارغ — الإشعارات معطلة'); return; }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: new URL('OneSignalSDKWorker.js', document.baseURI).pathname,
        serviceWorkerParam: { scope: new URL('./', document.baseURI).pathname },
        notifyButton: { enable: false },
        promptOptions: {
          slidedown: {
            prompts: [{
              type: 'push',
              autoPrompt: true,
              text: {
                actionMessage: 'هل ترغب في استقبال إشعارات الطلبات والعروض من DentaPro؟',
                acceptButton: 'تفعيل',
                cancelButton: 'لا شكراً'
              }
            }]
          }
        }
      });
      console.log('[push] init OK | supported:', OneSignal.Notifications.isPushSupported(),
        '| permission:', OneSignal.Notifications.permission,
        '| optedIn:', OneSignal.User.PushSubscription.optedIn);
    } catch (e) { console.error('[push] init FAILED:', e && (e.message || e)); return; }

    // ربط الجهاز بحساب العميل وفصله عند الخروج
    window.storePushLogin = function (email) { try { OneSignal.login(String(email).toLowerCase()); } catch (e) {} };
    window.storePushLogout = function () { try { OneSignal.logout(); } catch (e) {} };

    // عند النقر على إشعار نفتح الرابط الداخلي إن وُجد
    OneSignal.Notifications.addEventListener('click', function (event) {
      var link = event && event.notification && event.notification.additionalData && event.notification.additionalData.link;
      if (link && typeof onNotifClick === 'function') onNotifClick('', link);
    });

    // زر التفعيل: يظهر ما دام الجهاز غير مشترك فعلياً (حتى لو الإذن ممنوح سابقاً)
    if (!OneSignal.Notifications.isPushSupported()) return;
    if (OneSignal.User.PushSubscription.optedIn) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🔔 فعّل الإشعارات';
    btn.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9998;padding:10px 14px;border:0;border-radius:999px;' +
      'background:#0b4f75;color:#fff;font:600 14px inherit;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer';
    btn.onclick = async function () {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          alert('الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (أيقونة القفل بجانب الرابط) ثم أعد المحاولة.');
          return;
        }
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.Notifications.permission) await OneSignal.User.PushSubscription.optIn();
        console.log('[push] permission:', OneSignal.Notifications.permission,
          '| optedIn:', OneSignal.User.PushSubscription.optedIn,
          '| subscription id:', OneSignal.User.PushSubscription.id);
        if (OneSignal.User.PushSubscription.optedIn) { alert('تم تفعيل الإشعارات بنجاح'); btn.remove(); }
      } catch (e) { console.error('[push] enable failed:', e); }
    };
    document.body.appendChild(btn);

    // إخفاء الزر عند اكتمال الاشتراك بأي طريقة (مثل نافذة Slidedown)
    OneSignal.User.PushSubscription.addEventListener('change', function (ev) {
      if (ev && ev.current && ev.current.optedIn) btn.remove();
    });
  });
})();

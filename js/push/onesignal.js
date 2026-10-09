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
  });
})();

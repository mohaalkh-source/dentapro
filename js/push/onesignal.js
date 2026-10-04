// ===== وضع التشخيص على الهاتف: افتح الموقع بإضافة ?pushdebug=1 للرابط =====
(function () {
  if (location.search.indexOf('pushdebug=1') === -1) return;
  var box;
  function show(msg) {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:45vh;overflow:auto;z-index:2147483647;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.4 monospace;padding:6px;direction:ltr;white-space:pre-wrap;word-break:break-all';
      box.onclick = function () { box.style.display = 'none'; };
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent += msg + '\n';
  }
  var L = console.log, E = console.error;
  console.log = function () { var m = [].slice.call(arguments).join(' '); if (m.indexOf('[push]') > -1) show(m); L.apply(console, arguments); };
  console.error = function () { show('ERR ' + [].slice.call(arguments).join(' ')); E.apply(console, arguments); };
  window.addEventListener('error', function (e) { show('JS ERROR: ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) { show('PROMISE: ' + (e.reason && e.reason.message || e.reason)); });
  document.addEventListener('securitypolicyviolation', function (e) { show('CSP BLOCKED: ' + e.blockedURI + ' (' + e.violatedDirective + ')'); });
  window.addEventListener('load', function () {
    show('[push] origin: ' + location.origin);
    show('[push] Notification.permission: ' + (window.Notification ? Notification.permission : 'unsupported'));
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (r) {
      show('[push] service workers: ' + (r.map(function (x) { return x.scope + ' -> ' + (x.active ? x.active.scriptURL : 'no-active'); }).join(' | ') || 'none'));
    });
    fetch('OneSignalSDKWorker.js').then(function (r) { show('[push] OneSignalSDKWorker.js status: ' + r.status); });
  });
})();
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

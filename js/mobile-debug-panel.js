/* Mobile Debug Panel — نسخة تشخيصية للهاتف
 * أضف قبل </body>:
 * <script src="./js/mobile-debug-panel.js"></script>
 */
(function () {
  'use strict';
  if (window.__mobileDebugPanelLoaded) return;
  window.__mobileDebugPanelLoaded = true;

  var STORAGE_KEY = '__mobile_debug_logs_v2';
  var LAST_ACTION_KEY = '__mobile_debug_last_action_v2';
  var logs = [];
  var maxLogs = 300;
  var panel, content, counter;

  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) logs = saved.slice(-maxLogs);
  } catch (e) {}

  function stringify(value) {
    if (value instanceof Error) return value.stack || value.message || String(value);
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value, null, 2); }
      catch (e) { return '[Object غير قابل للعرض]'; }
    }
    return String(value);
  }

  function saveLogs() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-maxLogs))); }
    catch (e) {}
  }

  function addLog(type, args) {
    logs.push({
      type: type,
      time: new Date().toLocaleTimeString(),
      text: Array.prototype.slice.call(args).map(stringify).join(' ')
    });
    if (logs.length > maxLogs) logs.shift();
    saveLogs();
    render();
  }

  function saveLastAction(label, event) {
    var target = event && event.target && event.target.closest
      ? event.target.closest('button,a,[onclick],[data-order-id]') : null;
    var record = {
      time: new Date().toLocaleTimeString(),
      label: label,
      tag: target ? target.tagName : '',
      id: target ? (target.id || '') : '',
      text: target ? (target.innerText || target.getAttribute('aria-label') || '').trim().slice(0, 160) : '',
      onclick: target ? (target.getAttribute('onclick') || '').slice(0, 300) : '',
      page: document.querySelector('.page-section.active')?.id || '',
      href: location.href
    };
    try { localStorage.setItem(LAST_ACTION_KEY, JSON.stringify(record)); } catch (e) {}
  }

  function render() {
    if (!content) return;
    content.textContent = '';
    logs.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'mobile-debug-row mobile-debug-' + item.type;
      var head = document.createElement('div');
      head.className = 'mobile-debug-head';
      head.textContent = '[' + item.time + '] ' + item.type.toUpperCase();
      var body = document.createElement('pre');
      body.className = 'mobile-debug-text';
      body.textContent = item.text;
      row.appendChild(head);
      row.appendChild(body);
      content.appendChild(row);
    });
    if (counter) counter.textContent = String(logs.length);
    content.scrollTop = content.scrollHeight;
  }

  function copyLogs() {
    var text = logs.map(function (item) {
      return '[' + item.time + '] ' + item.type.toUpperCase() + '\n' + item.text;
    }).join('\n\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        alert('تم نسخ السجل');
      }).catch(function () { window.prompt('انسخ السجل:', text); });
    } else window.prompt('انسخ السجل:', text);
  }

  function createPanel() {
    var style = document.createElement('style');
    style.textContent = '\
      #mobileDebugButton{position:fixed;bottom:14px;left:14px;z-index:2147483646;background:#b91c1c;color:#fff;border:0;border-radius:999px;padding:9px 13px;font:bold 12px Arial;box-shadow:0 3px 12px #0005}\
      #mobileDebugPanel{display:none;position:fixed;inset:0;z-index:2147483647;background:#111;color:#eee;font:12px Arial;direction:ltr}\
      #mobileDebugPanel.open{display:flex;flex-direction:column}\
      .mobile-debug-toolbar{display:flex;gap:7px;align-items:center;padding:10px;background:#222;position:sticky;top:0}\
      .mobile-debug-toolbar button{border:1px solid #777;background:#333;color:#fff;border-radius:6px;padding:7px 10px;font-weight:bold}\
      .mobile-debug-title{flex:1;font-weight:bold}\
      #mobileDebugContent{overflow:auto;padding:8px}\
      .mobile-debug-row{border-bottom:1px solid #333;padding:8px 4px;white-space:pre-wrap}\
      .mobile-debug-head{font-weight:bold;margin-bottom:4px;color:#aaa}\
      .mobile-debug-text{margin:0;white-space:pre-wrap;word-break:break-word;font:12px monospace}\
      .mobile-debug-error .mobile-debug-head{color:#ff6b6b}\
      .mobile-debug-warn .mobile-debug-head{color:#ffd166}\
      .mobile-debug-info .mobile-debug-head{color:#6cb6ff}\
      .mobile-debug-log .mobile-debug-head{color:#8be28b}\
    ';
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.id = 'mobileDebugButton';
    button.type = 'button';
    button.textContent = 'DEBUG ';
    counter = document.createElement('span');
    counter.textContent = '0';
    button.appendChild(counter);

    panel = document.createElement('div');
    panel.id = 'mobileDebugPanel';
    var toolbar = document.createElement('div');
    toolbar.className = 'mobile-debug-toolbar';
    var title = document.createElement('span');
    title.className = 'mobile-debug-title';
    title.textContent = 'Mobile Debug Console';

    var copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'نسخ'; copy.onclick = copyLogs;
    var clear = document.createElement('button');
    clear.type = 'button'; clear.textContent = 'مسح';
    clear.onclick = function () {
      logs = [];
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LAST_ACTION_KEY); } catch (e) {}
      render();
    };
    var close = document.createElement('button');
    close.type = 'button'; close.textContent = 'إغلاق';
    close.onclick = function () { panel.classList.remove('open'); };

    toolbar.appendChild(title); toolbar.appendChild(copy); toolbar.appendChild(clear); toolbar.appendChild(close);
    content = document.createElement('div');
    content.id = 'mobileDebugContent';
    panel.appendChild(toolbar); panel.appendChild(content);
    document.body.appendChild(button); document.body.appendChild(panel);
    button.onclick = function () { panel.classList.add('open'); render(); };

    var lastAction = null;
    try { lastAction = JSON.parse(localStorage.getItem(LAST_ACTION_KEY) || 'null'); } catch (e) {}
    if (lastAction) addLog('warn', ['آخر نقرة محفوظة قبل إعادة فتح الصفحة:', lastAction]);
  }

  var original = {};
  ['log', 'info', 'warn', 'error'].forEach(function (method) {
    original[method] = console[method];
    console[method] = function () {
      addLog(method === 'error' ? 'error' : method === 'warn' ? 'warn' : method === 'info' ? 'info' : 'log', arguments);
      original[method].apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    addLog('error', [event.message || 'JavaScript error', event.filename ? event.filename + ':' + event.lineno + ':' + event.colno : '']);
  });
  window.addEventListener('unhandledrejection', function (event) {
    addLog('error', ['Unhandled Promise rejection:', event.reason]);
  });

  // يكتب آخر نقرة قبل تشغيل معالج الموقع، لذلك تبقى محفوظة حتى عند التجمّد.
  document.addEventListener('click', function (event) { saveLastAction('click', event); }, true);
  window.addEventListener('beforeunload', function () {
    try { localStorage.setItem(LAST_ACTION_KEY, JSON.stringify({
      time: new Date().toLocaleTimeString(), label: 'beforeunload',
      page: document.querySelector('.page-section.active')?.id || '', href: location.href
    })); } catch (e) {}
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createPanel, { once: true });
  else createPanel();
})();

/*
 * Mobile Debug Panel — بديل مبسط لـ F12 على الهاتف
 * الاستخدام: أضف هذا السطر قبل </body> في index.html:
 * <script src="./js/mobile-debug-panel.js"></script>
 *
 * افتح اللوحة من زر DEBUG أسفل الشاشة.
 * احذف السطر في النسخة النهائية قبل النشر العام.
 */
(function () {
  'use strict';

  if (window.__mobileDebugPanelLoaded) return;
  window.__mobileDebugPanelLoaded = true;

  var logs = [];
  var maxLogs = 300;
  var panel;
  var content;
  var counter;

  function stringify(value) {
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value, null, 2); }
      catch (e) { return '[Object غير قابل للعرض]'; }
    }
    return String(value);
  }

  function addLog(type, args) {
    var entry = {
      type: type,
      time: new Date().toLocaleTimeString(),
      text: Array.prototype.slice.call(args).map(stringify).join(' ')
    };

    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    render();
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
        alert('تم نسخ سجل الأخطاء');
      }).catch(function () {
        window.prompt('انسخ السجل:', text);
      });
    } else {
      window.prompt('انسخ السجل:', text);
    }
  }

  function createPanel() {
    var style = document.createElement('style');
    style.textContent = '\
      #mobileDebugButton{position:fixed;bottom:14px;left:14px;z-index:2147483646;\
        background:#b91c1c;color:#fff;border:0;border-radius:999px;padding:9px 13px;\
        font:bold 12px Arial;box-shadow:0 3px 12px #0005}\
      #mobileDebugPanel{display:none;position:fixed;inset:0;z-index:2147483647;\
        background:#111;color:#eee;font:12px Arial;direction:ltr}\
      #mobileDebugPanel.open{display:flex;flex-direction:column}\
      .mobile-debug-toolbar{display:flex;gap:7px;align-items:center;padding:10px;\
        background:#222;position:sticky;top:0}\
      .mobile-debug-toolbar button{border:1px solid #777;background:#333;color:#fff;\
        border-radius:6px;padding:7px 10px;font-weight:bold}\
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
    copy.type = 'button';
    copy.textContent = 'نسخ';
    copy.onclick = copyLogs;

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'مسح';
    clear.onclick = function () { logs = []; render(); };

    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'إغلاق';
    close.onclick = function () { panel.classList.remove('open'); };

    toolbar.appendChild(title);
    toolbar.appendChild(copy);
    toolbar.appendChild(clear);
    toolbar.appendChild(close);

    content = document.createElement('div');
    content.id = 'mobileDebugContent';

    panel.appendChild(toolbar);
    panel.appendChild(content);
    document.body.appendChild(button);
    document.body.appendChild(panel);

    button.onclick = function () { panel.classList.add('open'); render(); };
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
    addLog('error', [
      event.message || 'JavaScript error',
      event.filename ? event.filename + ':' + event.lineno + ':' + event.colno : ''
    ]);
  });

  window.addEventListener('unhandledrejection', function (event) {
    addLog('error', ['Unhandled Promise rejection:', event.reason]);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPanel, { once: true });
  } else {
    createPanel();
  }
})();

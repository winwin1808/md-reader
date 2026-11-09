(function () {
  var API = 'https://md-reader-api.qhao-work.workers.dev/api/feedback';
  var MAIL = 'qhao.work@gmail.com';
  var form = document.getElementById('fb');
  var status = document.getElementById('fb-status');
  if (!form) return;

  var version = (new URLSearchParams(location.search).get('v') || '').slice(0, 64) || null;
  var browser = null;
  try {
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    for (var i = 0; i < brands.length; i++) {
      if (brands[i].brand === 'Google Chrome' || brands[i].brand === 'Chromium') {
        browser = 'Chrome ' + brands[i].version;
        if (brands[i].brand === 'Google Chrome') break;
      }
    }
    if (!browser) {
      var m = /Chrome\/(\d+)/.exec(navigator.userAgent || '');
      if (m) browser = 'Chrome ' + m[1];
    }
  } catch (e) {}

  function show(ids, text) {
    for (var j = 0; j < ids.length; j++) {
      var el = document.getElementById(ids[j]);
      if (el) el.textContent = text;
    }
  }
  show(['fb-version', 'fb-version-en'], version || '—');
  show(['fb-browser', 'fb-browser-en'], browser || '—');

  function isVi() { return document.documentElement.dataset.lang === 'vi'; }

  function mailtoLink(reason, message) {
    var subject = 'MD Reader feedback';
    var body = 'Reason: ' + (reason || '') + '\nMessage: ' + (message || '') +
      '\nVersion: ' + (version || '') + '\nBrowser: ' + (browser || '');
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function fail(reason, message, btn) {
    status.textContent = '';
    status.appendChild(document.createTextNode(isVi() ? 'Không gửi được. ' : 'Could not send. '));
    var a = document.createElement('a');
    a.href = mailtoLink(reason, message);
    a.textContent = isVi() ? 'Gửi qua email' : 'Send by email';
    status.appendChild(a);
    btn.disabled = false;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = form.querySelector('button[type=submit]');
    var chosen = form.querySelector('input[name=reason]:checked');
    if (!chosen) {
      status.textContent = isVi() ? 'Vui lòng chọn một lý do.' : 'Please choose a reason.';
      return;
    }
    var reason = chosen.value;
    var message = form.elements['message'].value;
    var email = form.elements['email'].value;
    var website = form.elements['website'].value;
    btn.disabled = true;
    status.textContent = isVi() ? 'Đang gửi…' : 'Sending…';
    fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'uninstall', reason: reason, message: message, email: email || null,
        version: version, browser: browser,
        locale: document.documentElement.dataset.lang === 'vi' ? 'vi' : 'en',
        website: website
      })
    }).then(function (res) {
      if (res.status === 204) {
        form.hidden = true;
        form.style.display = 'none';
        status.textContent = isVi() ? 'Cảm ơn bạn đã góp ý!' : 'Thank you for your feedback!';
        form.parentNode.insertBefore(status, form);
      } else {
        fail(reason, message, btn);
      }
    }, function () { fail(reason, message, btn); });
  });
})();

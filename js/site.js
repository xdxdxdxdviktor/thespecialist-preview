/* The Specialist – hlavní skript webu (bez závislostí)
   1) menu  2) cookies / consent  3) měření (dataLayer)  4) poptávkový formulář
   Struktura eventů je popsaná v docs/MERENI.md */
(function () {
  'use strict';

  var I18N = {};
  try { I18N = JSON.parse(document.getElementById('ts-i18n').textContent); } catch (e) {}
  var CFG = window.TS_CONSENT_CFG || {};
  var body = document.body;
  var PAGE = {
    page_lang: document.documentElement.lang,
    page_type: body.getAttribute('data-page-type') || '',
    page_service: body.getAttribute('data-service') || ''
  };
  window.dataLayer = window.dataLayer || [];

  function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : '{' + k + '}'; }); }
  function ss(key, val) {
    try { if (val === undefined) { var v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ měření */
  function track(event, params) {
    var data = { event: event };
    var k;
    for (k in PAGE) data[k] = PAGE[k];
    if (params) for (k in params) if (params[k] !== undefined && params[k] !== '') data[k] = params[k];
    window.dataLayer.push(data);
  }
  window.TSTrack = track;

  // Zdroj návštěvy (UTM, gclid…) – uložen jen v sessionStorage, odešle se s poptávkou.
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];
  (function captureAttribution() {
    var q = new URLSearchParams(location.search);
    var found = {};
    var any = false;
    ATTR_KEYS.forEach(function (k) { var v = q.get(k); if (v) { found[k] = v.slice(0, 200); any = true; } });
    if (!ss('ts_landing')) {
      var ref = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : '';
      ss('ts_landing', { landing_page: location.pathname + location.search, referrer: ref.slice(0, 500), ts: Date.now() });
    }
    if (any) {
      found.landing_page = location.pathname;
      found.ts = Date.now();
      if (!ss('ts_attr_first')) ss('ts_attr_first', found);
      ss('ts_attr_last', found);
    }
  })();
  function attribution() {
    var last = ss('ts_attr_last') || {};
    var land = ss('ts_landing') || {};
    var out = { first_touch: ss('ts_attr_first'), landing_page: land.landing_page || '', referrer: land.referrer || '' };
    ATTR_KEYS.forEach(function (k) { out[k] = last[k] || ''; });
    return out;
  }

  track('ts_page_view');
  if (PAGE.page_type === 'service') track('service_view', { service: PAGE.page_service });

  var EVENT_MAP = {
    cta: function (el) {
      var cta = el.getAttribute('data-cta');
      return cta === 'consult' ? 'consultation_click' : 'cta_click';
    },
    phone_click: 'phone_click',
    whatsapp_click: 'whatsapp_click',
    email_click: 'email_click',
    outbound: function (el) {
      var c = el.getAttribute('data-cta');
      return c === 'casukoncitfirmu' ? 'casukoncitfirmu_click' : c === 'profese360' ? 'profese360_click' : 'outbound_click';
    },
    service_card: 'select_service',
    area_click: 'select_area',
    related_click: 'select_service',
    lang_switch: 'language_switch'
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a,button') : null;
    if (!el) return;
    var kind = el.getAttribute('data-track');
    var href = el.getAttribute('href') || '';
    if (!kind) {
      if (href.indexOf('tel:') === 0) kind = 'phone_click';
      else if (href.indexOf('mailto:') === 0) kind = 'email_click';
      else return;
    }
    var map = EVENT_MAP[kind];
    if (!map) return;
    var name = typeof map === 'function' ? map(el) : map;
    track(name, {
      cta_id: el.getAttribute('data-cta') || kind,
      cta_location: el.getAttribute('data-location') || '',
      service: el.getAttribute('data-service') || PAGE.page_service,
      area: el.getAttribute('data-area') || undefined,
      link_url: href.indexOf('http') === 0 ? href.split('?')[0] : undefined,
      lang_to: el.getAttribute('data-lang-to') || undefined
    });
  }, true);

  // Hloubka scrollu 50 % a 90 %
  (function () {
    var hit = {};
    var ticking = false;
    function check() {
      ticking = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      if (h <= 0) return;
      var p = (scrollY / h) * 100;
      [50, 90].forEach(function (m) { if (p >= m && !hit[m]) { hit[m] = 1; track('scroll_depth', { percent_scrolled: m }); } });
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  })();

  /* ------------------------------------------------------------ menu */
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('site-menu');
  if (toggle && menu) {
    var label = toggle.querySelector('.menu-label');
    var setMenu = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
      body.classList.toggle('menu-open', open);
      if (label) label.textContent = open ? label.getAttribute('data-close') : label.getAttribute('data-open');
    };
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); } });
    menu.addEventListener('click', function (e) { if (e.target.closest('a') && e.target.closest('a').getAttribute('href').charAt(0) === '#') setMenu(false); });
  }

  /* ------------------------------------------------------------ cookies / consent */
  var banner = document.getElementById('consent');
  var state = window.TS_CONSENT_STATE || null;

  function loadGtm() {
    if (!CFG.gtmId || window.TS_GTM_LOADED) return;
    window.TS_GTM_LOADED = 1;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CFG.gtmId);
    document.head.appendChild(s);
  }
  function clearTrackingCookies() {
    var host = location.hostname.split('.');
    var domains = ['', location.hostname, '.' + host.slice(-2).join('.')];
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^(_ga|_gid|_gat|_gcl|_fbp|_fbc|_uet|IDE|test_cookie)/.test(n)) {
        domains.forEach(function (d) { document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : ''); });
      }
    });
  }
  function saveConsent(a, m) {
    var prev = state;
    state = { v: CFG.v, a: a ? 1 : 0, m: m ? 1 : 0, t: Date.now() };
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    try { document.cookie = 'ts_consent=' + encodeURIComponent(JSON.stringify(state)) + '; Max-Age=' + 60 * 60 * 24 * 182 + '; path=/; SameSite=Lax' + secure; } catch (e) {}
    window.gtag && window.gtag('consent', 'update', {
      analytics_storage: a ? 'granted' : 'denied',
      ad_storage: m ? 'granted' : 'denied',
      ad_user_data: m ? 'granted' : 'denied',
      ad_personalization: m ? 'granted' : 'denied'
    });
    track('consent_update', { consent_analytics: a ? 'granted' : 'denied', consent_marketing: m ? 'granted' : 'denied' });
    if (a || m || CFG.early) loadGtm();
    hideBanner();
    // odvolání dříve uděleného souhlasu – smazat cookies a zastavit již načtené skripty
    if (prev && ((prev.a && !a) || (prev.m && !m))) { clearTrackingCookies(); setTimeout(function () { location.reload(); }, 150); }
  }
  function syncSwitches() {
    if (!banner) return;
    banner.querySelectorAll('[data-consent-cat]').forEach(function (inp) {
      var cat = inp.getAttribute('data-consent-cat');
      inp.checked = !!(state && (cat === 'analytics' ? state.a : state.m));
    });
  }
  function padBody() { if (banner && !banner.hidden) body.style.paddingBottom = banner.querySelector('.consent-inner').offsetHeight + 24 + 'px'; }
  function consentClass(on) { body.classList.toggle('consent-open', on); }
  function showBanner(expanded) {
    if (!banner) return;
    banner.hidden = false;
    consentClass(true);
    syncSwitches();
    setExpanded(!!expanded);
    padBody();
  }
  function hideBanner() { if (banner) { banner.hidden = true; body.style.paddingBottom = ''; consentClass(false); } }
  function setExpanded(on) {
    var settings = document.getElementById('consent-settings');
    settings.hidden = !on;
    banner.classList.toggle('is-expanded', on);
    var bSet = banner.querySelector('[data-consent="settings"]');
    var bSave = banner.querySelector('[data-consent="save"]');
    bSet.hidden = on;
    bSet.setAttribute('aria-expanded', String(on));
    bSave.hidden = !on;
    padBody();
  }
  if (banner) {
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var act = b.getAttribute('data-consent');
      if (act === 'accept') saveConsent(true, true);
      else if (act === 'reject') saveConsent(false, false);
      else if (act === 'settings') { setExpanded(true); var first = banner.querySelector('[data-consent-cat]'); first && first.focus(); }
      else if (act === 'save') saveConsent(banner.querySelector('[data-consent-cat="analytics"]').checked, banner.querySelector('[data-consent-cat="marketing"]').checked);
    });
    addEventListener('resize', padBody);
    if (!state) showBanner(false);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-consent-open]')) { e.preventDefault(); showBanner(true); }
  });
  window.TSConsent = { open: function () { showBanner(true); }, state: function () { return state; } };

  /* ------------------------------------------------------------ formulář */
  var ERR = (I18N.form && I18N.form.errors) || {};
  var VARS = I18N.vars || {};
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function phoneOk(v) { var d = v.replace(/\D/g, ''); return /^[+0-9 ()\-./]{9,30}$/.test(v.trim()) && d.length >= 9 && d.length <= 15; }

  function setupForm(form) {
    var panel = form.closest('.form-panel');
    var success = panel.querySelector('.form-success');
    var summary = form.querySelector('.form-summary');
    var submit = form.querySelector('[type=submit]');
    var submitHtml = submit.innerHTML;
    var started = false;
    var renderedAt = Date.now();
    var location_ = form.getAttribute('data-location');
    var select = form.querySelector('select[name=service]');

    // předvýběr služby z odkazu ?sluzba=…
    var want = new URLSearchParams(location.search).get('sluzba');
    if (want && select && !select.value) {
      for (var i = 0; i < select.options.length; i++) if (select.options[i].value === want) select.value = want;
    }

    var initialService = select ? select.value : '';

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { form_location: location_, service: select.value || PAGE.page_service });
    });

    function fieldError(name, msg) {
      var input = form.elements[name];
      if (!input) return;
      var err = document.getElementById(name + '-' + location_ + '-err');
      if (msg) { input.setAttribute('aria-invalid', 'true'); if (err) { err.textContent = msg; err.hidden = false; } }
      else { input.removeAttribute('aria-invalid'); if (err) { err.textContent = ''; err.hidden = true; } }
    }
    function validate(name) {
      var el = form.elements[name];
      if (!el) return true;
      var v = el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
      var msg = '';
      switch (name) {
        case 'service': if (!v) msg = ERR.service; break;
        case 'name': if (v.length < 2) msg = ERR.name; break;
        case 'phone': if (!v) msg = ERR.required; else if (!phoneOk(v)) msg = ERR.phone; break;
        case 'email': if (!v) msg = ERR.required; else if (!EMAIL_RE.test(v)) msg = ERR.email; break;
        case 'message': if (v.length < 10) msg = ERR.message; break;
        case 'consent': if (!v) msg = (I18N.form && I18N.form.consentRequired) || ERR.required; break;
      }
      fieldError(name, msg);
      return !msg;
    }
    var FIELDS = ['service', 'name', 'phone', 'email', 'message', 'consent'];
    FIELDS.forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      el.addEventListener('blur', function () { if (el.value || el.getAttribute('aria-invalid')) validate(n); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) validate(n); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid')) validate(n); });
    });

    function showSummary(msg) { summary.textContent = msg; summary.hidden = !msg; if (msg) summary.focus && summary.setAttribute('tabindex', '-1'); }
    function busy(on) {
      submit.disabled = on;
      submit.innerHTML = on ? (I18N.form && I18N.form.sending) || '…' : submitHtml;
      form.setAttribute('aria-busy', String(on));
    }
    function fail(kind, detail) {
      busy(false);
      showSummary(fill(ERR[kind] || ERR.server, VARS));
      summary.focus();
      track('form_error', { form_location: location_, error_type: kind, service: select.value, error_detail: detail });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showSummary('');
      var ok = FIELDS.map(validate).every(Boolean);
      if (!ok) {
        showSummary(ERR.summary);
        var firstBad = form.querySelector('[aria-invalid=true]');
        firstBad && firstBad.focus();
        track('form_error', { form_location: location_, error_type: 'validation', service: select.value });
        return;
      }
      if (navigator.onLine === false) return fail('offline');

      var fd = new FormData(form);
      var payload = {};
      fd.forEach(function (v, k) { payload[k] = typeof v === 'string' ? v.trim() : v; });
      payload.consent = !!form.elements.consent.checked;
      payload.lang = form.getAttribute('data-lang');
      payload.form_location = location_;
      payload.page_url = location.origin + location.pathname;
      payload.page_type = PAGE.page_type;
      payload.elapsed_ms = Date.now() - renderedAt;
      var att = attribution();
      for (var k in att) payload[k] = att[k];

      busy(true);
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { ctrl && ctrl.abort(); }, 20000);
      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (res) {
          clearTimeout(timer);
          return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
        })
        .then(function (r) {
          if (r.res.ok && r.data && r.data.ok) {
            // Úspěch se ukazuje až po potvrzení serverem
            busy(false);
            track('generate_lead', { form_location: location_, service: payload.service, lead_lang: payload.lang, lead_id: r.data.id || undefined });
            form.hidden = true;
            success.hidden = false;
            success.focus();
            form.reset();
            if (select) select.value = initialService;
            if (window.turnstile) try { window.turnstile.reset(); } catch (er) {}
            return;
          }
          if (r.res.status === 422 && r.data && r.data.fields) {
            busy(false);
            Object.keys(r.data.fields).forEach(function (f) { fieldError(f, ERR[r.data.fields[f]] || ERR.required); });
            showSummary(ERR.summary);
            track('form_error', { form_location: location_, error_type: 'server_validation', service: payload.service });
            return;
          }
          if (r.res.status === 429) return fail('rate');
          if (r.res.status === 403) return fail('spam');
          fail('server', String(r.res.status));
        })
        .catch(function (err) {
          clearTimeout(timer);
          fail(navigator.onLine === false ? 'offline' : 'network', err && err.name);
        });
    });

    var again = panel.querySelector('[data-form-reset]');
    again && again.addEventListener('click', function () {
      success.hidden = true;
      form.hidden = false;
      started = false;
      renderedAt = Date.now();
      form.querySelector('select,input').focus();
    });
  }
  var forms = document.querySelectorAll('form.inquiry');
  forms.forEach(setupForm);
  if (forms.length && document.querySelector('.cf-turnstile')) {
    var ts = document.createElement('script');
    ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    ts.async = true;
    ts.defer = true;
    document.head.appendChild(ts);
  }
})();

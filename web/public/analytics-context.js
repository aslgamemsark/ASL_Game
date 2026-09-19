/* Shared by the app and static marketing pages; no SDK or network requests here. */
(function () {
  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id'];
  var storageKey = 'quicksign_attribution_v2';
  var internalKey = 'quicksign_internal_tester';
  var memory;

  function optedOut() {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    try { return localStorage.getItem('quicksign_analytics_opt_out') === 'true'; } catch (_) { return false; }
  }
  function campaignValue(value) {
    if (typeof value !== 'string') return undefined;
    value = value.trim();
    // Campaign labels only: never forward URLs, emails, query strings, fragments or JWTs.
    if (!/^[a-zA-Z0-9 _.-]{1,100}$/.test(value) || /eyJ|access_token|refresh_token/i.test(value)) return undefined;
    return value;
  }
  function campaign(search) {
    var params = new URLSearchParams(search);
    var out = {};
    keys.forEach(function (key) { var value = campaignValue(params.get(key)); if (value) out[key] = value; });
    return out;
  }
  function safeUrl(value) {
    if (typeof value !== 'string') return value;
    return value.split(/[?#]/)[0];
  }
  function cleanTouch(touch) {
    if (!touch || typeof touch !== 'object') return null;
    var out = {};
    keys.forEach(function (key) { var value = campaignValue(touch[key]); if (value) out[key] = value; });
    if (typeof touch.referrer === 'string') {
      try { var url = new URL(touch.referrer); if (/^https?:$/.test(url.protocol)) out.referrer = url.origin; } catch (_) { /* invalid stored value */ }
    }
    if (!Object.keys(out).length) return null;
    out.landing_path = typeof touch.landing_path === 'string' && touch.landing_path.startsWith('/')
      ? safeUrl(touch.landing_path).slice(0, 200) : '/';
    return out;
  }
  function attribution() {
    if (optedOut()) return {};
    if (memory) return memory;
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) { /* blocked or invalid */ }
    var first = cleanTouch(stored.first);
    var latest = cleanTouch(stored.latest);
    var touch = campaign(window.location.search);
    try {
      var referrer = new URL(document.referrer);
      if (/^https?:$/.test(referrer.protocol) && referrer.origin !== window.location.origin) touch.referrer = referrer.origin;
    } catch (_) { /* direct visit */ }
    touch.landing_path = window.location.pathname;
    touch = cleanTouch(touch);
    if (touch) { if (!first) first = touch; latest = touch; }
    memory = { first: first, latest: latest };
    try { localStorage.setItem(storageKey, JSON.stringify(memory)); } catch (_) { /* session memory still works */ }
    return memory;
  }
  function trafficType() {
    var marker = new URLSearchParams(window.location.search).get('internal');
    try {
      if (marker === '1' || marker === '0') localStorage.setItem(internalKey, marker);
      if (marker !== '1' && marker !== '0') marker = localStorage.getItem(internalKey);
    } catch (_) { /* query marker still applies when storage is blocked */ }
    return marker === '1' ? 'internal' : 'external';
  }
  function properties() {
    var touches = attribution();
    var out = { traffic_type: trafficType() };
    ['first', 'latest'].forEach(function (kind) {
      keys.concat(['referrer', 'landing_path']).forEach(function (key) { out[kind + '_' + key] = null; });
      var touch = touches[kind];
      if (!touch) return;
      Object.keys(touch).forEach(function (key) { out[kind + '_' + key] = touch[key]; });
    });
    return out;
  }
  function sanitize(properties) {
    if (!properties || typeof properties !== 'object') return properties;
    Object.keys(properties).forEach(function (key) {
      var value = properties[key];
      if (/^(\$?(initial_)?(current_url|referrer|referring_domain)|href|referrer|attr__href|attr__src)$/.test(key)) properties[key] = safeUrl(value);
      else if (/^(\$initial_|first_|latest_)?(utm_source|utm_medium|utm_campaign|utm_content|utm_term|campaign_id)$/.test(key)) properties[key] = campaignValue(value) || null;
      // PostHog requires its public project `token` property; auth tokens live in URLs or named access/refresh fields.
      else if (/^(access_token|refresh_token|code|email|password|\$initial_gclid|\$initial_fbclid|gclid|fbclid)$/i.test(key)) delete properties[key];
      else if (value && typeof value === 'object') sanitize(value);
    });
    return properties;
  }
  function appUrl(href) {
    var destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin && destination.origin !== 'https://quicksignn.vercel.app') return href;
    // App entry links get only current campaign fields; never copy arbitrary/auth parameters.
    if (destination.pathname !== '/') return href;
    destination.search = '';
    destination.hash = '';
    if (!optedOut()) {
      var current = campaign(window.location.search);
      Object.keys(current).forEach(function (key) { destination.searchParams.set(key, current[key]); });
    }
    if (trafficType() === 'internal') destination.searchParams.set('internal', '1');
    return destination.toString();
  }
  window.quickSignAnalyticsContext = { properties: properties, sanitize: sanitize, appUrl: appUrl, campaign: campaign, optedOut: optedOut, trafficType: trafficType };
})();

/*
 * Ad attribution tracking script.
 *
 * Embed this on every funnel/landing page (same snippet pattern as the
 * Roaspy script you were using):
 *
 *   <script>
 *     var s = document.createElement("script");
 *     s.async = true;
 *     s.src = "https://YOUR-DASHBOARD-DOMAIN/track.js";
 *     document.head.appendChild(s);
 *   </script>
 *
 * What it does:
 *   1. Assigns a first-party visitor id cookie (or reads the existing one).
 *   2. Reads fbclid/UTM/ad ids from the URL and sends them, keyed by that
 *      visitor id, to /api/track — this is the authoritative attribution
 *      record on our side.
 *   3. Writes the same visitor id (nothing else) into a hidden form field
 *      named "rcl_visitor_id", if one exists on the page. Map that field to
 *      a GHL custom field of the same name so it lands on the contact.
 *
 * For ad_id/adset_id/campaign_id to show up in the URL at all, set dynamic
 * URL parameters on your Meta ads (Ad Set/Ad -> "Build a URL Parameter"):
 *   ad_id={{ad.id}}&adset_id={{adset.id}}&campaign_id={{campaign.id}}
 * Without that, we still capture fbclid and UTM params, but true per-ad
 * attribution needs those three ids.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/track";
  var VISITOR_COOKIE = "_rcl_vid";
  var VISITOR_COOKIE_DAYS = 365;
  var HIDDEN_FIELD_SELECTOR =
    '[name="rcl_visitor_id"], [data-name="rcl_visitor_id"]';
  var TRACKED_PARAMS = [
    "fbclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ad_id",
    "adset_id",
    "campaign_id",
  ];

  function getCookie(name) {
    var match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie =
      name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId() {
    var id = getCookie(VISITOR_COOKIE);
    if (!id) {
      id = uuid();
      setCookie(VISITOR_COOKIE, id, VISITOR_COOKIE_DAYS);
    }
    return id;
  }

  function getTrackedParams() {
    var search = new URLSearchParams(window.location.search);
    var out = {};
    var found = false;
    TRACKED_PARAMS.forEach(function (key) {
      var value = search.get(key);
      if (value) {
        out[key] = value;
        found = true;
      }
    });
    return found ? out : null;
  }

  function send(visitorId, params) {
    var payload = JSON.stringify({
      visitorId: visitorId,
      fbclid: params.fbclid,
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_campaign: params.utm_campaign,
      utm_content: params.utm_content,
      utm_term: params.utm_term,
      ad_id: params.ad_id,
      adset_id: params.adset_id,
      campaign_id: params.campaign_id,
      landingUrl: window.location.href,
      referrer: document.referrer || undefined,
    });

    // text/plain keeps this a CORS-safelisted "simple request" (no
    // preflight), since the funnel domain and the dashboard domain differ.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }));
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload,
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    }
  }

  function fillHiddenField(visitorId) {
    var el = document.querySelector(HIDDEN_FIELD_SELECTOR);
    if (el && el.value !== visitorId) {
      el.value = visitorId;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function init() {
    var visitorId = getVisitorId();
    var params = getTrackedParams();

    if (params) {
      send(visitorId, params);
    }

    window.RCL = { visitorId: visitorId };

    // GHL forms sometimes render after this script runs (widget/late
    // hydration), so keep trying to fill the hidden field for a bit rather
    // than only on DOMContentLoaded.
    var attempts = 0;
    var interval = setInterval(function () {
      attempts += 1;
      fillHiddenField(visitorId);
      if (attempts >= 20) clearInterval(interval); // ~10s at 500ms
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

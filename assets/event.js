/*
 * LetsPlay website event page (404.html serves every /event/<id> address).
 *
 * Part 1: shows the event to a signed-out visitor, or the right message (full, cancelled,
 *         invite-only, ...).
 * Part 2: signing in on the page: email -> 6-digit code -> name + 18+ (new guests only), then
 *         the event reloads the way the app reads it (with the participant list).
 * Part 3: free join, the "You're in!" page, and cancelling a spot (the 5-hour rule).
 * Part 4: paid join: the Pay page, Stripe's payment form (card, Apple Pay, Google Pay), the
 *         bank-check (3D Secure) return, and refunds when a paid spot is cancelled in time.
 *
 * Every join, payment and refund goes through the same server functions the app uses, and the
 * server re-checks every rule (spots, invite code, blocks, the 5-hour window, the payment itself).
 *
 * Safety rules for this file:
 * - Event text (title, description, names) is written with textContent, never innerHTML, so a
 *   host or player can't inject HTML into the page.
 * - The invite code is never logged, never put in the page title and never sent anywhere except
 *   the LetsPlay server. <meta name="referrer" content="no-referrer"> keeps it out of the Referer
 *   header when the visitor follows a link off this page.
 * - Whether an email already has an account is never shown: "Send code" says the same for any
 *   email, and the name step only appears after the code proves the email is theirs.
 */
(function () {
  "use strict";

  var CONFIG = window.LETSPLAY_CONFIG || {};
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var APP_STORE_URL =
    "https://apps.apple.com/ca/app/letsplay-pickup-sports/id6804315546?itscg=30200&itsct=apps_box_link&mttnsubad=6804315546";
  var PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ca.letsplayapp.letsplay";
  var RESEND_SECONDS = 60;
  // Cancelling more than this many hours before the start refunds a paid spot (the server's
  // assert_refund_window_open / REFUND_CUTOFF_HOURS in the app).
  var REFUND_CUTOFF_HOURS = 5;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var root = document.getElementById("event-app");
  if (!root || window.location.pathname.indexOf("/event/") !== 0) return;

  // The header's "Get the app" button links to the App Store; Android phones get Google Play.
  var navGetApp = document.querySelector(".nav__getapp");
  if (navGetApp && /Android/i.test(navigator.userAgent)) {
    navGetApp.href = "https://play.google.com/store/apps/details?id=ca.letsplayapp.letsplay";
  }

  /* ================================================================== helpers */

  /** Creates an element with attributes and children (strings become text nodes, so they are never parsed as HTML). */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "className") el.className = value;
        else if (key === "onClick") el.addEventListener("click", value);
        else el.setAttribute(key, value === true ? "" : value);
      });
    }
    appendChildren(el, children);
    return el;
  }

  /** Appends strings (as text) and nodes to a parent, skipping empty values. */
  function appendChildren(el, children) {
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child === null || child === undefined || child === false || child === "") return;
      el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
  }

  /** Builds a stroke icon from a list of SVG path strings (decorative, hidden from screen readers). */
  function icon(paths, className) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (className) svg.setAttribute("class", className);
    paths.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }

  var ICONS = {
    pin: ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
    copy: ["M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    lock: ["M7 11V8a5 5 0 0 1 10 0v3", "M5 11h14v10H5z"],
    ball: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M2 12h20", "M12 2v20", "M4.9 4.9c3.5 3 3.5 11.2 0 14.2", "M19.1 4.9c-3.5 3-3.5 11.2 0 14.2"],
    users: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1", "M16 3.13a4 4 0 0 1 0 7.75", "M22 21v-1a5 5 0 0 0-3.5-4.77"],
    x: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M15 9l-6 6", "M9 9l6 6"],
    clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 7v5l3 2"],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M21 21l-4.3-4.3"],
    alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
    pause: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M10 9v6", "M14 9v6"],
    wifi: ["M2 8.8a15 15 0 0 1 20 0", "M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 20h.01"],
    back: ["M15 6l-6 6 6 6"],
    chevronDown: ["M6 9l6 6 6-6"],
    mail: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M3.5 6.5l8.5 6.5 8.5-6.5"],
    ban: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M4.9 4.9l14.2 14.2"],
    star: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
    calendar: ["M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M3 10h18", "M8 3v4", "M16 3v4"],
    info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 11v5", "M12 8h.01"],
    padlock: ["M8 11V8a4 4 0 0 1 8 0v3", "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"],
  };

  /** Sport colour (same values as the app's getSportColor), used for the banner when there is no photo. */
  function sportColor(sport) {
    var colors = {
      basketball: "#F59E0B", soccer: "#16A34A", swimming: "#0284C7", tennis: "#A3CB04",
      volleyball: "#DC2626", running: "#7C3AED", golf: "#15803D", hockey: "#64748B",
      padel: "#0EA5E9", pickleball: "#F97316", football: "#92400E", baseball: "#B45309",
      table_tennis: "#6366F1", cricket: "#DC2626", badminton: "#EC4899", squash: "#0E7490",
      cycling: "#059669",
    };
    return colors[String(sport || "").toLowerCase()] || "#0D5C63";
  }

  /** Sport name for display (same as the app's getSportLabel). */
  function sportLabel(sport) {
    var labels = {
      basketball: "Basketball", soccer: "Soccer", swimming: "Swimming", tennis: "Tennis",
      volleyball: "Volleyball", running: "Running", golf: "Golf", hockey: "Hockey",
      padel: "Padel", pickleball: "Pickleball", football: "Football", baseball: "Baseball",
      table_tennis: "Table Tennis", cricket: "Cricket", badminton: "Badminton", squash: "Squash",
      cycling: "Cycling",
    };
    return labels[String(sport || "").toLowerCase()] || "Sport";
  }

  /** Darkens a #RRGGBB colour toward black by `amount` (0–1), for the banner gradient's far end. */
  function darken(hex, amount) {
    var clean = hex.replace("#", "").slice(0, 6);
    var out = "#";
    for (var i = 0; i < 6; i += 2) {
      var c = Math.round(parseInt(clean.slice(i, i + 2), 16) * (1 - amount));
      out += ("0" + c.toString(16)).slice(-2);
    }
    return out;
  }

  /** What the card is charged for a paid spot. Same formula as the server's computeFees (supabase/functions/_shared/fees.ts). */
  function totalWithFees(priceCents) {
    var platformFee = Math.round(priceCents * 0.01) + 20;
    return Math.ceil((priceCents + platformFee + 30) / (1 - 0.029));
  }

  /** The card processing fee kept on a refund (same estimate as computeFees' amount_stripe_fee_cents). */
  function cardFeeCents(totalCents) {
    return Math.round(totalCents * 0.029) + 30;
  }

  /** What a cancelled paid spot refunds: everything except the card fee (mirrors refund-participant). */
  function refundCents(totalCents) {
    return totalCents - cardFeeCents(totalCents);
  }

  /** True when the event starts within 5 hours (a paid spot can no longer be refunded). */
  function isWithinRefundCutoff(iso) {
    return new Date(iso).getTime() - Date.now() <= REFUND_CUTOFF_HOURS * 3600000;
  }

  /** "Thu, Nov 20 at 2:00 PM": the last moment a paid spot can be cancelled with a refund. */
  function refundDeadlineLabel(iso) {
    var cutoff = new Date(new Date(iso).getTime() - REFUND_CUTOFF_HOURS * 3600000);
    return formatShortDate(cutoff.toISOString()) + " at " + formatTime(cutoff.toISOString());
  }

  /** True inside Instagram, Facebook or TikTok's built-in browsers (no Apple Pay / Google Pay there). */
  function isInAppBrowser() {
    return /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview/i.test(navigator.userAgent);
  }

  /**
   * Friendly wording for a server error code. Same messages as the app's friendlyErrorMessage
   * (lib/utils/errors.ts), trimmed to the codes the website can meet.
   */
  function friendlyError(code, rawMessage) {
    var messages = {
      P0002: "This event no longer exists.",
      P0003: "This event is now full.",
      P0004: "You're not in this event.",
      P0005: "You can't get a refund within 5 hours of the event start.",
      P0006: "As the host, you can't leave your own event. Cancel it in the app instead.",
      P0008: "This is a paid event. Tap Join to pay for your spot.",
      P0011: "Joining on the web is paused right now. Get the app to join this event.",
      P0030: "You can't join this event.",
      P0031: "This event has been cancelled.",
      P0032: "This event has already started.",
      P0036: "You can still get a refund. Use Cancel my spot.",
      EVENT_NOT_FOUND: "This event no longer exists.",
      EVENT_NOT_PAID: "This event is free, so no payment is needed.",
      EVENT_CANCELLED: "This event has been cancelled.",
      EVENT_FULL: "This event is now full.",
      EVENT_PAST: "This event has already started.",
      USER_BLOCKED: "You can't join this event.",
      HOST_CANNOT_ACCEPT_PAYMENTS: "This event can't accept payments right now. Try again later.",
      INVITE_CODE_INVALID: "This invite link doesn't work. Check it with the person who invited you.",
      TOO_MANY_ATTEMPTS: "Too many attempts. Try again in a few minutes.",
      UNAUTHORIZED: "Your login has expired. Please log in again.",
      PAYMENT_IN_PROGRESS: "Your payment is still going through. Give it a moment, then refresh this page.",
      PAYMENT_NOT_CONFIRMED: "We couldn't confirm your payment. If you were charged, you'll be refunded automatically.",
      EVENT_FULL_REFUNDED: "This event filled up before your spot was confirmed, so your payment was refunded.",
      EVENT_CANCELLED_REFUNDED: "The host cancelled this event, so your payment was refunded.",
      REFUND_WINDOW_CLOSED: "You can't get a refund within 5 hours of the event start. You can still leave without a refund.",
      PAYMENT_FORFEITED: "This payment was for a spot you gave up. Join again to pay for a new spot.",
      REFUND_FAILED: "Something went wrong and we couldn't refund you automatically. Please contact support@letsplayapp.ca.",
      PAYMENT_DISPUTED: "This payment is being disputed through your bank, so it can't be cancelled here. Please contact support@letsplayapp.ca.",
      "23505": "You've already joined this event.",
    };
    if (code && messages[code]) return messages[code];
    var msg = String(rawMessage || "").toLowerCase();
    if (code === "42501" || msg.indexOf("jwt") !== -1 || msg.indexOf("permission denied") !== -1) {
      return "Your login has expired. Please log in again.";
    }
    if (msg.indexOf("network") !== -1 || msg.indexOf("fetch") !== -1) {
      return "Couldn't connect. Check your internet and try again.";
    }
    return "Something went wrong. Please try again.";
  }

  /** Reads a server function's error reply ({ code, message }) into { code, message } with friendly wording. */
  function functionError(err) {
    var ctx = err && err.context;
    var read = ctx && typeof ctx.json === "function" ? ctx.json() : Promise.reject();
    return read
      .then(function (body) {
        return { code: body && body.code, message: friendlyError(body && body.code, body && body.message) };
      })
      .catch(function () {
        return { code: null, message: friendlyError(null, err && err.message) };
      });
  }

  /** "7:00 PM" in the visitor's time zone. */
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  /** "7:00 PM – 9:00 PM", or just the start when there's no end time (same as the app). */
  function formatTimeRange(startIso, endIso) {
    return endIso ? formatTime(startIso) + " – " + formatTime(endIso) : formatTime(startIso);
  }

  /** "Thu, Nov 20". */
  function formatShortDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  /** "Thursday, November 20". */
  function formatLongDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  /** "Today", "Tomorrow" or "In N days" (up to 7), else null (same rule as the app). */
  function relativeDayLabel(iso) {
    var event = new Date(iso);
    var now = new Date();
    var eventDay = new Date(event.getFullYear(), event.getMonth(), event.getDate());
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((eventDay - today) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days >= 2 && days <= 7) return "In " + days + " days";
    return null;
  }

  /** "$12.00" in Canadian dollars. */
  function formatMoney(cents) {
    return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  }

  /** "Jordan M." — first name and last initial, the way the website shows people. */
  function shortName(first, last) {
    return [first || "", last ? last.charAt(0) + "." : ""].join(" ").trim();
  }

  /** Two-letter initials for an avatar, or "?". */
  function initialsOf(first, last) {
    return (((first || "").charAt(0) + (last || "").charAt(0)).toUpperCase()) || "?";
  }

  /** Reads the event id from /event/<id>, or null when the address isn't a valid event link. */
  function readEventId() {
    var match = window.location.pathname.match(/^\/event\/([^/?#]+)\/?$/);
    return match && UUID_RE.test(match[1]) ? match[1].toLowerCase() : null;
  }

  /**
   * Reads ?code= and normalises it the way the app does (letters and digits, upper case).
   * Returns null when there's none or it can't be a real code (8 letters/digits).
   */
  function readInviteCode() {
    var raw = new URLSearchParams(window.location.search).get("code");
    if (!raw) return null;
    var cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return /^[A-Z0-9]{8}$/.test(cleaned) ? cleaned : null;
  }

  /** Shows a short message at the bottom of the screen for 2.5 seconds. */
  function toast(text) {
    var el = h("div", { className: "ev-toast", role: "status" }, text);
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2500);
  }

  /** Replaces the page content and scrolls to the top (each step is its own "page"). */
  function show() {
    root.replaceChildren.apply(root, Array.prototype.slice.call(arguments).filter(Boolean));
    window.scrollTo(0, 0);
  }

  /* ================================================================== state */

  var eventId = readEventId();
  var inviteCode = readInviteCode();

  // The Supabase client (the login library). Null if the library failed to load; the signed-out
  // view still works without it.
  var sb =
    window.supabase && CONFIG.supabaseUrl && CONFIG.supabaseAnonKey
      ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
          auth: {
            persistSession: true, // stay logged in on this browser
            autoRefreshToken: true,
            detectSessionInUrl: false, // logins here are by code, never by link
            storageKey: "letsplay-web-auth",
          },
        })
      : null;

  var state = {
    user: null, // the logged-in Supabase user, or null
    profile: null, // their profile row (from get_my_profile), or null when they have none yet
    event: null, // the last event loaded, in the page's own shape (see normalise functions)
    pendingEmail: null, // the email a code was just sent to
    resendAt: 0, // when "Resend code" becomes available again (ms timestamp)
    joinAfterLogin: false, // they tapped Join while signed out: carry on joining once logged in
    joining: false, // a free join is in flight (stops double taps)
  };

  /* ================================================================== server */

  /** Calls the get-public-event server function (signed-out view). Resolves to its reply, or { status: 'error' }. */
  function fetchPublicEvent() {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 15000);
    return fetch(CONFIG.supabaseUrl + "/functions/v1/get-public-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.supabaseAnonKey,
        Authorization: "Bearer " + CONFIG.supabaseAnonKey,
      },
      body: JSON.stringify({ event_id: eventId, code: inviteCode }),
      signal: controller.signal,
    })
      .then(function (res) {
        return res.ok ? res.json() : { status: "error" };
      })
      .catch(function () {
        return { status: "error" };
      })
      .then(function (data) {
        clearTimeout(timer);
        return data && data.status ? data : { status: "error" };
      });
  }

  /** Public address of an event photo in the event-photos bucket, or null. */
  function photoUrl(photoPath) {
    return photoPath ? CONFIG.supabaseUrl + "/storage/v1/object/public/event-photos/" + photoPath : null;
  }

  /** Turns a database event row (normal read or get_event_by_invite) into the page's shape. */
  function normaliseRow(row, isMemberHint) {
    var participants = (row.participants || []).map(function (p) {
      var prof = p.profiles || null;
      var gone = !prof || !!prof.deleted_at;
      return {
        user_id: p.user_id,
        first: gone ? "Deleted" : prof.first_name,
        last: gone ? "user" : prof.last_name,
        deleted: gone,
      };
    });
    var uid = state.user ? state.user.id : null;
    var host = row.profiles || null;
    var hostGone = !host || !!host.deleted_at;
    var isPaid = !!row.is_paid && !!row.price_cents;
    var isMember =
      typeof isMemberHint === "boolean"
        ? isMemberHint
        : participants.some(function (p) {
            return p.user_id === uid;
          });
    return {
      id: row.id,
      host_id: row.host_id,
      title: row.title,
      sport: row.sport,
      description: row.description,
      date: row.date,
      end_time: row.end_time,
      photo_url: photoUrl(row.photo_path),
      venue_name: row.venue_name,
      location: row.location,
      is_paid: isPaid,
      price_cents: isPaid ? row.price_cents : null,
      total_cents: isPaid ? totalWithFees(row.price_cents) : null,
      is_private: !!row.is_private,
      spots_left: Math.max(0, (row.max_participants || 0) - (row.current_participants || 0)),
      going: row.current_participants || 0,
      max_participants: row.max_participants || 0,
      host_first_name: hostGone ? "" : host.first_name,
      host_last_name: hostGone ? "" : host.last_name,
      participants: participants,
      cancelled: !!row.cancelled_at,
      started: new Date(row.date).getTime() <= Date.now(),
      isMember: isMember,
      isHost: !!uid && row.host_id === uid,
      signedIn: true,
    };
  }

  /**
   * Loads the event as the logged-in person, the way the app does. Resolves to
   * { status: 'ok', event } or { status: <message kind> }.
   * - With an invite code: get_event_by_invite (also gives non-members the roster).
   * - Otherwise, or if the code doesn't match this event: the normal read, where the database's
   *   own rules decide what this person may see.
   */
  function fetchSignedInEvent() {
    var byCode = inviteCode
      ? sb.rpc("get_event_by_invite", { p_code: inviteCode }).then(function (res) {
          if (res.error) return { status: "error" };
          var d = res.data || {};
          if (d.status === "ok" && d.event && d.event.id === eventId) {
            return { status: "ok", event: normaliseRow(d.event, !!d.is_member) };
          }
          if (d.status === "blocked") return { status: "blocked" };
          if (d.status === "ended") return { status: "started" };
          if (d.status === "rate_limited") return { status: "rate_limited" };
          return null; // wrong code, or a code for another event: try the normal read
        })
      : Promise.resolve(null);

    return byCode.then(function (result) {
      if (result) return result;
      return sb
        .from("events")
        .select(
          "*, profiles!host_id(first_name, last_name, avatar_url, deleted_at), " +
            "participants(user_id, profiles!user_id(first_name, last_name, avatar_url, deleted_at))"
        )
        .eq("id", eventId)
        .maybeSingle()
        .then(function (res) {
          if (res.error) return { status: "error" };
          // Not readable while logged in: private without the right code, removed, or the host
          // blocked them. The page never says which.
          if (!res.data) return { status: inviteCode ? "invite_only" : "not_available" };
          return { status: "ok", event: normaliseRow(res.data) };
        });
    });
  }

  /** Reads the logged-in person's own profile (null when they haven't made one yet). */
  function fetchMyProfile() {
    return sb.rpc("get_my_profile").then(function (res) {
      if (res.error) throw res.error;
      var rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      return rows[0] || null;
    });
  }

  /** Turns a login error from Supabase into a short, friendly sentence. */
  function authErrorMessage(err, step) {
    var msg = String((err && err.message) || "").toLowerCase();
    var status = err && err.status;
    if (status === 429 || msg.indexOf("security purposes") !== -1 || msg.indexOf("rate limit") !== -1) {
      return step === "code"
        ? "Too many tries. Please wait a few minutes and try again."
        : "Too many codes requested. Please wait a minute and try again.";
    }
    if (step === "code" && (msg.indexOf("expired") !== -1 || msg.indexOf("invalid") !== -1)) {
      return "That code is wrong or has expired. Check it, or tap Resend code.";
    }
    if (msg.indexOf("network") !== -1 || msg.indexOf("fetch") !== -1) {
      return "Couldn't connect. Check your internet and try again.";
    }
    return "Something went wrong. Please try again.";
  }

  /* ================================================================== shared pieces */

  /** The "open in the app" link: the custom scheme on iPhone, an intent with a Play Store fallback on Android. */
  function openInAppLink() {
    var scheme = CONFIG.appScheme || "letsplay";
    var pkg = CONFIG.androidPackage || "ca.letsplayapp.letsplay";
    var path = "event/" + eventId + (inviteCode ? "?code=" + encodeURIComponent(inviteCode) : "");

    // Instagram's in-app browser won't hand custom-scheme links to the app, so show nothing there.
    if (/Instagram/.test(navigator.userAgent)) return null;

    var href = /Android/i.test(navigator.userAgent)
      ? "intent://" + path + "#Intent;scheme=" + scheme + ";package=" + pkg +
        ";S.browser_fallback_url=" + encodeURIComponent(PLAY_STORE_URL) + ";end"
      : scheme + "://" + path;

    return h("p", { className: "ev-openapp" }, [
      "Already have the app? ",
      h("a", { href: href }, "Open this event in LetsPlay"),
    ]);
  }

  /** App Store + Google Play badges, plus the open-in-app line when the event can be opened. */
  function getAppBlock(withOpenLink) {
    return h("div", { className: "ev-getapp" }, [
      h("div", { className: "ev-badges" }, [
        h("a", { href: APP_STORE_URL }, h("img", { src: "/assets/app-store-badge.svg", alt: "Download on the App Store" })),
        h("a", { href: PLAY_STORE_URL }, h("img", { src: "/assets/google-play-badge.png", alt: "Get it on Google Play" })),
      ]),
      withOpenLink && eventId ? openInAppLink() : null,
    ]);
  }

  /**
   * The sport's playing surface (same artwork as the app), or null if sport-surfaces.js didn't
   * load, in which case the plain sport-colour gradient behind it shows instead.
   */
  function sportArt(sport) {
    if (!window.LetsPlaySportSurfaces) return null;
    var svg = window.LetsPlaySportSurfaces.svg(sport, sportColor(sport));
    svg.setAttribute("class", "ev-banner__surface");
    return svg;
  }

  /** The 2:1 banner: the host's photo, or the sport's playing surface from above. */
  function banner(ev, className) {
    var color = sportColor(ev.sport);
    var el = h("div", { className: className || "ev-banner" });
    el.style.background = "linear-gradient(135deg, " + color + " 0%, " + darken(color, 0.35) + " 100%)";

    // Always drawn, so a photo that fails to load falls back to the sport artwork underneath.
    var art = sportArt(ev.sport);
    if (art) el.appendChild(art);
    if (ev.photo_url) {
      var img = h("img", { src: ev.photo_url, alt: "" });
      img.addEventListener("error", function () {
        img.remove();
      });
      el.appendChild(img);
    }
    el.appendChild(h("div", { className: "ev-banner__scrim" }));

    var chips = h("div", { className: "ev-chips" }, h("span", { className: "ev-chip" }, sportLabel(ev.sport)));
    if (ev.is_private) {
      chips.appendChild(h("span", { className: "ev-chip" }, [icon(ICONS.lock), "Invite only"]));
    }
    el.appendChild(chips);
    return el;
  }

  /** The small event summary at the top of the sign-in pages. */
  function miniSummary(ev) {
    var color = sportColor(ev.sport);
    var thumb = h("div", { className: "ev-thumb" });
    thumb.style.background = "linear-gradient(135deg, " + color + " 0%, " + darken(color, 0.35) + " 100%)";
    if (ev.photo_url) {
      thumb.appendChild(h("img", { src: ev.photo_url, alt: "" }));
    } else {
      var art = sportArt(ev.sport);
      if (art) thumb.appendChild(art);
    }
    return h("section", { className: "ev-card ev-summary" }, [
      thumb,
      h("div", { className: "ev-stack" }, [
        h("span", { className: "ev-strong ev-oneline" }, ev.title),
        h("span", { className: "ev-muted" }, formatShortDate(ev.date) + " · " + formatTimeRange(ev.date, ev.end_time)),
      ]),
    ]);
  }

  /** "← Back to the event" (or another label) at the top of a sign-in page. */
  function backLink(label, onBack) {
    return h("button", { type: "button", className: "ev-back", onClick: onBack }, [icon(ICONS.back), label]);
  }

  /** The description with "Show more" when it runs past 4 lines. */
  function aboutParts(text) {
    var desc = h("p", { className: "ev-desc is-clamped" }, text);
    var more = h("button", { type: "button", className: "ev-linkbtn", hidden: true }, "Show more");
    more.addEventListener("click", function () {
      var clamped = desc.classList.toggle("is-clamped");
      more.textContent = clamped ? "Show more" : "Show less";
    });
    // Only offer "Show more" when the text is actually cut off (measured after it's on screen).
    requestAnimationFrame(function () {
      if (desc.scrollHeight > desc.clientHeight + 1) more.hidden = false;
    });
    return [h("h2", { className: "ev-about__title" }, [icon(ICONS.info, "ev-about__icon"), "About this event"]), desc, more];
  }

  /** Who's going (signed-in view only): host first, with a Host badge, then everyone else. */
  function peopleSection(ev) {
    var people = ev.participants;
    var rows = people.map(function (p) {
      var isHost = p.user_id === ev.host_id;
      var isMe = state.user && p.user_id === state.user.id;
      return h("li", { className: "ev-person" }, [
        h("div", { className: "ev-avatar ev-avatar--sm" + (p.deleted ? " is-gone" : ""), "aria-hidden": "true" }, p.deleted ? "?" : initialsOf(p.first, p.last)),
        h("span", { className: "ev-person__name" }, p.deleted ? "Deleted user" : shortName(p.first, p.last) + (isMe ? " (you)" : "")),
        isHost ? h("span", { className: "ev-badge" }, "Host") : null,
      ]);
    });
    // Host at the top, like the app.
    rows.sort(function (a, b) {
      return (b.querySelector(".ev-badge") ? 1 : 0) - (a.querySelector(".ev-badge") ? 1 : 0);
    });
    return h("section", { className: "ev-card ev-pad" }, [
      h("h2", { className: "ev-section-title" }, "Going (" + people.length + ")"),
      peopleList(ev, rows),
    ]);
  }

  /** The names, or a "no one yet" line. */
  function peopleList(ev, rows) {
    return ev.participants.length
      ? h("ul", { className: "ev-people" }, rows)
      : h("p", { className: "ev-muted", style: "margin: 0" }, "No one yet. Be the first!");
  }

  /** "Participants" row with a chevron that opens and closes the list of names, like the app. Starts closed. */
  function participantsDropdown(ev) {
    var inner = peopleSection(ev).querySelector(".ev-people, p");
    var list = h("div", { className: "ev-dropdown__list", id: "ev-participants", hidden: true }, inner);
    var chevron = icon(ICONS.chevronDown, "ev-dropdown__chevron");
    var toggle = h("button", { type: "button", className: "ev-dropdown__toggle", "aria-expanded": "false", "aria-controls": "ev-participants" }, [
      h("span", null, "Participants"),
      chevron,
    ]);
    toggle.addEventListener("click", function () {
      var open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("is-open", open);
    });
    return h("div", { className: "ev-dropdown" }, [toggle, list]);
  }

  /** The copy-address button (same as the app: a copy icon, no text). */
  function copyButton(text) {
    var btn = h("button", { type: "button", className: "ev-iconbtn", "aria-label": "Copy address" }, icon(ICONS.copy));
    btn.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        btn.classList.add("is-done");
        btn.replaceChildren(icon(ICONS.check));
        toast("Address copied");
        setTimeout(function () {
          btn.classList.remove("is-done");
          btn.replaceChildren(icon(ICONS.copy));
        }, 2000);
      });
    });
    return btn;
  }

  /** "Logged in as sam@example.com · Log out" (signed-in views). */
  function accountLine() {
    if (!state.user) return null;
    var out = h("button", { type: "button", className: "ev-inline-link" }, "Log out");
    out.addEventListener("click", logOut);
    return h("p", { className: "ev-account" }, ["Logged in as " + (state.user.email || "you") + " · ", out]);
  }

  /** A text field with its label. Returns { wrap, input }. */
  function field(id, label, attrs) {
    var input = h("input", Object.assign({ id: id, className: "ev-input" }, attrs || {}));
    return { wrap: h("div", { className: "ev-field" }, [h("label", { for: id, className: "ev-label" }, label), input]), input: input };
  }

  /** A line for form errors, read out by screen readers when it changes. */
  function errorLine() {
    return h("p", { className: "ev-error", role: "alert", hidden: true });
  }

  /** Shows (or with null, hides) a form error. */
  function setError(el, text) {
    el.textContent = text || "";
    el.hidden = !text;
  }

  /** Puts a button into its busy state (or back), keeping its label for later. */
  function setBusy(btn, busy, busyLabel) {
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = busyLabel;
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  /* ================================================================== views: event */

  /** Grey placeholder shapes while the event loads. */
  function renderLoading() {
    show(
      h("div", { className: "ev", "aria-busy": "true", "aria-label": "Loading event" }, [
        h("div", { className: "ev-card" }, [
          h("div", { className: "ev-banner ev-skel" }),
          h("div", { className: "ev-body" }, [
            h("div", { className: "ev-skel", style: "height: 24px; width: 75%" }),
            h("div", { className: "ev-skel", style: "height: 16px; width: 55%" }),
            h("div", { className: "ev-skel", style: "height: 16px; width: 65%" }),
          ]),
        ]),
      ])
    );
  }

  /** The event page: ticket card, price and spots, (signed in) who's going, about, and the Join bar. */
  function renderEvent(ev) {
    var d = new Date(ev.date);
    var relative = relativeDayLabel(ev.date);
    var place = ev.venue_name || ev.location || "";
    var address = ev.venue_name ? ev.location : "";
    var hostName = shortName(ev.host_first_name, ev.host_last_name);
    var spots = ev.spots_left;

    document.title = ev.title + " · LetsPlay";

    var card = h("article", { className: "ev-card" }, [
      banner(ev),
      h("div", { className: "ev-body" }, [
        h("h1", { className: "ev-title" }, ev.title),
        h("div", { className: "ev-row" }, [
          h("div", { className: "ev-datetile", "aria-hidden": "true" }, [
            h("span", { className: "ev-datetile__dow" }, d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()),
            h("span", { className: "ev-datetile__day" }, String(d.getDate())),
          ]),
          h("div", { className: "ev-stack" }, [
            h("span", { className: "ev-strong" }, formatTimeRange(ev.date, ev.end_time)),
            h("span", { className: "ev-muted" }, relative ? relative + " · " + formatShortDate(ev.date) : formatLongDate(ev.date)),
          ]),
        ]),
        place
          ? h("div", { className: "ev-row ev-row--top" }, [
              icon(ICONS.pin, "ev-icon"),
              h("div", { className: "ev-stack" }, [
                h("span", { className: "ev-strong" }, place),
                address ? h("span", { className: "ev-muted" }, address) : null,
              ]),
              ev.location ? copyButton(ev.location) : null,
            ])
          : null,
        hostName
          ? h("div", { className: "ev-row ev-host" }, [
              h("div", { className: "ev-avatar", "aria-hidden": "true" }, initialsOf(ev.host_first_name, ev.host_last_name)),
              h("span", { className: "ev-host__text" }, ["Hosted by ", h("strong", null, hostName.replace(/\.$/, ""))]),
            ])
          : null,
      ]),
    ]);

    // Same as the app's capacity card, without the list of names.
    // An older get-public-event doesn't send the count; then show only "spots left", with no bar.
    var hasCount = typeof ev.going === "number" && ev.max_participants > 0;
    var fill = hasCount ? Math.min(100, (ev.going / ev.max_participants) * 100) : 0;
    var capacity = h("div", { className: "ev-capacity" + (spots <= 3 ? " is-low" : "") }, [
      h("div", { className: "ev-capacity__head" }, [
        icon(ICONS.users, "ev-capacity__icon"),
        h("span", { className: "ev-capacity__title" }, hasCount ? ev.going + " going" : ""),
        h("span", { className: "ev-capacity__spots" }, spots === 1 ? "1 spot left" : spots + " spots left"),
      ]),
      hasCount ? h("div", { className: "ev-progress", "aria-hidden": "true" }, h("div", { className: "ev-progress__fill", style: "width: " + fill + "%" })) : null,
      // Signed in: the names, in a dropdown under the bar.
      ev.signedIn ? participantsDropdown(ev) : null,
    ]);

    var joinBtn = h("button", { type: "button", className: "ev-btn" }, "Join");
    joinBtn.addEventListener("click", onJoinTapped);

    // Bottom strip like the app's: the price on the left, Join on the right.
    var joinBar = h("div", { className: "ev-joinbar" }, h("div", { className: "ev-joinbar__inner" }, [
      h("div", { className: "ev-joinbar__row" }, [
        h("div", { className: "ev-joinbar__price" }, [
          h("span", { className: "ev-joinbar__amount" }, ev.is_paid ? formatMoney(ev.price_cents) : "Free"),
          ev.is_paid ? h("span", { className: "ev-joinbar__per" }, "per person") : null,
        ]),
        joinBtn,
      ]),
      h("span", { className: "ev-joinbar__note" }, state.user ? "Joining as " + (state.user.email || "you") : "No app needed. Join with your email."),
    ]));

    show(
      h("div", { className: "ev" }, [
        card,
        // Who's going and the description share one card.
        h("section", { className: "ev-card ev-pad" }, [
          capacity,
          ev.description ? h("div", { className: "ev-about" }, aboutParts(ev.description)) : null,
        ]),
        h("div", { className: "ev-card ev-pad" }, getAppBlock(true)),
        accountLine(),
      ]),
      joinBar
    );
  }

  /**
   * The "You're in!" page for someone already in the event: the ticket with the details, who's
   * going, the app panel, and Cancel my spot (until the event starts).
   */
  function renderYoureIn(ev) {
    document.title = ev.title + " · LetsPlay";
    var place = ev.venue_name || ev.location || "";
    var others = Math.max(0, ev.participants.length - 1);

    var ticket = h("article", { className: "ev-card" }, [
      h("div", { className: "ev-in-head" }, [
        h("div", { className: "ev-in-check" }, icon(ICONS.check)),
        h("div", { className: "ev-stack" }, [
          h("span", { className: "ev-in-title" }, "You're in!"),
          h("span", { className: "ev-in-sub" }, "Joined as " + (state.user.email || "you")),
        ]),
      ]),
      h("div", { className: "ev-body" }, [
        h("span", { className: "ev-title", style: "font-size: 18px; line-height: 24px" }, ev.title),
        h("div", { className: "ev-row" }, [
          icon(ICONS.calendar, "ev-icon"),
          h("span", { className: "ev-strong", style: "font-weight: 500" }, formatShortDate(ev.date) + " · " + formatTimeRange(ev.date, ev.end_time)),
        ]),
        place
          ? h("div", { className: "ev-row ev-row--top" }, [
              icon(ICONS.pin, "ev-icon"),
              h("div", { className: "ev-stack" }, [
                h("span", { className: "ev-strong", style: "font-weight: 500" }, place),
                ev.venue_name && ev.location ? h("span", { className: "ev-muted" }, ev.location) : null,
              ]),
              ev.location ? copyButton(ev.location) : null,
            ])
          : null,
        h("span", { className: "ev-muted ev-host" }, others === 0 ? "You're the first one going." : "You and " + others + (others === 1 ? " other are" : " others are") + " going."),
      ]),
    ]);

    var app = h("section", { className: "ev-card ev-pad" }, [
      h("h2", { className: "ev-section-title", style: "color: var(--text); font-size: 16px" }, "Get the app to hear about changes"),
      h("p", { className: "ev-muted", style: "margin: 0 0 4px" }, "Time changes, cancellations and the event chat all live in the app."),
      getAppBlock(true),
      h("p", { className: "ev-muted", style: "margin: 10px 0 0; text-align: center" },
        state.user && state.user.email
          ? ["Log in with ", h("strong", null, state.user.email), " using a code. No password needed."]
          : "Log in with your email using a code. No password needed."),
    ]);

    var cancelArea = null;
    if (!ev.started) {
      var paidRefundable = ev.is_paid && !isWithinRefundCutoff(ev.date);
      var cancelBtn = h("button", { type: "button", className: "ev-cancel" }, "Cancel my spot");
      cancelBtn.addEventListener("click", function () {
        openCancelDialog(ev, ev.is_paid ? (paidRefundable ? "refund" : "forfeit") : "free");
      });
      cancelArea = h("section", { className: "ev-cancel-area" }, [
        cancelBtn,
        ev.is_paid
          ? h(
              "span",
              { className: "ev-muted", style: "text-align: center" },
              paidRefundable
                ? "Refund (minus the card fee) until " + refundDeadlineLabel(ev.date)
                : "It's less than 5 hours to start, so cancelling now isn't refunded."
            )
          : null,
      ]);
    }

    show(
      h("div", { className: "ev" }, [
        ticket,
        peopleSection(ev),
        app,
        cancelArea,
        h("p", { className: "ev-account" }, [
          "Not " + (state.user.email || "you") + "? ",
          (function () {
            var b = h("button", { type: "button", className: "ev-inline-link" }, "Log out");
            b.addEventListener("click", logOut);
            return b;
          })(),
        ]),
      ])
    );
  }

  /**
   * The Cancel my spot confirmation (wording: WEB_JOIN_CONTEXT decision 18, #8 and #9).
   * mode: "free" (leave_event), "refund" (refund-participant: paid, more than 5h out) or
   * "forfeit" (leave_event without a refund: paid, inside 5h). If the server's clock disagrees
   * with the visitor's, it answers with a code and the dialog switches to the other mode.
   */
  function openCancelDialog(ev, mode) {
    var err = errorLine();
    var text = h("p", { className: "ev-dialog__text" });
    var confirmBtn = h("button", { type: "button", className: "ev-btn ev-btn--danger" });
    var keepBtn = h("button", { type: "button", className: "ev-btn ev-btn--ghost" }, "Keep my spot");
    var busy = false;

    /** Fills the dialog for the current mode. */
    function paint() {
      if (mode === "refund") {
        text.textContent =
          "You'll get a refund of " + formatMoney(refundCents(ev.total_cents)) + " (the card fee isn't refunded).";
        confirmBtn.textContent = "Cancel my spot";
      } else if (mode === "forfeit") {
        text.textContent =
          "It's less than 5 hours to start, so you won't get a refund. Your spot will open up for someone else.";
        confirmBtn.textContent = "Cancel without refund";
      } else {
        text.textContent = "Your spot will be freed up.";
        confirmBtn.textContent = "Cancel my spot";
      }
    }
    paint();

    var overlay = h("div", { className: "ev-dialog-wrap" }, [
      h("div", { className: "ev-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "ev-dialog-title" }, [
        h("h2", { id: "ev-dialog-title", className: "ev-dialog__title" }, "Cancel your spot?"),
        text,
        err,
        confirmBtn,
        keepBtn,
      ]),
    ]);

    /** Closes the dialog. */
    function close() {
      if (busy) return;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
    }
    /** Escape closes the dialog. */
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    keepBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);

    confirmBtn.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      setError(err, null);
      setBusy(confirmBtn, true, "Cancelling…");
      keepBtn.disabled = true;

      var request =
        mode === "refund"
          ? sb.functions.invoke("refund-participant", { body: { event_id: ev.id } }).then(function (res) {
              return res.error ? functionError(res.error) : null;
            })
          : sb.rpc("leave_event", { p_event_id: ev.id }).then(function (res) {
              return res.error ? { code: res.error.code, message: friendlyError(res.error.code, res.error.message) } : null;
            });

      request.then(function (failure) {
        busy = false;
        keepBtn.disabled = false;
        setBusy(confirmBtn, false);
        if (!failure) {
          overlay.remove();
          document.removeEventListener("keydown", onKey);
          toast(mode === "refund" ? "Spot cancelled. Your refund is on its way." : "Spot cancelled.");
          state.event = null;
          load();
          return;
        }
        // The server's clock decides the 5-hour window: switch to whatever it says applies.
        if (failure.code === "REFUND_WINDOW_CLOSED" && mode === "refund") {
          mode = "forfeit";
          paint();
          setError(err, "It's now less than 5 hours to start, so this spot can't be refunded.");
          return;
        }
        if (failure.code === "P0036" && mode === "forfeit") {
          mode = "refund";
          paint();
          setError(err, "Good news: you can still get a refund.");
          return;
        }
        setError(err, failure.message);
      });
    });

    document.body.appendChild(overlay);
    keepBtn.focus();
  }

  /**
   * The wording for each message screen (WEB_JOIN_CONTEXT decision 18).
   * showApp: whether to offer the app; tone: "warn" for the amber icon; openLink: whether the
   * event itself can be opened in the app.
   */
  var MESSAGES = {
    full: { icon: ICONS.users, tone: "warn", title: "This event is full", text: "Spots can open up if someone leaves. Check back later.", showApp: true, openLink: true },
    cancelled: { icon: ICONS.x, title: "This event was cancelled", text: "Find other games near you in the LetsPlay app.", showApp: true },
    // Shown only to someone who was in the event and paid (decision 18 #1).
    cancelled_paid: { icon: ICONS.x, title: "This event was cancelled", text: "If you paid, your refund is on its way.", showApp: true },
    started: { icon: ICONS.clock, title: "This event has already started", text: "Find other games near you in the LetsPlay app.", showApp: true },
    not_found: { icon: ICONS.search, title: "We couldn't find this event", text: "The link may be wrong, or the event was removed.", showApp: true },
    invite_only: { icon: ICONS.lock, title: "This event is invite-only", text: "Ask the host for the invite link.", showApp: true, openLink: true },
    not_available: { icon: ICONS.ban, title: "This event isn't available", text: "", showApp: true },
    blocked: { icon: ICONS.ban, title: "This event isn't available", text: "", showApp: true },
    rate_limited: { icon: ICONS.alert, tone: "warn", title: "Too many tries", text: "Please wait a few minutes and try again.", showApp: false },
    paused: { icon: ICONS.pause, title: "Joining on the web is paused", text: "Get the app to join this event.", showApp: true, openLink: true },
    hosting: { icon: ICONS.star, title: "You're hosting this event", text: "Manage it in the LetsPlay app.", showApp: true, openLink: true },
    error: { icon: ICONS.wifi, tone: "warn", title: "Something went wrong", text: "Please check your connection and try again.", showApp: false, retry: true },
  };

  /** A message screen. `ev` (optional) adds a small event summary above it, used for "full". */
  function renderMessage(kind, ev) {
    var m = MESSAGES[kind] || MESSAGES.error;

    var body = h("section", { className: "ev-card ev-message" }, [
      h("div", { className: "ev-message__icon" + (m.tone === "warn" ? " is-warn" : "") }, icon(m.icon)),
      h("h1", null, m.title),
      m.text ? h("p", null, m.text) : null,
      m.showApp ? getAppBlock(!!m.openLink) : null,
    ]);

    if (m.retry) {
      var retry = h("button", { type: "button", className: "ev-btn", style: "margin-top: 8px" }, "Try again");
      retry.addEventListener("click", load);
      body.appendChild(retry);
    }

    var summary = null;
    if (ev) {
      document.title = ev.title + " · LetsPlay";
      summary = h("article", { className: "ev-card" }, [
        banner(ev, "ev-mini__banner"),
        h("div", { className: "ev-body" }, [
          h("h2", { className: "ev-title", style: "font-size: 18px; line-height: 24px" }, ev.title),
          h("span", { className: "ev-muted" }, formatShortDate(ev.date) + " · " + formatTimeRange(ev.date, ev.end_time)),
        ]),
      ]);
    }

    show(h("div", { className: "ev" }, [summary, body, accountLine()]));
  }

  /** Shows the right view for a loaded event. */
  function renderLoadedEvent(ev) {
    state.event = ev;
    if (ev.signedIn) {
      if (ev.isHost) return renderMessage("hosting", ev);
      if (ev.cancelled) return renderMessage(ev.isMember && ev.is_paid ? "cancelled_paid" : "cancelled");
      if (ev.isMember) return renderYoureIn(ev);
      if (ev.started) return renderMessage("started");
    }
    if (ev.spots_left <= 0) return renderMessage("full", ev);
    renderEvent(ev);

    // They tapped Join before logging in: carry straight on (free: join; paid: the Pay page).
    if (ev.signedIn && state.joinAfterLogin) {
      state.joinAfterLogin = false;
      onJoinTapped();
    }
  }

  /* ================================================================== views: sign in */

  /** Step 1: the email page. */
  function renderEmailStep() {
    var ev = state.event;
    var email = field("ev-email", "Email", {
      type: "email",
      autocomplete: "email",
      inputmode: "email",
      autocapitalize: "off",
      spellcheck: "false",
      placeholder: "you@example.com",
      value: state.pendingEmail || "",
    });
    var err = errorLine();
    var send = h("button", { type: "submit", className: "ev-btn" }, "Send code");

    var form = h("form", { className: "ev-form", novalidate: true }, [
      email.wrap,
      err,
      send,
      h("p", { className: "ev-fineprint" }, [
        "By continuing you agree to the ",
        h("a", { href: "/terms.html" }, "Terms"),
        " and ",
        h("a", { href: "/privacy.html" }, "Privacy Policy"),
        ".",
      ]),
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = email.input.value.trim().toLowerCase();
      if (!EMAIL_RE.test(value)) {
        setError(err, "Enter a valid email address.");
        email.input.focus();
        return;
      }
      setError(err, null);
      setBusy(send, true, "Sending…");
      sb.auth
        .signInWithOtp({ email: value, options: { shouldCreateUser: true } })
        .then(function (res) {
          setBusy(send, false);
          if (res.error) {
            setError(err, authErrorMessage(res.error, "email"));
            return;
          }
          state.pendingEmail = value;
          state.resendAt = Date.now() + RESEND_SECONDS * 1000;
          goStep("code");
        });
    });

    show(
      h("div", { className: "ev ev--form" }, [
        backLink("Back to the event", function () {
          goStep(null);
        }),
        ev ? miniSummary(ev) : null,
        h("div", { className: "ev-heading" }, [
          h("h1", null, "Join this event"),
          h("p", null, "No app or password needed. We'll email you a 6-digit code to confirm it's you."),
        ]),
        form,
      ])
    );
    email.input.focus();
  }

  /** Step 2: the code page (six boxes, backed by one real input so paste and autofill work). */
  function renderCodeStep() {
    var email = state.pendingEmail;
    if (!email) return goStep("email", true);

    var input = h("input", {
      id: "ev-code",
      className: "ev-otp__input",
      type: "text",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      maxlength: "6",
      "aria-label": "6-digit code",
    });
    var boxes = [];
    for (var i = 0; i < 6; i++) boxes.push(h("span", { className: "ev-otp__box", "aria-hidden": "true" }));
    var otp = h("div", { className: "ev-otp" }, boxes.concat([input]));
    var err = errorLine();
    var confirm = h("button", { type: "submit", className: "ev-btn" }, "Confirm");
    var resend = h("button", { type: "button", className: "ev-inline-link" });
    var other = h("button", { type: "button", className: "ev-inline-link" }, "Use a different email");
    var verifying = false;

    /** Mirrors the real input into the six boxes and marks the next empty one. */
    function paint() {
      var v = input.value;
      boxes.forEach(function (b, idx) {
        b.textContent = v.charAt(idx);
        b.classList.toggle("is-active", document.activeElement === input && idx === Math.min(v.length, 5));
      });
    }

    /** Updates the Resend label with the seconds left before another code can be sent. */
    function tickResend() {
      var left = Math.ceil((state.resendAt - Date.now()) / 1000);
      if (left > 0) {
        resend.textContent = "Resend code in " + left + "s";
        resend.disabled = true;
      } else {
        resend.textContent = "Resend code";
        resend.disabled = false;
      }
    }
    var timer = setInterval(function () {
      if (!document.body.contains(resend)) return clearInterval(timer);
      tickResend();
    }, 1000);
    tickResend();

    /** Checks the code with Supabase; on success the person is logged in on this browser. */
    function verify() {
      var token = input.value;
      if (verifying) return;
      if (!/^\d{6}$/.test(token)) {
        setError(err, "Enter the 6-digit code from the email.");
        input.focus();
        return;
      }
      verifying = true;
      setError(err, null);
      setBusy(confirm, true, "Checking…");
      sb.auth.verifyOtp({ email: email, token: token, type: "email" }).then(function (res) {
        verifying = false;
        if (res.error || !res.data || !res.data.session) {
          setBusy(confirm, false);
          setError(err, authErrorMessage(res.error, "code"));
          input.value = "";
          paint();
          input.focus();
          return;
        }
        state.user = res.data.session.user;
        afterLogin();
      });
    }

    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      paint();
      if (input.value.length === 6) verify();
    });
    input.addEventListener("focus", paint);
    input.addEventListener("blur", paint);

    resend.addEventListener("click", function () {
      resend.disabled = true;
      sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function (res) {
        if (res.error) {
          setError(err, authErrorMessage(res.error, "email"));
        } else {
          setError(err, null);
          toast("New code sent");
        }
        state.resendAt = Date.now() + RESEND_SECONDS * 1000;
        tickResend();
      });
    });

    other.addEventListener("click", function () {
      goStep("email");
    });

    var form = h("form", { className: "ev-form", novalidate: true }, [
      otp,
      err,
      confirm,
      h("div", { className: "ev-split" }, [resend, other]),
      h("p", { className: "ev-fineprint" }, "Can't find it? Check your spam folder. The code works for 1 hour."),
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      verify();
    });

    show(
      h("div", { className: "ev ev--form" }, [
        backLink("Back", function () {
          goStep("email");
        }),
        h("div", { className: "ev-heading ev-heading--center" }, [
          h("div", { className: "ev-message__icon" }, icon(ICONS.mail)),
          h("h1", null, "Check your email"),
          h("p", null, ["We sent a 6-digit code to", h("br"), h("strong", null, email)]),
        ]),
        form,
      ])
    );
    input.focus();
    paint();
  }

  /** Step 3 (new guests only): first and last name and the 18+ box. */
  function renderNameStep() {
    if (!state.user) return goStep("email", true);

    var first = field("ev-first", "First name", { autocomplete: "given-name", maxlength: "50" });
    var last = field("ev-last", "Last name", { autocomplete: "family-name", maxlength: "50" });
    var adult = h("input", { type: "checkbox", id: "ev-adult" });
    var err = errorLine();
    var go = h("button", { type: "submit", className: "ev-btn" }, "Continue");
    var other = h("button", { type: "button", className: "ev-inline-link" }, "Not you? Use a different email");
    other.addEventListener("click", function () {
      logOut().then(function () {
        goStep("email");
      });
    });

    var form = h("form", { className: "ev-form", novalidate: true }, [
      h("div", { className: "ev-grid2" }, [first.wrap, last.wrap]),
      h("label", { className: "ev-check", for: "ev-adult" }, [adult, h("span", null, "I'm 18 or older")]),
      err,
      go,
      h("div", { className: "ev-center" }, other),
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = first.input.value.trim();
      var l = last.input.value.trim();
      if (!f || !l) {
        setError(err, "Enter your first and last name.");
        (f ? last : first).input.focus();
        return;
      }
      if (!adult.checked) {
        setError(err, "You must be 18 or older to join events.");
        return;
      }
      setError(err, null);
      setBusy(go, true, "Saving…");
      sb.rpc("create_guest_profile", { p_first: f, p_last: l, p_is_adult: true }).then(function (res) {
        if (res.error) {
          setBusy(go, false);
          var code = res.error.code;
          setError(
            err,
            code === "P0011"
              ? "Joining on the web is paused right now. Get the app to join this event."
              : code === "P0012"
                ? "You must be 18 or older to join events."
                : code === "P0015"
                  ? "Enter your first and last name (50 characters at most)."
                  : "Something went wrong. Please try again."
          );
          return;
        }
        afterLogin();
      });
    });

    show(
      h("div", { className: "ev ev--form" }, [
        h("div", { className: "ev-confirmed" }, [
          icon(ICONS.check),
          h("span", null, ["Email confirmed: ", h("strong", null, state.user.email || "")]),
        ]),
        h("div", { className: "ev-heading" }, [
          h("h1", null, "What's your name?"),
          h("p", null, "This is the name the host and other players will see. We only ask once."),
        ]),
        form,
      ])
    );
    first.input.focus();
  }

  /* ================================================================== flow */

  /**
   * Moves between the event and the sign-in pages. Each step gets its own address (#email,
   * #code, #name) so the browser's back button works as people expect.
   */
  function goStep(step, replace) {
    var url = window.location.pathname + window.location.search + (step ? "#" + step : "");
    if (replace) history.replaceState({ step: step }, "", url);
    else history.pushState({ step: step }, "", url);
    renderStep(step);
  }

  /** Draws whichever step the address says. No step means the event itself. */
  function renderStep(step) {
    if (step === "email") return renderEmailStep();
    if (step === "code") return renderCodeStep();
    if (step === "name") return renderNameStep();
    if (step === "pay") return renderPayStep();
    if (state.event) return renderLoadedEvent(state.event);
    load();
  }

  window.addEventListener("popstate", function () {
    renderStep(window.location.hash.replace("#", "") || null);
  });

  /**
   * The Join button: signed out -> the email page; no profile yet -> the name page; paid -> the
   * Pay page; free -> join straight away.
   */
  function onJoinTapped() {
    if (!sb) {
      toast("Couldn't load. Please refresh the page.");
      return;
    }
    if (!state.user || !state.profile) {
      state.joinAfterLogin = true;
      return goStep(state.user ? "name" : "email");
    }
    var ev = state.event;
    if (!ev || !ev.signedIn) {
      // Logged in, but the page still shows the signed-out view: reload as them first.
      state.joinAfterLogin = true;
      state.event = null;
      return load();
    }
    if (ev.is_paid) return goStep("pay");
    joinFree(ev);
  }

  /** The code to send when joining: only for an invite-only event they aren't in yet. */
  function codeForJoin(ev) {
    return ev.is_private && !ev.isMember ? inviteCode : null;
  }

  /** Joins a free event (join_event, or join_event_with_code for invite-only), then shows You're in. */
  function joinFree(ev) {
    if (state.joining) return;
    state.joining = true;
    var btn = document.querySelector(".ev-joinbar .ev-btn");
    if (btn) setBusy(btn, true, "Joining…");

    var code = codeForJoin(ev);
    var request = code
      ? sb.rpc("join_event_with_code", { p_event_id: ev.id, p_code: code })
      : sb.rpc("join_event", { p_event_id: ev.id });

    request.then(function (res) {
      state.joining = false;
      var message = null;
      if (res.error) message = friendlyError(res.error.code, res.error.message);
      // Wrong codes come back as results, not errors (so the guess counter isn't rolled back).
      else if (res.data === "wrong_code") message = friendlyError("INVITE_CODE_INVALID");
      else if (res.data === "rate_limited") message = friendlyError("TOO_MANY_ATTEMPTS");

      if (message) {
        if (btn && document.body.contains(btn)) setBusy(btn, false);
        toast(message);
        // Full, cancelled or started since the page loaded: reload so the page shows it.
        if (res.error && /^P003[0-2]$|^P0003$/.test(res.error.code || "")) {
          state.event = null;
          load();
        }
        return;
      }
      state.event = null;
      load(); // now a member: shows You're in
    });
  }

  /* ================================================================== views: pay (Part 4) */

  var stripeLoading = null;

  /** Loads Stripe.js once (it must come from js.stripe.com) and returns the Stripe object. */
  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe(CONFIG.stripePublishableKey));
    if (!stripeLoading) {
      stripeLoading = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "https://js.stripe.com/v3/";
        s.onload = function () {
          resolve(window.Stripe(CONFIG.stripePublishableKey));
        };
        s.onerror = function () {
          stripeLoading = null;
          reject(new Error("stripe"));
        };
        document.head.appendChild(s);
      });
    }
    return stripeLoading;
  }

  /** Address Stripe sends the visitor back to after a bank check: this event, keeping the invite code. */
  function returnUrl() {
    return window.location.origin + window.location.pathname + window.location.search;
  }

  /** Step: the Pay page for a paid event (fee breakdown, 5h rules, Stripe's payment form). */
  function renderPayStep() {
    var ev = state.event;
    if (!ev || !ev.signedIn || !ev.is_paid) return goStep(null, true);
    if (ev.isMember) return goStep(null, true);

    var total = ev.total_cents;
    var insideCutoff = isWithinRefundCutoff(ev.date);
    var err = errorLine();
    var mount = h("div", { className: "ev-stripe" }, h("div", { className: "ev-skel", style: "height: 140px" }));
    var payBtn = h("button", { type: "button", className: "ev-btn", disabled: true }, "Pay " + formatMoney(total));
    var stripe = null;
    var elements = null;
    var paymentIntentId = null;
    var paying = false;

    var rules = h("section", { className: "ev-rules" }, [
      h("h2", null, "If you can't make it"),
      insideCutoff
        ? h("div", { className: "ev-rule is-warn" }, [
            icon(ICONS.alert),
            h("span", null, "It's less than 5 hours to start, so this spot can't be refunded. You can still leave, but without a refund."),
          ])
        : null,
      insideCutoff
        ? null
        : h("div", { className: "ev-rule" }, [icon(ICONS.clock), h("span", null, "More than 5 hours before the start: you get a refund, minus the card fee.")]),
      insideCutoff
        ? null
        : h("div", { className: "ev-rule" }, [icon(ICONS.alert), h("span", null, "Within 5 hours: you can still leave, but there's no refund.")]),
      insideCutoff ? null : h("span", { className: "ev-muted" }, "Refunds open until " + refundDeadlineLabel(ev.date) + "."),
    ]);

    var breakdown = h("section", { className: "ev-card ev-pad ev-breakdown" }, [
      h("div", null, [h("span", null, "Event price"), h("span", null, formatMoney(ev.price_cents))]),
      h("div", null, [h("span", null, "Service & processing fee"), h("span", null, formatMoney(total - ev.price_cents))]),
      h("div", { className: "ev-breakdown__total" }, [h("span", null, "Total"), h("span", null, formatMoney(total))]),
    ]);

    var payment = h("section", { className: "ev-card ev-pad" }, [
      h("h2", { className: "ev-section-title", style: "color: var(--text)" }, "Payment"),
      isInAppBrowser()
        ? h("p", { className: "ev-inapp" }, [
            "For Apple Pay or Google Pay, open this page in your browser: tap ",
            h("strong", null, "⋯"),
            " and choose ",
            h("strong", null, "Open in browser"),
            ". Cards work here too.",
          ])
        : null,
      mount,
    ]);

    show(
      h("div", { className: "ev ev--form" }, [
        backLink("Back to the event", function () {
          goStep(null);
        }),
        h("div", { className: "ev-heading" }, h("h1", null, "Pay for your spot")),
        miniSummary(ev),
        breakdown,
        rules,
        payment,
        err,
        payBtn,
        h("p", { className: "ev-fineprint" }, "Secure payment by Stripe. Paying as " + (state.user.email || "you") + "."),
      ])
    );

    // 1. Ask the server for this spot's payment (it re-checks spots, blocks and the invite code).
    var body = { event_id: ev.id };
    var code = codeForJoin(ev);
    if (code) body.invite_code = code;

    Promise.all([sb.functions.invoke("create-payment-intent", { body: body }), loadStripe()])
      .then(function (results) {
        var res = results[0];
        stripe = results[1];
        if (res.error) {
          return functionError(res.error).then(function (f) {
            mount.replaceChildren();
            setError(err, f.message);
          });
        }
        var data = res.data || {};
        if (data.kind === "already_joined") {
          state.event = null;
          history.replaceState({ step: null }, "", returnUrl());
          return load();
        }
        paymentIntentId = data.paymentIntentId;

        // 2. Stripe's own payment form (card, plus Apple Pay / Google Pay where the browser has them).
        elements = stripe.elements({
          clientSecret: data.clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#0D5C63",
              colorText: "#1C2E33",
              colorDanger: "#C53030",
              borderRadius: "10px",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
          },
        });
        var paymentElement = elements.create("payment", { layout: "tabs" });
        mount.replaceChildren();
        paymentElement.mount(mount);
        paymentElement.on("ready", function () {
          payBtn.disabled = false;
        });
      })
      .catch(function () {
        mount.replaceChildren();
        setError(err, "Couldn't load the payment form. Check your internet and refresh the page.");
      });

    // 3. Pay. Most cards finish here; ones that need a bank check leave the page and come back
    //    to returnUrl(), where finishReturnedPayment() takes over.
    payBtn.addEventListener("click", function () {
      if (paying || !stripe || !elements) return;
      paying = true;
      setError(err, null);
      setBusy(payBtn, true, "Paying…");
      stripe
        .confirmPayment({ elements: elements, redirect: "if_required", confirmParams: { return_url: returnUrl() } })
        .then(function (result) {
          if (result.error) {
            paying = false;
            setBusy(payBtn, false);
            // Card errors from Stripe are already written for people ("Your card was declined.").
            setError(err, result.error.message || "Your payment didn't go through. Please try again.");
            return;
          }
          var pi = result.paymentIntent;
          if (pi && pi.status === "processing") {
            renderMessageText("Your payment is going through", "Give it a moment, then refresh this page.");
            return;
          }
          confirmJoin(pi ? pi.id : paymentIntentId);
        });
    });
  }

  /**
   * After Stripe says the payment went through: confirm-payment-join seats them (the server asks
   * Stripe itself; it never trusts the page). Even if this call fails, Stripe's webhook seats
   * them too, so the page reloads from the server either way.
   */
  function confirmJoin(piId) {
    renderLoading();
    sb.functions.invoke("confirm-payment-join", { body: { payment_intent_id: piId } }).then(function (res) {
      history.replaceState({ step: null }, "", returnUrl());
      state.event = null;
      if (res.error) {
        return functionError(res.error).then(function (f) {
          toast(f.message);
          load();
        });
      }
      load();
    });
  }

  /** A plain message card with a title and a line (used while a payment is still processing). */
  function renderMessageText(title, text) {
    show(
      h("div", { className: "ev" }, [
        h("section", { className: "ev-card ev-message" }, [
          h("div", { className: "ev-message__icon" }, icon(ICONS.clock)),
          h("h1", null, title),
          h("p", null, text),
        ]),
      ])
    );
  }

  /**
   * Back from a bank check (3D Secure): Stripe adds ?payment_intent=…&redirect_status=… to the
   * address. Removes them (keeping the invite code) and finishes the join. Returns true if it did.
   */
  function finishReturnedPayment() {
    var params = new URLSearchParams(window.location.search);
    var piId = params.get("payment_intent");
    if (!piId) return false;
    var status = params.get("redirect_status");
    ["payment_intent", "payment_intent_client_secret", "redirect_status"].forEach(function (k) {
      params.delete(k);
    });
    var qs = params.toString();
    history.replaceState({ step: null }, "", window.location.pathname + (qs ? "?" + qs : ""));

    if (!state.user || !state.profile) return false;
    if (status === "failed") {
      toast("Your payment didn't go through. Please try again.");
      return false;
    }
    confirmJoin(piId);
    return true;
  }

  /** After the code (or the name step): check for a profile, then reload the event as this person. */
  function afterLogin() {
    renderLoading();
    fetchMyProfile()
      .then(function (profile) {
        if (profile && profile.deleted_at) {
          // A deleted account can't be used again; start fresh as signed out.
          return logOut().then(function () {
            toast("That account was deleted. Use a different email.");
            goStep("email", true);
          });
        }
        state.profile = profile;
        if (!profile) return goStep("name", true);
        // Back to the event (replacing the sign-in steps in the history), now signed in.
        history.replaceState({ step: null }, "", window.location.pathname + window.location.search);
        state.event = null;
        load();
      })
      .catch(function () {
        renderMessage("error");
      });
  }

  /** Logs out on this browser and shows the signed-out event. */
  function logOut() {
    var done = sb ? sb.auth.signOut({ scope: "local" }) : Promise.resolve();
    return done.then(function () {
      state.user = null;
      state.profile = null;
      state.event = null;
      state.joinAfterLogin = false;
      if (!window.location.hash) load();
    });
  }

  /** Loads the event (as this person when logged in, else the signed-out view) and shows it. */
  function load() {
    if (!eventId) return renderMessage("not_found");
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) return renderMessage("error");
    renderLoading();

    var signedIn = !!(state.user && state.profile);
    var request = signedIn ? fetchSignedInEvent() : fetchPublicEvent();
    request
      .then(function (data) {
        if (data.status === "ok" && data.event) renderLoadedEvent(data.event);
        else renderMessage(data.status);
      })
      .catch(function () {
        renderMessage("error");
      });
  }

  /** First load: pick up an existing login on this browser, then show the event. */
  function start() {
    if (!sb) return load();
    renderLoading();
    sb.auth
      .getSession()
      .then(function (res) {
        var session = res.data && res.data.session;
        if (!session) return null;
        state.user = session.user;
        return fetchMyProfile().then(function (profile) {
          if (profile && profile.deleted_at) return logOut();
          state.profile = profile;
        });
      })
      .catch(function () {
        // A broken saved login: carry on signed out.
        state.user = null;
        state.profile = null;
      })
      .then(function () {
        // Back from a bank check: finish the payment instead of showing the event.
        if (finishReturnedPayment()) return;
        // Opening the page mid-sign-in (e.g. a refresh on #code) starts that step again if it can.
        var step = window.location.hash.replace("#", "");
        if (step === "name" && state.user && !state.profile) return goStep("name", true);
        if (step) history.replaceState({ step: null }, "", window.location.pathname + window.location.search);
        load();
      });
  }

  start();
})();

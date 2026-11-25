/*
 * LetsPlay default event banners: each sport's playing surface seen from above, in the sport's
 * colour. Used by event.js when an event has no
 * photo (and underneath a photo, in case it fails to load).
 *
 * The drawing part is generated from the app's mobile/lib/utils/sportSurfaces.ts so the website
 * and the app show the same banners. To regenerate it after changing that file, run in mobile/:
 *   npx esbuild@0.24.0 lib/utils/sportSurfaces.ts --bundle --format=iife  *     --global-name=LetsPlaySportSurfacesCore --target=es2017
 * and replace the generated block below.
 */

/* ---------- generated from mobile/lib/utils/sportSurfaces.ts (do not edit by hand) ---------- */
"use strict";
var LetsPlaySportSurfacesCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/utils/sportSurfaces.ts
  var sportSurfaces_exports = {};
  __export(sportSurfaces_exports, {
    SURFACE_HEIGHT: () => SURFACE_HEIGHT,
    SURFACE_WIDTH: () => SURFACE_WIDTH,
    sportSurfaceXml: () => sportSurfaceXml
  });
  var SURFACE_WIDTH = 360;
  var SURFACE_HEIGHT = 170;
  function channels(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  function mix(a, b, t) {
    const x = channels(a);
    const y = channels(b);
    return "#" + x.map((v, i) => Math.round(Math.max(0, Math.min(255, v + (y[i] - v) * t))).toString(16).padStart(2, "0")).join("");
  }
  var dk = (c, t) => mix(c, "#000000", t);
  var lt = (c, t) => mix(c, "#FFFFFF", t);
  var L = (o = 0.55, w = 2) => `stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" fill="none"`;
  var S = (col, o = 0.85, w = 2) => `stroke="${col}" stroke-opacity="${o}" stroke-width="${w}" fill="none"`;
  var mirror = (m) => `${m}<g transform="translate(360 0) scale(-1 1)">${m}</g>`;
  var grad = (c, a, b) => `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dk(c, a)}"/><stop offset="1" stop-color="${dk(c, b)}"/></linearGradient></defs><rect width="360" height="170" fill="url(#bg)"/>`;
  var stripes = (w, o = 0.055) => {
    let s = "";
    for (let x = 0; x < 360; x += w * 2) s += `<rect x="${x + w}" y="0" width="${w}" height="170" fill="#fff" fill-opacity="${o}"/>`;
    return s;
  };
  var outside = (d, col, o) => `<path d="M0 0H360V170H0Z ${d}" fill="${col}" fill-opacity="${o}" fill-rule="evenodd"/>`;
  var stadium = (x, y, w, h) => {
    const r = h / 2;
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  };
  var SURFACES = {
    basketball: (c) => {
      let planks = "";
      for (let x = 0; x < 360; x += 9) {
        planks += `<line x1="${x}" y1="0" x2="${x}" y2="170" stroke="#000" stroke-opacity=".08" stroke-width="1"/><line x1="${x}" y1="${x * 7 % 170}" x2="${x + 9}" y2="${x * 7 % 170}" stroke="#000" stroke-opacity=".07" stroke-width="1"/>`;
      }
      const end = `<rect x="14" y="60" width="64" height="50" fill="#000" fill-opacity=".16"/><rect x="14" y="60" width="64" height="50" ${L()}/>
      <path d="M78 60A25 25 0 0 1 78 110" ${L()}/><path d="M78 60A25 25 0 0 0 78 110" ${L(0.45)} stroke-dasharray="4 4"/>
      <path d="M14 22H56A70 70 0 0 1 56 148H14" ${L()}/>
      <line x1="20" y1="75" x2="20" y2="95" ${L(0.9, 3)}/><circle cx="26" cy="85" r="4.5" ${S("#FB923C", 1, 2)}/>`;
      return `${grad(c, 0.02, 0.28)}${planks}<rect x="14" y="12" width="332" height="146" ${L()}/>
      <line x1="180" y1="12" x2="180" y2="158" ${L()}/><circle cx="180" cy="85" r="22" ${L()}/>${mirror(end)}`;
    },
    soccer: (c) => {
      const end = `<rect x="14" y="40" width="52" height="90" ${L()}/><rect x="14" y="64" width="18" height="42" ${L()}/>
      <circle cx="50" cy="85" r="1.8" fill="#fff" fill-opacity=".7"/><path d="M66 58.5A30 30 0 0 1 66 111.5" ${L()}/>
      <rect x="8" y="75" width="6" height="20" ${L(0.7, 1.5)}/><path d="M14 18A6 6 0 0 0 20 12M14 152A6 6 0 0 1 20 158" ${L()}/>`;
      return `${grad(c, 0.02, 0.3)}${stripes(30)}<rect x="14" y="12" width="332" height="146" ${L()}/>
      <line x1="180" y1="12" x2="180" y2="158" ${L()}/><circle cx="180" cy="85" r="28" ${L()}/><circle cx="180" cy="85" r="2" fill="#fff" fill-opacity=".7"/>${mirror(end)}`;
    },
    swimming: (c) => {
      const lane = 170 / 6;
      let s = "";
      for (let k = 0; k < 6; k++) {
        const y = lane * k + lane / 2;
        s += `<line x1="38" y1="${y}" x2="322" y2="${y}" stroke="${dk(c, 0.55)}" stroke-opacity=".45" stroke-width="4"/>
        <line x1="38" y1="${y - 7}" x2="38" y2="${y + 7}" stroke="${dk(c, 0.55)}" stroke-opacity=".45" stroke-width="4"/>
        <line x1="322" y1="${y - 7}" x2="322" y2="${y + 7}" stroke="${dk(c, 0.55)}" stroke-opacity=".45" stroke-width="4"/>`;
      }
      for (let k = 1; k < 6; k++) {
        const y = lane * k;
        s += `<line x1="8" y1="${y}" x2="352" y2="${y}" stroke="#fff" stroke-opacity=".75" stroke-width="3.5" stroke-dasharray="5 4"/>
        <line x1="8" y1="${y}" x2="352" y2="${y}" stroke="${lt(c, 0.3)}" stroke-opacity=".9" stroke-width="3.5" stroke-dasharray="5 4" stroke-dashoffset="4.5"/>`;
      }
      const ripples = [[90, 40], [230, 68], [150, 124], [290, 150]].map(([x, y]) => `<path d="M${x} ${y}q8 -4 16 0t16 0" ${L(0.22, 1.5)}/>`).join("");
      return `${grad(lt(c, 0.05), 0, 0.3)}${s}${ripples}
      <line x1="62" y1="0" x2="62" y2="170" ${L(0.3, 1)} stroke-dasharray="2 5"/><line x1="298" y1="0" x2="298" y2="170" ${L(0.3, 1)} stroke-dasharray="2 5"/>
      <rect x="0" y="0" width="8" height="170" fill="#fff" fill-opacity=".35"/><rect x="352" y="0" width="8" height="170" fill="#fff" fill-opacity=".35"/>`;
    },
    tennis: (c) => {
      const end = `<line x1="104" y1="36" x2="104" y2="134" ${L()}/><line x1="104" y1="85" x2="180" y2="85" ${L()}/><line x1="39" y1="85" x2="45" y2="85" ${L()}/>`;
      return `${grad(c, 0.3, 0.5)}<rect x="39" y="20" width="282" height="130" fill="${c}"/>
      <rect x="39" y="20" width="282" height="130" ${L(0.75)}/><line x1="39" y1="36" x2="321" y2="36" ${L(0.75)}/><line x1="39" y1="134" x2="321" y2="134" ${L(0.75)}/>
      ${mirror(end)}
      <line x1="180" y1="12" x2="180" y2="158" ${L(0.95, 3)}/><circle cx="180" cy="12" r="2.5" fill="#fff"/><circle cx="180" cy="158" r="2.5" fill="#fff"/>`;
    },
    volleyball: (c) => `${grad(c, 0.3, 0.5)}<rect x="50" y="20" width="260" height="130" fill="${c}"/><rect x="137" y="20" width="86" height="130" fill="#fff" fill-opacity=".1"/>
      <rect x="50" y="20" width="260" height="130" ${L(0.8)}/><line x1="137" y1="20" x2="137" y2="150" ${L(0.8)}/><line x1="223" y1="20" x2="223" y2="150" ${L(0.8)}/>
      <line x1="180" y1="10" x2="180" y2="160" ${L(0.95, 3)}/><circle cx="180" cy="10" r="3" fill="#fff"/><circle cx="180" cy="160" r="3" fill="#fff"/>`,
    running: (c) => {
      let lanes = "";
      for (let i = 0; i <= 6; i++) {
        const n = i * 9;
        lanes += `<path d="${stadium(20 + n, 10 + n, 320 - 2 * n, 150 - 2 * n)}" ${L(i === 0 || i === 6 ? 0.75 : 0.5, 1.3)}/>`;
      }
      return `<rect width="360" height="170" fill="${dk(c, 0.4)}"/><path d="${stadium(20, 10, 320, 150)}" fill="${c}"/>
      <path d="${stadium(74, 64, 212, 42)}" fill="${dk(c, 0.45)}"/><path d="${stadium(74, 64, 212, 42)}" fill="#fff" fill-opacity=".04"/>${lanes}
      <line x1="232" y1="106" x2="232" y2="160" stroke="#fff" stroke-width="3"/><line x1="128" y1="10" x2="128" y2="64" ${L(0.6, 1.5)}/>`;
    },
    golf: (c) => {
      let mow = "";
      for (let k = -6; k < 14; k++) {
        mow += `<rect x="${k * 36}" y="-60" width="18" height="300" fill="#fff" fill-opacity=".05" transform="rotate(25 180 85)"/>`;
      }
      const green = "M128 92C126 52 188 34 240 44C292 54 304 102 272 128C240 152 158 148 138 122C131 112 129 102 128 92Z";
      return `${grad(c, 0.05, 0.32)}${mow}
      <path d="${green}" fill="${lt(c, 0.22)}" stroke="${lt(c, 0.4)}" stroke-width="7" stroke-opacity=".55"/>
      <path d="M62 122C52 100 86 90 102 104C116 116 108 142 86 142C72 142 66 132 62 122Z" fill="#EADFB8"/>
      <path d="M296 30C312 22 336 30 334 46C332 60 310 62 300 54C292 48 288 36 296 30Z" fill="#EADFB8"/>
      <ellipse cx="229" cy="94" rx="10" ry="3" fill="#000" fill-opacity=".15"/>
      <circle cx="224" cy="92" r="3.5" fill="#0B2227"/><line x1="224" y1="92" x2="224" y2="48" stroke="#fff" stroke-width="2"/>
      <path d="M224 48L250 55L224 62Z" fill="#fff"/>`;
    },
    hockey: (c) => {
      const red = "#DC2626";
      const blue = "#2563EB";
      const end = `<line x1="40" y1="16" x2="40" y2="154" ${S(red, 0.8, 1.5)}/>
      <path d="M40 76A10 10 0 0 1 40 94Z" fill="#93C5FD" fill-opacity=".8" stroke="${red}" stroke-opacity=".8" stroke-width="1"/><rect x="32" y="79" width="8" height="12" ${S(red, 0.9, 1.5)}/>
      <circle cx="82" cy="48" r="19" ${S(red, 0.8, 1.5)}/><circle cx="82" cy="48" r="2.5" fill="${red}"/>
      <circle cx="82" cy="122" r="19" ${S(red, 0.8, 1.5)}/><circle cx="82" cy="122" r="2.5" fill="${red}"/>
      <circle cx="132" cy="48" r="2.5" fill="${red}"/><circle cx="132" cy="122" r="2.5" fill="${red}"/>
      <line x1="122" y1="12" x2="122" y2="158" ${S(blue, 0.8, 4)}/>`;
      return `<rect width="360" height="170" fill="${dk(c, 0.45)}"/>
      <rect x="14" y="12" width="332" height="146" rx="42" fill="${lt(c, 0.78)}"/>${mirror(end)}
      <line x1="180" y1="12" x2="180" y2="158" ${S(red, 0.85, 4)}/><circle cx="180" cy="85" r="21" ${S(blue, 0.85, 1.5)}/><circle cx="180" cy="85" r="2.5" fill="${blue}"/>
      <rect x="14" y="12" width="332" height="146" rx="42" ${S(dk(c, 0.2), 1, 4)}/>`;
    },
    padel: (c) => {
      const end = `<line x1="90" y1="20" x2="90" y2="150" ${L(0.75)}/><line x1="90" y1="85" x2="180" y2="85" ${L(0.75)}/>
      <path d="M58 20H50V150H58M50 20V30M50 140V150" ${L(0.45, 6)}/><path d="M50 20H96M50 150H96" ${L(0.45, 6)}/>`;
      return `${grad(c, 0.3, 0.5)}<rect x="50" y="20" width="260" height="130" fill="${c}"/>${mirror(end)}
      <rect x="50" y="20" width="260" height="130" ${L(0.3, 1)}/>
      <line x1="180" y1="14" x2="180" y2="156" ${L(0.95, 3)}/>`;
    },
    pickleball: (c) => {
      const end = `<line x1="48" y1="85" x2="138" y2="85" ${L(0.8)}/><line x1="138" y1="25" x2="138" y2="145" ${L(0.8)}/>`;
      return `${grad(c, 0.3, 0.5)}<rect x="48" y="25" width="264" height="120" fill="${c}"/><rect x="138" y="25" width="84" height="120" fill="#fff" fill-opacity=".14"/>
      <rect x="48" y="25" width="264" height="120" ${L(0.8)}/>${mirror(end)}
      <line x1="180" y1="16" x2="180" y2="154" ${L(0.95, 3)}/><circle cx="180" cy="16" r="2.5" fill="#fff"/><circle cx="180" cy="154" r="2.5" fill="#fff"/>`;
    },
    football: (c) => {
      let lines = "";
      let ticks = "";
      for (let k = 0; k <= 20; k++) {
        const x = 38 + k * 14.2;
        lines += `<line x1="${x}" y1="10" x2="${x}" y2="160" ${L(k % 10 === 0 ? 0.8 : 0.45, k === 0 || k === 20 ? 3 : 1.5)}/>`;
      }
      for (let k = 1; k < 100; k++) {
        const x = 38 + k * 2.84;
        if (k % 5) ticks += `<line x1="${x}" y1="66" x2="${x}" y2="71" ${L(0.45, 1)}/><line x1="${x}" y1="99" x2="${x}" y2="104" ${L(0.45, 1)}/>`;
      }
      return `<rect width="360" height="170" fill="${dk(c, 0.4)}"/><rect x="10" y="10" width="340" height="150" fill="${c}"/>${stripes(14.2, 0.04)}
      <rect x="10" y="10" width="28" height="150" fill="#000" fill-opacity=".2"/><rect x="322" y="10" width="28" height="150" fill="#000" fill-opacity=".2"/>
      ${lines}${ticks}<rect x="10" y="10" width="340" height="150" ${L(0.8)}/>
      <line x1="10" y1="76" x2="10" y2="94" stroke="#FACC15" stroke-width="4"/><line x1="350" y1="76" x2="350" y2="94" stroke="#FACC15" stroke-width="4"/>`;
    },
    baseball: (c) => {
      const dirt = "#D6A577";
      const base = (x, y) => `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" fill="#fff" transform="rotate(45 ${x} ${y})"/>`;
      let mow = "";
      for (let k = 0; k < 12; k++) {
        mow += `<circle cx="180" cy="158" r="${40 + k * 24}" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="12"/>`;
      }
      return `${grad(c, 0.15, 0.4)}${mow}
      <path d="M46 24A190 190 0 0 1 314 24" fill="none" stroke="${dk(c, 0.55)}" stroke-width="8"/>
      <path d="M180 158L99 77A115 115 0 0 1 261 77Z" fill="${dirt}"/>
      <path d="M180 146L222 106L180 66L138 106Z" fill="${dk(c, 0.15)}"/>
      <line x1="180" y1="158" x2="20" y2="-2" ${L(0.85, 1.5)}/><line x1="180" y1="158" x2="340" y2="-2" ${L(0.85, 1.5)}/>
      <circle cx="180" cy="110" r="8" fill="${dirt}"/><rect x="176" y="109" width="8" height="2" fill="#fff"/>
      <circle cx="180" cy="158" r="13" fill="${dirt}"/>${base(230, 108)}${base(180, 58)}${base(130, 108)}
      <path d="M176 154H184V158L180 162L176 158Z" fill="#fff"/>`;
    },
    table_tennis: (c) => `<rect width="360" height="170" fill="${dk(c, 0.55)}"/>${stripes(20, 0.03)}
      <rect x="87" y="38" width="198" height="110" rx="3" fill="#000" fill-opacity=".3"/>
      <rect x="81" y="30" width="198" height="110" rx="3" fill="${c}"/>
      <rect x="83" y="32" width="194" height="106" ${L(0.95, 3)}/><line x1="83" y1="85" x2="277" y2="85" ${L(0.85, 1.5)}/>
      <line x1="180" y1="22" x2="180" y2="148" stroke="#fff" stroke-width="3.5"/>
      <rect x="177" y="19" width="6" height="6" fill="${dk(c, 0.6)}"/><rect x="177" y="145" width="6" height="6" fill="${dk(c, 0.6)}"/>`,
    cricket: (c) => {
      const oval = "M12 85A168 78 0 1 0 348 85A168 78 0 1 0 12 85Z";
      const stumps = (x) => [80, 85, 90].map((y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join("");
      return `${grad(c, 0.05, 0.32)}${stripes(24)}${outside(oval, dk(c, 0.6), 0.7)}
      <path d="${oval}" ${L(0.8, 2.5)}/><ellipse cx="180" cy="85" rx="104" ry="54" ${L(0.5, 1.5)} stroke-dasharray="5 5"/>
      <rect x="136" y="77" width="88" height="16" fill="#E2CF9E"/>
      <line x1="146" y1="71" x2="146" y2="99" ${L(0.95, 1.5)}/><line x1="214" y1="71" x2="214" y2="99" ${L(0.95, 1.5)}/>
      <line x1="141" y1="77" x2="141" y2="93" ${L(0.95, 1.2)}/><line x1="219" y1="77" x2="219" y2="93" ${L(0.95, 1.2)}/>
      ${stumps(141)}${stumps(219)}`;
    },
    badminton: (c) => {
      const end = `<line x1="44" y1="85" x2="140" y2="85" ${L(0.8)}/><line x1="140" y1="23" x2="140" y2="147" ${L(0.8)}/><line x1="59" y1="23" x2="59" y2="147" ${L(0.8)}/>`;
      return `${grad(c, 0.3, 0.5)}<rect x="44" y="23" width="272" height="124" fill="${c}"/>
      <rect x="44" y="23" width="272" height="124" ${L(0.8)}/><line x1="44" y1="32" x2="316" y2="32" ${L(0.8)}/><line x1="44" y1="138" x2="316" y2="138" ${L(0.8)}/>${mirror(end)}
      <line x1="180" y1="14" x2="180" y2="156" ${L(0.95, 3)}/><circle cx="180" cy="14" r="2.5" fill="#fff"/><circle cx="180" cy="156" r="2.5" fill="#fff"/>`;
    },
    squash: (c) => {
      const red = "#EF4444";
      let planks = "";
      for (let y = 6; y < 164; y += 8) planks += `<line x1="60" y1="${y}" x2="300" y2="${y}" stroke="#000" stroke-opacity=".07" stroke-width="1"/>`;
      return `<rect width="360" height="170" fill="${dk(c, 0.5)}"/><rect x="60" y="6" width="240" height="158" fill="${lt(c, 0.12)}"/>${planks}
      <rect x="50" y="6" width="10" height="158" fill="#fff" fill-opacity=".45"/><line x1="60" y1="6" x2="60" y2="164" ${S(red, 0.9, 3)}/>
      <rect x="60" y="2" width="240" height="4" fill="#fff" fill-opacity=".3"/><rect x="60" y="164" width="240" height="4" fill="#fff" fill-opacity=".3"/>
      <rect x="300" y="2" width="5" height="166" fill="#fff" fill-opacity=".6"/>
      <line x1="194" y1="6" x2="194" y2="164" ${S(red, 0.9, 2)}/><line x1="194" y1="85" x2="300" y2="85" ${S(red, 0.9, 2)}/>
      <rect x="194" y="6" width="39" height="39" ${S(red, 0.9, 2)}/><rect x="194" y="125" width="39" height="39" ${S(red, 0.9, 2)}/>`;
    },
    cycling: (c) => `<rect width="360" height="170" fill="${dk(c, 0.5)}"/>
      <path d="${stadium(14, 8, 332, 154)}" fill="${lt(c, 0.18)}"/>
      <path d="${stadium(14, 8, 332, 154)}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="16"/>
      <path d="${stadium(32, 26, 296, 118)}" ${S("#2563EB", 0.85, 1.8)}/>
      <path d="${stadium(46, 40, 268, 90)}" ${S("#DC2626", 0.9, 1.8)}/>
      <path d="${stadium(51, 45, 258, 80)}" ${S("#0B2227", 0.8, 1.5)}/>
      <path d="${stadium(56, 50, 248, 70)}" fill="#7DD3FC" fill-opacity=".75"/>
      <path d="${stadium(68, 62, 224, 46)}" fill="${dk(c, 0.3)}"/>
      <rect x="236" y="120" width="4" height="42" fill="#fff"/><line x1="238" y1="120" x2="238" y2="162" stroke="#0B2227" stroke-width="1.5"/>`
  };
  var genericSurface = (c) => `${grad(c, 0.02, 0.32)}${stripes(30)}`;
  function sportSurfaceXml(sport, sportColor) {
    var _a;
    const draw = (_a = SURFACES[sport == null ? void 0 : sport.toLowerCase()]) != null ? _a : genericSurface;
    const color = sportColor.slice(0, 7);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SURFACE_WIDTH} ${SURFACE_HEIGHT}" preserveAspectRatio="xMidYMid slice">${draw(color)}</svg>`;
  }
  return __toCommonJS(sportSurfaces_exports);
})();
/* ---------- end of generated block ---------- */

(function () {
  "use strict";

  var core = window.LetsPlaySportSurfacesCore;

  /**
   * Returns the banner artwork for a sport as an <svg> element. The markup is built only from the
   * constants in this file (the sport name is used as a lookup key, never written into it), and
   * parsed with DOMParser rather than innerHTML.
   */
  function svg(sport, color) {
    var key = String(sport || "").toLowerCase();
    var markup = core.sportSurfaceXml(key, color);
    var doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    var el = document.importNode(doc.documentElement, true);
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("focusable", "false");
    return el;
  }

  window.LetsPlaySportSurfaces = { svg: svg };
})();

/* Flo og Fjære — den levende sjøen på nettsiden.
 *
 * Samme oppskrift som appen (MASTER § 7): himmelen følger sola gjennom
 * de fire palettene (natt, gry, dag, skumring), sjøen er tre summerte
 * sinusbølger med energi fra strømmen, skumkant, kaustikk og lysstripe
 * fra sol eller måne. Månen har riktig fase, stjernene blinker. Alt
 * tegnes i ett lerret, bare mens det er på skjermen, og står stille
 * under «Reduser bevegelse».
 */
(function () {
  'use strict';

  // ---------- Palettene (App/Visual/Palette.swift) ----------
  function hex(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lag(p) {
    var o = {};
    for (var k in p) o[k] = hex(p[k]);
    return o;
  }
  var PAL = {
    natt: lag({ skyTop: '#03121F', skyBottom: '#061A2B', shallow: '#0C3350', deep: '#020F1C', crest: '#9FCADB', horizon: '#1E4258', accent: '#8FD8FF' }),
    gry: lag({ skyTop: '#1B2A4A', skyBottom: '#4A3B52', shallow: '#2B5170', deep: '#0A1D33', crest: '#D8C2C6', horizon: '#8A6A78', accent: '#FFC9A3' }),
    dag: lag({ skyTop: '#0F4C75', skyBottom: '#1B6FA8', shallow: '#2E8FC4', deep: '#062A47', crest: '#DDF1FA', horizon: '#7FB8D9', accent: '#DCF4FF' }),
    skumring: lag({ skyTop: '#3B2A45', skyBottom: '#8A4A3C', shallow: '#2F5E7E', deep: '#08192C', crest: '#E8C8B4', horizon: '#B86F52', accent: '#FFD9BE' })
  };
  var SOL = hex('#FFD25E');
  var MAANE = hex('#F2EAD3');

  function blandFarge(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function blandPalett(a, b, t) {
    var o = {};
    for (var k in a) o[k] = blandFarge(a[k], b[k], t);
    return o;
  }
  function jevn(x) {
    var t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';
  }

  /* Palette.forSun: overgangene ligger mellom −6° og 4°; stigende sol
   * gir gry, synkende skumring. */
  function palettFor(hoyde, stigende) {
    var skumring = stigende ? PAL.gry : PAL.skumring;
    if (hoyde <= -6) return PAL.natt;
    if (hoyde >= 4) return PAL.dag;
    if (hoyde < -1) return blandPalett(PAL.natt, skumring, jevn((hoyde + 6) / 5));
    return blandPalett(skumring, PAL.dag, jevn((hoyde + 1) / 5));
  }

  // ---------- Et forenklet døgn og tidevann ----------
  /* Solhøyde i grader for et klokkeslett: topp 34° kl. 13, soloppgang
   * omtrent 06:30, solnedgang 19:30 — en norsk vårdag. */
  function solhoyde(time) {
    return 30 * Math.cos(2 * Math.PI * (time - 13) / 24) + 4;
  }
  function solStiger(time) {
    var t = ((time % 24) + 24) % 24;
    return t > 1 && t < 13;
  }
  /* Tidevannet: én halvdaglig bølge (M2, 12 t 25 min) med litt S2 for
   * liv — nok til at tallet, retningen og neste snu er troverdige. */
  var PERIODE = 12.42;
  function nivaa(time) {
    return 0.5 + 0.5 * Math.cos(2 * Math.PI * (time - 2.6) / PERIODE);
  }
  function stiger(time) {
    return Math.sin(2 * Math.PI * (time - 2.6) / PERIODE) < 0;
  }
  function energi(time) {
    return 0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * (time - 2.6) / PERIODE));
  }
  /* Neste høyvann eller lavvann etter et klokkeslett. */
  function nesteSnu(time) {
    var fase = ((time - 2.6) / PERIODE) % 1;
    if (fase < 0) fase += 1;
    var tilHoy = (1 - fase) * PERIODE;
    var tilLav = ((0.5 - fase + 1) % 1) * PERIODE;
    return tilHoy < tilLav ? { hoy: true, om: tilHoy } : { hoy: false, om: tilLav };
  }
  function klokke(time) {
    var t = ((time % 24) + 24) % 24;
    var t0 = Math.floor(t), m = Math.floor((t - t0) * 60);
    return (t0 < 10 ? '0' : '') + t0 + ':' + (m < 10 ? '0' : '') + m;
  }
  function cm(time, lav, hoy) {
    return Math.round(lav + (hoy - lav) * nivaa(time));
  }

  // ---------- Hjelpere ----------
  function hash(x) {
    var v = Math.sin(x) * 43758.5453;
    return v - Math.floor(v);
  }
  var STJERNER = [];
  for (var i = 0; i < 70; i++) {
    STJERNER.push([hash(i * 12.9898), hash(i * 78.233), hash(i * 37.719)]);
  }
  var redusert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Tegningen ----------
  /* s: { palett, nivaa (0–1), energi, tid (s), hoyde (solhøyde),
   *      time (klokkeslett), maaneAlder (døgn), topp, bunn (andeler
   *      av høyden for vannflaten ved høyvann og lavvann), detalj } */
  function tegn(ctx, w, h, s) {
    var p = s.palett, t = s.tid, d = s.dpr || 1;
    var natt = Math.min(1, Math.max(0, (-s.hoyde - 2) / 6));

    // Himmel.
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(p.skyTop));
    g.addColorStop(1, rgba(p.skyBottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var flate = h * (s.bunn - (s.bunn - s.topp) * s.nivaa);

    // Sola: et mykt lys, aldri en hard skive — tekst står i himmelen.
    var solAndel = Math.min(1, Math.max(0, (s.hoyde + 6) / 6));
    var tt = ((s.time % 24) + 24) % 24;
    var solX = w * (0.5 + 0.42 * Math.sin(Math.PI * (tt - 13) / 12));
    var solY = flate - Math.min(1, Math.max(0, s.hoyde / 40)) * (flate - h * 0.08) - h * 0.02;
    if (solAndel > 0.01) {
      var lav = 1 - Math.min(1, Math.max(0, s.hoyde / 25));
      var farge = blandFarge(SOL, p.horizon, lav * 0.8);
      var r = Math.max(w, h) * (0.22 + 0.14 * lav);
      var pust = 0.85 + 0.15 * Math.sin(t * 2 * Math.PI / 6.5);
      var sg = ctx.createRadialGradient(solX, solY, 0, solX, solY, r);
      sg.addColorStop(0, rgba(farge, 0.36 * solAndel * pust));
      sg.addColorStop(1, rgba(farge, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
    }

    // Stjerner og måne.
    var maaneX = w * (s.maaneX || 0.82), maaneY = h * (s.maaneY || 0.2);
    if (natt > 0.01) {
      var antall = s.detalj === 'lett' ? 34 : 70;
      for (var i = 0; i < antall; i++) {
        var st = STJERNER[i];
        var sy = flate * 0.82 * st[1];
        if (sy > flate - 20 * d) continue;
        var blink = redusert ? 0.8 : 0.55 + 0.45 * Math.sin(t * (1.1 + st[2]) + i);
        var rr = (0.6 + 0.8 * st[2]) * d;
        ctx.fillStyle = rgba(p.crest, natt * blink * 0.85);
        ctx.beginPath();
        ctx.arc(w * st[0], sy, rr, 0, 6.2832);
        ctx.fill();
      }
      tegnMaane(ctx, maaneX, maaneY, Math.min(w, h) * 0.035 + 6 * d, s.maaneAlder || 10, natt, p);
    }

    // Horisontdis like over vannkanten.
    var dis = 0.42 + 0.12 * Math.sin(t * 2 * Math.PI / 5.5 + 0.7);
    var dy = flate - 14 * d;
    var dg = ctx.createLinearGradient(0, dy - 22 * d, 0, dy + 22 * d);
    dg.addColorStop(0, rgba(p.horizon, 0));
    dg.addColorStop(0.5, rgba(p.horizon, dis));
    dg.addColorStop(1, rgba(p.horizon, 0));
    ctx.fillStyle = dg;
    ctx.fillRect(0, dy - 22 * d, w, 44 * d);

    tegnVann(ctx, w, h, flate, s, solAndel, solX, natt, maaneX);
  }

  function tegnMaane(ctx, cx, cy, r, alder, andel, p) {
    var phi = 2 * Math.PI * alder / 29.530588853;
    var cosPhi = Math.cos(phi);
    var vokser = alder < 29.530588853 / 2;
    var morkt = blandFarge(p.skyTop, MAANE, 0.16);
    ctx.save();
    ctx.globalAlpha = andel;
    var gl = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 3.4);
    gl.addColorStop(0, rgba(MAANE, 0.16));
    gl.addColorStop(1, rgba(MAANE, 0));
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = rgba(morkt);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.992, 0, 6.2832); ctx.fill();
    // Den lyse delen som én sti: lem (høyre når månen vokser, sett fra
    // Norge) og terminatoren, en halvellipse med halvakse r·|cos φ|.
    // Én sti gir ingen søm midt på skiva.
    var rx = Math.max(0.01, r * Math.abs(cosPhi)), halv = Math.PI / 2, sigd = cosPhi > 0;
    ctx.fillStyle = rgba(MAANE);
    ctx.beginPath();
    if (vokser) {
      ctx.arc(cx, cy, r, -halv, halv, false);
      if (sigd) ctx.ellipse(cx, cy, rx, r, 0, halv, -halv, true);
      else ctx.ellipse(cx, cy, rx, r, 0, halv, 3 * halv, false);
    } else {
      ctx.arc(cx, cy, r, halv, 3 * halv, false);
      if (sigd) ctx.ellipse(cx, cy, rx, r, 0, 3 * halv, halv, true);
      else ctx.ellipse(cx, cy, rx, r, 0, -halv, halv, false);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function bolge(x, t, e, w, amp) {
    // Shaders.metal: 21/14/8 pt på ~680/385/200 pt bølgelengde,
    // skalert til lerretets bredde.
    var k = 1 / Math.max(w, 320);
    var v = 21 * Math.sin(x * 6.25 * k + t * 1.45)
          + 14 * Math.sin(x * 11.1 * k - t * 1.02)
          + 8 * Math.sin(x * 21.2 * k + t * 2.3);
    return v * e * amp;
  }

  function tegnVann(ctx, w, h, flate, s, solAndel, solX, natt, maaneX) {
    var p = s.palett, t = s.tid, e = s.energi, d = s.dpr || 1;
    var amp = (s.amp || 0.55) * d;
    var steg = Math.max(3, Math.round(w / 260));
    var x;

    // Bakerste lag, farget mot himmelen (luftperspektiv).
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (x = 0; x <= w + steg; x += steg) {
      ctx.lineTo(x, flate - 16 * d + bolge(x * 1.6 + 90, t * 0.6 + 4, e, w, amp * 0.45));
    }
    ctx.lineTo(w + steg, h);
    ctx.closePath();
    ctx.fillStyle = rgba(blandFarge(p.shallow, p.skyBottom, 0.45), 0.6);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (x = 0; x <= w + steg; x += steg) {
      ctx.lineTo(x, flate - 8 * d + bolge(x * 1.3 + 40, t * 0.85 + 2, e, w, amp * 0.7));
    }
    ctx.lineTo(w + steg, h);
    ctx.closePath();
    ctx.fillStyle = rgba(blandFarge(p.shallow, p.deep, 0.45), 0.75);
    ctx.fill();

    // Fremre lag med dybdegradient.
    var kam = [];
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (x = 0; x <= w + steg; x += steg) {
      var y = flate + bolge(x, t, e, w, amp);
      kam.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + steg, h);
    ctx.closePath();
    var vg = ctx.createLinearGradient(0, flate, 0, h);
    vg.addColorStop(0, rgba(p.shallow));
    vg.addColorStop(1, rgba(p.deep));
    ctx.fillStyle = vg;
    ctx.fill();

    // Inne i vannet: kaustikk og lysstripe.
    ctx.save();
    ctx.clip();
    if (s.detalj !== 'lett') {
      for (var k = 0; k < 3; k++) {
        var by = flate + (26 + k * 30) * d;
        ctx.beginPath();
        for (x = -10; x <= w + 10; x += 8 * d) {
          var yy = by + 7 * d * Math.sin(x / (32 * d) + t * (0.7 + 0.15 * k) + k * 2.1);
          if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = rgba(p.crest, 0.07 * (1 - k * 0.28));
        ctx.lineWidth = (9 - 2 * k) * d;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    if (solAndel > 0.01) glimt(ctx, w, h, flate, t, solX, p.crest, solAndel * 0.9, 0, d);
    if (natt > 0.01) glimt(ctx, w, h, flate, t, maaneX, MAANE, natt, 50, d);
    ctx.restore();

    // Skumkanten.
    ctx.beginPath();
    for (var j = 0; j < kam.length; j += 2) {
      if (j === 0) ctx.moveTo(kam[0], kam[1]); else ctx.lineTo(kam[j], kam[j + 1]);
    }
    ctx.strokeStyle = rgba(p.crest, 0.88);
    ctx.lineWidth = 2.2 * d;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Skum på toppene når strømmen er sterk.
    var skum = Math.max(0, (e - 0.45) / 0.55);
    if (skum > 0 && s.detalj !== 'lett') {
      for (var q = 2; q < kam.length - 2; q += 2) {
        if (kam[q + 1] < kam[q - 1] && kam[q + 1] <= kam[q + 3]) {
          var tw = 0.5 + 0.5 * Math.sin(t * 3.1 + q * 0.37);
          ctx.fillStyle = rgba(p.crest, 0.85 * skum * tw);
          ctx.beginPath();
          ctx.arc(kam[q], kam[q + 1] - d, (1 + skum * tw) * d, 0, 6.2832);
          ctx.fill();
        }
      }
    }
  }

  /* Lysstripen: sola eller månen speilet i vannet, brutt opp av bølgene. */
  function glimt(ctx, w, h, flate, t, x, farge, andel, frø, d) {
    var dybde = h - flate, rader = 16;
    for (var i = 0; i < rader; i++) {
      var f = i / rader;
      var y = flate + 6 * d + dybde * 0.8 * f;
      var spredning = (2 + 16 * f) * d;
      var jitter = (hash(frø + i * 5.3 + Math.floor(t * 2.5)) - 0.5) * spredning;
      var bredde = (5 + 14 * f) * d;
      var skimmer = 0.45 + 0.55 * Math.sin(t * 2.9 + i * 1.9 + frø);
      ctx.fillStyle = rgba(farge, andel * 0.42 * Math.pow(1 - f, 1.3) * skimmer);
      ctx.fillRect(x + jitter - bredde / 2, y, bredde, 1.6 * d);
    }
  }

  // ---------- Lerret som lever bare når det synes ----------
  /* modell(sekunder) → tilstand for tegn(); lerretet tegnes i full
   * oppløsning (høyst 2×, og aldri over ~3 millioner piksler). */
  function lerret(el, modell, opts) {
    opts = opts || {};
    var ctx = el.getContext('2d', { alpha: false });
    var synlig = true, aktiv = !document.hidden, ramme = null, start = performance.now();
    var dpr = 1, w = 0, h = 0;
    function mal() {
      var r = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var px = r.width * r.height * dpr * dpr;
      if (px > 3.2e6) dpr = Math.sqrt(3.2e6 / (r.width * r.height));
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    }
    function bilde(naa) {
      ramme = null;
      var sek = (naa - start) / 1000;
      var s = modell(redusert ? 0 : sek);
      s.dpr = dpr;
      s.tid = redusert ? 12 : sek;
      tegn(ctx, w, h, s);
      if (opts.etter) opts.etter(s);
      if (!redusert && synlig && aktiv) ramme = requestAnimationFrame(bilde);
    }
    function vekk() {
      if (ramme == null && synlig && aktiv) ramme = requestAnimationFrame(bilde);
    }
    mal();
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { mal(); if (redusert) bilde(performance.now()); }).observe(el);
    } else {
      window.addEventListener('resize', mal);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (p) {
        synlig = p[0].isIntersecting;
        if (synlig) vekk();
      }, { rootMargin: '80px' }).observe(el);
    }
    document.addEventListener('visibilitychange', function () {
      aktiv = !document.hidden;
      if (aktiv) vekk();
    });
    bilde(performance.now());
    return {
      tegnNaa: function () { if (redusert || ramme == null) bilde(performance.now()); },
      vekk: vekk
    };
  }

  // ---------- Avsløring ved scrolling ----------
  function avslor() {
    var el = document.querySelectorAll('[data-avsl]');
    if (redusert || !('IntersectionObserver' in window)) {
      el.forEach(function (e) { e.classList.add('vist'); });
      return;
    }
    var obs = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) {
        if (p.isIntersecting) { p.target.classList.add('vist'); obs.unobserve(p.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    el.forEach(function (e) { obs.observe(e); });
  }

  // ---------- Vannlinja i bunnteksten ----------
  function bunnlinje() {
    var svg = document.querySelector('.bunn-linje');
    if (!svg || redusert) return;
    var fyll = svg.querySelector('.fyll'), bak = svg.querySelector('.bak'), strek = svg.querySelector('.strek');
    var t0 = performance.now(), synlig = false, ramme = null;
    function linje(t, fase, skala, loft) {
      var d = '';
      for (var x = 0; x <= 1200; x += 20) {
        var y = 18 - loft + skala * (5 * Math.sin(x * 0.012 + t * 0.9 + fase) + 3 * Math.sin(x * 0.027 - t * 0.6 + fase * 1.7));
        d += (x ? ' L' : 'M') + x + ' ' + y.toFixed(2);
      }
      return d;
    }
    function f(naa) {
      var t = (naa - t0) / 1000, d = linje(t, 0, 1, 0);
      strek.setAttribute('d', d);
      fyll.setAttribute('d', d + ' L1200 36 L0 36 Z');
      bak.setAttribute('d', linje(t * 0.8, 2.1, 0.7, 4));
      ramme = synlig && !document.hidden ? requestAnimationFrame(f) : null;
    }
    f(t0);
    new IntersectionObserver(function (p) {
      synlig = p[0].isIntersecting;
      if (synlig && ramme == null) ramme = requestAnimationFrame(f);
    }).observe(svg);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && synlig && ramme == null) ramme = requestAnimationFrame(f);
    });
  }

  window.FloSjo = {
    PAL: PAL, palettFor: palettFor, solhoyde: solhoyde, solStiger: solStiger,
    nivaa: nivaa, stiger: stiger, energi: energi, nesteSnu: nesteSnu,
    klokke: klokke, cm: cm, tegn: tegn, lerret: lerret, rgba: rgba,
    tegnMaane: tegnMaane, redusert: redusert, PERIODE: PERIODE
  };

  document.addEventListener('DOMContentLoaded', function () {
    avslor();
    bunnlinje();
  });
})();

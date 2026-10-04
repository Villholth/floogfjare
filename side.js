/* Vilkår og personvern: sjøfeltet i toppen og innholdslista som viser
   hvor du er. Delt mellom de to sidene, så de alltid ser like ut. */
(function () {
  'use strict';
  var F = window.FloSjo;

  // Sjøfeltet: et rolig utsnitt av skumringen, som appens ikon.
  var lerret = document.querySelector('.side-hode canvas');
  if (lerret) {
    var overline = document.querySelector('.side-hode .overline'), sistAksent = null;
    var smal = window.matchMedia('(max-width: 719px)');
    // Lyset puster rundt solnedgang (appikonets farger) i stedet for å gå
    // mot natt: fra lav sol til like etter at den har gått ned, og tilbake.
    F.lerret(lerret, function (sek) {
      var time = 19.62 + 0.25 * Math.sin(sek / 40 - 1.2);
      var h = F.solhoyde(time);
      return {
        palett: F.palettFor(h, false), hoyde: h, time: time,
        nivaa: 0.5 + 0.5 * Math.sin(sek / 9), energi: 0.45, maaneAlder: 12.5,
        maaneX: smal.matches ? 0.84 : 0.8, maaneY: 0.24,
        topp: 0.7, bunn: 0.8, amp: smal.matches ? 0.4 : 0.6, detalj: 'lett'
      };
    }, {
      // Overlinja tar himmelens aksentfarge, som tittelen på forsiden.
      etter: function (s) {
        var a = 'rgb(' + s.palett.accent.map(Math.round).join(',') + ')';
        if (a !== sistAksent) { overline.style.color = a; sistAksent = a; }
      }
    });
  }

  // Innholdslista: markerer avsnittet du leser.
  var lenker = Array.prototype.slice.call(document.querySelectorAll('.innhold-liste a'));
  if (!lenker.length || !('IntersectionObserver' in window)) return;
  var avsnitt = lenker.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var synlige = new Set();
  var obs = new IntersectionObserver(function (poster) {
    poster.forEach(function (p) { if (p.isIntersecting) synlige.add(p.target); else synlige.delete(p.target); });
    var forst = avsnitt.find(function (s) { return synlige.has(s); });
    lenker.forEach(function (a, i) { a.setAttribute('aria-current', avsnitt[i] === forst ? 'true' : 'false'); });
  }, { rootMargin: '-20% 0px -55% 0px' });
  avsnitt.forEach(function (s) { if (s) obs.observe(s); });
})();

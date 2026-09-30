// Scroll progress rail, reveal-on-scroll, and one-shot stat counters.
(function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- scroll progress ---------------------------------------------------
  var fill = document.getElementById('progressFill');
  if (fill) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        fill.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // --- count-up ----------------------------------------------------------
  function countUp(el) {
    var to = parseFloat(el.dataset.to);
    var suffix = el.dataset.suffix || '';
    // Match the source precision so "70.0" does not render as "70".
    var decimals = (String(el.dataset.to).split('.')[1] || '').length;
    if (reduced) { el.textContent = to.toFixed(decimals) + suffix; return; }
    var dur = 1100, t0 = null;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // --- reveal ------------------------------------------------------------
  var items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    // No observer: show everything rather than leaving the page blank.
    Array.prototype.forEach.call(items, function (el) {
      el.classList.add('in');
      var n = el.querySelector('.num');
      if (n) countUp(n);
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('in');
      var n = el.querySelector('.num');
      if (n && !n.dataset.done) { n.dataset.done = '1'; countUp(n); }
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Stagger siblings so a grid animates in sequence rather than all at once.
  Array.prototype.forEach.call(items, function (el) {
    var sibs = el.parentElement ? el.parentElement.children : [];
    var i = Array.prototype.indexOf.call(sibs, el);
    el.style.transitionDelay = Math.min(i, 5) * 55 + 'ms';
    io.observe(el);
  });

  // --- closed-loop rows: cycle one replan at a time ----------------------
  document.querySelectorAll('.cl-row').forEach(function (row) {
    var rounds = row.querySelectorAll('.cl-round');
    var fill = row.querySelector('.cl-line-fill');
    var i = 0, timer = null;

    function tick() {
      rounds.forEach(function (r, k) { r.classList.toggle('on', k === i); });
      if (fill) fill.style.width = ((i + 0.5) / rounds.length) * 100 + '%';
      i = (i + 1) % rounds.length;
    }

    if (reduced) {
      rounds.forEach(function (r) { r.classList.add('on'); });
      if (fill) fill.style.width = '100%';
      return;
    }
    if (!('IntersectionObserver' in window)) { rounds.forEach(function (r) { r.classList.add('on'); }); return; }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        // Pause off-screen so four rows are not animating out of view.
        if (e.isIntersecting && !timer) { tick(); timer = setInterval(tick, 1250); }
        else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
      });
    }, { threshold: 0.2 });
    io.observe(row);
  });

  // --- progress scrubber --------------------------------------------------
  var scrub = document.querySelector('.scrub');
  if (scrub) {
    var range = scrub.querySelector('#scrubRange');
    var out = scrub.querySelector('#scrubVal');
    var cards = scrub.querySelectorAll('.scrub-card');
    var buttons = scrub.querySelectorAll('.scrub-toggle button');
    var R = ['0', '0.1', '0.3', '0.5', '0.7', '0.9'];
    var mode = 'gen';

    // Preload so dragging does not flash placeholder gaps.
    cards.forEach(function (c) {
      var k = c.dataset.key;
      ['g', 't'].forEach(function (m) {
        for (var j = 0; j < 5; j++) { var im = new Image(); im.src = 'static/em/' + k + '_' + m + j + '.jpg'; }
      });
    });

    function render() {
      var idx = parseInt(range.value, 10);
      out.textContent = 'r = ' + R[idx];
      cards.forEach(function (c) {
        var k = c.dataset.key;
        var img = c.querySelector('img');
        // index 0 is the shared first frame; 1..5 map to the five progress points
        img.src = idx === 0 ? 'static/em/' + k + '_f0.jpg'
                            : 'static/em/' + k + '_' + (mode === 'gen' ? 'g' : 't') + (idx - 1) + '.jpg';
        img.classList.toggle('gen', mode === 'gen');
      });
    }

    range.addEventListener('input', render);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        buttons.forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    render();
  }
})();
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
    var prefix = el.dataset.prefix || '';
    // Match the source precision so "70.0" does not render as "70".
    var decimals = (String(el.dataset.to).split('.')[1] || '').length;
    if (reduced) { el.textContent = prefix + to.toFixed(decimals) + suffix; return; }
    var dur = 1100, t0 = null;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (to * eased).toFixed(decimals) + suffix;
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

  // --- closed-loop rows: accumulate, hold, then restart -------------------
  document.querySelectorAll('.cl-row').forEach(function (row) {
    var rounds = row.querySelectorAll('.cl-round');
    var fill = row.querySelector('.cl-line-fill');
    var i = 0, timer = null;

    function tick() {
      if (i < rounds.length) {
        // A rollout happens in order and does not un-happen, so completed
        // rounds stay lit rather than dimming as the next one starts.
        rounds[i].classList.add('on');
        if (fill) fill.style.width = ((i + 1) / rounds.length) * 100 + '%';
        i++;
      } else {
        rounds.forEach(function (r) { r.classList.remove('on'); });
        if (fill) fill.style.width = '0%';
        i = 0;
      }
    }

    function lightAll() {
      rounds.forEach(function (r) { r.classList.add('on'); });
      if (fill) fill.style.width = '100%';
    }

    if (reduced || !('IntersectionObserver' in window)) { lightAll(); return; }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !timer) { tick(); timer = setInterval(tick, 1900); }
        else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
      });
    }, { threshold: 0.2 });
    io.observe(row);
  });

  // --- method figure: stagger the reveal, then let the pulse loop ---------
  var mf = document.querySelector('.mf');
  if (mf) {
    mf.querySelectorAll('.mf-goals figure').forEach(function (f, i) {
      f.style.setProperty('--d', (0.35 + i * 0.16) + 's');
    });
    mf.querySelectorAll('.mf-acts figure').forEach(function (f, i) {
      f.style.setProperty('--d', (1.05 + i * 0.1) + 's');
    });
    if (reduced || !('IntersectionObserver' in window)) {
      mf.classList.add('run');
    } else {
      var mio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { mf.classList.add('run'); mio.disconnect(); } });
      }, { threshold: 0.25 });
      mio.observe(mf);
    }
  }

  // --- sub-goal viewer: autoplays, yields to the slider, any K -----------
  document.querySelectorAll('.sgv').forEach(function (v) {
    var frames, rs;
    try {
      frames = JSON.parse(v.dataset.frames);
      rs = JSON.parse(v.dataset.r);
    } catch (e) { return; }
    if (!frames.length) return;

    var img = v.querySelector('.sgv-img');
    var cap = v.querySelector('.sgv-cap');
    var range = v.querySelector('.sgv-range');
    var val = v.querySelector('.sgv-val');
    var play = v.querySelector('.sgv-play');
    var timer = null;

    frames.forEach(function (src) { var im = new Image(); im.src = src; });
    range.max = frames.length - 1;

    function show(i) {
      img.src = frames[i];
      cap.innerHTML = 'imagine <b>r = ' + rs[i] + '</b>';
      val.textContent = (i + 1) + ' / ' + frames.length;
    }
    function start() {
      if (timer || reduced) return;
      play.classList.remove('paused');
      play.innerHTML = '&#10073;&#10073;';
      play.setAttribute('aria-label', 'pause');
      timer = setInterval(function () {
        range.value = (parseInt(range.value, 10) + 1) % frames.length;
        show(parseInt(range.value, 10));
      }, 1000);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      play.classList.add('paused');
      play.innerHTML = '&#9654;';
      play.setAttribute('aria-label', 'play');
    }

    // Grabbing the slider hands control over; the button gives it back.
    ['input', 'pointerdown'].forEach(function (ev) {
      range.addEventListener(ev, function () { stop(); show(parseInt(range.value, 10)); });
    });
    play.addEventListener('click', function () { timer ? stop() : start(); });

    show(0);
    if (reduced) { stop(); return; }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          // Only resume automatically if the reader has not taken over.
          if (e.isIntersecting && !play.classList.contains('paused')) start();
          else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
        });
      }, { threshold: 0.35 });
      io.observe(v);
    } else { start(); }
  });

  // --- progress scrubber: plays itself until you grab it -----------------
  var scrub = document.querySelector('.scrub');
  if (scrub) {
    var range = scrub.querySelector('#scrubRange');
    var out = scrub.querySelector('#scrubVal');
    var cards = scrub.querySelectorAll('.scrub-card');
    var buttons = scrub.querySelectorAll('.scrub-toggle button');
    var R = ['0', '0.1', '0.3', '0.5', '0.7', '0.9'];
    var mode = 'gen', auto = null;

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
        var k = c.dataset.key, img = c.querySelector('img');
        img.src = idx === 0 ? 'static/em/' + k + '_f0.jpg'
                            : 'static/em/' + k + '_' + (mode === 'gen' ? 'g' : 't') + (idx - 1) + '.jpg';
      });
    }

    function stopAuto() {
      if (auto) { clearInterval(auto); auto = null; }
      scrub.querySelector('[data-mode="auto"]').classList.remove('on');
    }
    function startAuto() {
      if (auto || reduced) return;
      scrub.querySelector('[data-mode="auto"]').classList.add('on');
      auto = setInterval(function () {
        range.value = (parseInt(range.value, 10) + 1) % R.length;
        render();
      }, 1100);
    }

    // Touching the slider hands control over; the auto chip takes it back.
    ['input', 'pointerdown'].forEach(function (ev) {
      range.addEventListener(ev, function () { stopAuto(); render(); });
    });
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mode === 'auto') { startAuto(); return; }
        mode = b.dataset.mode;
        buttons.forEach(function (x) {
          if (x.dataset.mode !== 'auto') x.classList.toggle('on', x === b);
        });
        render();
      });
    });

    render();
    if (!reduced && 'IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { startAuto(); } else { stopAuto(); } });
      }, { threshold: 0.3 });
      sio.observe(scrub);
    }
  }
})();
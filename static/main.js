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

  // --- closed-loop rollouts: sub-goals cycle, then the next replan --------
  document.querySelectorAll('.roll').forEach(function (c) {
    var reps = JSON.parse(c.dataset.reps), labels = JSON.parse(c.dataset.labels);
    var rs = c.dataset.r ? JSON.parse(c.dataset.r) : null;
    var ob = c.querySelector('.obs img'), im = c.querySelector('.img img');
    var ex = c.querySelector('.exec img'), cap = c.querySelector('.img b');
    var range = c.querySelector('.roll-range'), play = c.querySelector('.roll-play');
    var box = c.querySelector('.roll-reps');
    var K = reps[0].g.length, ri = 0, k = 0, timer = null;

    reps.forEach(function (r) { r.g.concat([r.ob]).forEach(function (s) { new Image().src = s; }); });
    range.disabled = K < 2;
    var btns = labels.map(function (l, i) {
      var b = document.createElement('button');
      b.textContent = l;
      b.setAttribute('aria-label', 'replan ' + l);
      b.addEventListener('click', function () { stop(); showRep(i); showK(0); });
      box.appendChild(b);
      return b;
    });

    function showRep(i) {
      ri = i; ob.src = reps[i].ob; ex.src = reps[i].ex;
      btns.forEach(function (b, j) { b.classList.toggle('on', j === i); });
    }
    function showK(j) {
      k = j; range.value = j; im.src = reps[ri].g[j];
      cap.textContent = rs ? 'r = ' + rs[j] : (K > 1 ? (j + 1) + '/' + K : '');
    }
    function tick() {
      if (k + 1 < K) showK(k + 1);
      else { showRep((ri + 1) % reps.length); showK(0); }
    }
    function start() {
      if (timer || reduced) return;
      play.classList.remove('paused'); play.innerHTML = '&#10073;&#10073;'; play.setAttribute('aria-label', 'pause');
      timer = setInterval(tick, K > 1 ? 950 : 2200);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      play.classList.add('paused'); play.innerHTML = '&#9654;'; play.setAttribute('aria-label', 'play');
    }

    ['input', 'pointerdown'].forEach(function (ev) {
      range.addEventListener(ev, function () { stop(); showK(parseInt(range.value, 10)); });
    });
    play.addEventListener('click', function () { timer ? stop() : start(); });

    showRep(0); showK(0);
    if (reduced) { stop(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          // Resume on its own only if the reader has not taken over.
          if (e.isIntersecting && !play.classList.contains('paused')) start();
          else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
        });
      }, { threshold: 0.3 }).observe(c);
    } else { start(); }
  });

  // --- stage switcher: light only the parts a stage touches ---------------
  var bar = document.querySelector('.stagebar');
  var arch = document.querySelector('.arch2');
  if (bar && arch) {
    var title = document.getElementById('stageTitle');
    var note = document.getElementById('stageNote');
    var STAGES = {
      '1': { off: ['a'], t: 'Video-only pretraining',
        n: 'Action-free videos only. The video expert learns visual dynamics and to predict the scene at any requested progress r. No action labels, no action expert.' },
      '2': { off: [], t: 'Joint fine-tuning',
        n: 'On robot demonstrations both experts train together. Action tokens attend to the observation and the sub-goals, so every action chunk is grounded in the plan.' },
      '3': { off: ['x'], t: 'Inference with sub-goal caching',
        n: 'No dense rollout. The video expert runs once on the observation and sub-goal slots; their key\u2013value features are cached and the action expert denoises all T steps against them \u2014 about 10\u00d7 fewer video-expert passes. A new observation refreshes the cache.' }
    };
    function apply(s) {
      var st = STAGES[s];
      arch.dataset.stage = s;
      arch.querySelectorAll('[data-role]').forEach(function (el) {
        el.classList.toggle('off', st.off.indexOf(el.dataset.role) > -1);
      });
      arch.querySelectorAll('.amask i').forEach(function (el) {
        el.classList.toggle('off', st.off.indexOf(el.dataset.q) > -1 || st.off.indexOf(el.dataset.k) > -1);
      });
      arch.querySelectorAll('[data-s]').forEach(function (el) {
        el.hidden = el.dataset.s.split(' ').indexOf(s) < 0;
      });
      title.textContent = st.t;
      note.textContent = st.n;
      bar.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.stage === s);
      });
    }
    bar.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { apply(b.dataset.stage); });
    });
    apply('1');
  }

  // --- page particles: drift left-to-right, blue into red ----------------
  var fx = document.querySelector('.page-fx');
  if (fx && !reduced) {
    var ctx = fx.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], raf = null;

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      fx.width = W * dpr; fx.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      // Scale with area so a wide screen is not sparse and a phone is not busy.
      var n = Math.round(Math.min(120, Math.max(38, (W * H) / 11000)));
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({ x: Math.random() * W, y: Math.random() * H,
                     r: Math.random() * 1.7 + 0.5,
                     v: Math.random() * 0.24 + 0.06,
                     a: Math.random() * 0.45 + 0.12,
                     ph: Math.random() * Math.PI * 2 });
      }
    }
    function draw(ts) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.v;
        p.y += Math.sin((ts / 2600) + p.ph) * 0.16;
        if (p.x > W + 6) { p.x = -6; p.y = Math.random() * H; }
        // Hue follows horizontal position: imagination on the left, action right.
        var f = p.x / W;
        var cr = Math.round(0 + f * 220), cg = Math.round(162 - f * 132), cb = Math.round(232 - f * 202);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + p.a + ')';
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    function go() { if (!raf) raf = requestAnimationFrame(draw); }

    size(); seed(); go();
    var rt; window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { size(); seed(); }, 150);
    });
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : go();
    });
  }

  // --- progress scrubber: plays itself until you grab it -----------------
  var scrub = document.querySelector('.scrub');
  if (scrub) {
    var range = scrub.querySelector('#scrubRange');
    var out = scrub.querySelector('#scrubVal');
    var cards = scrub.querySelectorAll('.scrub-card');
    var buttons = scrub.querySelectorAll('.scrub-toggle button');
    var R = ['0', '0.1', '0.3', '0.5', '0.7', '0.9'];
    var mode = 'gen', auto = null;
    var EM = function (s) { return (window.__EM && window.__EM[s]) || s; };

    cards.forEach(function (c) {
      var k = c.dataset.key;
      ['g', 't'].forEach(function (m) {
        for (var j = 0; j < 5; j++) { var im = new Image(); im.src = EM('static/em/' + k + '_' + m + j + '.jpg'); }
      });
    });

    function render() {
      var idx = parseInt(range.value, 10);
      out.textContent = 'r = ' + R[idx];
      cards.forEach(function (c) {
        var k = c.dataset.key, img = c.querySelector('img');
        img.src = EM(idx === 0 ? 'static/em/' + k + '_f0.jpg'
                               : 'static/em/' + k + '_' + (mode === 'gen' ? 'g' : 't') + (idx - 1) + '.jpg');
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
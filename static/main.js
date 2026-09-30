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
    var i = 0, hold = 0, timer = null;

    function tick() {
      if (i < rounds.length) {
        // A rollout happens in order and does not un-happen, so completed
        // rounds stay lit rather than dimming as the next one starts.
        rounds[i].classList.add('on');
        if (fill) fill.style.width = ((i + 1) / rounds.length) * 100 + '%';
        i++;
      } else {
        // Hold the completed sequence for a beat before clearing, otherwise the
        // rounds wipe the instant the last one lands.
        hold = (hold + 1) % 3;
        if (hold !== 0) return;
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
        if (e.isIntersecting && !timer) { tick(); timer = setInterval(tick, 3200); }
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

  // --- title: particles explode outward, then settle into "ProWAM" -------
  (function () {
    var h1 = document.getElementById('proTitle'), cv = document.getElementById('proFx');
    if (!h1 || !cv || reduced) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cs = getComputedStyle(h1);
    var fs = parseFloat(cs.fontSize);
    var probe = document.createElement('canvas').getContext('2d');
    probe.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
    var W = Math.ceil(probe.measureText('ProWAM').width) + 8;
    var H = Math.ceil(fs * 1.22);
    if (!W || !fs) return;

    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Stamp the word once, then read it back as a point cloud.
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var oc = off.getContext('2d');
    oc.fillStyle = '#fff';
    oc.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
    oc.textBaseline = 'middle';
    oc.fillText('ProWAM', 4, H / 2);
    var proW = probe.measureText('Pro').width + 4;   // colour split point

    var data = oc.getImageData(0, 0, W, H).data;
    var step = W > 700 ? 4 : 3, pts = [];
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
      }
    }
    if (pts.length < 40) return;
    // The particle assembly *is* this heading's entrance, so take it out of the
    // reveal system -- otherwise reveal's translateY(20px) fires afterwards and
    // yanks the settled word upward.
    h1.classList.remove('reveal');
    h1.classList.add('in');
    h1.style.transform = 'none';

    // Park the canvas exactly over the heading; the h1 keeps its box.
    var r = h1.getBoundingClientRect(), pr = h1.offsetParent.getBoundingClientRect();
    cv.style.top = (r.top - pr.top + (r.height - H) / 2) + 'px';
    cv.style.opacity = '1';
    h1.style.opacity = '0';

    var ps = pts.map(function (q) {
      var ang = Math.random() * Math.PI * 2, rad = 90 + Math.random() * 320;
      return { tx: q[0], ty: q[1],
               x: q[0] + Math.cos(ang) * rad, y: q[1] + Math.sin(ang) * rad,
               d: 0.055 + Math.random() * 0.05, r: step * 0.5 };
    });

    var t0 = null, done = false;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      ctx.clearRect(0, 0, W, H);
      var settled = 0;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.x += (p.tx - p.x) * p.d;
        p.y += (p.ty - p.y) * p.d;
        if (Math.abs(p.tx - p.x) < 0.6 && Math.abs(p.ty - p.y) < 0.6) settled++;
        if (p.tx < proW) {
          ctx.fillStyle = '#e9ecf2';
        } else {
          // Ramp only across "WAM", matching the h1 gradient.
          var f = Math.min(1, Math.max(0, (p.tx - proW) / (W - proW)));
          ctx.fillStyle = 'rgb(' + Math.round(0 + f * 220) + ',' + Math.round(162 - f * 132) + ',' + Math.round(232 - f * 202) + ')';
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (settled / ps.length > 0.985 && ts - t0 > 900) done = true;
      if (!done) requestAnimationFrame(frame);
      else {
        // Dots never fill the glyph the way solid type does, so paint the real
        // word onto the canvas first; the handover then has nothing to jump.
        ctx.clearRect(0, 0, W, H);
        var g = ctx.createLinearGradient(proW, 0, W, 0);
        g.addColorStop(0, '#00a2e8');
        g.addColorStop(0.38, '#61bdde');
        g.addColorStop(0.72, '#f1a29f');
        g.addColorStop(1, '#dc1e1e');
        ctx.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, proW, H); ctx.clip();
        ctx.fillStyle = '#e9ecf2'; ctx.fillText('ProWAM', 4, H / 2);
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(proW, 0, W - proW, H); ctx.clip();
        ctx.fillStyle = g; ctx.fillText('ProWAM', 4, H / 2);
        ctx.restore();
        h1.style.opacity = '1';
        cv.style.opacity = '0';
        setTimeout(function () { cv.remove(); }, 320);
      }
    }
    requestAnimationFrame(frame);
  })();

  // --- hero particles: drift left-to-right, blue into red ----------------
  var fx = document.querySelector('.hero-fx');
  if (fx && !reduced) {
    var hero = fx.parentElement, ctx = fx.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], raf = null;

    function size() {
      W = hero.offsetWidth; H = hero.offsetHeight;
      fx.width = W * dpr; fx.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      // Scale with area so a wide hero is not sparse and a phone is not busy.
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
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? go() : stop(); });
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : go();
    });
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
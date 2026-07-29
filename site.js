/* ─────────────────────────────────────────────────────────────
   Background: a sparse memory view.

   A static grid of hex bytes. Nothing scrolls, drifts, or
   parallaxes — the only change is that every ~500 ms one or two
   cells get rewritten, flare amber for a moment, then settle
   back to the resting slate. Exactly what watching a live
   process in a hex editor looks like, and quiet enough to read
   over. Only the cells currently fading are repainted, so the
   cost is a handful of small fillText calls per frame.
   ───────────────────────────────────────────────────────────── */
(function memoryField() {
  'use strict';
  var cv = document.querySelector('.bgfield');
  if (!cv || !cv.getContext) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var CW = 27, CH = 23;            // cell advance, CSS px
  var REST = 0.040, PEAK = 0.34;   // alpha at rest and at the moment of a write
  var DECAY = 1100;                // ms for a written byte to fade back
  var PERIOD = 520;                // ms between writes
  var PER_WRITE = 2;               // cells touched per write

  var SLATE = [138, 151, 166];
  var AMBER = [233, 166, 60];

  var cells = [], active = [], cols = 0, rows = 0, raf = null, last = 0;

  function byte() { return (Math.random() * 256) | 0; }
  function hx(n) { var s = n.toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }

  function paint(cell) {
    var x = cell.c * CW, y = cell.r * CH, f = cell.f;
    ctx.clearRect(x, y, CW, CH);
    var r = (SLATE[0] + (AMBER[0] - SLATE[0]) * f) | 0;
    var g = (SLATE[1] + (AMBER[1] - SLATE[1]) * f) | 0;
    var b = (SLATE[2] + (AMBER[2] - SLATE[2]) * f) | 0;
    var a = REST + (PEAK - REST) * f;
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
    ctx.fillText(hx(cell.v), x, y + 5);
  }

  function build() {
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '11px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';

    cols = Math.ceil(w / CW) + 1;
    rows = Math.ceil(h / CH) + 1;
    cells = [];
    active = [];
    ctx.clearRect(0, 0, w, h);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = { c: c, r: r, v: byte(), f: 0 };
        cells.push(cell);
        paint(cell);
      }
    }
  }

  function frame(t) {
    if (!last) last = t;
    var dt = Math.min(60, t - last);
    last = t;
    for (var i = active.length - 1; i >= 0; i--) {
      var cell = active[i];
      cell.f -= dt / DECAY;
      if (cell.f <= 0) { cell.f = 0; active.splice(i, 1); }
      paint(cell);
    }
    if (active.length) { raf = requestAnimationFrame(frame); }
    else { raf = null; last = 0; }
  }

  function write() {
    if (document.hidden || !cells.length) return;
    for (var n = 0; n < PER_WRITE; n++) {
      var cell = cells[(Math.random() * cells.length) | 0];
      cell.v = byte();
      cell.f = 1;
      if (active.indexOf(cell) < 0) active.push(cell);
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  build();
  if (!reduce) setInterval(write, PERIOD);

  var t0;
  window.addEventListener('resize', function () {
    clearTimeout(t0);
    t0 = setTimeout(function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; last = 0; }
      build();
    }, 180);
  });
})();

/* ─────────────────────────────────────────────────────────────
   Hex-editor behaviours. Every animation here is something a
   real hex editor does — nothing decorative.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. render the .rodata dump ────────────────────────────
     Bytes are the single source of truth; the ASCII column is
     derived from them, so the two can never disagree.
     Base address 0x2000 matches .rodata in the section table.  */

  var BYTES = [
    // "Yiyue Zhang\0SKKU"
    0x59,0x69,0x79,0x75,0x65,0x20,0x5A,0x68, 0x61,0x6E,0x67,0x00,0x53,0x4B,0x4B,0x55,
    // "\0SecAI Lab\0" + padding
    0x00,0x53,0x65,0x63,0x41,0x49,0x20,0x4C, 0x61,0x62,0x00,0x00,0x00,0x00,0x00,0x00,
    // "binary analysis\0"
    0x62,0x69,0x6E,0x61,0x72,0x79,0x20,0x61, 0x6E,0x61,0x6C,0x79,0x73,0x69,0x73,0x00
  ];
  var BASE = 0x2000;

  function hex(n, w) {
    var s = n.toString(16).toUpperCase();
    while (s.length < w) s = '0' + s;
    return s;
  }

  var dump = document.getElementById('dump');
  if (dump) {
    var html = '';
    for (var row = 0; row * 16 < BYTES.length; row++) {
      var off = row * 16;
      var line = BYTES.slice(off, off + 16);
      html += '<span class="addr">' + hex(BASE + off, 8) + '</span>  ';
      for (var i = 0; i < 16; i++) {
        var b = line[i];
        var nul = (b === 0) ? ' nul' : '';
        html += '<span class="b' + nul + '" data-i="' + (off + i) + '">' + hex(b, 2) + '</span>';
        html += (i === 7) ? '  ' : ' ';
      }
      html += ' <span class="bar">|</span>';
      for (var j = 0; j < 16; j++) {
        var c = line[j];
        // printable ASCII renders as itself, everything else as '.'
        var ch = (c >= 0x20 && c < 0x7f) ? String.fromCharCode(c) : '.';
        if (ch === ' ') ch = '\u00a0';
        html += '<span class="a' + (c === 0 ? ' nul' : '') + '" data-i="' + (off + j) + '">' + ch + '</span>';
      }
      html += '<span class="bar">|</span>';
      if (row * 16 + 16 < BYTES.length) html += '\n';
    }
    dump.innerHTML = html;

    /* ── 2. byte ↔ ASCII linkage on hover ──────────────────── */
    var cells = dump.querySelectorAll('[data-i]');
    dump.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-i]');
      if (!t) return;
      var i = t.dataset.i;
      for (var k = 0; k < cells.length; k++) {
        if (cells[k].dataset.i === i) cells[k].classList.add('lit');
      }
    });
    dump.addEventListener('mouseout', function () {
      for (var k = 0; k < cells.length; k++) cells[k].classList.remove('lit');
    });

    /* ── 3. bytes settle out of noise, left to right ───────── */
    if (!reduce) {
      var bs = dump.querySelectorAll('.b');
      Array.prototype.forEach.call(bs, function (el, idx) {
        var truth = el.textContent, ticks = 0, limit = 4 + idx;
        var t = setInterval(function () {
          if (++ticks >= limit) { clearInterval(t); el.textContent = truth; }
          else { el.textContent = hex((Math.random() * 256) | 0, 2); }
        }, 34);
      });
    }
  }

  /* ── 4. caret tracks scroll position down the address rail ─ */
  var rail = document.querySelector('.rail');
  var cursor = document.querySelector('.rail-cursor');
  if (rail && cursor && !reduce) {
    var place = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      cursor.style.top = (pct * (rail.offsetHeight - cursor.offsetHeight)) + 'px';
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
  }

  /* ── 5. sections resolve as they come into view ───────────── */
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
})();

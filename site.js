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

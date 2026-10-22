/*
 * Shared helpers for the Specs Explains scenes: cue times from the voice track,
 * the camera, marker fills, and the few tween shapes every scene reuses.
 * All of it is deterministic: tweens sit at absolute times and nothing reads the clock.
 */
(function () {
  const K = {};
  const E = () => window.Specs.EASE;
  const lerp = (a, b, p) => a + (b - a) * p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.lerp = lerp;
  K.clamp = clamp;

  // Line start (s) and end (e) times, scene-local, from assets/data/timing.js.
  K.cues = function (scene) {
    const T = window.SPECS_TIMING[scene];
    const s = {};
    const e = {};
    for (const k in T.lines) {
      s[k] = T.lines[k].s;
      e[k] = T.lines[k].e;
    }
    // estimated time a word or phrase is spoken inside a line, by character position
    const w = (k, needle, frac) => {
      const L = T.lines[k];
      const i = L.text.toLowerCase().indexOf(needle.toLowerCase());
      const p = i < 0 ? 0 : (i + (frac || 0) * needle.length) / L.text.length;
      return L.s + (L.e - L.s) * p;
    };
    return { s, e, w, dur: T.duration };
  };

  // Camera over a world <g>: keys [[t, cx, cy, zoom, dur, ease]]; cx/cy may be functions of t.
  K.camera = function (el, keys, init) {
    const start = Object.assign({ cx: 960, cy: 540, z: 1 }, init || {});
    const val = (v, t) => (typeof v === "function" ? v(t) : v);
    function at(t) {
      let cur = { cx: start.cx, cy: start.cy, z: start.z };
      for (const k of keys) {
        if (t < k[0]) break;
        const from = cur;
        const to = { cx: val(k[1], t), cy: val(k[2], t), z: k[3] == null ? from.z : k[3] };
        const p = clamp((t - k[0]) / (k[4] || 0.8), 0, 1);
        const e = E()[k[5] || "inOut"](p);
        // zoom eases in log space so a deep zoom feels even
        cur = { cx: lerp(from.cx, to.cx, e), cy: lerp(from.cy, to.cy, e), z: Math.exp(lerp(Math.log(from.z), Math.log(to.z), e)) };
      }
      return cur;
    }
    function render(t) {
      const c = at(t);
      el.setAttribute("transform", `translate(960 540) scale(${c.z.toFixed(5)}) translate(${(-c.cx).toFixed(2)} ${(-c.cy).toFixed(2)})`);
      return c;
    }
    return { at, render };
  };

  // Marker look: every [data-marker] shape gets a flat colour underlay printed 6px off register.
  K.markers = function (root) {
    root.querySelectorAll("[data-marker]").forEach((n) => {
      const fill = n.cloneNode(false);
      fill.removeAttribute("id");
      fill.removeAttribute("data-marker");
      fill.removeAttribute("pathLength");
      fill.setAttribute("fill", n.getAttribute("data-marker"));
      fill.setAttribute("stroke", "none");
      const off = n.getAttribute("data-off") || "6 5";
      const tr = n.getAttribute("transform") || "";
      fill.setAttribute("transform", `translate(${off}) ${tr}`);
      fill.setAttribute("class", "mk-fill");
      n.parentNode.insertBefore(fill, n);
      n.setAttribute("fill", "none");
    });
  };

  // Split an element's text into word spans (HTML) or tspans (SVG) for per-word reveals.
  K.words = function (node) {
    const svg = node instanceof SVGElement;
    const text = node.textContent.trim().split(/\s+/);
    node.textContent = "";
    text.forEach((w, i) => {
      const s = document.createElementNS(svg ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", svg ? "tspan" : "span");
      s.textContent = (i ? " " : "") + w;
      s.setAttribute("class", "w");
      node.appendChild(s);
    });
    return node.querySelectorAll(".w");
  };

  // Stroke draw-on; shapes need pathLength="1" and stroke-dasharray: 1 1.1 (the gap is a little
  // longer than the path so no round cap peeks out at either end while hidden).
  K.draw = (tl, sel, t, dur, ease, stagger) =>
    tl.fromTo(sel, { strokeDashoffset: 1.05 }, { strokeDashoffset: 0, duration: dur || 0.6, ease: ease || "power2.inOut", stagger: stagger || 0 }, t);
  K.undraw = (tl, sel, t, dur) => tl.to(sel, { strokeDashoffset: -1.05, duration: dur || 0.4, ease: "power2.in" }, t);

  K.show = (tl, sel, t, dur) => tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: dur || 0.3, ease: "power1.out" }, t);
  K.hide = (tl, sel, t, dur) => tl.to(sel, { opacity: 0, duration: dur || 0.25, ease: "power1.in" }, t);

  K.pop = (tl, sel, t, o) => {
    o = o || {};
    tl.fromTo(
      sel,
      { scale: o.from == null ? 0 : o.from, opacity: 0, transformOrigin: o.origin || "50% 50%" },
      { scale: 1, opacity: 1, duration: o.dur || 0.5, ease: o.ease || "back.out(2.2)", stagger: o.stagger || 0 },
      t,
    );
  };

  K.out = (tl, sel, t, o) => {
    o = o || {};
    tl.to(sel, { opacity: 0, scale: o.scale == null ? 0.9 : o.scale, duration: o.dur || 0.25, ease: "power2.in", transformOrigin: o.origin || "50% 50%", stagger: o.stagger || 0 }, t);
  };

  // Per-word reveal of a node prepared with K.words.
  K.write = (tl, words, t, gap) =>
    tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "power1.out", stagger: gap == null ? 0.07 : gap }, t);

  // A finite heartbeat pulse between t0 and t1.
  K.pulse = (tl, sel, t0, t1, period, amt, origin) => {
    const n = Math.max(1, Math.floor((t1 - t0) / period));
    for (let i = 0; i < n; i++) {
      const t = t0 + i * period;
      tl.to(sel, { scale: amt || 1.12, duration: period * 0.18, ease: "power2.out", transformOrigin: origin || "50% 50%" }, t);
      tl.to(sel, { scale: 1, duration: period * 0.42, ease: "power2.inOut", transformOrigin: origin || "50% 50%" }, t + period * 0.18);
    }
  };

  // Gentle finite bob for floating things (bubbles, notes, planets).
  K.bob = (tl, sel, t0, t1, amp, period) => {
    const n = Math.max(1, Math.floor((t1 - t0) / period));
    for (let i = 0; i < n; i++) {
      tl.to(sel, { y: i % 2 ? amp : -amp, duration: period, ease: "sine.inOut" }, t0 + i * period);
    }
  };

  // Highlighter swipe: a rect scaled in from the left.
  K.swipe = (tl, sel, t, dur) =>
    tl.fromTo(sel, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: dur || 0.35, ease: "power2.out" }, t);

  // A driver tween whose onUpdate draws procedural layers (Specs, cameras) at scene time.
  K.driver = (tl, dur, fn) => {
    const proxy = { t: 0 };
    tl.fromTo(proxy, { t: 0 }, { t: dur, duration: dur, ease: "none", onUpdate: () => fn(proxy.t) }, 0);
    fn(0);
  };

  window.Kit = K;
})();

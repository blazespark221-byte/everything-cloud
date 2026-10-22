/*
 * Specs: the stick-figure host, drawn procedurally into an SVG <g>.
 *
 * Everything he does is a function of scene time t, so any frame renders on its own:
 *   const rig = Specs.create(groupEl, { scene: "sky", x: 1400, y: 900, s: 1,
 *     moves: [[t, x, y, s, dur, mode?]],      // mode: "ease" | "walk" | "hop"
 *     poses: [[t, "point-r", dur, ease?]],    // names from Specs.POSES, or a param object
 *     faces: [[t, "happy", dur]],             // names from Specs.FACES
 *     looks: [[t, lx, ly, dur]],              // pupils, -1..1
 *   });
 *   rig.render(t);                            // from the scene timeline's onUpdate
 *   rig.point("handR") / rig.point("lensL")   // scene coordinates after render
 *
 * The mouth follows window.SPECS_LIPSYNC[scene], made from the voice track by tools/voice.py.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#1f1d1a";
  const PAPER = "#fffdf8";
  const CORAL = "#ff5a4e";

  // Body lengths in rig units (scale 1 is about 480 px tall).
  const HIP_Y = -192;
  const BODY = 150;
  const UPPER = 80;
  const FORE = 76;
  const THIGH = 100;
  const SHIN = 100;
  const HEAD_R = 66;
  const NECK = 72;

  const D2R = Math.PI / 180;
  const dir = (deg) => [Math.sin(deg * D2R), Math.cos(deg * D2R)]; // 0 = down, 90 = screen right
  const lerp = (a, b, p) => a + (b - a) * p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const EASE = {
    linear: (p) => p,
    inOut: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    in: (p) => p * p * p,
    back: (p) => {
      const c1 = 1.6;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    spring: (p) => 1 - Math.exp(-6 * p) * Math.cos(p * 9.5),
  };

  function hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Two-bone arm IK: hand target (dx, dy) relative to the shoulder -> { u, f } angles.
  // bend +1 / -1 picks which way the elbow folds.
  function ikArm(dx, dy, bend) {
    const d = clamp(Math.hypot(dx, dy), 1, UPPER + FORE - 0.5);
    const base = Math.atan2(dx, dy) / D2R;
    const off = Math.acos(clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1)) / D2R;
    const u = base + (bend || 1) * off;
    const elbow = dir(u).map((v) => v * UPPER);
    const fAbs = Math.atan2(dx - elbow[0], dy - elbow[1]) / D2R;
    let f = fAbs - u;
    while (f > 180) f -= 360;
    while (f < -180) f += 360;
    return { u, f };
  }

  // Poses: arm angles (upper absolute, forearm relative), hands (0 dot, 1 open, 2 point, 3 fist),
  // lean, crouch, head tilt, feet spread, shrug, arm swing and talk-gesture allowance.
  const BASE = {
    uL: -14, fL: -6, uR: 14, fR: 6,
    hL: 0, hR: 0,
    lean: 0, crouch: 0, tilt: 0, headX: 0, headY: 0,
    footL: -26, footR: 26, liftL: 0, liftR: 0,
    shrug: 0, swing: 1, talk: 0.5, wave: 0, glassesY: 0, rot: 0,
  };
  const P = (o) => Object.assign({}, BASE, o);
  const POSES = {
    idle: P({}),
    relaxed: P({ uL: -10, fL: -4, uR: 10, fR: 4, talk: 0.7 }),
    explain: P({ uL: -28, fL: -58, uR: 28, fR: 58, hL: 1, hR: 1, swing: 0, talk: 1 }),
    "explain-r": P({ uR: 38, fR: 62, hR: 1, uL: -12, fL: -6, swing: 0, talk: 1, tilt: 3 }),
    "explain-l": P({ uL: -38, fL: -62, hL: 1, uR: 12, fR: 6, swing: 0, talk: 1, tilt: -3 }),
    wave: P({ uR: 128, fR: 32, hR: 1, wave: 1, swing: 0, tilt: 4, talk: 0.3 }),
    "point-r": P({ uR: 82, fR: 6, hR: 2, swing: 0, lean: 3, tilt: 3, talk: 0.3 }),
    "point-l": P({ uL: -82, fL: -6, hL: 2, swing: 0, lean: -3, tilt: -3, talk: 0.3 }),
    "point-ur": P({ uR: 132, fR: 12, hR: 2, swing: 0, tilt: 6, talk: 0.3 }),
    "point-ul": P({ uL: -132, fL: -12, hL: 2, swing: 0, tilt: -6, talk: 0.3 }),
    "point-dr": P({ uR: 50, fR: 4, hR: 2, swing: 0, lean: 4, tilt: 8, talk: 0.3 }),
    "point-dl": P({ uL: -50, fL: -4, hL: 2, swing: 0, lean: -4, tilt: -8, talk: 0.3 }),
    "present-r": P({ uR: 68, fR: 26, hR: 1, uL: -12, fL: -4, swing: 0, lean: 2, talk: 0.6 }),
    "present-l": P({ uL: -68, fL: -26, hL: 1, uR: 12, fR: 4, swing: 0, lean: -2, talk: 0.6 }),
    shrug: P({ uL: -48, fL: -74, uR: 48, fR: 74, hL: 1, hR: 1, shrug: -10, tilt: 8, swing: 0, talk: 0.2 }),
    think: P({ hR: 3, uL: -30, fL: 64, hL: 3, tilt: -7, swing: 0, talk: 0.1 }),
    hips: P({ uL: -36, fL: 60, uR: 36, fR: -60, hL: 3, hR: 3, footL: -40, footR: 40, swing: 0, talk: 0.2 }),
    "arms-up": P({ uL: -152, fL: -12, uR: 152, fR: 12, hL: 1, hR: 1, tilt: 0, swing: 0, talk: 0.3, crouch: -4 }),
    cheer: P({ uL: -150, fL: 8, uR: 150, fR: -8, hL: 3, hR: 3, swing: 0, talk: 0.3 }),
    "fist-up": P({ uR: 32, fR: 120, hR: 3, uL: -16, fL: -6, swing: 0, talk: 0.2, tilt: 4 }),
    "hold-sign": P({ uL: -30, fL: -100, uR: 30, fR: 100, hL: 1, hR: 1, swing: 0, talk: 0.1 }),
    "hold-front": P({ uL: -26, fL: 92, uR: 26, fR: -92, hL: 0, hR: 0, swing: 0, talk: 0.1 }),
    "scratch-head": P({ uR: 122, fR: 84, hR: 0, tilt: 9, swing: 0, talk: 0.2 }),
    "push-glasses": P({ uR: 100, fR: 128, hR: 2, tilt: -3, swing: 0, talk: 0, glassesY: -4 }),
    "hand-chest": P({ uR: 18, fR: 150, hR: 1, uL: -14, fL: -6, swing: 0, talk: 0.3, tilt: -4 }),
    "hand-ear": P({ uL: -128, fL: -92, hL: 1, tilt: -10, swing: 0, talk: 0.1 }),
    crouch: P({ uL: -40, fL: -30, uR: 40, fR: 30, crouch: 46, lean: 0, footL: -44, footR: 44, swing: 0, talk: 0 }),
    float: P({ uL: -64, fL: -24, uR: 64, fR: 24, hL: 1, hR: 1, footL: -18, footR: 30, liftL: 26, liftR: 6, swing: 0, talk: 0.6 }),
    lie: P({ uL: -10, fL: 0, uR: 168, fR: 10, hR: 0, swing: 0, talk: 0.3, rot: -90 }),
    sleep: P({ uL: -6, fL: 0, uR: 6, fR: 0, swing: 0, talk: 0, rot: -90 }),
    yawn: P({ uR: 130, fR: 40, hR: 1, uL: -130, fL: -40, hL: 1, swing: 0, talk: 0.1, crouch: -6, tilt: -6 }),
    "hand-mouth": P({ uR: 30, fR: 152, hR: 1, swing: 0, talk: 0.1, tilt: 4 }),
    "reach-r": P({ uR: 58, fR: -8, hR: 1, lean: 9, crouch: 18, swing: 0, talk: 0.2 }),
    "reach-l": P({ uL: -58, fL: 8, hL: 1, lean: -9, crouch: 18, swing: 0, talk: 0.2 }),
    "hold-r": P({ uR: 46, fR: 62, hR: 0, uL: -14, fL: -6, swing: 0, talk: 0.4 }),
    "hold-l": P({ uL: -46, fL: -62, hL: 0, uR: 14, fR: 6, swing: 0, talk: 0.4 }),
    "hold-up-r": P({ uR: 70, fR: 64, hR: 0, uL: -14, fL: -6, swing: 0, talk: 0.4, tilt: 4 }),
    "hold-up-l": P({ uL: -70, fL: -64, hL: 0, uR: 14, fR: 6, swing: 0, talk: 0.4, tilt: -4 }),
    jealous: P({ uL: -30, fL: 64, uR: 30, fR: -64, hL: 3, hR: 3, swing: 0, talk: 0.3, tilt: -6, lean: -3 }),
    tired: P({ uL: -6, fL: 0, uR: 6, fR: 0, crouch: 20, lean: 6, tilt: 14, swing: 0, talk: 0.2 }),
  };

  const ikPose = (base, side, dx, dy, bend) => {
    const a = ikArm(dx, dy, bend);
    return Object.assign({}, base, side === "R" ? { uR: a.u, fR: a.f } : { uL: a.u, fL: a.f });
  };
  // A pose whose hand reaches a point given in rig units (relative to the feet, unscaled).
  function reach(name, side, tx, ty, bend) {
    const base = typeof name === "string" ? POSES[name] : Object.assign({}, BASE, name);
    const L = base.lean * D2R;
    const hip = [0, HIP_Y + base.crouch];
    const neck = [hip[0] + Math.sin(L) * BODY, hip[1] - Math.cos(L) * BODY + base.shrug * 0.3];
    const sh = [lerp(neck[0], hip[0], 0.07), lerp(neck[1], hip[1], 0.07) + base.shrug];
    return ikPose(base, side, tx - sh[0], ty - sh[1], bend);
  }

  POSES.think = ikPose(POSES.think, "R", 16, -12, -1);
  POSES["push-glasses"] = ikPose(POSES["push-glasses"], "R", 5, -86, -1);

  // Faces: brows (px, negative raises), brow tilt (deg, positive = cross), eye scale and openness,
  // smile (-1..1), extra mouth opening and blush.
  const F = (o) => Object.assign({ bL: 0, bR: 0, bTilt: 0, eyeS: 1, eyeOpen: 1, smile: 0.3, mO: 0, blush: 0 }, o);
  const FACES = {
    neutral: F({}),
    happy: F({ bL: -3, bR: -3, smile: 0.85 }),
    excited: F({ bL: -8, bR: -8, smile: 1, eyeS: 1.12, blush: 0.6 }),
    surprised: F({ bL: -13, bR: -13, smile: 0, mO: 0.75, eyeS: 1.3 }),
    amazed: F({ bL: -11, bR: -11, smile: 0.55, mO: 0.45, eyeS: 1.22, blush: 0.4 }),
    thinking: F({ bL: -9, bR: 2, smile: -0.1 }),
    skeptical: F({ bL: 3, bR: -10, smile: -0.25, eyeOpen: 0.8 }),
    worried: F({ bL: -5, bR: -5, bTilt: -14, smile: -0.55 }),
    smug: F({ bL: -2, bR: -6, smile: 0.7, eyeOpen: 0.62 }),
    sleepy: F({ bL: 2, bR: 2, smile: 0.1, eyeOpen: 0.28 }),
    asleep: F({ bL: 3, bR: 3, smile: 0.2, eyeOpen: 0 }),
    wince: F({ bL: 2, bR: 2, bTilt: 13, smile: -0.6, eyeOpen: 0.18 }),
    jealous: F({ bL: 1, bR: 1, bTilt: 11, smile: -0.35, eyeOpen: 0.7 }),
    proud: F({ bL: -4, bR: -4, smile: 0.95, eyeOpen: 0.55, blush: 0.5 }),
    shocked: F({ bL: -15, bR: -15, smile: -0.3, mO: 0.9, eyeS: 1.38 }),
    grin: F({ bL: -5, bR: -5, smile: 1, blush: 0.3 }),
  };

  function blendObj(a, b, p) {
    const out = {};
    for (const k in a) out[k] = typeof a[k] === "number" ? lerp(a[k], b[k], p) : p < 0.5 ? a[k] : b[k];
    return out;
  }

  // Keyed tracks: [[t, value, dur, ease]] -> value at time.
  function evalTrack(keys, t, resolve, init) {
    let cur = init;
    let prev = init;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (t < k[0]) break;
      prev = cur;
      const target = resolve(k[1]);
      const dur = k[2] == null ? 0.4 : k[2];
      const p = dur <= 0 ? 1 : clamp((t - k[0]) / dur, 0, 1);
      const e = EASE[k[3] || "inOut"](p);
      cur = p >= 1 ? target : blendObj(prev, target, e);
    }
    return cur;
  }

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  function create(group, cfg) {
    const seed = Array.from(cfg.scene || "specs").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const lips = (window.SPECS_LIPSYNC || {})[cfg.scene] || { fps: 30, open: "", shape: "" };
    const poses = (cfg.poses || []).map((k) => [k[0], k[1], k[2], k[3]]);
    const faces = cfg.faces || [];
    const looks = (cfg.looks || []).map((k) => [k[0], { lx: k[1], ly: k[2] }, k[3], k[4]]);
    const moves = cfg.moves || [];
    const s0 = { x: cfg.x || 960, y: cfg.y || 920, s: cfg.s || 1 };
    const ink = cfg.ink || INK;
    const talkGain = cfg.talk == null ? 1 : cfg.talk;

    // blink schedule
    const rnd = mulberry32(seed);
    const blinks = [];
    for (let t = 0.9 + rnd() * 1.5; t < 600; t += 2.3 + rnd() * 2.9) blinks.push(t);

    // build the drawing
    group.setAttribute("data-specs", cfg.scene || "");
    const root = el("g", {}, group);
    const shadow = el("ellipse", { cx: 0, cy: 4, rx: 74, ry: 10, fill: "rgba(31,29,26,0.13)" }, root);
    const body = el("g", {}, root);
    const line = { fill: "none", stroke: ink, "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" };
    const legL = el("path", line, body);
    const legR = el("path", line, body);
    const torso = el("path", line, body);
    const armL = el("path", line, body);
    const armR = el("path", line, body);
    const tie = el("g", {}, body);
    el("path", { d: "M0 0 L-17 -10 L-15 10 Z M0 0 L17 -10 L15 10 Z", fill: CORAL, stroke: ink, "stroke-width": 3.2, "stroke-linejoin": "round" }, tie);
    el("circle", { cx: 0, cy: 0, r: 4.5, fill: CORAL, stroke: ink, "stroke-width": 3 }, tie);
    const handL = el("g", {}, body);
    const handR = el("g", {}, body);
    const mkHand = (g) => ({
      dot: el("circle", { r: 7.5, fill: ink }, g),
      fingers: el("path", { fill: "none", stroke: ink, "stroke-width": 5, "stroke-linecap": "round" }, g),
    });
    const hands = { L: mkHand(handL), R: mkHand(handR) };

    const head = el("g", {}, root);
    const hair = el("path", { fill: "none", stroke: ink, "stroke-width": 6, "stroke-linecap": "round" }, head);
    el("circle", { cx: 0, cy: 0, r: HEAD_R, fill: PAPER, stroke: ink, "stroke-width": 7.5 }, head);
    const blushL = el("ellipse", { cx: -44, cy: 20, rx: 11, ry: 6.5, fill: "#ff8fa3", opacity: 0 }, head);
    const blushR = el("ellipse", { cx: 44, cy: 20, rx: 11, ry: 6.5, fill: "#ff8fa3", opacity: 0 }, head);
    const eyeL = el("ellipse", { rx: 6.6, ry: 6.6, fill: ink }, head);
    const eyeR = el("ellipse", { rx: 6.6, ry: 6.6, fill: ink }, head);
    const lidL = el("path", { fill: "none", stroke: ink, "stroke-width": 4.5, "stroke-linecap": "round" }, head);
    const lidR = el("path", { fill: "none", stroke: ink, "stroke-width": 4.5, "stroke-linecap": "round" }, head);
    const browL = el("path", { fill: "none", stroke: ink, "stroke-width": 5.5, "stroke-linecap": "round" }, head);
    const browR = el("path", { fill: "none", stroke: ink, "stroke-width": 5.5, "stroke-linecap": "round" }, head);
    const glasses = el("g", {}, head);
    const lensFill = { fill: "rgba(150,205,255,0.28)", stroke: ink, "stroke-width": 5.5 };
    const lensL = el("circle", Object.assign({ cx: -28, cy: -4, r: 23 }, lensFill), glasses);
    const lensR = el("circle", Object.assign({ cx: 28, cy: -4, r: 23 }, lensFill), glasses);
    el("path", { d: "M-6 -8 Q0 -14 6 -8", fill: "none", stroke: ink, "stroke-width": 5, "stroke-linecap": "round" }, glasses);
    el("path", { d: "M-51 -8 L-64 -15 M51 -8 L64 -15", fill: "none", stroke: ink, "stroke-width": 5, "stroke-linecap": "round" }, glasses);
    el("path", { d: "M-41 -12 Q-38 -19 -31 -21 M15 -12 Q18 -19 25 -21", fill: "none", stroke: "#ffffff", "stroke-width": 3.5, "stroke-linecap": "round", opacity: 0.9 }, glasses);
    const mouth = el("path", { fill: "none", stroke: ink, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, head);
    const tongue = el("path", { fill: "#ff7b7b", stroke: "none" }, head);

    const state = { pts: {} };

    function moveAt(t) {
      let cur = { x: s0.x, y: s0.y, s: s0.s, bob: 0, phase: 0, walking: 0, hop: 0, dirn: 0 };
      for (const m of moves) {
        if (t < m[0]) break;
        const from = { x: cur.x, y: cur.y, s: cur.s };
        const to = { x: m[1], y: m[2], s: m[3] == null ? cur.s : m[3] };
        const dur = m[4] || 0.6;
        const mode = m[5] || "ease";
        const p = clamp((t - m[0]) / dur, 0, 1);
        const e = mode === "walk" ? EASE.inOut(p) : mode === "hop" ? EASE.inOut(p) : EASE[mode] ? EASE[mode](p) : EASE.inOut(p);
        cur = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), s: lerp(from.s, to.s, e), bob: 0, phase: 0, walking: 0, hop: 0, dirn: Math.sign(to.x - from.x) };
        if (mode === "walk" && p < 1) {
          const dist = Math.abs(to.x - from.x) / Math.max(0.2, to.s);
          const steps = Math.max(1, Math.round(dist / 120));
          cur.phase = e * steps * Math.PI;
          cur.walking = Math.sin(Math.PI * p) > 0.05 ? 1 : 0;
          cur.walking *= clamp(Math.min(p, 1 - p) * 8, 0, 1);
        }
        if (mode === "hop" && p < 1) cur.hop = Math.sin(Math.PI * p);
      }
      return cur;
    }

    function poseRes(v) {
      return typeof v === "string" ? POSES[v] || POSES.idle : Object.assign({}, BASE, v);
    }
    function faceRes(v) {
      return typeof v === "string" ? FACES[v] || FACES.neutral : F(v);
    }

    function mouthAt(t) {
      const f = t * lips.fps;
      const i = Math.floor(f);
      const a = +(lips.open[i] || 0);
      const b = +(lips.open[i + 1] || 0);
      const open = lerp(a, b, f - i) / 9;
      return { open, shape: lips.shape[i] || "n" };
    }

    function energyAt(t) {
      let sum = 0;
      for (let k = -12; k <= 3; k++) sum += +(lips.open[Math.floor((t + k / 30) * lips.fps)] || 0);
      return clamp(sum / (16 * 5), 0, 1);
    }

    function blinkAt(t) {
      for (const b of blinks) {
        if (b > t + 0.2) break;
        const d = t - b;
        if (d >= 0 && d < 0.17) return 1 - Math.sin((d / 0.17) * Math.PI);
      }
      return 1;
    }

    function jit(t, i) {
      const k = Math.floor(t * 12);
      return [(hash(k + seed, i * 2) - 0.5) * 2.2, (hash(k + seed, i * 2 + 1) - 0.5) * 2.2];
    }

    function render(t) {
      const mv = moveAt(t);
      const poseHead = evalTrack(poses, t + 0.05, poseRes, POSES.idle);
      const pose = evalTrack(poses, t, poseRes, POSES.idle);
      const poseArm = evalTrack(poses, t - 0.06, poseRes, POSES.idle);
      const face = evalTrack(faces, t, faceRes, FACES.neutral);
      const look = evalTrack(looks, t, (v) => v, { lx: 0, ly: 0.05 });
      const en = energyAt(t) * talkGain;
      const breath = Math.sin(t * 1.9 + seed) * 1.6;

      // walking legs and arm swing
      const ph = mv.phase;
      const w = mv.walking;
      const stepL = Math.sin(ph) * 30 * w;
      const liftL = Math.max(0, Math.cos(ph)) * 16 * w;
      const liftR = Math.max(0, -Math.cos(ph)) * 16 * w;
            const hopY = -mv.hop * 70;

      const crouch = pose.crouch + Math.abs(Math.sin(ph)) * 6 * w + breath * 0.5;
      const lean = pose.lean + mv.dirn * 4 * w;
      const hip = [0, HIP_Y + crouch];
      const neck = [hip[0] + Math.sin(lean * D2R) * BODY, hip[1] - Math.cos(lean * D2R) * BODY + pose.shrug * 0.3];
      const shoulder = [lerp(neck[0], hip[0], 0.07), lerp(neck[1], hip[1], 0.07) + pose.shrug];

      // legs by IK with planted feet
      const footL = [pose.footL - stepL, -(pose.liftL + liftL)];
      const footR = [pose.footR + stepL, -(pose.liftR + liftR)];
      const leg = (foot, side) => {
        const dx = foot[0] - hip[0];
        const dy = foot[1] - hip[1];
        const d = clamp(Math.hypot(dx, dy), 1, THIGH + SHIN - 0.5);
        const base = Math.atan2(dy, dx);
        const off = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
        const kneeAt = (a) => [hip[0] + Math.cos(a) * THIGH, hip[1] + Math.sin(a) * THIGH];
        const out = kneeAt(side === "L" ? base + off : base - off);
        const fwd = kneeAt(mv.dirn > 0 ? base - off : base + off);
        const knee = [lerp(out[0], fwd[0], w), lerp(out[1], fwd[1], w)];
        const ankle = [hip[0] + (dx / Math.hypot(dx, dy)) * d, hip[1] + (dy / Math.hypot(dx, dy)) * d];
        return { knee, ankle };
      };
      const lL = leg(footL, "L");
      const lR = leg(footR, "R");

      // arms
      const swingA = Math.sin(ph) * 16 * w * pose.swing;
      const gest = en * pose.talk;
      const wave = pose.wave ? Math.sin(t * 2 * Math.PI * 1.7) * 24 * pose.wave : 0;
      const uL = poseArm.uL + swingA + Math.sin(t * 4.3 + 1) * 7 * gest;
      const fL = poseArm.fL + Math.sin(t * 5.7 + 2) * 12 * gest;
      const uR = poseArm.uR + swingA + Math.sin(t * 3.9) * 7 * gest;
      const fR = poseArm.fR + Math.sin(t * 6.1 + 0.5) * 12 * gest + wave;
      const arm = (u, f) => {
        const e = dir(u);
        const elbow = [shoulder[0] + e[0] * UPPER, shoulder[1] + e[1] * UPPER];
        const g = dir(u + f);
        const hand = [elbow[0] + g[0] * FORE, elbow[1] + g[1] * FORE];
        return { elbow, hand, ang: u + f };
      };
      const aL = arm(uL, fL);
      const aR = arm(uR, fR);

      // head leads a little
      const nod = Math.sin(t * 4.2) * 3.2 * en + Math.sin(t * 0.7 + seed) * 1.2;
      const tilt = poseHead.tilt + nod + lean * 0.4;
      const hc = [
        neck[0] + Math.sin((lean + tilt * 0.25) * D2R) * NECK + poseHead.headX,
        neck[1] - Math.cos((lean + tilt * 0.25) * D2R) * NECK + poseHead.headY - Math.abs(Math.sin(t * 7.1)) * 2 * en,
      ];

      // boil
      const J = (p, i) => {
        const j = jit(t, i);
        return [p[0] + j[0], p[1] + j[1]];
      };
      const P2 = (p) => f1(p[0]) + " " + f1(p[1]);
      const hipJ = J(hip, 1);
      const neckJ = J(neck, 2);
      const shJ = J(shoulder, 3);
      const toe = 17 * (mv.dirn || 1);
      legL.setAttribute("d", `M${P2(hipJ)} L${P2(J(lL.knee, 4))} L${P2(J(lL.ankle, 5))} l${f1(lerp(-17, toe, w))} 1`);
      legR.setAttribute("d", `M${P2(hipJ)} L${P2(J(lR.knee, 6))} L${P2(J(lR.ankle, 7))} l${f1(lerp(17, toe, w))} 1`);
      const mid = [(hip[0] + neck[0]) / 2 - lean * 0.35, (hip[1] + neck[1]) / 2];
      torso.setAttribute("d", `M${P2(hipJ)} Q${P2(J(mid, 8))} ${P2(neckJ)}`);
      armL.setAttribute("d", `M${P2(shJ)} L${P2(J(aL.elbow, 9))} L${P2(J(aL.hand, 10))}`);
      armR.setAttribute("d", `M${P2(shJ)} L${P2(J(aR.elbow, 11))} L${P2(J(aR.hand, 12))}`);
      tie.setAttribute("transform", `translate(${P2(neckJ)}) rotate(${f1(lean)})`);

      const drawHand = (h, g, a, kind) => {
        const k = Math.round(kind);
        g.setAttribute("transform", `translate(${P2(a.hand)})`);
        h.dot.setAttribute("r", k === 3 ? 10 : 7.5);
        let d = "";
        const fd = (deg, len) => {
          const v = dir(deg);
          return `M0 0 L${f1(v[0] * len)} ${f1(v[1] * len)} `;
        };
        if (k === 1) d = fd(a.ang - 32, 13) + fd(a.ang, 15) + fd(a.ang + 32, 13);
        if (k === 2) d = fd(a.ang, 21);
        h.fingers.setAttribute("d", d);
      };
      drawHand(hands.L, handL, aL, poseArm.hL);
      drawHand(hands.R, handR, aR, poseArm.hR);

      // face
      const hairLag = evalTrack(poses, t - 0.14, poseRes, POSES.idle).tilt - poseHead.tilt;
      head.setAttribute("transform", `translate(${P2(hc)}) rotate(${f1(tilt)})`);
      const sway = hairLag * 0.9 + Math.sin(t * 2.3) * 1.5;
      hair.setAttribute(
        "d",
        `M-10 -63 Q${f1(-16 + sway)} -80 ${f1(-24 + sway * 1.4)} -86 M0 -66 Q${f1(sway)} -86 ${f1(3 + sway * 1.6)} -96 M10 -63 Q${f1(18 + sway)} -78 ${f1(26 + sway * 1.3)} -82`,
      );
      const bl = blinkAt(t);
      const open = clamp(face.eyeOpen * bl, 0, 1.2);
      const ex = look.lx * 8;
      const ey = look.ly * 6 - 4;
      const eyeR0 = 6.6 * face.eyeS;
      for (const [eye, lid, cx] of [
        [eyeL, lidL, -28],
        [eyeR, lidR, 28],
      ]) {
        eye.setAttribute("cx", f1(cx + ex));
        eye.setAttribute("cy", f1(ey));
        eye.setAttribute("rx", f1(eyeR0));
        eye.setAttribute("ry", f1(Math.max(0.5, eyeR0 * open)));
        const closed = open < 0.3;
        eye.setAttribute("opacity", closed ? 0 : 1);
        lid.setAttribute("d", closed ? `M${f1(cx + ex - 8)} ${f1(ey)} Q${f1(cx + ex)} ${f1(ey + 4)} ${f1(cx + ex + 8)} ${f1(ey)}` : "");
      }
      const by = -40;
      const tiltB = face.bTilt;
      browL.setAttribute("d", `M-42 ${f1(by + face.bL - tiltB * 0.35)} Q-28 ${f1(by + face.bL - 6)} -14 ${f1(by + face.bL + tiltB * 0.35)}`);
      browR.setAttribute("d", `M14 ${f1(by + face.bR + tiltB * 0.35)} Q28 ${f1(by + face.bR - 6)} 42 ${f1(by + face.bR - tiltB * 0.35)}`);
      glasses.setAttribute("transform", `translate(0 ${f1(poseHead.glassesY)})`);
      blushL.setAttribute("opacity", f1(face.blush * 0.55));
      blushR.setAttribute("opacity", f1(face.blush * 0.55));

      const m = mouthAt(t);
      const op = clamp(m.open * talkGain + face.mO, 0, 1.2);
      const wide = m.shape === "w" ? 1.18 : m.shape === "o" ? 0.72 : 1;
      const mw = (27 + face.smile * 4) * (op > 0.08 ? wide : 1);
      const mx = look.lx * 4;
      const my = 33;
      const c = face.smile * 11;
      if (op < 0.08) {
        mouth.setAttribute("d", `M${f1(mx - mw / 2)} ${f1(my - c * 0.3)} Q${f1(mx)} ${f1(my + c)} ${f1(mx + mw / 2)} ${f1(my - c * 0.3)}`);
        mouth.setAttribute("fill", "none");
        tongue.setAttribute("d", "");
      } else {
        const h = 6 + op * 20;
        const top = my - c * 0.25 - h * 0.18;
        mouth.setAttribute(
          "d",
          `M${f1(mx - mw / 2)} ${f1(top)} Q${f1(mx)} ${f1(top + c * 0.5)} ${f1(mx + mw / 2)} ${f1(top)} Q${f1(mx + mw * 0.42)} ${f1(top + h + c * 0.4)} ${f1(mx)} ${f1(top + h + c * 0.45)} Q${f1(mx - mw * 0.42)} ${f1(top + h + c * 0.4)} ${f1(mx - mw / 2)} ${f1(top)} Z`,
        );
        mouth.setAttribute("fill", "#3b2321");
        const tw = mw * 0.28;
        const tb = top + h + c * 0.4;
        tongue.setAttribute("d", h > 12 ? `M${f1(mx - tw)} ${f1(tb - 2)} Q${f1(mx)} ${f1(tb - h * 0.45)} ${f1(mx + tw)} ${f1(tb - 2)} Z` : "");
      }

      // place the whole figure
      const s = mv.s;
      const rot = pose.rot;
      root.setAttribute("transform", `translate(${f1(mv.x)} ${f1(mv.y + hopY * s)}) rotate(${f1(rot)}) scale(${(s).toFixed(4)})`);
      shadow.setAttribute("rx", f1(74 * (1 - mv.hop * 0.4)));
      shadow.setAttribute("opacity", rot ? 0 : 1);

      // scene-space points for props and cameras
      const toScene = (p) => {
        const c = Math.cos(rot * D2R);
        const sn = Math.sin(rot * D2R);
        return [mv.x + (p[0] * c - p[1] * sn) * s, mv.y + hopY * s + (p[0] * sn + p[1] * c) * s];
      };
      const inHead = (p) => {
        const c = Math.cos(tilt * D2R);
        const sn = Math.sin(tilt * D2R);
        return toScene([hc[0] + p[0] * c - p[1] * sn, hc[1] + p[0] * sn + p[1] * c]);
      };
      state.pts = {
        handL: toScene(aL.hand),
        handR: toScene(aR.hand),
        head: toScene(hc),
        lensL: inHead([-28, -4 + poseHead.glassesY]),
        lensR: inHead([28, -4 + poseHead.glassesY]),
        feet: toScene([0, 0]),
        neck: toScene(neck),
        scale: s,
        tilt,
      };
      return state.pts;
    }

    return {
      render,
      point: (k) => state.pts[k],
      at: (t) => render(t),
    };
  }

  window.Specs = { create, POSES, FACES, ikArm, reach, EASE };
})();

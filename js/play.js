/* Rule Road minigames: each town's rule drawn as a live scene, plus hands-on games that make a choice for you.
   stage(T, s) draws the scene under the meters; Play.mount() wires up the game for the current step after each render.
   Step fields: play: { kind: "catch" }       – catch the falling hour (Tockfield)
                drag: { item, label, zones } – drag the item into a zone to choose (Inchwick)
                pay:  true                    – tap dogs smallest-first to pay them back (Leashville)
   Laterton needs no field: a heavy shadow turns "Next" into hold-to-drag. Petalton's yard grows from spoken sorries (mic). */

const Play = {
  mem: {},        // last drawn values per town, so scenes animate from the old value to the new one
  timer: 0, raf: 0, boilT: 0, autoT: 0,

  stop() { cancelAnimationFrame(this.raf); clearTimeout(this.timer); clearInterval(this.boilT); clearTimeout(this.autoT); this.raf = this.boilT = this.autoT = 0; if (typeof Preview !== "undefined") Preview.on = -1; },

  // after a finger gesture lands on a choice: show the result long enough to read, then go to the next day.
  // The Next button fills up as a countdown and still works for anyone who wants to skip ahead.
  // Not when the next step needs its own action (Laterton's heavy shadow, passing the phone in road-trip mode).
  autoNext() {
    if (S.sleep) return; // Doubleton/Halfnight: midnight waits for you to hold the moon
    const b = document.querySelector('.go[data-act="next"]');
    if (!b || /Pass the phone/.test(b.textContent)) return;
    const r = S.lastResult || {}, chars = ((r.say || "") + (r.night || "").replace(/<[^>]+>/g, "")).length;
    const ms = Math.max(2400, Math.min(5200, 1600 + chars * 32));
    b.style.setProperty("--auto-ms", ms + "ms"); b.classList.add("auto");
    const go = () => {
      if (!document.body.contains(b) || S.phase !== "result") return;
      if (Voice.el && !Voice.el.paused && !Voice.el.ended) { this.autoT = setTimeout(go, 400); return; } // let the narrator finish
      next();
    };
    this.autoT = setTimeout(go, ms);
  },

  // field-journal scenes: re-seed the shared ink filter so the pen lines shimmer like a flipbook (off for reduced motion)
  boil() {
    const n = document.getElementById("ink-noise");
    if (!n || Juice.reduced || !document.querySelector(".sketch")) return;
    let k = 0;
    this.boilT = setInterval(() => { if (!document.hidden) n.setAttribute("seed", 1 + (k = (k + 1) % 3)); }, 160);
  },

  // after a choice: keep the dog pack in step with the Leashville numbers
  after(T, before, s) {
    if (T.id !== "M5") return;
    s.free = Math.max(0, s.free); // freedom bottoms out at zero
    if (!s.pack) s.pack = [];
    if (s.dogs > before.dogs) {
      let grow = s.size - before.size;
      if (!s.pack.length && Glove.has("biscuit") && grow > 1) { s.size -= grow - 1; grow = 1; } // the biscuit keeps the first dog a puppy
      s.pack.push(grow);
    }
    else if (s.dogs === 0) s.pack = [];
    else if (s.size > before.size) s.pack = s.pack.map(x => x * 2);
  },

  mount() {
    this.stop();
    if (S.screen !== "town") return;
    const T = TOWNS[S.t], st = S.phase === "step" ? T.steps[S.step] : null;
    if (typeof paintPreload === "function") paintPreload(T.id);
    if (typeof Film !== "undefined") Film.watch();
    animateStage(T);
    this.boil();
    if (st && st.play && st.play.kind === "catch" && !S.played) catchGame(st);
    if (st && st.drag && S.phase === "step") dragGame(st);
    if (st && st.pay && S.phase === "step") payGame(st);
    if (T.id === "M-shadow" && S.s.lb > 50) heavyNext();
    if (document.getElementById("actitem")) actGame();
    if (T.id === "L1" && st && st.choices) sayGame(st); // Hushwick: hold a line to say it, one word token per beat
    if (st && S.phase === "step") { if (st.loop) loopGame(st); if (st.tiptoe) tiptoeGame(st); if (st.tune) tuneGame(st); if (st.slider) sliderGame(st); }
    if (S.sleep && S.phase === "result") moonGame();
  },
};

/* ---------- scenes ---------- */
// every town's scene is an ink sketch from js/sketch.js; the minigames below wire into the pieces those scenes draw
function stage(T, s) {
  const st = S.phase === "step" || S.phase === "result" ? T.steps[S.step] : null;
  return typeof SCENES !== "undefined" && SCENES[T.id] ? SCENES[T.id](s, st) : "";
}

// scenes animate from the last value they showed
function animateStage(T) {
  const f = document.querySelector("[data-scene]"); if (!f) return;
  const k = f.dataset.scene, v = +f.dataset.val, was = Play.mem[k];
  Play.mem[k] = v;
  if (was === undefined || was === v) return;
  if (k === "house") {
    const g = f.querySelector(".house"); g.style.transform = `scaleY(${Math.max(40, was) / v})`;
    requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transition = "transform .7s cubic-bezier(.3,1.4,.5,1)"; g.style.transform = ""; }));
    if (v < was) { Sound.tone(110, .5, "sawtooth", .05); Sound.tone(90, .6, "triangle", .07, .1); Juice.buzz([30, 40, 30]); } // creak
  }
  if (k === "shadow") {
    const e = f.querySelector(".shade"); e.style.transform = `scaleX(${Math.max(0.05, was / v)})`;
    requestAnimationFrame(() => requestAnimationFrame(() => { e.style.transition = "transform 1.2s ease-out"; e.style.transform = ""; }));
  }
  if (k === "dogs" && v > was) { Sound.tone(220, .15, "square", .05); Sound.tone(180, .2, "square", .05, .16); } // woof woof
}

/* ---------- Tockfield: catch the falling hour ---------- */
function catchGame(st) {
  const box = document.getElementById("catch"), orb = document.getElementById("orb"), jar = document.getElementById("cjar");
  if (!box) return;
  const W = () => box.clientWidth, H = () => box.clientHeight;
  let jx = 0.5, ox = 0.15 + Math.random() * 0.7, drift = (Math.random() - 0.5) * 0.25, t0 = 0, done = false;
  const dur = Juice.reduced ? 3600 : 2600;
  const place = () => { jar.style.left = jx * W() + "px"; };
  // the jar moves with the thumb (only sideways movement counts), and jumps only if you touch far away from it
  let ax = null, aj = 0, held = false;
  const clamp = v => Math.max(0.08, Math.min(0.92, v));
  const onDown = e => {
    const p = e.touches ? e.touches[0] : e; if (!p) return; held = true;
    const r = box.getBoundingClientRect(), fx = (p.clientX - r.left) / r.width;
    if (Math.abs(fx - jx) * r.width > 60) { jx = clamp(fx); place(); }
    ax = p.clientX; aj = jx;
    try { box.setPointerCapture(e.pointerId); } catch {}
    if (e.cancelable) e.preventDefault();
  };
  const onMove = e => {
    if (!held) return; const p = e.touches ? e.touches[0] : e; if (!p) return;
    jx = clamp(aj + (p.clientX - ax) / box.getBoundingClientRect().width); place();
    if (e.cancelable) e.preventDefault();
  };
  const onUp = () => { held = false; };
  if (window.PointerEvent) { box.addEventListener("pointerdown", onDown); box.addEventListener("pointermove", onMove); ["pointerup", "pointercancel"].forEach(v => box.addEventListener(v, onUp)); }
  else { box.addEventListener("touchstart", onDown, { passive: false }); box.addEventListener("touchmove", onMove, { passive: false }); box.addEventListener("touchend", onUp); box.addEventListener("mousedown", onDown); document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); }
  box.addEventListener("keydown", e => { if (e.key === "ArrowLeft") { jx = Math.max(0.08, jx - 0.08); place(); } if (e.key === "ArrowRight") { jx = Math.min(0.92, jx + 0.08); place(); } });
  place();
  const tick = now => {
    if (done || !document.body.contains(box)) return;
    if (!t0) t0 = now;
    const p = Math.min(1, (now - t0) / dur);
    const x = Math.max(0.05, Math.min(0.95, ox + drift * p)), y = p * p;
    orb.style.left = x * W() + "px"; orb.style.top = y * (H() - 46) + "px";
    if (p >= 1) {
      done = true;
      const hit = Math.abs(x - jx) * W() < (Glove.has("big-jar") ? 62 : 40);
      S.played = true;
      if (hit) {
        Juice.burst(jar, 10, "money"); Sound.good();
        const tip = document.getElementById("catch-tip"); if (tip) tip.textContent = "Caught it!";
        Play.timer = setTimeout(() => render(), 500);
      } else {
        Juice.penalty(); S.played = "miss";
        pick(-1, { say: "It bounced off the jar's rim and rolled into the dark. That hour is gone." });
      }
      return;
    }
    Play.raf = requestAnimationFrame(tick);
  };
  Play.timer = setTimeout(() => { Play.raf = requestAnimationFrame(tick); }, 700); // a beat to see where the jar is
}

/* ---------- Inchwick: drag it into the house, or leave it ---------- */
function dragGame(st) {
  const chip = document.getElementById("dragchip"); if (!chip) return;
  const zones = [...document.querySelectorAll("[data-zone]")];
  let sx = 0, sy = 0, on = false, moved = 0;
  const at = (x, y) => zones.find(z => { const r = z.getBoundingClientRect(), m = 14; return x >= r.left + m && x <= r.right - m && y >= r.top + m && y <= r.bottom - m; });
  const centre = () => { const r = chip.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const down = e => { const p = e.touches ? e.touches[0] : e; on = true; sx = p.clientX; sy = p.clientY; chip.classList.add("lifted"); if (e.cancelable) e.preventDefault(); };
  const move = e => {
    if (!on) return; const p = e.touches ? e.touches[0] : e;
    chip.style.transform = `translate(${p.clientX - sx}px, ${p.clientY - sy}px) rotate(-4deg)`;
    moved = Math.max(moved, Math.hypot(p.clientX - sx, p.clientY - sy));
    const c = centre(), z = moved > 36 ? at(c[0], c[1]) : null; zones.forEach(q => q.classList.toggle("hot", q === z));
    if (z) Preview.show(+z.dataset.zone); else Preview.clear();
    if (e.cancelable) e.preventDefault();
  };
  const up = e => {
    if (!on) return; on = false;
    const c = centre(), z = moved > 36 ? at(c[0], c[1]) : null; moved = 0;
    chip.classList.remove("lifted"); zones.forEach(q => q.classList.remove("hot"));
    if (z) { chip.style.opacity = "0"; Juice.buzz([12]); Preview.clear(); pick(+z.dataset.zone); Play.autoNext(); }
    else { Preview.clear(); Juice.buzz([6]); chip.style.transition = "transform .38s cubic-bezier(.175,.885,.32,1.275)"; chip.style.transform = ""; setTimeout(() => { chip.style.transition = ""; }, 400); }
  };
  if (window.PointerEvent) {
    chip.addEventListener("pointerdown", e => { try { chip.setPointerCapture(e.pointerId); } catch {} down(e); });
    chip.addEventListener("pointermove", move); chip.addEventListener("pointerup", up); chip.addEventListener("pointercancel", up);
  } else {
    chip.addEventListener("touchstart", down, { passive: false }); chip.addEventListener("touchmove", move, { passive: false }); chip.addEventListener("touchend", up);
    chip.addEventListener("mousedown", down); document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }
}
function dragPanel(st) {
  return `<div class="dragzone">
    <div class="zone" data-zone="${st.drag.zones[0].pick}">${esc(st.drag.zones[0].label)}</div>
    <button class="chip" id="dragchip" aria-label="Drag ${esc(st.drag.label)}"><b>${st.drag.item}</b><span>${esc(st.drag.label)}</span></button>
    <div class="zone" data-zone="${st.drag.zones[1].pick}">${esc(st.drag.zones[1].label)}</div>
  </div>`;
}

/* ---------- live preview while dragging: the page reacts to a choice before you let go ----------
   It shows WHICH meters a choice would touch (a pulsing dot, bigger for bigger changes), never which way or how much,
   so each town's catch stays hidden. The drawing acts out the rule on the sign (the ceiling creaks down, a ghost dog
   trots in) through pv-<meter>-up/down classes on the scene, plus a few scenes that need the actual numbers. */
const SCENE_PREVIEW = {
  // Inchwick: the house squashes by exactly the inches this would cost
  "M-shrink": (fig, a, b) => { const g = fig.querySelector(".house"); if (g && b.door !== a.door) { g.style.transition = "transform .35s cubic-bezier(.175,.885,.32,1.275)"; g.style.transform = `scaleY(${(Math.max(40, b.door) / Math.max(40, a.door)).toFixed(3)})`; } },
  // Chargeville: the battery fill slides to where this would leave you
  L3: (fig, a, b) => { const r = fig.querySelector(".bat-fill"); if (r && b.bat !== a.bat) { const h = Math.round(Math.max(0, Math.min(100, b.bat)) * .74); r.style.transition = "y .35s, height .35s"; r.setAttribute("y", 103 - h); r.setAttribute("height", h); } },
};
const Preview = {
  on: -1,
  show(i, toward) {
    if (i === this.on) return;
    this.clear(); if (!(i >= 0)) return;
    const r = dryRun(i), fig = document.querySelector("[data-scene]"); if (!r || !fig) return;
    this.on = i;
    const T = TOWNS[S.t];
    T.meters.forEach(m => {
      const a = r.before[m.k], b = r.after[m.k];
      if (typeof a !== "number" || typeof b !== "number" || a === b) return;
      const box = document.querySelector(`.mv[data-k="${m.k}"]`); const el = box && box.closest(".meter");
      const big = Math.abs(b - a) >= (m.max ? m.max * 0.2 : Math.max(2, Math.abs(a) * 0.5));
      if (el) el.classList.add("pv", big ? "pv-big" : "pv-small");
      fig.classList.add(`pv-${m.k}-${b > a ? "up" : "down"}`);
    });
    if (r.after.opened && !r.before.opened) fig.classList.add("pv-opened");
    const score = T.meters.reduce((sum, m) => { const d = r.after[m.k] - r.before[m.k]; if (!d || typeof d !== "number") return sum; const w = dirOf(T, m.k) === "down" ? -1 : dirOf(T, m.k) === "up" || !kidOf(T) ? 1 : 0; return sum + Math.sign(d) * w; }, 0);
    if (score) fig.classList.add(score > 0 ? "pv-good" : "pv-bad"); // the traveler's face reacts before you let go
    fig.classList.add("previewing"); fig.style.setProperty("--pvtilt", (toward || 0) * 1.2 + "deg");
    if (SCENE_PREVIEW[T.id]) SCENE_PREVIEW[T.id](fig, r.before, r.after);
    Juice.buzz([5]);
  },
  clear() {
    if (this.on < 0) return; this.on = -1;
    document.querySelectorAll(".meter.pv").forEach(e => e.classList.remove("pv", "pv-big", "pv-small"));
    const fig = document.querySelector("[data-scene]"); if (!fig) return;
    [...fig.classList].filter(c => c.startsWith("pv-")).forEach(c => fig.classList.remove(c));
    fig.classList.remove("previewing");
    const g = fig.querySelector(".house"); if (g && TOWNS[S.t].id === "M-shrink") g.style.transform = "";
    const f = fig.querySelector(".bat-fill"); if (f && f.dataset.y) { f.setAttribute("y", f.dataset.y); f.setAttribute("height", f.dataset.h); }
  },
};

/* ---------- act it out: drag the item on the drawing onto a zone to choose ---------- */
function actGame() {
  const item = document.getElementById("actitem"), zones = [...document.querySelectorAll(".act-zone")];
  if (item.dataset.bound) return; item.dataset.bound = "1";
  let sx = 0, sy = 0, on = false, hot = null;
  const at = (x, y) => zones.find(z => { const r = z.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
  const pt = e => e.touches ? e.touches[0] || e.changedTouches[0] : e;
  const back = () => { Preview.clear(); Juice.buzz([6]); item.style.transition = "transform .38s cubic-bezier(.175,.885,.32,1.275)"; item.style.transform = ""; setTimeout(() => { item.style.transition = ""; }, 400); };
  const side = z => { const a = item.getBoundingClientRect(), b = z.getBoundingClientRect(); return Math.sign((b.left + b.width / 2) - (a.left + a.width / 2)); };
  const down = e => {
    const p = pt(e); if (!p) return; on = true; sx = p.clientX; sy = p.clientY;
    item.classList.add("lifted"); Sound.tone(520, .06, "triangle", .05);
    try { item.setPointerCapture(e.pointerId); } catch {}
    if (e.cancelable) e.preventDefault();
  };
  const move = e => {
    if (!on) return; const p = pt(e); if (!p) return;
    item.style.transform = `translate(${p.clientX - sx}px, ${p.clientY - sy}px) scale(1.15)`;
    const z = at(p.clientX, p.clientY);
    if (z !== hot) {
      zones.forEach(q => q.classList.toggle("hot", q === z && z.dataset.zone !== "off")); hot = z;
      if (z) { Juice.buzz([8]); Sound.tone(z.dataset.zone === "off" ? 200 : 700, .05, "triangle", .04); }
      if (z && z.dataset.zone !== "off") Preview.show(+z.dataset.zone, side(z)); else Preview.clear();
    }
    if (e.cancelable) e.preventDefault();
  };
  const up = () => {
    if (!on) return; on = false; item.classList.remove("lifted"); zones.forEach(q => q.classList.remove("hot"));
    const z = hot; hot = null;
    if (!z) return back();
    if (z.dataset.zone === "off") { Juice.penalty(); z.classList.add("nope"); setTimeout(() => z.classList.remove("nope"), 400); return back(); }
    item.style.transition = "opacity .2s"; item.style.opacity = "0";
    Juice.buzz([12]); Preview.clear(); pick(+z.dataset.zone); Play.autoNext();
  };
  if (window.PointerEvent) {
    item.addEventListener("pointerdown", down); item.addEventListener("pointermove", move);
    item.addEventListener("pointerup", up); item.addEventListener("pointercancel", () => { on = false; hot = null; item.classList.remove("lifted"); zones.forEach(q => q.classList.remove("hot")); back(); });
  } else {
    item.addEventListener("touchstart", down, { passive: false }); item.addEventListener("touchmove", move, { passive: false }); item.addEventListener("touchend", up);
    item.addEventListener("mousedown", down); document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }
  // a click without a drag (keyboard, or a tap) points the player at the buttons instead of choosing for them
  item.addEventListener("click", e => { if (e.detail === 0) { const c = document.querySelector(".choices .choice:not([disabled])"); if (c) c.focus(); } });
}

/* ---------- Hushwick: hold a line to say it; one word token goes per beat ---------- */
function sayGame(st) {
  const per = Juice.reduced ? 120 : 200; // ms per word
  document.querySelectorAll('.choice[data-act="pick"]').forEach(b => {
    const i = +b.dataset.c, c = st.choices[i];
    if (!c || !c.w || b.disabled) return;
    b.dataset.act = "hold-say"; b.classList.add("hold");
    b.insertAdjacentHTML("afterbegin", '<i class="fill"></i>');
    const fill = b.querySelector(".fill");
    let t = 0, spent = 0, holding = false;
    const toks = () => { const left = S.s.words; return Array.from({ length: c.w }, (_, k) => document.querySelector(`[data-tok="${left - 1 - k}"]`)); };
    const reset = () => { clearInterval(t); holding = false; spent = 0; fill.style.width = "0"; toks().forEach(x => x && x.classList.remove("spend")); };
    const go = e => {
      if (holding) return; holding = true; if (e && e.cancelable) e.preventDefault();
      const tk = toks();
      const beat = () => {
        if (tk[spent]) tk[spent].classList.add("spend");
        Sound.tone(660 * Math.pow(1.08, spent), .08, "triangle", .06); Juice.buzz([6]);
        spent += 1; fill.style.width = (spent / c.w * 100) + "%";
        if (spent >= c.w) { clearInterval(t); holding = false; setTimeout(() => pick(i), 120); }
      };
      beat(); if (spent < c.w) t = setInterval(beat, per);
    };
    const stop = () => { if (holding && spent < c.w) reset(); };
    if (window.PointerEvent) { b.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(v => b.addEventListener(v, stop)); }
    else { b.addEventListener("touchstart", go, { passive: false }); b.addEventListener("mousedown", go); ["touchend", "touchcancel", "mouseup", "mouseleave"].forEach(v => b.addEventListener(v, stop)); }
    b.addEventListener("contextmenu", e => e.preventDefault()); // a long press shouldn't open the phone's menu
    b.addEventListener("click", e => { if (e.detail === 0) pick(i); }); // keyboard: Enter or Space says it straight away
  });
}

/* ---------- silent gestures: draw a loop (Petalton), tiptoe (Whisperton), tune a note (Harmonia) ----------
   Each works on a layer laid over the scene drawing, in the drawing's own units (300 wide, data-h tall),
   and ends by picking a choice exactly as a tap would, then moving on by itself. */
const Gest = {
  at(el, e) { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 300, (e.clientY - r.top) / r.height * +el.dataset.h]; },
  cap(t) { const c = document.querySelector("[data-scene] figcaption"); if (c) c.textContent = t; },
  done(i, dyn) { if (dyn) pick(-1, dyn); else pick(i); Play.autoNext(); },
  bind(el, down, move, up) {
    if (!el || el.dataset.bound) return false; el.dataset.bound = "1";
    el.addEventListener("pointerdown", e => { if (e.target.closest("[data-act]")) return; try { el.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); down(e); });
    el.addEventListener("pointermove", e => { e.preventDefault(); move(e); });
    ["pointerup", "pointercancel"].forEach(v => el.addEventListener(v, e => up(e)));
    return true;
  },
};

// Petalton: one unbroken loop around the bud says sorry. Lifting early just fizzles; try again
function loopGame(st) {
  const L = document.getElementById("loop"), cx = L ? +L.dataset.cx : 0, cy = L ? +L.dataset.cy : 0;
  let pts = null, turn = 0, last = 0;
  const trail = L && L.querySelector(".trail"), draw = () => trail.setAttribute("points", (pts || []).map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "));
  const angle = p => Math.atan2(p[1] - cy, p[0] - cx);
  Gest.bind(L, e => { pts = [Gest.at(L, e)]; turn = 0; last = angle(pts[0]); draw(); },
    e => {
      if (!pts) return; const p = Gest.at(L, e); pts.push(p);
      let d = angle(p) - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turn += d; last = angle(p); draw();
      if (Math.abs(turn) > 5.5) { pts = null; Juice.buzz([15, 30, 15]); Gest.done(0); } // most of a full circle
    },
    () => { if (!pts) return; pts = null; draw(); if (Math.abs(turn) > 0.6) { Juice.buzz([10]); Gest.cap("Almost! Keep your finger down all the way around the bud."); } });
}

// Whisperton: tap the bridge tiles left to right. Long presses and rushed taps are stomps: each one cracks the glass
function tiptoeGame(st) {
  const L = document.getElementById("tiptoe"), cfg = st.tiptoe, kid = document.getElementById("tipkid");
  if (!L) return;
  const N = cfg.taps || 9, allowed = (cfg.cracks || 0) + (Glove.has("muffler") ? 1 : 0), tile = i => 8 + i * 28.4;
  const next = L.querySelector(".next"), cracks = L.querySelector(".cracks");
  let at = 0, t0 = 0, aim = -1, lastUp = 0, stomps = 0, over = false;
  const show = () => { next.setAttribute("x", (tile(at + 1)).toFixed(1)); };
  Gest.bind(L, e => { if (over) return; const [x] = Gest.at(L, e); aim = Math.floor((x - 8) / 28.4); t0 = performance.now(); },
    () => {},
    () => {
      if (over || aim < 0) return;
      const now = performance.now(), held = now - t0, rushed = lastUp && now - lastUp < 170;
      if (aim !== at + 1) { aim = -1; Gest.cap("Step on the next tile, the one glowing."); return; }
      at = aim; aim = -1; lastUp = now;
      if (kid) kid.setAttribute("transform", `translate(${(tile(at) - tile(0)).toFixed(1)} 0)`);
      if (!cfg.intro && (held > 260 || rushed)) {
        stomps += 1; Juice.buzz([80]); Sound.tone(140, .25, "sawtooth", .05);
        cracks.insertAdjacentHTML("beforeend", `<path d="M${tile(at) + 4} 109 l6 5 l-2 3 l8 2 M${tile(at) + 14} 110 l5 8" />`);
        const f = L.closest(".stage"); f.classList.remove("shudder"); void f.offsetWidth; f.classList.add("shudder");
        Gest.cap(stomps > allowed ? "Too loud. The glass gives way!" : `Stomp! ${allowed - stomps} more and it breaks. Lighter taps.`);
      } else { Juice.buzz([8]); Sound.tone(1200 + at * 40, .05, "sine", .03); }
      if (stomps > allowed) { over = true; return Gest.done(Math.max(0, st.choices.findIndex(c => !c.gesture))); }
      if (at >= N) {
        over = true;
        if (cfg.intro) return Gest.done(0);
        const g = st.choices.find(c => c.gesture);
        Gest.done(-1, { ...g, fx: s => { if (g.fx) g.fx(s); s.glass -= stomps * cfg.cost; },
          say: stomps ? `${stomps === 1 ? "One crack" : stomps + " cracks"} under your feet… but you made it across.` : val(g.say, S.s) });
        return;
      }
      show();
    });
}

// Harmonia: drag the note up and down the staff and hold it steady. Morning sets your note; later doors want
// higher, lower, the same note again, or one smooth slide up. The Tuning Fork widens the "same note" window
function tuneGame(st) {
  const L = document.getElementById("tune"), cfg = st.tune;
  if (!L) return;
  const note = L.querySelector(".note"), ring = L.querySelector(".hold"), base = S.base || 0.5, tol = Glove.has("fork") ? 0.12 : 0.07;
  const Y = v => 26 + v * 88, V = y => Math.max(0, Math.min(1, (y - 26) / 88));
  const ok = v => ({ any: true, higher: v < base - 0.12, lower: v > base + 0.12, match: Math.abs(v - base) < tol })[cfg.mode];
  const C = 2 * Math.PI * 14; ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C;
  let v = cfg.mode === "slide" ? 0.95 : 0.5, held = false, still = 0, stillV = v, timer = 0, slide = null, over = false;
  const place = () => note.setAttribute("transform", `translate(203 ${Y(v).toFixed(1)})`);
  const finish = () => { over = true; held = false; clearInterval(timer); if (cfg.mode === "any") S.base = v; Juice.buzz([25, 40, 25]); Sound.good(); Gest.done(st.choices.findIndex(c => c.gesture)); };
  const tick = () => {
    if (!held || over) return clearInterval(timer);
    const need = (cfg.secs || 1) * 1000, t = ok(v) ? performance.now() - still : 0;
    ring.style.strokeDashoffset = C * (1 - Math.min(1, t / need)); note.classList.toggle("in", ok(v));
    if (t >= need) finish();
  };
  Gest.bind(L, e => {
    if (over) return; held = true; v = V(Gest.at(L, e)[1]); place(); still = performance.now(); stillV = v;
    if (cfg.mode === "slide") slide = { v0: v, t0: performance.now() }; else { clearInterval(timer); timer = setInterval(tick, 50); }
  }, e => {
    if (!held || over) return; v = V(Gest.at(L, e)[1]); place();
    if (Math.abs(v - stillV) > 0.035) { still = performance.now(); stillV = v; } // moving resets the hold
    if (slide && slide.v0 > 0.62 && v < 0.3 && performance.now() - slide.t0 < 1500) finish();
  }, () => {
    if (over || !held) return; held = false; clearInterval(timer); ring.style.strokeDashoffset = C; slide = null;
    Gest.cap(({ any: "Hold it still a little longer.", higher: "Higher than your line, and hold.", lower: "Lower than your line, and hold.", match: "Find the line from this morning, and hold.", slide: "Start at the bottom and swipe up in one go." })[cfg.mode]);
  });
  place();
}

// Laterton: slide toward "pay later" and the shadow stretches under your finger; let go at an end to choose
function sliderGame(st) {
  const L = document.getElementById("slider"); if (!L) return;
  const knob = L.querySelector(".slide-knob"), shade = document.querySelector(".stage-shadow .shade"), x0 = 100, x1 = 284;
  let f = 0.5, on = false;
  const place = () => { knob.setAttribute("cx", (x0 + f * (x1 - x0)).toFixed(1)); if (shade) { shade.style.transition = "none"; shade.style.transform = `scaleX(${(1 + Math.max(0, f - 0.5) * 14).toFixed(2)})`; } };
  Gest.bind(L, e => { on = true; f = Math.max(0, Math.min(1, (Gest.at(L, e)[0] - x0) / (x1 - x0))); place(); },
    e => { if (!on) return; f = Math.max(0, Math.min(1, (Gest.at(L, e)[0] - x0) / (x1 - x0))); place(); if (f > 0.75) Juice.buzz([6]); },
    () => {
      if (!on) return; on = false;
      if (f >= 0.85) return Gest.done(0);
      if (f <= 0.15) return Gest.done(1);
      f = 0.5; place(); Gest.cap("Slide all the way to one end.");
    });
}

// Doubleton/Halfnight: hold the moon for a moment to sleep until midnight
function moonGame() {
  const b = document.getElementById("moonhold"); if (!b || b.dataset.bound) return; b.dataset.bound = "1";
  let t = 0, p = 0;
  const go = e => { if (e && e.cancelable) e.preventDefault(); clearInterval(t); const t0 = performance.now(); p = 0;
    t = setInterval(() => { p = (performance.now() - t0) / 900; b.style.setProperty("--p", Math.min(100, p * 100) + "%"); if (p >= 1) { clearInterval(t); wake(); } }, 50); };
  const stop = () => { if (p < 1) { clearInterval(t); p = 0; b.style.setProperty("--p", "0%"); } };
  b.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(v => b.addEventListener(v, stop));
  b.addEventListener("click", e => { if (e.detail === 0) wake(); }); // keyboard: Enter or Space sleeps straight away
  b.addEventListener("contextmenu", e => e.preventDefault());
}

/* ---------- Leashville: pay the dogs back, smallest first ---------- */
function payGame(st) {
  const s = S.s;
  document.querySelectorAll("[data-dog]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const i = +b.dataset.dog, smallest = Math.min.apply(null, s.pack);
    if (s.pack[i] !== smallest) { Juice.penalty(); b.classList.add("nope"); setTimeout(() => b.classList.remove("nope"), 400); const c = document.querySelector(".stage-dogs figcaption"); if (c) c.textContent = "Start with the smallest dog. It's the fastest to pay off."; return; }
    Juice.burst(b, 6, "money");
    b.classList.add("gone");
    s.pack[i] = Infinity;
    if (s.pack.every(v => v === Infinity)) { s.pack = []; setTimeout(() => { pick(0); Play.autoNext(); }, 450); }
  }));
}

/* ---------- Laterton: a heavy shadow has to be dragged to the next scene ---------- */
function heavyNext() {
  const b = document.querySelector('[data-act="next"]'); if (!b) return;
  const need = Math.min(3200, 500 + S.s.lb * 1.5) / (Glove.has("shades") ? 2 : 1); // ms of holding
  b.dataset.act = "hold-next"; b.classList.add("heavy");
  b.innerHTML = `<i class="fill"></i><span>Hold to drag your shadow (${S.s.lb.toLocaleString("en-US")} lb)</span>`;
  const fill = b.querySelector(".fill");
  let t0 = 0, raf = 0;
  const go = e => { if (e.cancelable) e.preventDefault(); t0 = performance.now(); Juice.buzz([20]); step(); };
  const step = () => { const p = Math.min(1, (performance.now() - t0) / need); fill.style.width = p * 100 + "%"; if (p >= 1) { Juice.buzz([10, 20, 10]); next(); window.scrollTo(0, 0); return; } raf = requestAnimationFrame(step); };
  const stop = () => { cancelAnimationFrame(raf); if (fill) fill.style.width = "0"; };
  if (window.PointerEvent) { b.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(v => b.addEventListener(v, stop)); }
  else { b.addEventListener("touchstart", go, { passive: false }); b.addEventListener("mousedown", go); ["touchend", "touchcancel", "mouseup", "mouseleave"].forEach(v => b.addEventListener(v, stop)); }
  b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { if (!e.repeat) go(e); } });
  b.addEventListener("keyup", stop);
}


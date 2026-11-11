/* Rule Road minigames: each town's rule drawn as a live scene, plus hands-on games that make a choice for you.
   stage(T, s) draws the scene under the meters; Play.mount() wires up the game for the current step after each render.
   Step fields: play: { kind: "catch" }       – catch the falling hour (Tockfield)
                drag: { item, label, zones } – drag the item into a zone to choose (Inchwick)
                pay:  true                    – tap dogs smallest-first to pay them back (Leashville)
   Laterton needs no field: a heavy shadow turns "Next" into hold-to-drag. Petalton's yard grows from spoken sorries (mic). */

const Play = {
  mem: {},        // last drawn values per town, so scenes animate from the old value to the new one
  timer: 0, raf: 0, boilT: 0,

  stop() { cancelAnimationFrame(this.raf); clearTimeout(this.timer); clearInterval(this.boilT); this.raf = this.boilT = 0; },

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
    animateStage(T);
    this.boil();
    if (st && st.play && st.play.kind === "catch" && !S.played) catchGame(st);
    if (st && st.drag && S.phase === "step") dragGame(st);
    if (st && st.pay && S.phase === "step") payGame(st);
    if (T.id === "M-shadow" && S.s.lb > 50) heavyNext();
    if (document.getElementById("actitem")) actGame();
    if (T.id === "L1" && st && st.choices) sayGame(st); // Hushwick: the tap fallback under the mic becomes hold-to-say
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
    if (e.pointerId !== undefined && box.setPointerCapture) box.setPointerCapture(e.pointerId);
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
    if (e.cancelable) e.preventDefault();
  };
  const up = e => {
    if (!on) return; on = false;
    const c = centre(), z = moved > 36 ? at(c[0], c[1]) : null; moved = 0;
    chip.classList.remove("lifted"); zones.forEach(q => q.classList.remove("hot"));
    if (z) { chip.style.opacity = "0"; pick(+z.dataset.zone); }
    else { chip.style.transition = "transform .25s cubic-bezier(.3,1.5,.5,1)"; chip.style.transform = ""; setTimeout(() => { chip.style.transition = ""; }, 260); }
  };
  if (window.PointerEvent) {
    chip.addEventListener("pointerdown", e => { chip.setPointerCapture(e.pointerId); down(e); });
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

/* ---------- act it out: drag the item on the drawing onto a zone to choose ---------- */
function actGame() {
  const item = document.getElementById("actitem"), zones = [...document.querySelectorAll(".act-zone")];
  if (item.dataset.bound) return; item.dataset.bound = "1";
  let sx = 0, sy = 0, on = false, hot = null;
  const at = (x, y) => zones.find(z => { const r = z.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
  const pt = e => e.touches ? e.touches[0] || e.changedTouches[0] : e;
  const back = () => { item.style.transition = "transform .3s cubic-bezier(.3,1.5,.5,1)"; item.style.transform = ""; setTimeout(() => { item.style.transition = ""; }, 320); };
  const down = e => {
    const p = pt(e); if (!p) return; on = true; sx = p.clientX; sy = p.clientY;
    item.classList.add("lifted"); Sound.tone(520, .06, "triangle", .05);
    if (e.pointerId !== undefined && item.setPointerCapture) item.setPointerCapture(e.pointerId);
    if (e.cancelable) e.preventDefault();
  };
  const move = e => {
    if (!on) return; const p = pt(e); if (!p) return;
    item.style.transform = `translate(${p.clientX - sx}px, ${p.clientY - sy}px) scale(1.15)`;
    const z = at(p.clientX, p.clientY);
    if (z !== hot) { zones.forEach(q => q.classList.toggle("hot", q === z && z.dataset.zone !== "off")); hot = z; if (z) { Juice.buzz([8]); Sound.tone(z.dataset.zone === "off" ? 200 : 700, .05, "triangle", .04); } }
    if (e.cancelable) e.preventDefault();
  };
  const up = () => {
    if (!on) return; on = false; item.classList.remove("lifted"); zones.forEach(q => q.classList.remove("hot"));
    const z = hot; hot = null;
    if (!z) return back();
    if (z.dataset.zone === "off") { Juice.penalty(); z.classList.add("nope"); setTimeout(() => z.classList.remove("nope"), 400); return back(); }
    item.style.transition = "opacity .2s"; item.style.opacity = "0";
    pick(+z.dataset.zone);
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
    if (s.pack.every(v => v === Infinity)) { s.pack = []; setTimeout(() => pick(0), 450); }
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

/* ---------- Petalton: say sorry out loud ---------- */
function sorryResolve(r, s) {
  const st = TOWNS[S.t].steps[S.step], yes = st.choices[0], no = st.choices[1];
  if (/\bsorry\b|apolog|my bad|forgive|i was wrong/i.test(r.text)) return { ...yes, t: `“${r.text}”`, heard: r.text };
  return { ...no, t: `“${r.text}”`, heard: r.text, say: "That wasn't a sorry. " + val(no.say, s) };
}

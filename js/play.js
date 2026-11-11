/* Rule Road minigames: each town's rule drawn as a live scene, plus hands-on games that make a choice for you.
   stage(T, s) draws the scene under the meters; Play.mount() wires up the game for the current step after each render.
   Step fields: play: { kind: "catch" }       – catch the falling hour (Tockfield)
                drag: { item, label, zones } – drag the item into a zone to choose (Inchwick)
                pay:  true                    – tap dogs smallest-first to pay them back (Leashville)
   Laterton needs no field: a heavy shadow turns "Next" into hold-to-drag. Petalton's yard grows from spoken sorries (mic). */

const Play = {
  mem: {},        // last drawn values per town, so scenes animate from the old value to the new one
  timer: 0, raf: 0,

  stop() { cancelAnimationFrame(this.raf); clearTimeout(this.timer); this.raf = 0; },

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
    if (st && st.play && st.play.kind === "catch" && !S.played) catchGame(st);
    if (st && st.drag && S.phase === "step") dragGame(st);
    if (st && st.pay && S.phase === "step") payGame(st);
    if (T.id === "M-shadow" && S.s.lb > 50) heavyNext();
  },
};

/* ---------- scenes ---------- */
function stage(T, s) {
  const st = S.phase === "step" || S.phase === "result" ? T.steps[S.step] : null;
  if (T.id === "M-shrink") return houseScene(s);
  if (T.id === "M5") return dogScene(s, st);
  if (T.id === "M-shadow") return shadowScene(s, st);
  if (T.id === "L4") return yardScene(s);
  if (T.id === "L-fallback") return shelfScene(s, st);
  return "";
}

// Inchwick: the house shrinks one inch per thing; you are 66 inches tall
function houseScene(s) {
  const h = Math.max(40, s.door), stuff = Math.max(0, 72 - s.door), tooLow = s.door < 66;
  const boxes = Array.from({ length: Math.min(stuff, 14) }, (_, i) => `<rect x="${118 + (i % 7) * 13}" y="${126 - Math.floor(i / 7) * 12}" width="11" height="10" rx="2" fill="#C68B3E" stroke="#7A5422"/>`).join("");
  return `<figure class="stage stage-house" data-scene="house" data-val="${h}" aria-label="Your house is ${s.door} inches tall. You are 66 inches.">
    <svg viewBox="0 0 300 150" width="100%" role="img">
      <rect x="0" y="136" width="300" height="14" fill="#1C2A4A"/>
      <g class="house" style="transform-origin: 150px 136px">
        <rect x="80" y="36" width="140" height="100" fill="#22355F" stroke="#FFD23F" stroke-width="2"/>
        <polygon points="70,38 150,0 230,38" fill="#E63946"/>
        <rect x="88" y="62" width="26" height="74" fill="#14213D" stroke="#9AA7C4"/>
      </g>
      ${boxes}
      <g class="me ${tooLow ? "squashed" : ""}" style="transform-origin: 101px 136px"><circle cx="101" cy="${tooLow ? 92 : 74}" r="7" fill="#FFD23F"/><rect x="95" y="${tooLow ? 99 : 81}" width="12" height="${tooLow ? 37 : 55}" rx="5" fill="#FFD23F"/></g>
      <line x1="236" y1="62" x2="236" y2="136" stroke="#9AA7C4" stroke-dasharray="3 3"/><text x="242" y="104" fill="#9AA7C4" font-size="11" font-family="Atkinson Hyperlegible Mono, monospace">${s.door}"</text>
    </svg>
    <figcaption>${tooLow ? "You can't stand up in your own house." : stuff ? `${stuff} new thing${stuff > 1 ? "s" : ""} inside. ${s.door - 66} inch${s.door - 66 === 1 ? "" : "es"} of headroom left.` : "Six feet of door. Plenty of room."}</figcaption>
  </figure>`;
}

// Leashville: every loan is a dog on a leash, sized by what you owe, pulling you backward
function dogScene(s, st) {
  const pack = s.pack || [], pull = Math.min(70, s.size * 5);
  const order = pack.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const dogs = pack.map((v, i) => {
    const px = Math.min(96, 26 + v * 9), rank = order.indexOf(i) + 1;
    return st && st.pay && S.phase === "step"
      ? `<button class="dog" data-dog="${i}" style="font-size:${px}px" aria-label="Pay back dog ${rank}, size ${v}">🐕<i>${v}</i></button>`
      : `<span class="dog" style="font-size:${px}px">🐕</span>`;
  }).join("");
  return `<figure class="stage stage-dogs" data-scene="dogs" data-val="${pull}" aria-label="${pack.length} dogs following you">
    <div class="dogrow"><div class="pack">${dogs || '<span class="free">No dogs. Just you and the open street.</span>'}</div><span class="walker" style="transform: translateX(${pull}px)">🚶</span></div>
    <figcaption>${pack.length ? `${pack.length} dog${pack.length > 1 ? "s" : ""} on the leash, pulling you back${st && st.pay && S.phase === "step" ? ". Tap them to pay them back, smallest first." : "."}` : "Nobody behind you."}</figcaption>
  </figure>`;
}

// Laterton: the shadow is nothing at noon and everything at sunset
function shadowScene(s, st) {
  const sunset = !!(st && /p\.m\.|sunset|November/i.test(st.when)) || S.phase === "end";
  const len = sunset ? Math.min(270, 20 + Math.sqrt(s.lb) * 9) : 14 + s.plans;
  const dark = Math.min(0.92, 0.35 + s.lb / 2000);
  return `<figure class="stage stage-shadow ${sunset ? "dusk" : "noon"}" data-scene="shadow" data-val="${len}" aria-label="Your shadow weighs ${s.lb} pounds">
    <svg viewBox="0 0 300 120" width="100%" role="img">
      <circle cx="${sunset ? 286 : 150}" cy="${sunset ? 96 : 16}" r="${sunset ? 16 : 11}" fill="${sunset ? "#FF8A3D" : "#FFE27A"}"/>
      <rect x="0" y="100" width="300" height="20" fill="#1C2A4A"/>
      <ellipse class="shade" cx="${40 + len / 2}" cy="104" rx="${len / 2}" ry="${sunset ? 7 : 4}" fill="rgba(0,0,0,${dark})" style="transform-origin: 40px 104px"/>
      <circle cx="40" cy="58" r="8" fill="#FFD23F"/><rect x="33" y="66" width="14" height="36" rx="6" fill="#FFD23F"/>
    </svg>
    <figcaption>${sunset ? `Sunset. Your shadow weighs ${s.lb.toLocaleString("en-US")} lb.` : s.plans ? `Noon. ${s.plans} plan${s.plans > 1 ? "s" : ""}, and your shadow feels like nothing. For now.` : "Noon. A normal shadow."}</figcaption>
  </figure>`;
}

// Petalton: one flower per sorry, one thorn per sorry you skipped
const PETALS = ["#E63946", "#FF8FB1", "#FFD23F", "#B784F5", "#FF9F43", "#7BD389"];
function yardScene(s) {
  const n = Math.min(s.flowers, 18), t = Math.min(s.thorns, 12), prev = Play.mem.yard || 0;
  const flower = i => {
    const x = 14 + ((i * 53) % 272), h = 26 + ((i * 17) % 22), c = PETALS[i % PETALS.length];
    const petals = [0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${96 - h - 7}" rx="4" ry="7" fill="${c}" transform="rotate(${a} ${x} ${96 - h})"/>`).join("");
    return `<g class="${i >= prev ? "grow" : ""}" style="transform-origin:${x}px 96px; animation-delay:${(i - prev) * 0.12}s"><line x1="${x}" y1="96" x2="${x}" y2="${96 - h}" stroke="#4E9A5B" stroke-width="2.5"/>${petals}<circle cx="${x}" cy="${96 - h}" r="3.4" fill="#FFF2B0"/></g>`;
  };
  const thorn = i => { const x = 30 + ((i * 41 + 11) % 250); return `<path d="M${x - 7} 96 L${x} ${78 - (i % 3) * 4} L${x + 7} 96 Z" fill="#3B2A2A" stroke="#7A4B4B"/>`; };
  return `<figure class="stage stage-yard" data-scene="yard" data-val="${n}" aria-label="${s.flowers} flowers and ${s.thorns} thorns in your yard">
    <svg viewBox="0 0 300 110" width="100%" role="img">
      <rect x="0" y="94" width="300" height="16" fill="#3A2A1C"/>
      ${Array.from({ length: t }, (_, i) => thorn(i)).join("")}${Array.from({ length: n }, (_, i) => flower(i)).join("")}
      <rect x="270" y="58" width="24" height="38" fill="none" stroke="${s.thorns > 1 ? "#E63946" : "#9AA7C4"}" stroke-width="2"/>
    </svg>
    <figcaption>${s.thorns > 1 ? "Thorns are creeping toward the gate." : s.flowers ? "Your yard is blooming." : "Just dirt, for now."}</figcaption>
  </figure>`;
}

// Tockfield: the pantry shelf of saved hours
function shelfScene(s, st) {
  const jars = Math.min(s.jars, 60);
  return `<figure class="stage stage-shelf" data-scene="shelf" data-val="${jars}" aria-label="${s.jars} hours saved in jars">
    <div class="shelf">${Array.from({ length: jars }, () => '<i class="jar"></i>').join("")}</div>
    ${st && st.play && st.play.kind === "catch" && !S.played && S.phase === "step" ? `<div class="catch" id="catch" tabindex="0" aria-label="Move the jar with your finger, mouse or arrow keys to catch the falling hour">
      <i class="orb" id="orb"></i><i class="cjar ${Glove.has("big-jar") ? "big" : ""}" id="cjar"></i><span class="catch-tip" id="catch-tip">Catch the hour! Drag or tap to move the jar.</span></div>` : ""}
    <figcaption>${s.jars ? `${s.jars} hours on the shelf, labeled “Someday.”` : "The shelf is empty. Every hour got spent."}</figcaption>
  </figure>`;
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

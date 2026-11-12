/* Rule Road juice: coin bursts, sparkles, haptics, screen shake and pitched pings.
   Everything is drawn with DOM + CSS and synthesized with Web Audio, so it costs no downloads. */
const Juice = {
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,

  buzz(pattern) { try { if (Prefs.haptics !== false && navigator.vibrate) navigator.vibrate(pattern); } catch {} },

  // a short rising ping per coin, so a big burst sounds like it's climbing
  ping(k) { Sound.tone(880 * Math.pow(1.06, k), 0.16, "triangle", 0.07, k * 0.045); },

  // coins (money meters) or sparkles (life meters) fly out of a meter and fall
  burst(el, n, kind) {
    if (!el) return;
    n = Math.max(1, Math.min(14, n));
    for (let k = 0; k < n && k < 8; k++) this.ping(k);
    this.buzz(n > 6 ? [12, 30, 12, 30, 20] : [12]);
    if (this.reduced) return;
    const r = el.getBoundingClientRect();
    for (let k = 0; k < n; k++) {
      const p = document.createElement("i");
      p.className = "fx-" + (kind === "life" ? "spark" : "coin");
      p.style.left = r.left + r.width * (0.3 + Math.random() * 0.4) + "px";
      p.style.top = r.top + r.height * 0.4 + "px";
      p.style.setProperty("--dx", (Math.random() * 2 - 1) * 140 + "px");
      p.style.setProperty("--dy", -(70 + Math.random() * 110) + "px");
      p.style.setProperty("--rot", (Math.random() * 2 - 1) * 540 + "deg");
      p.style.animationDelay = k * 28 + "ms";
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  },

  // a rule broken: low buzz, double pulse, 3px shudder
  penalty() {
    Sound.tone(140, 0.25, "sawtooth", 0.09); Sound.tone(70, 0.3, "sine", 0.12, 0.02);
    this.buzz([80]); // a broken rule: one heavy rumble
    this.shake();
  },

  shake() {
    if (this.reduced) return;
    const a = document.getElementById("app");
    a.classList.remove("fx-shake"); void a.offsetWidth; a.classList.add("fx-shake");
  },

  tap() { this.buzz([15]); },

  // a number that floats up from a meter: green when it moved the good way, red when not
  float(el, delta, good) {
    if (!el || !delta) return;
    const r = el.getBoundingClientRect(), n = document.createElement("i");
    n.className = "fx-num " + (good ? "up" : "down");
    n.textContent = (delta > 0 ? "+" : "−") + Math.abs(Math.round(delta * 10) / 10).toLocaleString("en-US");
    n.style.left = r.left + r.width * 0.6 + "px"; n.style.top = r.top + "px";
    document.body.appendChild(n);
    if (this.reduced) setTimeout(() => n.remove(), 900); else n.addEventListener("animationend", () => n.remove());
  },

  // after a choice: fling coins/sparkles out of every meter that went up, shake on every one that went down
  meters(T, before, after) {
    let down = false;
    for (const m of T.meters) {
      const a = before[m.k], b = after[m.k];
      if (typeof a !== "number" || typeof b !== "number" || a === b) continue;
      const el = document.querySelector(`.mv[data-k="${m.k}"]`);
      const bad = typeof dirOf === "function" && dirOf(T, m.k) === "down"; // more thorns, dogs or debt is not a win
      if (bad) { if (b > a) down = true; else this.burst(el, 4, "life"); continue; }
      if (b > a) {
        const steps = m.max ? Math.round((b - a) / m.max * 20) : Math.round(Math.log2(1 + b - a) * 2.5);
        this.burst(el, Math.max(2, steps), m.life ? "life" : "money");
      } else down = true;
    }
    if (down) this.penalty();
  },
};

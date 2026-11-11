/* Rule Road car radio: the dashboard, the CB handset (hold to talk) and the live voice challenges.
   Step kinds (st.mic.kind):
     calibrate – say a line in your normal voice; sets this player's loud/quiet thresholds
     whisper   – talk for `secs` seconds without going over the loud line; `cracks` mistakes allowed
     pitch     – hum: any (sets your note), higher, lower, match, or slide (low → high siren)
     speech    – say anything; st.mic.resolve(result, s) turns the words into a choice
   Every challenge ends in onMicResult(), which picks a choice exactly like a tap would. */

// what to say when this browser can't turn speech into text (Firefox, iOS before 14.5, old Android browsers)
const TALK_OFF = "Talking out loud needs Safari on iOS 14.5 or newer, or Chrome. Tap a choice instead.";
const DEFAULT_CAL = { loud: -30, talk: -56 }; // dBFS, used until the player calibrates

const MicRun = {
  holding: false, done: false, raf: 0, last: 0, sr: null, text: "", hist: [], d: null,

  reset() {
    cancelAnimationFrame(this.raf);
    if (this.sr) this.sr.stop();
    this.holding = this.done = false; this.sr = null; this.text = ""; this.hist = [];
    this.d = { talked: 0, cracks: 0, lastCrack: 0, held: 0, inBand: 0, ema: -100, peak: -100, lowest: 0, words: 0, mine: [], gt: 0 };
    Mic.stopClip();
  },

  step() { const T = TOWNS[S.t]; return S.screen === "town" && S.phase === "step" ? T.steps[S.step] : null; },
  cal() { const c = S.cal || DEFAULT_CAL; return Glove.has("muffler") ? { loud: c.loud + 3, talk: c.talk } : c; },
  cracksAllowed(st) { return st.mic.cracks + (Glove.has("muffler") ? 1 : 0); },

  status(msg) { const el = document.getElementById("mp-status"); if (el) el.textContent = msg; },

  async press() {
    const st = this.step();
    if (!st || !st.mic || this.done || this.holding || this.tail) return;
    const k = st.mic.kind;
    Voice.stop(); Juice.tap();
    if (k === "speech" && !Mic.speechOK) { this.status(TALK_OFF); return; }
    if (Mic.state !== "on") {
      this.status("Allow the microphone…");
      const ok = await Mic.open();
      if (!ok) { this.status(Mic.state === "denied" ? "The mic is blocked. Allow it in your browser's site settings, or tap a choice." : "No mic here. Tap a choice instead."); paintDash(); return; }
      render(); // tap choices that need the mic lock now
      this.status("Mic on. Now hold the handset and talk.");
      return; // the permission prompt broke the hold, so ask for a fresh one
    }
    this.holding = true;
    document.querySelectorAll("[data-cb]").forEach(b => b.classList.add("live"));
    Mic.startClip();
    if (k === "speech") {
      this.text = "";
      this.sr = Mic.listen((text, final, err) => this.onText(st, text, final, err));
      this.status("Listening… let go when you're done.");
    } else this.status(st.mic.kind === "pitch" ? "Hum…" : "Talk…");
    this.last = performance.now();
    this.loop(st);
  },

  release() {
    if (!this.holding) return;
    this.holding = false;
    document.querySelectorAll("[data-cb]").forEach(b => b.classList.remove("live"));
    const st = this.step(); if (!st) return;
    if (st.mic.kind === "speech") { // keep listening 0.7s after release, so a Bluetooth mic's last word still lands
      const sr = this.sr; this.tail = true; this.status("Catching your last word…");
      setTimeout(() => { this.tail = false; if (sr) sr.stop(); }, 700);
      return; // onText(final) finishes
    }
    Mic.stopClip(); // only the successful take goes on the tape
    const d = this.d, k = st.mic.kind;
    if (k === "pitch" && d.held > 12) return this.finish(st, { ok: false, label: "couldn't find the note" });
    if (k === "calibrate" && d.talked > 0.6) return this.finishCal(st);
    this.status(k === "pitch" ? "Keep trying: hold the handset and hum." : k === "calibrate" ? "A bit longer. Hold and say the whole line." : `Keep going: ${Math.max(0, st.mic.secs - d.talked).toFixed(1)}s of whispering left.`);
  },

  loop(st) {
    if (!this.holding) return;
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const d = this.d, k = st.mic.kind, cal = this.cal();
    const db = Mic.db();
    d.ema = d.ema < -90 ? db : d.ema * 0.6 + db * 0.4;
    d.held += dt;
    if (k === "calibrate" || k === "whisper") {
      const talking = d.ema > cal.talk;
      if (talking) d.talked += dt;
      if (k === "calibrate") {
        if (talking) d.peak = Math.max(d.peak, d.ema);
        d.lowest = Math.min(d.lowest || 0, db);
        this.hist.push(Math.max(0, Math.min(1.3, (d.ema + 70) / 50)));
        if (d.talked >= 1.4) return this.finishCal(st);
      } else {
        const v = (d.ema - cal.talk) / (cal.loud - cal.talk); // 0 = quiet floor, 1 = the loud line
        // one sample every 0.1s while talking: drawn on the scope, and saved as this player's ghost for challenge links
        if (talking) { d.gt += dt; if (d.gt >= 0.1 && d.mine.length < 40) { d.gt = 0; d.mine.push(Math.max(0, Math.min(1.3, v))); } }
        if (v > 1 && now - d.lastCrack > 600) {
          d.cracks += 1; d.lastCrack = now; Juice.penalty();
          const cb = document.getElementById("mp-cracks"); if (cb) cb.textContent = "✕".repeat(d.cracks) + "·".repeat(Math.max(0, this.cracksAllowed(st) - d.cracks));
          const mp = document.getElementById("micpanel"); if (mp) mp.classList.add("cracked");
          if (d.cracks >= this.cracksAllowed(st)) return this.finish(st, { ok: false, cracks: d.cracks, label: "cracked the glass" });
          this.status("CRACK! Quieter…");
        } else if (v <= 1 && talking) this.status(v > 0.8 ? "Careful…" : "Good. Keep whispering.");
        if (d.talked >= st.mic.secs) return this.finish(st, { ok: true, cracks: d.cracks, label: "whispered across" });
      }
      this.prog(k === "calibrate" ? d.talked / 1.4 : d.talked / st.mic.secs);
    } else if (k === "pitch") {
      const f = Mic.pitch();
      this.hist.push(f ? Math.max(0, Math.min(1, Math.log2(f / 70) / Math.log2(1000 / 70))) : -1);
      const ok = f && this.pitchOK(st.mic.mode, f);
      if (ok) { d.inBand += dt; Juice.ping(Math.min(7, Math.floor(d.inBand * 5))); }
      this.prog(d.inBand / st.mic.secs);
      if (d.inBand >= st.mic.secs) {
        if (st.mic.mode === "any") S.base = d.lastF || f;
        return this.finish(st, { ok: true, label: `hummed ${Math.round(f)} Hz` });
      }
      if (f) d.lastF = f;
      if (d.held > 12) return this.finish(st, { ok: false, label: "couldn't find the note" });
    }
    this.draw(st);
    this.raf = requestAnimationFrame(() => this.loop(st));
  },

  // is this frequency the note the door wants? Everything is relative to the player's own note (S.base)
  pitchOK(mode, f) {
    const d = this.d;
    if (mode === "any") { const ok = d.lastF && Math.abs(f / d.lastF - 1) < 0.07; return ok; }
    if (!S.base) { // no note yet (they tapped the first door): learn it from this hum
      d.calF = d.calF ? d.calF * 0.9 + f * 0.1 : f; d.calT = (d.calT || 0) + 1;
      if (d.calT > 25) { S.base = d.calF; this.status("Got your note. Now go " + (mode === "lower" ? "lower!" : "higher!")); }
      return false;
    }
    const b = S.base;
    const fork = Glove.has("fork"); // the tuning fork forgives a slightly-off note
    if (mode === "higher") return f >= b * (fork ? 1.12 : 1.18);
    if (mode === "lower") return f <= b * (fork ? 0.92 : 0.87);
    if (mode === "match") return Math.abs(f / b - 1) < (fork ? 0.12 : 0.08);
    if (mode === "slide") { d.minF = Math.min(d.minF || f, f); return f >= d.minF * (fork ? 1.25 : 1.35); }
    return false;
  },

  finishCal(st) {
    const d = this.d;
    const normal = Math.max(-45, Math.min(-8, d.peak));
    // a whisper has to stay 9 dB under this player's normal voice; "talking" starts a bit above the room's hum
    const loud = normal - 9;
    S.cal = { loud, talk: Math.min(loud - 6, Math.max((d.lowest || -70) + 6, normal - 30)) };
    return this.finish(st, { ok: true, label: "said hello" });
  },

  onText(st, text, final, err) {
    if (this.done || this.step() !== st) return;
    this.text = text;
    const el = document.getElementById("mp-words"); if (el) el.textContent = text ? `“${text}”` : "";
    if (st.mic.words) {
      const n = Talk.words(text).length, left = S.s.words - n;
      const wc = document.getElementById("mp-count");
      if (wc) { wc.textContent = left >= 0 ? `${left} word${left === 1 ? "" : "s"} left` : `${-left} over!`; wc.classList.toggle("over", left < 0); }
      if (n > this.d.words) { if (left < 0) Juice.penalty(); else Juice.tap(); this.d.words = n; }
    }
    if (!final) return;
    this.sr = null;
    if (!text) {
      Mic.stopClip();
      this.status(err === "not-allowed" || err === "service-not-allowed" ? "Speech is blocked here. Tap a choice instead." : err === "network" ? "Talking needs the internet. Tap a choice instead." : "Didn't catch that. Hold the handset and try again.");
      return;
    }
    this.finish(st, { ok: true, text, label: `“${text}”` });
  },

  async finish(st, res) {
    if (this.done) return;
    this.done = true; this.holding = false;
    cancelAnimationFrame(this.raf);
    if (this.sr) this.sr.stop();
    document.querySelectorAll("[data-cb]").forEach(b => b.classList.remove("live"));
    if (st.mic.kind === "whisper" && res.ok && !S.ghostOut && this.d.mine.length > 4) S.ghostOut = this.d.mine.map(v => Math.round(v / 1.3 * 9)).join("");
    const clip = await Mic.stopClip();
    if (clip) S.reel.push({ blob: clip, label: `${st.when}: ${res.label}` });
    onMicResult(res);
  },

  prog(p) { const el = document.getElementById("mp-prog"); if (el) el.style.width = Math.min(100, p * 100) + "%"; },

  // the scope: your voice as a line, the loud limit (or the target note) as a band, and a challenger's ghost if there is one
  draw(st) {
    const c = document.getElementById("mp-scope"); if (!c) return;
    const g = c.getContext("2d"), W = c.width, H = c.height, k = st.mic.kind, N = 90;
    g.clearRect(0, 0, W, H);
    const y = v => H - 6 - v / 1.3 * (H - 12);
    if (k === "whisper") {
      g.fillStyle = "rgba(230,57,70,.18)"; g.fillRect(0, 0, W, y(1));
      g.strokeStyle = "#E63946"; g.setLineDash([8, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, y(1)); g.lineTo(W, y(1)); g.stroke(); g.setLineDash([]);
      const gh = S.challenge && S.challenge.g;
      if (gh) {
        g.strokeStyle = "rgba(154,167,196,.8)"; g.lineWidth = 3; g.beginPath();
        [...gh].forEach((ch, i) => { const px = i / 39 * W, py = y(+ch / 9 * 1.3); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
      }
    }
    if (k === "pitch" && S.base) {
      const band = { higher: [1.18, 4], lower: [0.3, 0.87], match: [0.92, 1.08] }[st.mic.mode];
      if (band) {
        const p = f => Math.max(0, Math.min(1, Math.log2(f / 70) / Math.log2(1000 / 70)));
        g.fillStyle = "rgba(123,211,137,.18)";
        const top = H - 6 - p(S.base * band[1]) * (H - 12), bot = H - 6 - p(S.base * band[0]) * (H - 12);
        g.fillRect(0, top, W, bot - top);
      }
    }
    if (k === "whisper") {
      g.strokeStyle = "#FFD23F"; g.lineWidth = 4; g.lineJoin = "round"; g.beginPath();
      this.d.mine.forEach((v, i) => { const px = i / 39 * W, py = y(v); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      return g.stroke();
    }
    const h = this.hist.slice(-N);
    g.strokeStyle = "#FFD23F"; g.lineWidth = 4; g.lineJoin = "round"; g.beginPath();
    let pen = false;
    h.forEach((v, i) => {
      if (v < 0) { pen = false; return; }
      const px = i / (N - 1) * W;
      const py = k === "pitch" ? H - 6 - v * (H - 12) : y(v);
      pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true;
    });
    g.stroke();
  },
};

// called by the engine when the player enters a step
function micEnter() { MicRun.reset(); }

function micPanel(st) {
  const m = st.mic, k = m.kind;
  const speechOff = k === "speech" && !Mic.speechOK;
  const blocked = Mic.state === "denied" || Mic.state === "unsupported" || speechOff;
  const hint = { calibrate: "Say it in your normal voice", whisper: "Stay under the red line", pitch: { any: "Hold one steady note", higher: "Go higher than your note", lower: "Go lower than your note", match: "Find your note again", slide: "Low… then slide up" }[m.mode], speech: m.words ? "Every word counts" : "Speak your answer" }[k];
  const line = k === "speech" ? m.line : k === "pitch" ? m.line : `Say: “${m.line}”`;
  const ghost = k === "whisper" && S.challenge && S.challenge.g ? `<span class="mp-ghost">— ${esc(S.challenge.c || "Friend")}'s ghost</span>` : "";
  return `<div class="micpanel kind-${k}" id="micpanel">
    <div class="mp-head"><span class="mp-tag">CB radio · ${esc(hint)}</span>${k === "whisper" ? `<span class="mp-cracks" id="mp-cracks" aria-label="cracks">${"·".repeat(MicRun.cracksAllowed(st))}</span>` : ""}${m.words ? `<span class="mp-count" id="mp-count">${S.s.words} words left</span>` : ""}</div>
    <p class="mp-line">${esc(line)}</p>
    ${m.rhyme && Glove.has("rhyme-book") ? `<p class="mp-hint">📕 Rhymes with ${m.rhyme.toUpperCase()}: ${RHYMES[m.rhyme]}</p>` : ""}
    ${k !== "speech" ? `<canvas class="mp-scope" id="mp-scope" width="640" height="150" aria-hidden="true"></canvas>${ghost}` : `<p class="mp-words" id="mp-words" aria-live="polite"></p>`}
    <div class="mp-bar"><i id="mp-prog"></i></div>
    <p class="mp-status" id="mp-status" aria-live="polite">${blocked ? (speechOff ? TALK_OFF : Mic.state === "denied" ? "The mic is blocked. Tap a choice below." : "No mic on this device. Tap a choice below.") : Mic.state === "on" ? "Hold the CB handset below and " + (k === "pitch" ? "hum." : "talk.") : "Hold the CB handset below. Your browser will ask to use the mic; nothing is uploaded" + (k === "speech" ? ", except the words, which your browser turns into text." : ".")}</p>
  </div>`;
}

// is this tap choice the "did it with your voice" option, which only the mic can earn once it's on?
const micOnly = (st, c) => c.mic && st.mic && Mic.state === "on" && st.mic.kind !== "speech";

/* the dashboard: radio display + CB handset, fixed to the bottom of town screens */
const freq = i => (88.1 + 0.8 * i).toFixed(1);
function dash() {
  if (S.screen !== "town") return "";
  const T = TOWNS[S.t], st = S.phase === "step" ? T.steps[S.step] : null;
  const live = !!(st && st.mic);
  return `<div class="dash" role="region" aria-label="Car radio">
    <div class="dash-radio"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="fm">${freq(roadPos(S.t))} FM</span><span class="st">${esc(T.name)}</span></div>
    <button class="cb" data-cb ${live ? "" : "disabled"} aria-label="Hold to talk">
      <span class="cb-dot" aria-hidden="true"></span><span>${live ? "Hold to talk" : "CB · no signal"}</span>
    </button>
  </div>`;
}
function paintDash() { const d = document.querySelector(".dash"); if (d) d.outerHTML = dash(); }

// hold-to-talk on the handset: pointer events where they exist, touch + mouse on iOS 12 and old Android, Space/Enter for keyboards
const cbAt = e => (e.target && e.target.closest ? e.target.closest("[data-cb]") : null);
function cbDown(e) { const b = cbAt(e); if (b && !b.disabled) { e.preventDefault(); if (e.pointerId !== undefined && b.setPointerCapture) b.setPointerCapture(e.pointerId); MicRun.press(); } }
if (window.PointerEvent) {
  document.addEventListener("pointerdown", cbDown);
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, () => MicRun.release()));
} else {
  document.addEventListener("touchstart", cbDown, { passive: false });
  document.addEventListener("mousedown", cbDown);
  ["touchend", "touchcancel", "mouseup"].forEach(ev => document.addEventListener(ev, () => MicRun.release()));
}
document.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && cbAt(e) && !e.repeat) { e.preventDefault(); MicRun.press(); } });
document.addEventListener("keyup", e => { if ((e.key === " " || e.key === "Enter") && cbAt(e)) { e.preventDefault(); MicRun.release(); } });
document.addEventListener("contextmenu", e => { if (cbAt(e)) e.preventDefault(); }); // long-press on phones

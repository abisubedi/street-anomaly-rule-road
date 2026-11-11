/* Town broadcast reel: the host's intro, then the player's own takes through a radio filter with static between them,
   then the host's sign-off. It plays live, and "Save" records the same mix into an audio file on the device. */
const Reel = {
  ctx: null, timers: [], busy: false,

  async buf(src) {
    try {
      const ab = src instanceof Blob ? await src.arrayBuffer() : await (await fetch(src)).arrayBuffer();
      return await new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no));
    } catch { return null; }
  },

  stop() {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null; this.busy = false;
    const cap = document.getElementById("reel-cap"); if (cap) cap.textContent = "";
    document.querySelectorAll("[data-act=reel]").forEach(b => (b.textContent = "▶ Play your broadcast"));
  },

  async play(T, save) {
    if (this.busy) return this.stop();
    this.busy = true; Voice.stop();
    document.querySelectorAll("[data-act=reel]").forEach(b => (b.textContent = "■ Stop broadcast"));
    const cap = document.getElementById("reel-cap");
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.ctx, out = ctx.createGain(); out.connect(ctx.destination);
    const dest = save && window.MediaRecorder ? ctx.createMediaStreamDestination() : null;
    if (dest) out.connect(dest);
    if (cap) cap.textContent = "Tuning in…";
    const takes = S.reel.slice(-6);
    const [intro, outro, ...bufs] = await Promise.all([this.buf(`/voice/${T.id}-reel.mp3`), this.buf("/voice/reel-out.mp3"), ...takes.map(c => this.buf(c.blob))]);
    if (!this.ctx) return;
    let t = ctx.currentTime + 0.15;
    const cues = [];
    const stat = d => {
      const n = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate), ch = n.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 900));
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n; bp.type = "bandpass"; bp.frequency.value = 2200; g.gain.value = 0.05;
      s.connect(bp).connect(g).connect(out); s.start(t); t += d;
    };
    const say = (b, radio, label) => {
      const s = ctx.createBufferSource(); s.buffer = b;
      let node = s;
      if (radio) { // the player's takes sound like a CB radio
        const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper(), g = ctx.createGain();
        hp.type = "highpass"; hp.frequency.value = 380; lp.type = "lowpass"; lp.frequency.value = 3100;
        const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.2 * x); } ws.curve = curve;
        g.gain.value = 1.8;
        node = s.connect(hp).connect(lp).connect(ws).connect(g);
      }
      node.connect(out);
      const len = radio ? Math.min(b.duration, 4.5) : b.duration;
      s.start(t, 0, len); cues.push([t, label]); t += len + 0.2;
    };
    stat(0.4);
    if (intro) say(intro, false, `Rule Road radio · ${T.name}`);
    bufs.forEach((b, i) => { if (b) { stat(0.22); say(b, true, takes[i].label); } });
    stat(0.3);
    if (outro) say(outro, false, "Back to the road.");
    const end = t + 0.2;
    let rec = null, chunks = [];
    if (dest) {
      try {
        const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(x => MediaRecorder.isTypeSupported?.(x)) || "";
        rec = new MediaRecorder(dest.stream, type ? { mimeType: type } : undefined);
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.start();
      } catch { rec = null; }
    }
    const base = ctx.currentTime;
    cues.forEach(([at, label]) => this.timers.push(setTimeout(() => { if (cap) cap.textContent = label; }, (at - base) * 1000)));
    this.timers.push(setTimeout(async () => {
      if (rec) {
        const done = new Promise(r => (rec.onstop = r)); rec.stop(); await done;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const ext = /mp4/.test(blob.type) ? "m4a" : "webm";
        await saveFile(blob, `RuleRoad-${T.name.replace(/\s+/g, "")}-broadcast.${ext}`, `My Rule Road broadcast from ${T.name}`);
      }
      this.stop();
    }, (end - base) * 1000));
  },
};

// share a file on phones (share sheet), download it everywhere else
async function saveFile(blob, name, text) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}

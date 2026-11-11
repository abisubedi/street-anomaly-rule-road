/* Rule Road mic engine: live loudness (dBFS), pitch (autocorrelation), short clip recording and speech-to-text.
   Audio never leaves the device, except speech-to-text, which the browser runs (Chrome sends it to Google). */
const SR_API = window.SpeechRecognition || window.webkitSpeechRecognition;

const Mic = {
  state: navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? "off" : "unsupported", // off | asking | on | denied | unsupported
  speechOK: !!SR_API,
  stream: null, ctx: null, an: null, buf: null,
  rec: null, chunks: [], recType: "",

  async open() {
    if (this.state === "on") return true;
    if (this.state === "unsupported") return false;
    this.state = "asking";
    try {
      // raw signal: no auto gain, so a whisper stays quiet and a shout stays loud
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      this.state = "denied"; return false;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 2048;
    src.connect(this.an);
    this.buf = new Float32Array(this.an.fftSize);
    this.recType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    this.state = "on";
    return true;
  },

  close() {
    this.stopClip();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = this.ctx = this.an = null;
    if (this.state === "on") this.state = "off";
  },

  // loudness of the last 43ms in dBFS (-100 = silence, 0 = full scale)
  db() {
    if (!this.an) return -100;
    this.an.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    return 20 * Math.log10(Math.sqrt(s / this.buf.length) || 1e-5);
  },

  // fundamental frequency in Hz (70–2500, humming to whistling), or 0 when quiet or noisy. Call db() first: it fills buf.
  pitch() {
    if (!this.an) return 0;
    const b = this.buf, n = b.length, sr = this.ctx.sampleRate;
    let e = 0;
    for (let i = 0; i < n; i++) e += b[i] * b[i];
    if (Math.sqrt(e / n) < 0.008) return 0;
    const minLag = Math.floor(sr / 2500), maxLag = Math.min(Math.floor(sr / 70), n >> 1);
    let best = 0, bestLag = 0;
    const r = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let c = 0, ea = 0, eb = 0;
      for (let j = 0, m = n - lag; j < m; j += 2) { c += b[j] * b[j + lag]; ea += b[j] * b[j]; eb += b[j + lag] * b[j + lag]; }
      r[lag] = c / (Math.sqrt(ea * eb) || 1);
      if (r[lag] > best) { best = r[lag]; bestLag = lag; }
    }
    if (best < 0.75) return 0; // not a steady tone
    // the first lag that's nearly as good as the best avoids octave-low errors
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (r[lag] > 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { bestLag = lag; break; }
    }
    const a = r[bestLag - 1] || 0, c2 = r[bestLag + 1] || 0, m2 = r[bestLag];
    const shift = (a - c2) / (2 * (a - 2 * m2 + c2) || 1);
    return sr / (bestLag + (Math.abs(shift) < 1 ? shift : 0));
  },

  // record what the player says, for the end-of-town broadcast
  startClip() {
    if (!this.stream || !window.MediaRecorder || this.rec) return;
    try {
      this.chunks = [];
      this.rec = new MediaRecorder(this.stream, this.recType ? { mimeType: this.recType } : undefined);
      this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start();
      this.clipStart = performance.now();
    } catch { this.rec = null; }
  },
  stopClip() {
    const rec = this.rec; this.rec = null;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise(res => {
      rec.onstop = () => res(this.chunks.length ? new Blob(this.chunks, { type: rec.mimeType || this.recType || "audio/webm" }) : null);
      try { rec.stop(); } catch { res(null); }
    });
  },

  // speech to text while the mic button is held; onText gets (text, final)
  listen(onText) {
    if (!SR_API) return null;
    const r = new SR_API();
    r.lang = "en-US"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    let finals = "";
    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals += " " + t; else interim += " " + t;
      }
      onText((finals + " " + interim).replace(/\s+/g, " ").trim(), false);
    };
    r.onerror = e => { r._err = e.error; };
    r.onend = () => onText(finals.replace(/\s+/g, " ").trim(), true, r._err);
    try { r.start(); } catch { return null; }
    return { stop: () => { try { r.stop(); } catch {} } };
  },
};

/* text helpers for talk-back towns */
const Talk = {
  words: t => (t.toLowerCase().match(/[a-z0-9']+/g) || []),
  has: (t, list) => { const w = " " + Talk.words(t).join(" ") + " "; return list.some(k => w.includes(" " + k + " ")); },
  // does the last word of the offer rhyme with the item? (spelling rhyme on the last vowel sound, plus a few sound-alikes)
  rhymes(offer, target) {
    const w = Talk.words(offer); if (!w.length) return false;
    const a = w[w.length - 1], b = target.toLowerCase();
    if (a === b) return false; // repeating the word isn't a rhyme
    const tail = x => {
      x = x.replace(/ow(n?)$/, "o$1").replace(/e$/, "").replace(/(ght)$/, "t").replace(/ph/g, "f").replace(/ck$/, "k").replace(/ee|ea/g, "i").replace(/oa|ow$/g, "o").replace(/ai|ay/g, "a");
      const m = x.match(/[aeiouy]+[^aeiouy]*$/);
      return m ? m[0] : x;
    };
    return tail(a) === tail(b) || (a.length > 2 && b.length > 2 && a.slice(-3) === b.slice(-3));
  },
};

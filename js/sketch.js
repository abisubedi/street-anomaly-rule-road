/* Rule Road field journal: every town's rule drawn as an ink sketch on ruled paper, driven by the town's numbers.
   Sk is the pen kit (colour washes, lines, the traveler kid and her moods). SCENES maps a town id to its drawing;
   stage() in play.js asks here first. Glovebox items show up in the drawings when they are equipped.
   All drawing sits inside class="ink", which the shared #ink filter in index.html wobbles like a hand-drawn line. */

const INK = "#F1E8D0", DIM = "#9AA7C4", DARK = "#14130C", GOLD = "#E9B949", SUN = "#FFD23F", RED = "#E63946",
  LEAF = "#7BD389", SKY = "#7FC8F8", PINK = "#FF8FB1", PLUM = "#B784F5", WOOD = "#C68B3E";
const fmt = n => Math.round(n).toLocaleString("en-US");
const plural = (n, w, ws) => `${fmt(n)} ${n === 1 ? w : ws || w + "s"}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const has = id => typeof Glove !== "undefined" && Glove.has(id);

// painted towns: load the art while the player reads the arrival sign, so the first day appears complete
const PAINT = { M5: ["bg", "dog", "traveler-pull", "traveler-free", "puppy", "bubble-worry", "bubble-coin"].map(n => `/img/leashville/${n}.webp`) };
const paintPreload = id => {
  (PAINT[id] || []).forEach(src => { const im = new Image(); im.src = src; }); PAINT[id] = null;
  // near the end of the town, warm up the ending clips (the service worker keeps them for offline)
  const f = FILM[id], T = TOWNS[S.t];
  if (f && f.ends && !f.warm && S.phase !== "arrive" && S.step >= T.steps.length - 2) { f.warm = true; ["end-debt", "end-paid"].forEach(n => fetch(`${f.dir}/${n}.mp4`).catch(() => {})); }
};

/* film: short hand-animated clips for a town's arrival and ending. Each plays once and rests on its last frame.
   Phones set to reduce motion get the last frame as a still. */
const FILM = { M5: { dir: "/img/leashville", arrive: true, ends: true } };
const Film = {
  seen: new Set(), // arrivals already watched this session: re-renders show the last frame instead of replaying
  clip(src, poster, still, cls, id) {
    if (Juice.reduced || (id && this.seen.has(id))) return `<img class="${cls}" src="${still}" alt="" width="768" height="432">`;
    return `<video class="${cls}" src="${src}" poster="${poster}" data-still="${still}" muted playsinline autoplay preload="auto" disablepictureinpicture disableremoteplayback ${id ? `data-film="${id}"` : ""} aria-hidden="true"></video>`;
  },
  arrive(T) {
    const f = FILM[T.id]; if (!f || !f.arrive) return "";
    return this.clip(`${f.dir}/arrive.mp4`, `${f.dir}/arrive-first.webp`, `${f.dir}/arrive-last.webp`, "film-v", T.id);
  },
  end(T, free) {
    const f = FILM[T.id]; if (!f || !f.ends) return "";
    const n = free ? "end-paid" : "end-debt";
    return this.clip(`${f.dir}/${n}.mp4`, `${f.dir}/${n}.webp`, `${f.dir}/${n}.webp`, "paint-full");
  },
};
// "ended" doesn't bubble, so listen in the capture phase
document.addEventListener("ended", e => { const id = e.target && e.target.dataset && e.target.dataset.film; if (id) Film.seen.add(id); }, true);
// if a clip can't play (Safari won't stream a video whose server ignores byte ranges, before the service worker
// takes over), show its still frame instead of a frozen poster
const filmStill = v => { if (!v || !v.dataset || !v.dataset.still || !document.body.contains(v)) return; const im = new Image(); im.className = v.className; im.alt = ""; im.src = v.dataset.still; v.replaceWith(im); };
document.addEventListener("error", e => { if (e.target && e.target.tagName === "VIDEO") filmStill(e.target); }, true);
Film.watch = () => document.querySelectorAll("video[data-still]").forEach(v => {
  if (v.dataset.watched) return; v.dataset.watched = "1";
  setTimeout(() => { if (v.readyState < 2 || (v.paused && !v.ended && v.currentTime === 0)) filmStill(v); }, 3000);
});

const KID_FACES = {
  happy: `<path d="M50 73 q3 -4 6 0 M60 73 q3 -4 6 0" fill="none" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/><path d="M50 78 Q58 78 66 78 Q64 87 58 87 Q52 87 50 78 Z" fill="${DARK}"/>`,
  calm: `<circle cx="54" cy="72" r="1.8" fill="${DARK}"/><circle cx="62" cy="72" r="1.8" fill="${DARK}"/><path d="M53 79 Q58 82 63 79" fill="none" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`,
  worried: `<circle cx="54" cy="73" r="2" fill="${DARK}"/><circle cx="62" cy="73" r="2" fill="${DARK}"/><path d="M49 68 L56 65 M67 68 L60 65" stroke="${DARK}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="58" cy="81" rx="3" ry="3.6" fill="${DARK}"/><path d="M75 62 q-4 6 0 8 q4 -2 0 -8 Z" fill="${SKY}" stroke="${INK}" stroke-width="1"/>`,
  sleepy: `<path d="M51 73 h6 M59 73 h6" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/><ellipse cx="58" cy="81" rx="2" ry="2.4" fill="${DARK}"/>`,
};

const Sk = {
  // a shape drawn twice: a wash of colour nudged off the line (like watercolour that missed), then the pen outline
  wash(tag, a, color, o = .85) {
    return `<g transform="translate(2 2)" opacity="${o}"><${tag} ${a} fill="${color}"/></g><${tag} ${a} fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  },
  line(d, c = INK, w = 2) { return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`; },
  text(x, y, t, c = INK, size = 12, extra = "") { return `<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-weight="700" text-anchor="middle" style="font-family:var(--font-sign)" ${extra}>${t}</text>`; },
  ground(y = 128) { return Sk.line(`M8 ${y + 1} Q80 ${y - 2} 150 ${y + 1} T292 ${y}`, DIM, 1.6); },
  heart(x, y, k = 1, c = RED) { return `<g transform="translate(${x} ${y}) scale(${k})">${Sk.wash("path", 'd="M0 4 C0 -4 -10 -4 -10 3 C-10 9 0 14 0 18 C0 14 10 9 10 3 C10 -4 0 -4 0 4Z"', c)}</g>`; },
  coin(x, y, r = 4) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${GOLD}" stroke="#5A4512" stroke-width=".8"/>`; },
  note(x, y, c = SUN) { return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="8" rx="4" ry="3" fill="${c}"/>${Sk.line("M4 8 V-6 l6 3", c, 1.8)}</g>`; },

  // how the traveler feels: the last choice's verdict while it's on screen, the stars at the end, calm otherwise
  mood(over) {
    if (over) return over;
    if (S.phase === "end") return S.res >= 3 ? "happy" : S.res <= 1 ? "worried" : "calm";
    const g = S.phase === "result" && S.grid[S.grid.length - 1];
    return g === "g" ? "happy" : g === "r" ? "worried" : "calm";
  },

  // the traveler: a stick-figure kid with a yellow head, drawn standing on (x, ground) and 66 units tall at scale 1
  kid(x, g, mood, o = {}) {
    const arms = o.arms || (mood === "happy" ? "M58 92 L44 76 M58 92 L72 76" : mood === "worried" ? "M58 92 L46 70 M58 92 L70 70" : "M58 94 L46 108 M58 94 L80 100");
    return `<g class="kid" transform="translate(${x} ${g}) scale(${o.scale || 1}) translate(-58 -128)">
      <circle cx="60" cy="76" r="12" fill="${SUN}" opacity=".9"/><circle cx="58" cy="74" r="12" fill="none" stroke="${INK}" stroke-width="1.8"/>${KID_FACES[mood] || KID_FACES.calm}
      ${o.shades ? `<path d="M46 71 h24" stroke="${DARK}" stroke-width="1.6"/><rect x="47" y="69" width="9" height="6" rx="2" fill="${DARK}"/><rect x="60" y="69" width="9" height="6" rx="2" fill="${DARK}"/>` : ""}
      <path d="M58 86 L58 112 M58 112 L49 128 M58 112 L67 128 ${arms}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ${o.scarf ? `<path d="M49 86 Q58 92 67 86 L67 91 Q58 97 49 91 Z" fill="${RED}" stroke="${INK}" stroke-width="1"/><path d="M62 92 l2 12 l5 -1 l-3 -11 Z" fill="${RED}" stroke="${INK}" stroke-width="1"/>` : ""}
      ${o.extra || ""}
    </g>`;
  },

  // act it out: a draggable item and drop zones laid over the drawing, in the drawing's own units (300 wide)
  actLayer(a, h) {
    const pc = (v, t) => (v / t * 100).toFixed(2) + "%";
    const zones = a.zones.map(z => `<div class="act-zone ${z.top ? "top" : ""} ${z.off ? "off" : ""}" data-zone="${z.off ? "off" : z.c}" style="left:${pc(z.x, 300)};top:${pc(z.y, h)};width:${pc(z.w, 300)};height:${pc(z.h, h)}">${z.icon ? `<b>${z.icon}</b>` : ""}<span>${esc(z.label)}</span></div>`).join("");
    return `<div class="act-layer">${zones}<button class="act-item" id="actitem" style="left:${pc(a.item.x, 300)};top:${pc(a.item.y, h)}" aria-label="${esc(a.item.label)}. Or use the buttons below.">${a.item.icon}</button></div>`;
  },

  // the journal page: ruled paper, tape, the drawing, and a one-line caption
  frame(id, val, label, svg, cap, o = {}) {
    const act = o.act !== undefined ? o.act : actOf(S.phase === "step" ? TOWNS[S.t].steps[S.step] : null, S.s), h = svg ? o.h || 140 : o.actH || 110;
    const draw = svg ? `<svg viewBox="0 0 300 ${h}" width="100%" aria-hidden="true">${o.under || ""}<g class="ink">${svg}</g></svg>` : "";
    return `<figure class="stage stage-${id} sketch ${o.cls || ""}" data-scene="${id}" data-val="${val}" data-town="${esc(TOWNS[S.t].name)}" aria-label="${label}">
      ${act ? `<div class="act-wrap">${draw}${svg ? "" : o.html || ""}${Sk.actLayer(act, h)}</div>${svg ? o.html || "" : ""}` : draw + (o.html || "")}
      <figcaption>${act ? act.hint : cap}</figcaption>
    </figure>`;
  },
};

/* ---------- Doubleton and Halfnight: the coin jar ---------- */
function jarScene(s, st) {
  const r = S.phase === "result" ? S.lastResult : null;
  const night = !!(r && r.night), doubled = night && /→/.test(r.night), end = S.phase === "end", opened = !!s.opened;
  const mood = opened ? "worried" : doubled ? "happy" : Sk.mood();
  const shown = Math.min(s.jar, 84), extra = s.jar - shown, prev = Math.min(Play.mem.jar || 0, shown);
  const coins = Array.from({ length: shown }, (_, i) => {
    const row = Math.floor(i / 7), col = i % 7, x = 122 + col * 9 + (row % 2 ? 3 : 0), y = 122 - row * 5.5;
    return `<ellipse class="${i >= prev ? "grow" : ""}" style="animation-delay:${Math.min(i - prev, 20) * 0.04}s" cx="${x}" cy="${y}" rx="4.6" ry="2.3" fill="${GOLD}" stroke="#5A4512" stroke-width=".8"/>`;
  }).join("");
  const lid = opened
    ? `<g transform="rotate(-24 214 118)">${Sk.wash("rect", 'x="196" y="112" width="46" height="9" rx="3"', RED)}</g>`
    : Sk.wash("rect", 'x="120" y="26" width="60" height="10" rx="3"', RED);
  // Piggy Charm (Glovebox): a little pig hangs off the jar's neck
  const piggy = has("piggy") ? `${Sk.line("M180 40 Q186 44 190 50", INK, 1.2)}<g transform="translate(193 57)">${Sk.wash("circle", 'cx="0" cy="0" r="7"', PINK)}<path d="M-5 -6 l2 -4 l2 3 M3 -6 l2 -4 l1 4" fill="${PINK}" stroke="${INK}" stroke-width="1"/><ellipse cx="3" cy="2" rx="3" ry="2.2" fill="#FFC2D4" stroke="${DARK}" stroke-width=".8"/><circle cx="-2" cy="-2" r="1" fill="${DARK}"/></g>` : "";
  const cap = opened ? "The lid is off. No magic tonight."
    : doubled ? `Midnight. The jar glows. ${plural(s.jar, "coin")}!`
    : end ? `${plural(s.jar, "coin")} in the jar.`
    : s.jar ? `${plural(s.jar, "coin")}. Keep the lid on, and they double at midnight.`
    : "An empty jar. Zero doubled is still zero.";
  const act = actOf(st, s);
  const under = doubled ? `<circle class="glow" cx="150" cy="84" r="58" fill="${SUN}" opacity=".14"/>` : "";
  return Sk.frame("jar", shown, `Your jar has ${fmt(s.jar)} coins${opened ? " and the lid is off" : ""}`, `
    ${night ? `<path d="M262 14 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 Z" fill="#FFE27A" opacity=".9" stroke="${INK}" stroke-width="1.2"/><path d="M236 22 l2 5 l5 1 l-5 1 l-2 5 l-2 -5 l-5 -1 l5 -1 Z" fill="${INK}" opacity=".7"/>` : ""}
    ${doubled ? `<g stroke="${SUN}" stroke-width="2" stroke-linecap="round">${[0, 40, 140, 180, 220, 320].map(a => { const c = Math.cos(a * Math.PI / 180), d = Math.sin(a * Math.PI / 180); return `<line x1="${150 + c * 50}" y1="${82 + d * 50}" x2="${150 + c * 62}" y2="${82 + d * 62}"/>`; }).join("")}</g>${Sk.text(212, 42, "×2!", SUN, 20, 'transform="rotate(-10 212 42)"')}` : ""}
    ${Sk.ground()}${coins}
    <path d="M118 42 Q113 46 113 56 L112 118 Q112 128 124 128 L176 128 Q188 128 188 118 L187 56 Q187 46 182 42 Z" fill="rgba(154,200,230,.10)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    ${Sk.line("M122 36 L122 42 M178 36 L178 42")}${Sk.line("M120 54 Q121 80 121 110", INK, 1.2).replace("/>", ' opacity=".45"/>')}
    ${lid}${piggy}
    <g transform="rotate(-4 150 74)"><rect x="131" y="64" width="38" height="17" rx="2" fill="${INK}" opacity=".92"/>${Sk.text(150, 77, opened ? "oops" : "SAVE", DARK, 11)}</g>
    ${Sk.kid(58, 128, mood)}
    ${extra > 0 ? Sk.text(150, 15, `+${fmt(extra)} more`, SUN, 12) : ""}`, act ? act.hint : cap, { under, h: 150, act });
}

const SCENES = {
  M1: jarScene,
  "M-chain": jarScene,

  /* Hushwick: ten word tokens a day, and a friendship heart that grows */
  L1(s, st) {
    const left = clamp(s.words, 0, 10), heart = clamp(s.heart, 0, 14);
    const tokens = Array.from({ length: 10 }, (_, i) => {
      const x = 118 + (i % 5) * 34, y = 22 + Math.floor(i / 5) * 26, on = i < left;
      return on ? `<g data-tok="${i}">${Sk.wash("rect", `x="${x}" y="${y}" width="28" height="18" rx="7"`, INK, .9)}${Sk.line(`M${x + 6} ${y + 9} h16`, DARK, 1.6)}</g>`
        : `<rect x="${x}" y="${y}" width="28" height="18" rx="7" fill="none" stroke="${DIM}" stroke-dasharray="3 3"/>${Sk.line(`M${x + 8} ${y + 4} l12 10 M${x + 20} ${y + 4} l-12 10`, DIM, 1.2)}`;
    }).join("");
    return Sk.frame("words", left, `${left} words left, friendship ${s.heart}`, `${Sk.ground()}${tokens}
      ${Sk.heart(200, 82, .7 + heart / 14 * .9)}${Sk.kid(58, 128, Sk.mood(left <= 2 && S.phase !== "end" ? "worried" : ""), { arms: "M58 94 L46 108 M58 94 L74 86" })}`,
      S.phase === "step" && st && st.choices ? "Hold a line to say it. Each word uses a token."
        : `${plural(left, "word")} left today.${heart ? ` Friendship: ${s.heart}.` : ""}`);
  },

  /* Greenpenny: a coin tree that only grows on watered days */
  M2(s, st) {
    const n = clamp(s.coins, 0, 40), dry = S.phase === "result" && !s.streak, act = actOf(st, s);
    const coins = Array.from({ length: n }, (_, i) => { const a = i * 2.4, rr = 8 + (i * 7) % 30; return Sk.coin(190 + Math.cos(a) * rr * 1.3, 58 + Math.sin(a) * rr * .8, 3.6); }).join("");
    const drops = Array.from({ length: clamp(s.streak, 0, 7) }, (_, i) => `<path d="M${116 + i * 5} ${96 + (i % 2) * 8} q-3 5 0 6 q3 -1 0 -6 Z" fill="${SKY}"/>`).join("");
    return Sk.frame("tree", n, `${s.coins} coins on the tree, watered ${s.streak} days in a row`, `${Sk.ground()}
      ${Sk.wash("path", 'd="M184 128 L186 84 Q187 74 182 66 M188 92 Q198 84 204 76"', WOOD)}
      ${Sk.wash("path", 'd="M150 66 Q148 30 186 26 Q230 24 230 62 Q232 92 190 92 Q150 94 150 66 Z"', dry ? "#8A9A5B" : LEAF, .55)}${coins}
      ${dry ? [0, 1, 2, 3].map(i => Sk.coin(160 + i * 14, 125, 3.6)).join("") : ""}
      ${s.streak && !act ? `${Sk.wash("path", 'd="M88 92 L108 92 L106 108 L90 108 Z"', SKY, .6)}${Sk.line("M108 96 L118 90")}${drops}` : ""}
      ${Sk.kid(58, 128, Sk.mood(dry ? "worried" : ""), { arms: "M58 94 L46 108 M58 94 L88 96" })}`,
      act ? act.hint : dry ? "No water today. The tree drops coins." : s.streak ? `Watered ${plural(s.streak, "day")} in a row. ${plural(s.coins, "coin")} on the tree.` : "A little tree. It grows only if you water it every day.", { act });
  },

  /* Saidsville: what you say about the neighbours comes true; their faces show it */
  L2(s) {
    const happy = clamp(Math.round(s.smiles / 2.4), 0, 5), sad = clamp(-s.smiles, 0, 5);
    const cols = [PINK, SKY, LEAF, PLUM, "#FF9F43"];
    const folks = cols.map((c, i) => {
      const x = 140 + i * 34, face = i < happy ? `<path d="M${x - 4} ${92} q4 5 8 0" fill="none" stroke="${DARK}" stroke-width="1.6" stroke-linecap="round"/>`
        : i >= 5 - sad ? `<path d="M${x - 4} ${95} q4 -4 8 0" fill="none" stroke="${DARK}" stroke-width="1.6" stroke-linecap="round"/>` : Sk.line(`M${x - 3} 93 h6`, DARK, 1.6);
      return `${Sk.wash("circle", `cx="${x}" cy="88" r="10"`, c)}<circle cx="${x - 3}" cy="86" r="1.4" fill="${DARK}"/><circle cx="${x + 3}" cy="86" r="1.4" fill="${DARK}"/>${face}${Sk.line(`M${x} 98 V114 M${x} 114 l-6 14 M${x} 114 l6 14 M${x} 104 l-8 6 M${x} 104 l8 6`)}`;
    }).join("");
    return Sk.frame("smiles", s.smiles, `${s.smiles} smiles in town`, `${Sk.ground()}
      ${Sk.wash("path", 'd="M78 30 Q78 16 100 16 L130 16 Q150 16 150 30 Q150 44 130 44 L104 44 L92 54 L96 44 Q78 44 78 30 Z"', INK, .9)}${Sk.text(114, 35, s.smiles < 0 ? "grr…" : "you're great!", DARK, 10)}
      ${folks}${Sk.kid(58, 128, Sk.mood())}`,
      s.smiles > 0 ? `${plural(s.smiles, "smile")} in town, and counting.` : s.smiles < 0 ? "Some neighbours are having a bad hour." : "Careful what you say. It comes true.");
  },

  /* Yawnmore: every unneeded buy steals an hour of sleep */
  M3(s) {
    const sleep = clamp(s.sleep, 0, 9);
    const moons = Array.from({ length: 9 }, (_, i) => { const x = 150 + i * 15, on = i < sleep; return `<path d="M${x} 16 a6 6 0 1 0 5 9 a5 5 0 1 1 -5 -9 Z" fill="${on ? "#FFE27A" : "none"}" stroke="${on ? INK : DIM}" stroke-width="1" ${on ? "" : 'stroke-dasharray="2 2"'}/>`; }).join("");
    const coins = Array.from({ length: clamp(Math.round(s.coins / 2), 0, 12) }, (_, i) => `<ellipse cx="250" cy="${124 - i * 3.2}" rx="9" ry="2.6" fill="${GOLD}" stroke="#5A4512" stroke-width=".8"/>`).join("");
    const tired = sleep <= 5;
    return Sk.frame("sleep", sleep, `${s.sleep} hours of sleep tonight`, `${Sk.ground()}${moons}
      ${Sk.wash("rect", 'x="30" y="96" width="150" height="20" rx="4"', PLUM, .55)}${Sk.line("M30 96 V128 M180 104 V128 M30 116 H180")}
      ${Sk.wash("rect", 'x="40" y="86" width="30" height="12" rx="5"', INK, .8)}
      <circle cx="58" cy="84" r="11" fill="${SUN}" opacity=".9"/><circle cx="56" cy="82" r="11" fill="none" stroke="${INK}" stroke-width="1.8"/>
      ${tired ? `<circle cx="52" cy="81" r="1.8" fill="${DARK}"/><circle cx="60" cy="81" r="1.8" fill="${DARK}"/><ellipse cx="56" cy="88" rx="2.4" ry="3" fill="${DARK}"/>` : Sk.line("M50 81 h4 M58 81 h4 M54 88 q2 2 4 0", DARK, 1.8)}
      ${Sk.wash("path", 'd="M66 92 Q110 84 176 94 L176 104 L66 104 Z"', SKY, .5)}
      ${tired ? "" : Sk.text(96, 66, "z", INK, 12) + Sk.text(108, 54, "Z", INK, 16) + Sk.text(124, 40, "Z", INK, 20)}
      ${Sk.line("M232 128 V100 H268 V128")}${coins}`,
      tired ? `Only ${plural(s.sleep, "hour")} of sleep. Yawn.` : `${plural(s.sleep, "hour")} of sleep tonight.`);
  },

  /* Chargeville: your phone battery is your energy */
  L3(s) {
    const b = clamp(s.bat, 0, 100), h = Math.round(b * .74), c = b >= 50 ? LEAF : b >= 25 ? SUN : RED;
    const mood = b === 0 ? "sleepy" : b < 25 ? "worried" : b >= 75 ? "happy" : Sk.mood();
    return Sk.frame("bat", b, `Your battery is at ${b}%`, `${Sk.ground()}
      ${Sk.wash("rect", 'x="140" y="12" width="70" height="116" rx="12"', "#22355F", .9)}
      <rect x="160" y="26" width="30" height="80" rx="4" fill="none" stroke="${INK}" stroke-width="1.6"/><rect x="169" y="21" width="12" height="5" rx="1" fill="${INK}"/>
      <rect x="163" y="${103 - h}" width="24" height="${h}" rx="2" fill="${c}" opacity=".9"/>
      ${Sk.text(175, 122, b + "%", INK, 12)}
      ${b < 25 ? Sk.line("M232 40 l-8 14 h8 l-8 14", SUN, 2.4) : ""}
      ${Sk.kid(70, 128, mood, b < 25 ? { arms: "M58 94 L50 112 M58 94 L66 112" } : {})}`,
      b === 0 ? "0%. You can't even lift your feet." : b < 25 ? `${b}%. Everything feels heavy.` : b >= 75 ? `${b}%. Full of energy!` : `${b}%. Doing okay.`);
  },

  /* Petalton: one flower per sorry, one thorn per sorry you skipped */
  L4(s) {
    const n = Math.min(s.flowers, 18), t = Math.min(s.thorns, 12), prev = Play.mem.yard || 0;
    const petals = [RED, PINK, SUN, PLUM, "#FF9F43", LEAF];
    const flower = i => {
      const x = 14 + ((i * 53) % 230), h = 24 + ((i * 17) % 22), c = petals[i % petals.length];
      const p = [0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${119 - h - 7}" rx="4" ry="7" fill="${c}" stroke="${INK}" stroke-width=".6" transform="rotate(${a} ${x} ${119 - h})"/>`).join("");
      return `<g class="${i >= prev ? "grow" : ""}" style="transform-origin:${x}px 119px; animation-delay:${(i - prev) * 0.12}s">${Sk.line(`M${x} 119 Q${x - 3} ${119 - h / 2} ${x} ${119 - h}`, LEAF, 2.2)}${p}<circle cx="${x}" cy="${119 - h}" r="3.4" fill="#FFF2B0"/></g>`;
    };
    const thorn = i => { const x = 30 + ((i * 41 + 11) % 210); return `<path d="M${x - 7} 119 L${x} ${101 - (i % 3) * 4} L${x + 7} 119 Z" fill="#3B2A2A" stroke="${INK}" stroke-width="1"/>`; };
    return Sk.frame("yard", n, `${s.flowers} flowers and ${s.thorns} thorns in your yard`, `
      ${Sk.wash("rect", 'x="0" y="119" width="300" height="12" rx="2"', "#5B4636", .7)}
      ${Array.from({ length: t }, (_, i) => thorn(i)).join("")}${Array.from({ length: n }, (_, i) => flower(i)).join("")}
      ${Sk.line("M252 120 V84 M292 120 V84 M252 92 H292 M252 108 H292", s.thorns > 1 ? RED : DIM, 2)}
      ${Sk.kid(272, 119, Sk.mood(s.thorns > 1 ? "worried" : ""), { scale: .75 })}`,
      s.thorns > 1 ? "Thorns are creeping toward the gate." : s.flowers ? `${plural(s.flowers, "flower")} in your yard.` : "Just dirt, for now.");
  },

  /* Futureville: the bank app shows you your future self */
  M4(s) {
    const f = s.future, fm = f >= 6 ? "happy" : f >= 3 ? "calm" : "worried";
    const stack = Array.from({ length: clamp(s.saved, 0, 14) }, (_, i) => `<ellipse cx="104" cy="${125 - i * 3.2}" rx="9" ry="2.6" fill="${GOLD}" stroke="#5A4512" stroke-width=".8"/>`).join("");
    return Sk.frame("future", f, `Your future self looks ${fm}`, `${Sk.ground()}
      ${Sk.wash("rect", 'x="160" y="10" width="110" height="118" rx="12"', "#22355F", .9)}<rect x="168" y="24" width="94" height="94" rx="4" fill="rgba(127,200,248,.12)" stroke="${INK}" stroke-width="1.2"/>
      ${Sk.text(215, 21, "FUTURE YOU", SUN, 9)}
      ${f >= 8 ? Sk.wash("path", 'd="M232 112 V92 L246 80 L260 92 V112 Z"', RED, .55) : ""}
      ${Sk.kid(206, 116, fm, { scale: .78, extra: f >= 3 ? "" : Sk.line("M70 104 l6 16", DIM, 2) })}
      ${stack}${Sk.kid(58, 128, Sk.mood(), { arms: "M58 94 L46 108 M58 94 L80 88" })}`,
      `Future you is ${f >= 8 ? "cozy, with a home of their own" : f >= 6 ? "smiling" : f >= 3 ? "doing okay" : "worried about money"}.${s.saved ? ` ${plural(s.saved, "coin")} saved.` : ""}`);
  },

  /* Boomerang Bay: what you throw away washes back up */
  L5(s) {
    const pile = clamp(s.pile, 0, 12);
    const junk = Array.from({ length: pile }, (_, i) => { const x = 130 + (i % 5) * 16 + (Math.floor(i / 5) % 2) * 8, y = 116 - Math.floor(i / 5) * 12, c = [WOOD, SKY, PINK, DIM][i % 4]; return Sk.wash("rect", `x="${x}" y="${y}" width="13" height="11" rx="2" transform="rotate(${(i * 23) % 20 - 10} ${x + 6} ${y + 6})"`, c, .8); }).join("");
    return Sk.frame("beach", pile, `${s.pile} things coming back`, `
      ${Sk.line("M8 128 H292", DIM, 1.6)}${Sk.line("M222 120 q8 -6 16 0 t16 0 t16 0 t16 0 M210 110 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0", SKY, 1.8)}
      <g transform="rotate(-20 220 30)">${Sk.wash("path", 'd="M200 34 Q220 14 244 30 L238 36 Q220 26 206 40 Z"', WOOD, .9)}</g>
      ${Sk.line("M120 70 Q170 10 214 36", DIM, 1.2).replace("/>", ' stroke-dasharray="4 4"/>')}
      ${junk}${Sk.kid(58, 128, Sk.mood(pile > 3 ? "worried" : pile === 0 && s.happy > 3 ? "happy" : ""))}`,
      pile ? `${plural(s.pile, "thing")} washed back up on your beach.` : "Nothing came back. The beach is clear.");
  },

  /* Leashville, painted: the journal art from img/leashville, laid out as cut-out pieces that follow the numbers.
     Every loan is a dog on a leash, sized by what you owe. Paying back makes it trot off; the Dog Biscuit keeps
     the first one a puppy. The scene is 300×152 units over the background strip; pieces are placed in those units. */
  M5(s, st) {
    const pack = s.pack || [], paying = st && st.pay && S.phase === "step", W = 300, H = 152, G = 141; // G: where feet touch the ground
    if (S.phase === "end") { // the ending is a full painting, chosen by how it went
      const free = !pack.length && !s.dogs;
      return Sk.frame("dogs", 0, free ? "You paid every dog back" : "The dogs are still pulling you", "",
        free ? "Every dog paid back." : `${plural(pack.length || s.dogs, "dog")} still on the leash.`,
        { cls: "painted", html: Film.end(TOWNS[S.t], free) });
    }
    const pc = (v, t) => (v / t * 100).toFixed(2) + "%";
    const order = pack.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const pull = Math.min(70, s.size * 5);
    // dogs line up to the left of the traveler, each one's size from what that loan has grown to
    let right = 202;
    const placed = pack.map((v, i) => {
      const pup = i === 0 && has("biscuit") && v <= 1;
      const h = pup ? 34 : clamp(30 + v * 9, 30, 92), w = pup ? h * 0.873 : h * 1.88;
      const x = right - w; right = x + w * 0.22;
      const collar = pup ? [x + w * 0.42, G - h * 0.52] : [x + w * 0.25, G - h * 0.76];
      return { v, i, pup, x, h, w, collar };
    });
    const hands = [221, 62]; // the traveler's fists in the pulling pose (mirrored to face the dogs)
    const leash = placed.map(d => `<path d="M${hands[0]} ${hands[1]} L${d.collar[0].toFixed(1)} ${d.collar[1].toFixed(1)}" />`).join("");
    const dogs = placed.map(d => {
      const box = `left:${pc(d.x, W)};top:${pc(G - d.h, H)};width:${pc(d.w, W)};height:${pc(d.h, H)};--amp:${Math.min(3, 0.6 + d.v * 0.35)}px`;
      const img = `<img src="/img/leashville/${d.pup ? "puppy" : "dog"}.webp" alt="" draggable="false">`;
      return paying
        ? `<button class="pdog" data-dog="${d.i}" style="${box}" aria-label="Pay back dog ${order.indexOf(d.i) + 1}, size ${d.v}">${img}<i>${d.v}</i></button>`
        : `<span class="pdog" style="${box}">${img}</span>`;
    }).join("");
    const free = !pack.length;
    const justPaid = S.phase === "result" && free && (S.lastResult || {}).i !== undefined && st && st.pay;
    const worry = !free && !paying && (S.phase === "result" || s.size >= 4);
    const walker = free
      ? `<img class="ptrav free" src="/img/leashville/traveler-free.webp" alt="" style="left:${pc(226, W)};top:${pc(G - 100, H)};height:${pc(100, H)}">`
      : `<img class="ptrav pull" src="/img/leashville/traveler-pull.webp" alt="" style="left:${pc(204, W)};top:${pc(G - 100, H)};height:${pc(100, H)};--amp:${Math.min(4, 1 + s.size * 0.3)}px">`;
    const html = `<div class="paint" style="aspect-ratio:${W}/${H}">
      <img class="paint-bg" src="/img/leashville/bg.webp" alt="" width="900" height="456">
      ${worry ? `<img class="pbub" src="/img/leashville/bubble-worry.webp" alt="" style="left:${pc(176, W)};top:${pc(-4, H)};width:${pc(76, W)}">` : ""}
      ${free && (justPaid || s.free >= 5) ? `<img class="pbub" src="/img/leashville/bubble-coin.webp" alt="" style="left:${pc(244, W)};top:${pc(-6, H)};width:${pc(56, W)}">` : ""}
      <svg class="pleash" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${leash}</svg>
      ${dogs}${walker}
    </div>`;
    return Sk.frame("dogs", pull, `${pack.length} dogs following you`, "",
      pack.length ? `${plural(pack.length, "dog")} on the leash, pulling you back${paying ? ". Tap them to pay them back, smallest first." : "."}` : "Nobody behind you. Just you and the open street.",
      { cls: "painted", html, actH: H });
  },

  /* Tockfield: the pantry shelf of saved hours, and the catch game */
  "L-fallback"(s, st) {
    const jars = Math.min(s.jars, 60), big = has("big-jar");
    const jar = i => { const row = Math.floor(i / 20), x = 14 + (i % 20) * 13.6, y = 30 + row * 34; return `<rect x="${x}" y="${y}" width="9" height="13" rx="2" fill="${SUN}" opacity=".85" stroke="${INK}" stroke-width=".8"/>`; };
    const catching = st && st.play && st.play.kind === "catch" && !S.played && S.phase === "step";
    return Sk.frame("shelf", jars, `${s.jars} hours saved in jars`, `
      ${[44, 78, 112].map(y => Sk.wash("rect", `x="8" y="${y}" width="284" height="5" rx="1"`, WOOD, .8)).join("")}
      ${Array.from({ length: jars }, (_, i) => jar(i)).join("")}
      ${big ? `${Sk.wash("rect", 'x="244" y="88" width="36" height="24" rx="4"', SKY, .3)}${Sk.text(262, 104, "BIG", INK, 9)}` : ""}
      <g transform="rotate(-6 40 16)">${Sk.wash("rect", 'x="16" y="8" width="54" height="15" rx="2"', INK, .9)}${Sk.text(43, 19, "Someday", DARK, 9)}</g>`,
      s.jars ? `${plural(s.jars, "hour")} on the shelf, labeled “Someday.”` : "The shelf is empty. Every hour got spent.",
      { h: 122, html: catching ? `<div class="catch" id="catch" tabindex="0" aria-label="Move the jar with your finger, mouse or arrow keys to catch the falling hour">
        <i class="orb" id="orb"></i><i class="cjar ${big ? "big" : ""}" id="cjar"></i><span class="catch-tip" id="catch-tip">Catch the hour! Drag or tap to move the jar.</span></div>` : "" });
  },

  /* Tillsbury: the wallet talks back */
  M8(s) {
    const t = s.trust, wm = t >= 5 ? "happy" : t <= 1 ? "worried" : "calm";
    const bills = Array.from({ length: clamp(Math.round(s.cash / 6), 0, 6) }, (_, i) => `<g transform="rotate(${-14 + i * 6} ${170 + i * 9} 60)">${Sk.wash("rect", `x="${162 + i * 9}" y="40" width="16" height="26" rx="2"`, LEAF, .7)}</g>`).join("");
    const mouth = wm === "happy" ? Sk.line("M192 92 q12 10 24 0", DARK, 2.4) : wm === "worried" ? Sk.line("M194 98 q10 -8 20 0", DARK, 2.4) : Sk.line("M194 94 h20", DARK, 2.4);
    return Sk.frame("wallet", s.cash, `Your wallet has ${s.cash} coins and trusts you ${t}`, `${Sk.ground()}${bills}
      ${Sk.wash("rect", 'x="150" y="60" width="110" height="66" rx="10"', "#8A5A2B", .9)}${Sk.line("M150 74 H260")}
      <circle cx="194" cy="84" r="3" fill="${DARK}"/><circle cx="214" cy="84" r="3" fill="${DARK}"/>${mouth}
      ${S.phase === "step" ? `${Sk.wash("path", 'd="M200 8 L284 8 Q292 8 292 16 L292 30 Q292 38 284 38 L262 38 L254 50 L254 38 L208 38 Q200 38 200 30 Z"', INK, .9)}${Sk.text(246, 28, "You sure?", DARK, 11)}` : ""}
      ${Sk.kid(70, 128, Sk.mood())}`,
      `${plural(s.cash, "coin")} in your wallet. ${t >= 5 ? "It trusts you." : t <= 1 ? "It's nervous." : "It's watching."}`);
  },

  /* Tagwick: coins with jobs stay put; idle coins walk off */
  "M-jobs"(s) {
    const working = clamp(Math.round(s.plan), 0, 6), leaving = clamp(Math.round((100 - s.cash) / 12), 0, 5);
    const workers = Array.from({ length: working }, (_, i) => { const x = 110 + i * 22; return `${Sk.coin(x, 118, 9)}<path d="M${x - 9} 110 a9 7 0 0 1 18 0 Z" fill="${SUN}" stroke="${INK}" stroke-width="1"/>${Sk.line(`M${x - 11} 110 h22`, INK, 1.4)}`; }).join("");
    const walkers = Array.from({ length: leaving }, (_, i) => { const x = 250 + i * 10, y = 70 - i * 9; return `${Sk.coin(x, y, 6)}${Sk.line(`M${x - 2} ${y + 6} l-3 7 M${x + 2} ${y + 6} l4 7 M${x - 12} ${y} h-6 M${x - 12} ${y + 4} h-4`, INK, 1.4)}`; }).join("");
    return Sk.frame("jobs", s.cash, `${s.cash} coins left, ${working} with a job`, `${Sk.ground()}${workers}${walkers}
      ${leaving ? Sk.text(262, 22, "bye!", INK, 11) : ""}${Sk.kid(58, 128, Sk.mood())}`,
      leaving ? `${plural(s.cash, "coin")} left. Coins with no job walked off.` : `${plural(s.cash, "coin")}. Give every one a job.`);
  },

  /* Hourmouth: price tags in hours of your life */
  "M-hours"(s) {
    const top = clamp(s.hours / 48, 0, 1), fam = clamp(s.family, 0, 6);
    const people = Array.from({ length: fam }, (_, i) => Sk.kid(196 + i * 18, 128, "happy", { scale: .5, arms: "M58 94 L40 100 M58 94 L76 100" })).join("");
    return Sk.frame("hours", s.hours, `${s.hours} hours left, family ${s.family}`, `${Sk.ground()}
      ${Sk.line("M112 18 H160 M112 126 H160 M116 18 Q116 60 136 72 Q116 84 116 126 M156 18 Q156 60 136 72 Q156 84 156 126")}
      <path d="M${136 - 18 * top} ${66 - 44 * top} Q136 ${70} ${136 + 18 * top} ${66 - 44 * top} Z" fill="${SUN}" opacity=".85"/>
      <path d="M122 124 Q136 ${124 - 44 * (1 - top)} 150 124 Z" fill="${SUN}" opacity=".85"/>${Sk.line("M136 72 V122", SUN, 1).replace("/>", ' stroke-dasharray="2 3"/>')}
      ${people}${Sk.kid(58, 128, Sk.mood(s.missed ? "worried" : ""))}`,
      `${plural(s.hours, "hour")} of your life left to spend.${fam ? "" : " Your family misses you."}`);
  },

  /* Inchwick: the house shrinks one inch per new thing. Drawn to scale: 1 unit = 1 inch; you are 66 */
  "M-shrink"(s) {
    const door = Math.max(40, s.door), stuff = Math.max(0, 72 - s.door), tooLow = s.door < 66, wall = door + 12, top = 136 - wall;
    const boxes = Array.from({ length: Math.min(stuff, 14) }, (_, i) => Sk.wash("rect", `x="${142 + (i % 6) * 13}" y="${125 - Math.floor(i / 6) * 12}" width="11" height="10" rx="2"`, WOOD, .8)).join("");
    return Sk.frame("house", door, `Your house is ${s.door} inches tall. You are 66 inches.`, `
      ${Sk.ground(135)}
      <g class="house" style="transform-origin: 150px 136px">
        ${Sk.wash("rect", `x="70" y="${top}" width="160" height="${wall}"`, "#22355F", .9)}
        ${Sk.wash("path", `d="M60 ${top + 2} L150 ${top - 30} L240 ${top + 2} Z"`, RED, .8)}
        <rect x="86" y="${136 - door}" width="30" height="${door}" fill="${DARK}" opacity=".6" stroke="${INK}" stroke-width="1.6"/>
      </g>
      ${boxes}
      <g class="me ${tooLow ? "squashed" : ""}" transform="translate(101 136) scale(1 ${tooLow ? door / 66 : 1}) translate(-101 -136)">${Sk.kid(101, 136, tooLow ? "worried" : Sk.mood(), { scale: .92 })}</g>
      ${Sk.line(`M252 ${136 - door} V136`, DIM, 1.4).replace("/>", ' stroke-dasharray="3 3"/>')}${Sk.text(268, 136 - door / 2, `${s.door}"`, DIM, 12)}`,
      tooLow ? "You can't stand up in your own house." : stuff ? `${plural(stuff, "new thing")} inside. ${s.door - 66} inch${s.door - 66 === 1 ? "" : "es"} of headroom left.` : "Six feet of door. Plenty of room.",
      { h: 150 });
  },

  /* Featherton: every subscription is a bird living in your coat, eating your coins */
  "M-birds"(s) {
    const birds = clamp(s.birds, 0, 9), coins = clamp(Math.round(s.coins / 70), 0, 15);
    const bird = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">${Sk.wash("ellipse", 'cx="0" cy="0" rx="8" ry="6"', SKY, .9)}<circle cx="-5" cy="-4" r="4" fill="${SKY}" stroke="${INK}" stroke-width="1"/><circle cx="-6" cy="-5" r="1" fill="${DARK}"/><path d="M-9 -4 l-4 1 l4 1" fill="${SUN}"/></g>`;
    return Sk.frame("birds", birds, `${s.birds} birds in your coat`, `${Sk.ground()}${Sk.line("M8 26 Q150 40 292 24", DIM, 1.4)}
      ${Array.from({ length: birds }, (_, i) => bird(130 + i * 18, 26 + Math.sin(i) * 3, .9)).join("")}
      ${Array.from({ length: coins }, (_, i) => `<ellipse cx="${200 + (i % 3) * 20}" cy="${124 - Math.floor(i / 3) * 4}" rx="9" ry="2.6" fill="${GOLD}" stroke="#5A4512" stroke-width=".8"/>`).join("")}
      ${birds ? bird(232, 102, .8) + bird(212, 106, .7) : ""}
      ${Sk.kid(70, 128, Sk.mood(birds > 4 ? "worried" : ""), { extra: `<path d="M48 88 L46 116 L70 116 L68 88 Z" fill="${PLUM}" opacity=".5" stroke="${INK}" stroke-width="1.2"/>` })}`,
      birds ? `${plural(s.birds, "bird")} in your coat, eating every month. ${fmt(s.coins)} coins left.` : `${fmt(s.coins)} coins, and no birds. Quiet pockets.`);
  },

  /* Duesbury: a forgotten bill grows into a monster */
  "M-monster"(s) {
    const k = s.bill ? clamp(.5 + Math.log10(s.bill + 1) / 2.2, .5, 1.6) : 0;
    return Sk.frame("monster", s.bill, `You owe ${s.bill}`, `${Sk.ground()}
      ${k ? `<g transform="translate(210 128) scale(${k}) translate(-210 -128)">
        ${Sk.wash("path", 'd="M170 128 Q166 70 210 64 Q254 70 250 128 Q240 120 230 128 Q220 120 210 128 Q200 120 190 128 Q180 120 170 128 Z"', PLUM, .85)}
        <circle cx="198" cy="88" r="6" fill="${INK}"/><circle cx="222" cy="88" r="6" fill="${INK}"/><circle cx="199" cy="89" r="2.6" fill="${DARK}"/><circle cx="221" cy="89" r="2.6" fill="${DARK}"/>
        <path d="M196 104 Q210 114 224 104 Z" fill="${DARK}"/><path d="M200 105 l3 5 l3 -4 l3 5 l3 -5 l3 4 l3 -4" fill="${INK}"/>
        <g transform="rotate(8 250 90)">${Sk.wash("rect", 'x="240" y="74" width="26" height="32" rx="2"', INK, .9)}${Sk.text(253, 94, fmt(s.bill), DARK, 9)}</g>
      </g>` : `<g transform="rotate(-8 210 90)">${Sk.wash("rect", 'x="180" y="62" width="60" height="56" rx="3"', INK, .9)}${Sk.text(210, 96, "PAID", LEAF, 16)}</g>`}
      ${Sk.kid(58, 128, Sk.mood(k > 1 ? "worried" : !s.bill ? "happy" : ""))}`,
      s.bill ? `The bill says ${fmt(s.bill)}. ${s.bill > 50 ? "It's getting big." : "It's still small."}` : "Paid. No monster today.");
  },

  /* Laterton: the shadow is nothing at noon and everything at sunset */
  "M-shadow"(s, st) {
    const sunset = !!(st && /p\.m\.|sunset|November/i.test(st.when)) || S.phase === "end";
    const len = sunset ? Math.min(220, 20 + Math.sqrt(s.lb) * 9) : 14 + s.plans; // the low sun sits behind you, so the shadow stretches away from it
    const dark = Math.min(0.92, 0.35 + s.lb / 2000), shades = has("shades");
    return Sk.frame("shadow", len, `Your shadow weighs ${s.lb} pounds`, `
      ${Sk.wash("circle", `cx="${sunset ? 26 : 150}" cy="${sunset ? 92 : 18}" r="${sunset ? 16 : 11}"`, sunset ? "#FF8A3D" : "#FFE27A", .9)}
      ${sunset ? "" : Sk.line("M150 2 v-4 M136 18 h-6 M164 18 h6 M140 8 l-4 -4 M160 8 l4 -4", SUN, 1.6)}
      ${Sk.ground(110)}
      <ellipse class="shade" cx="${66 + len / 2}" cy="114" rx="${len / 2}" ry="${sunset ? 7 : 4}" fill="rgba(0,0,0,${dark})" stroke="${DIM}" stroke-width="1.2" stroke-dasharray="4 3" style="transform-origin: 66px 114px"/>
      ${Sk.kid(66, 112, Sk.mood(sunset && s.lb > 200 ? "worried" : ""), { scale: .8, shades })}`,
      sunset ? `Sunset. Your shadow weighs ${fmt(s.lb)} lb.${shades ? " The sunglasses help a little." : ""}` : s.plans ? `Noon. ${plural(s.plans, "plan")}, and your shadow feels like nothing. For now.` : "Noon. A normal shadow.",
      { h: 128, cls: sunset ? "dusk" : "noon" });
  },

  /* Whisperton: loud words crack the glass bridge */
  "L-whisper"(s) {
    const cracked = clamp(Math.round((100 - s.glass) / 10), 0, 10);
    const tiles = Array.from({ length: 10 }, (_, i) => { const x = 8 + i * 28.4, bad = i >= 10 - cracked; return `<rect x="${x}" y="108" width="26" height="12" rx="1" fill="${SKY}" opacity="${bad ? .15 : .35}" stroke="${INK}" stroke-width="1"/>${bad ? Sk.line(`M${x + 4} 109 l6 5 l-2 3 l8 2 M${x + 14} 110 l5 8`, INK, 1) : ""}`; }).join("");
    const muffler = has("muffler");
    return Sk.frame("glass", s.glass, `The glass bridge is ${s.glass}% whole`, `${tiles}
      ${Sk.line("M8 108 V70 M292 108 V70 M8 76 H292", DIM, 1.4)}
      ${Sk.text(150, 30, "shh…", DIM, 14)}
      ${Sk.kid(70, 108, Sk.mood(s.glass < 40 ? "worried" : ""), { scale: .8, scarf: muffler, arms: "M58 94 L48 108 M58 94 L66 80" })}`,
      `The glass bridge is ${s.glass}% whole.${muffler ? " Your muffler softens your voice." : ""}`, { h: 128 });
  },

  /* Harmonia: every door opens to a note */
  "L-hum"(s) {
    const open = clamp(s.doors, 0, 5), fork = has("fork");
    const doors = Array.from({ length: 5 }, (_, i) => {
      const x = 118 + i * 34, on = i < open;
      return on ? `<rect x="${x}" y="70" width="24" height="58" fill="${SUN}" opacity=".35"/>${Sk.wash("path", `d="M${x} 70 L${x + 10} 76 L${x + 10} 132 L${x} 128 Z"`, WOOD, .9)}${Sk.note(x + 14, 52)}`
        : Sk.wash("rect", `x="${x}" y="70" width="24" height="58" rx="2"`, WOOD, .8) + `<circle cx="${x + 19}" cy="100" r="1.8" fill="${INK}"/>`;
    }).join("");
    return Sk.frame("doors", open, `${s.doors} doors open`, `${Sk.ground()}${doors}
      ${Sk.note(86, 52, INK)}${Sk.note(98, 36, INK)}
      ${Sk.kid(58, 128, Sk.mood(), { extra: fork ? `${Sk.line("M80 100 V86 M80 86 l-4 -10 M80 86 l4 -10", "#C0C8D8", 2)}` : "", arms: "M58 94 L46 108 M58 94 L80 100" })}`,
      `${open} of 5 doors open.${fork ? " The tuning fork hums along." : ""}`);
  },

  /* Rhymeburg: offers have to rhyme */
  "M-rhyme"(s) {
    const got = clamp(s.stuff, 0, 8), book = has("rhyme-book");
    const goods = Array.from({ length: got }, (_, i) => Sk.wash("circle", `cx="${96 + (i % 4) * 9}" cy="${112 - Math.floor(i / 4) * 8}" r="4.5"`, [RED, SKY, LEAF, PLUM][i % 4], .9)).join("");
    return Sk.frame("market", got, `${s.stuff} things bought, ${s.coins} coins left`, `${Sk.ground()}
      ${[0, 1, 2, 3, 4].map(i => Sk.wash("path", `d="M${170 + i * 22} 30 L${192 + i * 22} 30 L${192 + i * 22} 44 Q${181 + i * 22} 52 ${170 + i * 22} 44 Z"`, i % 2 ? INK : RED, .8)).join("")}
      ${Sk.line("M172 44 V128 M278 44 V128")}${Sk.wash("rect", 'x="166" y="96" width="118" height="10"', WOOD, .8)}
      ${Sk.text(225, 76, "hat · cat", SUN, 11)}
      ${Sk.wash("path", 'd="M90 104 L126 104 L122 124 L94 124 Z"', WOOD, .7)}${goods}
      ${Sk.kid(58, 128, Sk.mood(), { arms: "M58 94 L46 108 M58 94 L92 104", extra: book ? Sk.wash("rect", 'x="38" y="96" width="12" height="16" rx="1"', RED, .9) : "" })}`,
      `${plural(s.stuff, "thing")} in your basket, ${plural(s.coins, "coin")} left.${book ? " Your rhyme book is open." : ""}`);
  },

  /* Echo Valley: what you say comes back as a promise */
  "L-echo"(s) {
    const n = clamp((s.echo || []).length, 0, 5), t = clamp(s.time, 0, 12), a = (t / 12) * 360 - 90;
    return Sk.frame("echo", n, `${s.time} Saturday hours left, ${n} promises echoing`, `
      ${Sk.wash("path", 'd="M150 128 L210 40 L250 96 L270 70 L298 128 Z"', "#5B6E9A", .6)}${Sk.line("M200 55 l10 -15 l10 15", INK, 1.6)}
      ${Sk.ground()}
      ${Array.from({ length: n }, (_, i) => `${Sk.wash("path", `d="M${150 - i * 18} ${40 + i * 14} q0 -10 14 -10 h12 q14 0 14 10 q0 10 -14 10 h-12 l-6 6 v-6 q-8 0 -8 -10 Z"`, INK, .85)}${Sk.line(`M${158 - i * 18} ${40 + i * 14} h18`, DARK, 1.4)}`).join("")}
      <circle cx="30" cy="30" r="18" fill="${INK}" opacity=".9" stroke="${INK}" stroke-width="1.6"/>${Sk.line(`M30 30 L${30 + Math.cos(a * Math.PI / 180) * 12} ${30 + Math.sin(a * Math.PI / 180) * 12}`, DARK, 2)}${Sk.text(30, 62, t + "h", SUN, 11)}
      ${Sk.kid(70, 128, Sk.mood(t <= 3 ? "worried" : ""))}`,
      n ? `${plural(n, "promise")} echoing back. ${plural(t, "hour")} of Saturday left.` : `${plural(t, "hour")} of Saturday. Whatever you say comes back.`);
  },
};

/* ---------- act it out: choose by doing something on the drawing ---------- */
// what each Doubleton day tempts you with; choice 0 always keeps the jar shut
const JAR_DAYS = {
  "Day 1": { coin: true, keep: "Into the jar", icon: "🍬", spend: "Gumball" },
  "Day 2": { keep: "Keep saving", icon: "⭐", spend: "Sticker" },
  "Day 3": { keep: "Keep it shut", icon: "👦", spend: "Open & count" },
  "Day 4": { keep: "Just watch", icon: "🎡", spend: "Ride" },
  "Day 5": { coin: true, keep: "Save it all", icon: "📕", spend: "Comic" },
  "Day 6": { keep: "Share lunch", icon: "🧒", spend: "Give 5" },
  "Day 7": { keep: "Walk away", icon: "🏎️", spend: "RC car" },
};
// what pulls you away from watering the Greenpenny tree
const TREE_DAYS = { "Day 1": ["🛏️", "Tomorrow"], "Day 2": ["⚽", "Play"], "Day 3": ["📺", "Watch"], "Day 4": ["🌧️", "Let rain"], "Day 5": ["😴", "Skip"], "Day 6": ["🎒", "Just go"], "Day 7": ["👦", "Let him"], "Day 8": ["🎂", "Party"] };
const CAN = `<svg viewBox="0 0 44 32" width="30" aria-hidden="true"><path d="M8 12 h20 v16 h-20 Z" fill="${SKY}" fill-opacity=".55" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M28 16 l12 -8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12 q6 -9 12 0" fill="none" stroke="${INK}" stroke-width="2"/></svg>`;

// the jar layout: the jar itself is choice 0 (keep it shut), the temptation sits to its right
function jarAct(d, st, s) {
    if (!d || st.choices.length !== 2) return null;
    const ok = c => !c.need || c.need(s), cost = val(st.choices[1].cost, s);
    return {
      item: { icon: d.coin ? "🪙" : "✋", label: d.coin ? "Drag the coin" : "Drag your hand", x: 88, y: 100 },
      zones: [{ c: 0, x: 106, y: 18, w: 88, h: 114, top: true, label: d.keep, off: !ok(st.choices[0]) },
        { c: 1, x: 212, y: 52, w: 82, h: 80, icon: d.icon, label: ok(st.choices[1]) ? d.spend + (cost ? " " + cost : "") : "Not enough", off: !ok(st.choices[1]) }],
      hint: d.coin ? `Drag the coin into the jar, or to the ${d.icon}.` : `Drag your hand: hold the lid shut, or reach for the ${d.icon}.`,
    };
}
const HALF_NIGHTS = { 1: { coin: true, keep: "Into the jar", icon: "🍩", spend: "Donut too" }, 2: { keep: "Keep going", icon: "🥪", spend: "Quit, lunch" }, 3: { keep: "Let it go", icon: "🍩", spend: "Donut" } };

// every other town: drag the town's item onto one of the choices, laid out as stickers across the drawing.
// days maps a step number to one [icon, short label] per choice; costs and "not enough" are added automatically
function rowAct(st, s, A) {
  const p = A.days[S.step], n = st.choices.length;
  if (!p || p.length !== n) return null;
  const b = { x0: 120, x1: 296, y: 30, h: 98, ...A.box }, gap = 6, w = (b.x1 - b.x0 - gap * (n - 1)) / n;
  return {
    item: A.item,
    zones: st.choices.map((c, i) => {
      const ok = !c.need || c.need(s), cost = val(c.cost, s);
      return { c: i, x: b.x0 + i * (w + gap), y: b.y, w, h: b.h, icon: p[i][0], off: !ok,
        label: ok ? p[i][1] + (cost && String(cost).length <= 9 ? " " + cost : "") : "Not enough" };
    }),
    hint: A.hint,
  };
}
const HAND = (x, y) => ({ icon: "✋", label: "Drag your hand", x, y });
const COIN = (x, y) => ({ icon: "🪙", label: "Drag the coin", x, y });
const WORDS = (x, y) => ({ icon: "💬", label: "Drag your words", x, y });
const ROWS = {
  L2: { item: WORDS(90, 100), box: { x0: 118, y: 58, h: 70 }, hint: "Drag your words to what you'll say. It comes true.",
    days: { 0: [["🌸", "Really kind"], ["🌩️", "Grumpy troll"], ["🤐", "Say nothing"]], 1: [["🌸", "She'll score"], ["🌩️", "Worst player"]], 2: [["🌸", "Really funny"], ["🌩️", "Kind of weird"]],
      4: [["🌸", "I studied"], ["🌩️", "I'll fail"], ["💪", "I can do it"]], 5: [["🌸", "Mom finds a way"], ["🌩️", "Loses everything"]], 6: [["🌸", "Bravest kid"], ["🌩️", "Total baby"], ["🤝", "Hold his hand"]], 7: [["🌸", "Strong fish"], ["🌩️", "Boring fish"]] } },
  M3: { item: HAND(112, 70), box: { x0: 150, y: 34, h: 92 }, hint: "Reach for it, or keep your hands (and your sleep).",
    days: { 0: [["🌀", "Buy it"], ["🔄", "Put it back"]], 1: [["👟", "Buy shoes"], ["👛", "Keep coins"]], 2: [["🍭", "Candy cane"], ["🚰", "Fountain"]], 4: [["🕹️", "Claw"], ["👀", "Just watch"]],
      5: [["📘", "School book"], ["🚶", "Skip it"]], 6: [["🪀", "Yo-yo #4"], ["✋", "Have three"]], 7: [["🔑", "Keychains"], ["🚪", "Walk out"]] } },
  L3: { item: HAND(100, 100), box: { x0: 126 }, hint: "Drag your hand to what you'll do. Screens drain you.",
    days: { 0: [["📱", "Scroll in bed"], ["🍳", "Breakfast"]], 1: [["🏃", "Play tag"], ["🎮", "New level"]], 2: [["📞", "Answer"], ["📺", "Keep watching"]], 4: [["🚪", "Other room"], ["📱", "Quick check"]],
      5: [["🐕", "Play fetch"], ["📱", "Toss once"]], 6: [["🔕", "Mute it"], ["💬", "Read them all"]], 7: [["😴", "Nap"], ["📖", "Comic"], ["📺", "One more"]] } },
  M4: { item: COIN(90, 94), box: { x0: 126 }, hint: "Drag the coin. Future you is watching.",
    days: { 0: [["🐷", "Save 20 first"], ["👟", "New shoes"]], 1: [["☕", "Home coffee"], ["✨", "Fancy coffee"]], 2: [["🤝", "Split a small"], ["🍕", "Giant one"]], 4: [["🐷", "Save 15"], ["🎮", "All on games"]],
      5: [["📱", "Skip it"], ["🏷️", "Buy on sale"]], 6: [["🧺", "Picnic"], ["🛍️", "Mall"]], 7: [["🐷", "Keep saving"], ["⏳", "Wait"]] } },
  L5: { item: HAND(90, 100), box: { x0: 120, y: 24, h: 82 }, hint: "Keep it, or toss it. Whatever you toss comes back.",
    days: { 0: [["🥪", "Wrap it up"], ["🗑️", "Trash it"]], 1: [["🧒", "Give it away"], ["🗑️", "Throw it out"]], 2: [["🚰", "Refill it"], ["🗑️", "Toss, buy new"]], 4: [["✏️", "Draw on back"], ["🗑️", "Crumple it"]],
      5: [["🧒", "Give to cousin"], ["🗑️", "Bin them"]], 6: [["🍱", "Lunch tomorrow"], ["🗑️", "Toss it"]], 7: [["🔧", "Fix & share"], ["🗑️", "Throw it all"]] } },
  M5: { item: COIN(226, 60), box: { x0: 6, x1: 196, y: 18, h: 120 }, hint: "Drag the coin. Every loan comes home as a dog.",
    days: { 0: [["🎟️", "Save up"], ["🐕", "Borrow 50"]], 1: [["📺", "Old TV is fine"], ["🐕", "Borrow for TV"]], 2: [["🚲", "Keep the bike"], ["🐕", "Borrow for car"]], 4: [["📱", "Keep my phone"], ["🐕", "Borrow for it"]],
      5: [["🍕", "Pizza at home"], ["🐕", "Borrow"]], 6: [["🐷", "Pay from jar"], ["🐕", "Borrow 15"]] } },
  "L-fallback": { item: HAND(36, 96), box: { x0: 76, x1: 296, y: 14, h: 104 }, hint: "Drag your hand: use your saved hours, or keep them.",
    days: { 2: [["🫙", "Show a jar"], ["🤐", "Keep it vague"]], 4: [["⏰", "Wake Theo"], ["😴", "Let him sleep"]], 5: [["🫙", "Open ALL"], ["1️⃣", "Just the oldest"]], 6: [["🥞", "Fort & pancakes"], ["🧹", "Tidy pantry"]] } },
  M8: { item: COIN(100, 100), box: { x0: 128, y: 44, h: 84 }, hint: "Drag the coin. Your wallet is listening.",
    days: { 3: [["🎁", "Save for Mom"], ["🥿", "Light-up slippers"]], 4: [["🎁", "Buy her present"], ["💌", "Make a card"]] } },
  "M-jobs": { item: COIN(90, 100), hint: "Drag the coin. Coins with a job stay.",
    days: { 1: [["🏷️", "Tag: HEATER"], ["👖", "Pocket them"]], 2: [["🏷️", "Tag: FOOD"], ["👋", "Let them go"]], 3: [["🔧", "Pay the repair"], ["👧", "Ask sister"]] } },
  "M-hours": { item: HAND(90, 100), hint: "Drag your hand. Every price is hours of your life.",
    days: { 1: [["🏷️", "Tap the tag"], ["🧥", "Leave it"]], 2: [["🏷️", "Tap the tag"], ["❓", "Which hours?"]], 3: [["🏠", "Dad's house"], ["🪑", "Stay home"]] } },
  "M-birds": { item: HAND(100, 100), box: { x0: 128, y: 40, h: 88 }, hint: "Drag your hand. Every bird eats every month.",
    days: { 1: [["🐦", "Sign up for all"], ["✅", "Keep just one"]], 2: [["✉️", "Open and look"], ["🎵", "Music up"]], 3: [["📢", "Read the bills"], ["🚪", "Hide"]] } },
  "M-monster": { item: HAND(90, 100), hint: "Drag your hand. Bills you dodge grow teeth.",
    days: { 1: [["💳", "Pay it now"], ["📅", "Tomorrow"]], 2: [["📬", "Check mail"], ["🙈", "Leave it"]], 3: [["📞", "Call and ask"], ["🏚️", "Hide in attic"]] } },
  "M-shadow": { item: HAND(94, 88), box: { x0: 124, y: 32, h: 74 }, hint: "Drag your hand. Every pay-later weighs on your shadow.",
    days: { 1: [["📲", "Pay later"], ["🐷", "Save up"]], 2: [["📲", "Keep tapping"], ["🧮", "Add it up"]], 3: [["💡", "Every light on"], ["💸", "Pay them off"]] } },
  "L-whisper": { item: WORDS(94, 86), box: { x0: 122, y: 14, h: 88 }, hint: "Drag your words. Loud ones crack the glass.",
    days: { 2: [["🤫", "Wait quietly"], ["📢", "Yell louder"], ["🙏", "Whisper please"]], 5: [["🤭", "Into sleeve"], ["😂", "Laugh out loud"], ["😊", "Save it"]] } },
  "L-hum": { item: WORDS(92, 100), box: { x0: 116 }, hint: "Drag your voice to what you'll do.",
    days: { 2: [["🙋", "“Me!”"], ["🎵", "Hum along"], ["🎹", "Hide"]], 6: [["🎵", "Hum for her"], ["👏", "Clap"], ["🙈", "Cover eyes"]] } },
  "M-rhyme": { item: COIN(100, 86), box: { x0: 134 }, hint: "Drag the coin to your choice.",
    days: { 2: [["🤝", "Lend her"], ["🎈", "Maybe soon!"], ["✋", "Say no"]], 7: [["🚌", "Ride the bus"], ["🚶", "Walk home"]] } },
  "L-echo": { item: HAND(100, 100), box: { x0: 126 }, hint: "Drag your hand. Promises cost Saturday hours.",
    days: { 4: [["🤝", "Keep my word"], ["🤒", "Pretend sick"]], 5: [["🤝", "Keep my word"], ["🙈", "Ignore it"]], 6: [["🤝", "Keep my word"], ["📵", "Let it ring"]], 7: [["🎡", "Go to the fair"], ["🛋️", "Stay home"]] } },
};

const ACTS = {
  M1: (st, s) => jarAct(JAR_DAYS[st.when], st, s),
  "M-chain": (st, s) => jarAct(HALF_NIGHTS[S.step], st, s),
  M2(st) {
    const d = TREE_DAYS[st.when], w = st.choices.findIndex(c => c.water === 1); if (!d || w < 0) return null;
    return {
      item: { icon: CAN, label: "Drag the watering can", x: 96, y: 98 },
      zones: [{ c: w, x: 144, y: 14, w: 94, h: 116, top: true, label: "Water it" }, { c: 1 - w, x: 242, y: 56, w: 54, h: 74, icon: d[0], label: d[1] }],
      hint: `Tip the can over the tree, or drag it to the ${d[0]}.`,
    };
  },
};
function actOf(st, s) {
  if (!st || S.phase !== "step" || st.rehook || st.drag || st.play || st.pay || !st.choices) return null;
  const id = TOWNS[S.t].id, f = ACTS[id];
  return f ? f(st, s) : ROWS[id] ? rowAct(st, s, ROWS[id]) : null;
}

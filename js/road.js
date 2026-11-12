/* Rule Road map logic: districts and their star gates, the Daily Anomaly Mile and its streak,
   challenge links (?town=ID&c=Name&s=stars&g=ghost) and saved player preferences. */

const DISTRICTS = [
  { name: "Main Street", need: 0, ids: ["M1", "L1", "L-whisper", "M2", "L2"] },
  { name: "The Coin Belt", need: 6, ids: ["M3", "L-hum", "L3", "L4", "M4"] },
  { name: "Echo Hills", need: 15, ids: ["M-rhyme", "L5", "M5", "L-echo", "L-fallback"] },
  { name: "Shadow Valley", need: 25, ids: ["M8", "M-jobs", "M-chain", "M-hours", "M-shrink"] },
  { name: "The Night Highway", need: 35, ids: ["M-birds", "M-monster", "M-shadow"] },
];

const store = {
  get(k, d) { try { const v = localStorage.getItem("rule-road-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rule-road-" + k, JSON.stringify(v)); } catch {} },
};

// the order towns appear on the road (TOWNS indexes); any town not placed in a district goes on the last one
let _road = null;
function road() {
  if (_road) return _road;
  const placed = DISTRICTS.flatMap(d => d.ids).map(id => TOWNS.findIndex(t => t.id === id)).filter(i => i >= 0);
  TOWNS.forEach((t, i) => { if (!placed.includes(i)) { placed.push(i); DISTRICTS[DISTRICTS.length - 1].ids.push(t.id); } });
  return (_road = placed);
}
const roadPos = t => road().indexOf(t);
const freq = i => (88.1 + 0.8 * i).toFixed(1); // each town has its own radio frequency, shown on its sign
const nextOnRoad = t => road()[roadPos(t) + 1];
const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0);
const districtOf = t => DISTRICTS.findIndex(d => d.ids.includes(TOWNS[t].id));
// a district opens with enough stars, or once you've already played any town in it
const districtOpen = di => totalStars() >= DISTRICTS[di].need || DISTRICTS[di].ids.some(id => S.stars[id]);

/* Daily Anomaly Mile: one town per calendar day, the same for everyone */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dailyTown() {
  const k = dayKey(); let h = 7;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return road()[h % road().length];
}
function streak() {
  const d = store.get("daily", { last: "", n: 0 });
  const y = new Date(); y.setDate(y.getDate() - 1);
  return d.last === dayKey() || d.last === dayKey(y) ? d.n : 0;
}
const dailyDone = () => store.get("daily", { last: "" }).last === dayKey();
function markDaily() {
  const d = store.get("daily", { last: "", n: 0 });
  if (d.last === dayKey()) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  store.set("daily", { last: dayKey(), n: d.last === dayKey(y) ? d.n + 1 : 1 });
  return true;
}

/* challenge links: someone shared a result; play their town and try to beat it */
function readChallenge() {
  const p = new URLSearchParams(location.search);
  const id = p.get("town"); if (!id) return null;
  const t = TOWNS.findIndex(x => x.id === id); if (t < 0) return null;
  const c = (p.get("c") || "").replace(/[^\p{L}\p{N} '._-]/gu, "").slice(0, 20);
  const s = Math.max(0, Math.min(3, parseInt(p.get("s") || "0", 10) || 0));
  const g = /^[0-9]{5,40}$/.test(p.get("g") || "") ? p.get("g") : "";
  try { history.replaceState(null, "", location.pathname); } catch {}
  return { t, id, c, s, g };
}

const Prefs = {
  coop: store.get("coop", false),
  party: store.get("party", false),
  name: store.get("name", ""),
  save() { store.set("coop", this.coop); store.set("party", this.party); store.set("name", this.name); },
};

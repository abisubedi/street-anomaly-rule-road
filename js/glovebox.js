/* The glovebox: road-trip items that unlock as your stars add up. Equip any two; each one bends one town's rule a little.
   Items unlock at star milestones (nothing is spent), so districts never lock again. */
const ITEMS = [
  { id: "big-jar", icon: "🫙", name: "Big Jar", need: 6, towns: ["L-fallback"], what: "A wider jar in Tockfield. Falling hours are easier to catch." },
  { id: "muffler", icon: "🔇", name: "Muffler", need: 10, towns: ["L-whisper"], what: "Whisperton's glass takes a bit more noise, and one extra crack." },
  { id: "fork", icon: "🎼", name: "Tuning Fork", need: 14, towns: ["L-hum"], what: "Harmonia's doors open even if your note is a little off." },
  { id: "piggy", icon: "🐷", name: "Piggy Charm", need: 20, towns: ["M1", "M-chain"], what: "Your jar starts with one extra coin in Doubleton and Halfnight." },
  { id: "rhyme-book", icon: "📕", name: "Rhyme Book", need: 26, towns: ["M-rhyme"], what: "Shows words that rhyme in Rhymeburg's market." },
  { id: "biscuit", icon: "🦴", name: "Dog Biscuit", need: 32, towns: ["M5"], what: "Your first loan's dog in Leashville stays a puppy." },
  { id: "shades", icon: "🕶️", name: "Sunglasses", need: 40, towns: ["M-shadow"], what: "Laterton's heavy shadow is half as hard to drag." },
];
const RHYMES = { hat: "that, cat, flat, mat", cake: "sake, bake, make, take", boat: "coat, goat, note, float", kite: "right, bright, night, light", cone: "own, phone, bone, alone" };

const Glove = {
  on: store.get("glove", []),
  open: it => totalStars() >= it.need,
  has(id) { const it = ITEMS.find(x => x.id === id); return !!it && this.on.indexOf(id) >= 0 && this.open(it); },
  // equip, or unequip; with two already on, the oldest comes off
  toggle(id) {
    const i = this.on.indexOf(id);
    if (i >= 0) this.on.splice(i, 1); else { this.on.push(id); if (this.on.length > 2) this.on.shift(); }
    store.set("glove", this.on);
  },
  forTown(T) { return ITEMS.filter(it => it.towns.indexOf(T.id) >= 0 && this.has(it.id)); },
};

function gloveboxPanel() {
  const total = totalStars();
  const next = ITEMS.find(it => total < it.need);
  return `<section class="glovebox" aria-label="Glovebox">
    <h2 class="dname"><span>🧤 Glovebox</span><span class="lock">${Glove.on.filter(id => Glove.has(id)).length}/2 equipped${next ? ` · next item at ${next.need} ★` : ""}</span></h2>
    <div class="items">${ITEMS.map(it => {
      const open = Glove.open(it), on = Glove.has(it.id);
      return `<button class="item ${on ? "on" : ""} ${open ? "" : "locked"}" data-act="equip" data-id="${it.id}" ${open ? "" : 'aria-disabled="true"'} aria-pressed="${on}">
        <span class="item-i">${open ? it.icon : "🔒"}</span><b>${esc(it.name)}</b>
        <span>${open ? esc(it.what) : `Unlocks at ${it.need} ★`}</span>${on ? '<em>Equipped</em>' : ""}
      </button>`;
    }).join("")}</div>
  </section>`;
}

/* the first ride: one tap starts the engine (and unlocks sound), then Mile 1's first choice is on screen */
function renderIgnition() {
  return `<section class="ignition">
    <img class="hero-art" src="/img/hero-sign.jpg" width="1100" height="603" alt="Rule Road, on a lit overhead highway sign">
    <p class="ign-line">Every town has one strange rule.<br>Your first one is a mile away.</p>
    <button class="ignite" data-act="ignite"><span class="key" aria-hidden="true">🔑</span><b>Turn the key</b><span>Start driving</span></button>
    <button class="skipmap" data-act="home">Show me the map instead</button>
  </section>`;
}

function ignite() {
  Sound.init(); Sound.static(); setTimeout(() => Sound.static(), 160);
  Juice.buzz([30, 40, 60]);
  store.set("seen", true);
  const first = road()[0];
  startTown(first, { free: true }); // the host starts reading the sign
  S.phase = "step"; S.step = 0; S.firstRide = true; enterStep(); render();
  // bring the story and the first choice on screen, even on a 320×568 phone
  const story = document.querySelector(".scene .story"), dashTop = (document.querySelector(".dash") || { getBoundingClientRect: () => ({ top: innerHeight }) }).getBoundingClientRect().top;
  const c = document.querySelector('[data-act="pick"]');
  if (story && c) window.scrollTo(0, Math.max(0, Math.min(story.getBoundingClientRect().top + pageYOffset - 12, c.getBoundingClientRect().bottom + pageYOffset - dashTop + 12)));
  else window.scrollTo(0, 0);
}

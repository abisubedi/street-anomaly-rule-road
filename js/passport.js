/* The Anomaly Passport: every town you finish stamps your passport.
   3★ a gold wax seal (CLEARED), 2★ a brass stamp (ENTERED), 1★ a red CITATION: you broke the town's law.
   A better run replaces the stamp. Stamps are simply your best stars per town (S.stars), so nothing new is saved
   and everyone's progress so far already shows up as stamps. */
const Passport = {
  grade: n => n >= 3 ? "seal" : n === 2 ? "entered" : n === 1 ? "citation" : "",
  label: n => n >= 3 ? "Cleared" : n === 2 ? "Entered" : "Citation",

  // an ink stamp for one town; "slam" makes it hit the page
  stamp(T, n, cls = "") {
    const g = this.grade(n); if (!g) return "";
    return `<span class="pstamp g-${g} ${cls}" role="img" aria-label="${esc(T.name)}: ${this.label(n)}, ${n} of 3 stars">
      <span class="ps-ring"><span class="ps-town">${esc(T.name)}</span><span class="ps-word">${this.label(n)}</span><span class="ps-stars">${"★".repeat(n)}${"☆".repeat(3 - n)}</span></span></span>`;
  },

  counts() {
    const v = TOWNS.map(T => S.stars[T.id] || 0);
    return { seals: v.filter(n => n >= 3).length, entered: v.filter(n => n === 2).length, citations: v.filter(n => n === 1).length, empty: v.filter(n => !n).length };
  },

  // the passport page on the home screen: one slot per town, in road order
  panel() {
    const c = this.counts(), stamped = TOWNS.length - c.empty;
    let locked = 0;
    const slots = road().map(i => {
      const T = TOWNS[i], n = S.stars[T.id] || 0, open = districtOpen(districtOf(i));
      if (n) return `<button class="pslot" data-act="town" data-i="${i}" aria-label="${esc(T.name)}, ${this.label(n)}. Play again">${this.stamp(T, n)}</button>`;
      if (!open) { locked += 1; return ""; } // locked towns don't take a page each; they're counted below
      return `<button class="pslot empty" data-act="town" data-i="${i}" aria-label="${esc(T.name)}, no stamp yet"><span>${esc(T.name)}</span></button>`;
    }).join("") + (locked ? `<span class="pslot empty locked" aria-label="${locked} locked towns"><span>+${locked}<br>locked</span></span>` : "");
    return `<section class="passport" aria-label="Your passport">
      <h2 class="dname"><span>🛂 Your passport</span><span class="lock">${stamped}/${TOWNS.length} stamped</span></h2>
      <p class="ps-tally">${c.seals ? `<b class="t-seal">${c.seals} cleared</b>` : ""}${c.entered ? `<b class="t-entered">${c.entered} entered</b>` : ""}${c.citations ? `<b class="t-cite">${c.citations} citation${c.citations > 1 ? "s" : ""}</b>` : ""}${!stamped ? "Every town stamps your passport. Break its law and you get a citation instead." : ""}</p>
      ${c.citations ? `<p class="ps-note">Replay a town to swap a citation for a stamp.</p>` : ""}
      <div class="ps-grid">${slots}</div>
    </section>`;
  },

  // a stamp just landed: a thud you can feel
  thud(n) {
    Sound.tone(n === 1 ? 90 : 120, 0.18, "square", 0.08); Sound.tone(60, 0.25, "sine", 0.12, 0.02);
    Juice.buzz(n === 1 ? [80] : [30, 20, 60]); Juice.shake();
  },
};

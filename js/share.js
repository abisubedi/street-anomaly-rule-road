/* Share card: a 1080×1440 poster of the town sign, your stars, your choices as a color strip and a challenge link. */
function challengeUrl(T, stars) {
  const u = new URL(location.origin + "/");
  u.searchParams.set("town", T.id);
  if (Prefs.name) u.searchParams.set("c", Prefs.name);
  u.searchParams.set("s", stars);
  return u.toString();
}

function wrap(g, text, maxW) {
  const words = text.split(" "), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

async function drawCard(T, stars) {
  try { await Promise.all(["400 80px Bungee", "700 40px Fredoka", "400 40px 'Atkinson Hyperlegible Next'", "italic 400 40px 'Atkinson Hyperlegible Next'"].map(f => document.fonts.load(f))); } catch {}
  const W = 1080, H = 1440, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const SIGN = "Fredoka, 'Trebuchet MS', sans-serif", DISP = "Bungee, 'Arial Black', sans-serif", BODY = "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', Verdana, sans-serif";
  // night street
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#14213D"); bg.addColorStop(1, "#0B1428");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, 700); glow.addColorStop(0, "rgba(255,210,63,.18)"); glow.addColorStop(1, "rgba(255,210,63,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.025)"; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2); // scanlines
  g.textAlign = "center";
  g.fillStyle = "#9AA7C4"; g.font = `700 34px ${SIGN}`;
  g.fillText(`RULE ROAD  ·  MILE ${roadPos(S.t) + 1}  ·  ${freq(roadPos(S.t))} FM`, W / 2, 110);
  // the sign
  g.font = `700 64px ${SIGN}`;
  const lines = wrap(g, ("In this town, " + T.rule).toUpperCase(), 820).slice(0, 6);
  const sh = 120 + lines.length * 72, sx = 80, sy = 160;
  g.fillStyle = "#FFD23F"; roundRect(g, sx, sy, W - 160, sh, 28); g.fill();
  g.strokeStyle = "#14130C"; g.lineWidth = 8; roundRect(g, sx + 18, sy + 18, W - 196, sh - 36, 18); g.stroke();
  g.fillStyle = "#14130C"; g.textAlign = "left"; g.font = `400 30px ${DISP}`;
  g.fillText(T.name.toUpperCase(), sx + 56, sy + 78);
  g.font = `700 64px ${SIGN}`;
  lines.forEach((l, i) => g.fillText(l, sx + 52, sy + 152 + i * 72));
  g.fillStyle = "#8C97B0"; g.fillRect(W / 2 - 11, sy + sh, 22, 60);
  // stars
  let y = sy + sh + 160;
  g.textAlign = "center"; g.font = `900 120px ${SIGN}`;
  [0, 1, 2].forEach(i => { g.fillStyle = i < stars ? "#FFD23F" : "#2D3D63"; g.fillText("★", W / 2 + (i - 1) * 140, y); });
  // the passport verdict, like an ink stamp under the stars
  y += 78; g.font = `400 46px ${DISP}`; g.fillStyle = { seal: "#E9B949", entered: "#8FB4F0", citation: "#FF5A6A" }[Passport.grade(stars)] || "#FFD23F";
  g.fillText(`PASSPORT: ${Passport.label(stars).toUpperCase()} · ${T.name.toUpperCase()}`, W / 2, y);
  // your choices as a strip: green helped, yellow neutral, red hurt
  y += 50;
  const n = S.grid.length, sz = Math.min(70, (W - 200) / Math.max(1, n) - 12), gx = W / 2 - (n * (sz + 12) - 12) / 2;
  S.grid.forEach((k, i) => { g.fillStyle = { g: "#7BD389", y: "#FFD23F", r: "#E63946" }[k]; roundRect(g, gx + i * (sz + 12), y, sz, sz, 12); g.fill(); });
  y += sz + 70;
  // the numbers
  g.font = `700 40px ${BODY}`; g.fillStyle = "#EEF1F8";
  T.meters.forEach(m => { g.fillText(`${m.label}: ${S.s[m.k]}${m.unit || ""}`, W / 2, y); y += 56; });
  // the dare
  g.fillStyle = "#E63946"; g.font = `400 46px ${DISP}`;
  g.fillText(S.challenge && stars > S.challenge.s ? `I BEAT ${(S.challenge.c || "MY FRIEND").toUpperCase()}. YOUR TURN.` : "CAN YOU BEAT ME?", W / 2, H - 150);
  g.fillStyle = "#9AA7C4"; g.font = `700 36px ${SIGN}`;
  g.fillText("streetanomaly.pages.dev", W / 2, H - 90);
  return new Promise(r => c.toBlob(r, "image/png"));
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

async function shareResult(T, stars) {
  const toast = document.getElementById("share-toast");
  const url = challengeUrl(T, stars);
  const text = `I got ${"★".repeat(stars)}${"☆".repeat(3 - stars)} in ${T.name} on Rule Road. Can you beat me?`;
  const blob = await drawCard(T, stars);
  const file = new File([blob], `RuleRoad-${T.name.replace(/\s+/g, "")}.png`, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}` }); if (toast) toast.textContent = "Shared."; return; }
    if (navigator.share) { await navigator.share({ text, url }); if (toast) toast.textContent = "Shared."; return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  await saveFile(blob, file.name, text);
  try { await navigator.clipboard.writeText(`${text} ${url}`); if (toast) toast.textContent = "Card saved, and the challenge link is copied."; }
  catch { if (toast) toast.textContent = "Card saved. Challenge link: " + url; }
}

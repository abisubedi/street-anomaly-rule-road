/* Rule Road compatibility layer: keeps the game running on every iPhone and iPad since 2013 (iOS 12+)
   and on Android 4.4+ browsers. Load it first. Scripts stay at ES2019 syntax: no ?. or ?? anywhere. */

// a promise that may not exist on old engines (old webkitAudioContext.close(), media.play() before iOS 10)
function quiet(p) { if (p && typeof p.catch === "function") p.catch(function () {}); return p; }

// connect audio nodes in a row; old Safari's connect() returns undefined, so chaining .connect().connect() throws
function chain() {
  for (var i = 0; i + 1 < arguments.length; i++) arguments[i].connect(arguments[i + 1]);
  return arguments[arguments.length - 1];
}

// Blob.arrayBuffer() arrived in iOS 14 / Chrome 76
function blobBuffer(b) {
  if (b.arrayBuffer) return b.arrayBuffer();
  return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsArrayBuffer(b); });
}

// flexbox gap arrived in iOS 14.1 / Chrome 84; without it the CSS adds margins instead
(function () {
  var f = document.createElement("div");
  f.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
  f.appendChild(document.createElement("div")); f.appendChild(document.createElement("div"));
  document.documentElement.appendChild(f);
  var ok = f.scrollHeight === 1;
  f.parentNode.removeChild(f);
  if (!ok) document.documentElement.className += " no-flexgap";
})();

// iPhone ring/silent switch: it mutes Web Audio (crackle, pings, buzzers) unless the page plays as media.
// iOS 17+ lets us ask for the "playback" session; older iOS gets the same result from a silent looping <audio>.
var iosAudio = { el: null,
  unlock: function () {
    if (navigator.audioSession) { try { navigator.audioSession.type = "playback"; return; } catch (e) {} }
    if (this.el || !/iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return;
    var n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    this.el = new Audio(URL.createObjectURL(new Blob([b], { type: "audio/wav" })));
    this.el.loop = true; this.el.setAttribute("playsinline", ""); quiet(this.el.play());
    var el = this.el;
    document.addEventListener("visibilitychange", function () { if (document.hidden) el.pause(); else quiet(el.play()); });
  } };

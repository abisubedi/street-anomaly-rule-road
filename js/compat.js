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

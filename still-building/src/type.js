/* =============================================================================
 *  STILL BUILDING — type. Everything on the overlay layer goes through here so
 *  the film speaks with one voice: Cinzel capitals for year stamps and
 *  statements, small tracked Inter for places.
 * ========================================================================== */
'use strict';
const TYPE = (() => {
  const INK = [0.97, 0.94, 0.86];
  function setup(g, font, track, align) {
    g.font = font; g.letterSpacing = `${track}px`; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 26; g.shadowOffsetY = 2;
  }
  function draw(g, text, x, y, a, col = INK) {
    if (a <= 0.003) return;
    g.fillStyle = css(col, a);
    g.fillText(text, x, y);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillText(text, x, y);
  }
  /** Year stamp, lower left: big numerals, hairline, place line. */
  function year(S, big, sub, t0, t1) {
    const g = S.tx, a = env(S.t, t0, t1, 0.5, 0.5) * S.ta;
    if (a <= 0.003) return;
    const k = seg(S.t, t0, t0 + 1.4, E.out), x = 132, y = 930;
    g.save();
    setup(g, '600 138px Cinzel', 10 + 10 * k, 'left');
    draw(g, big, x - 6, y, a);
    const w = g.measureText(big).width;
    g.fillStyle = css([0.85, 0.68, 0.36], a * 0.95);
    g.fillRect(x, y + 24, Math.max(120, w - 14) * k, 2.5);
    if (sub) {
      setup(g, '500 25px Inter', 9, 'left');
      draw(g, sub, x + 2, y + 66, a * 0.92, [0.9, 0.87, 0.8]);
    }
    g.restore();
  }
  /** A declarative line, centred. */
  function say(S, text, t0, t1, { y = 600, size = 58, track = 16, font = '500', fi = 0.7, fo = 0.7 } = {}) {
    const g = S.tx, a = env(S.t, t0, t1, fi, fo) * S.ta;
    if (a <= 0.003) return;
    const k = seg(S.t, t0, t1, E.lin);
    g.save();
    setup(g, `${font} ${size}px Cinzel`, track + 6 * k, 'center');
    draw(g, text, W / 2 + (track + 6 * k) / 2, y, a);
    g.restore();
  }
  /** Serif italic line (quotations). */
  function quote(S, text, t0, t1, { y = 900, size = 62, fi = 0.8, fo = 0.8, x = W / 2 } = {}) {
    const g = S.tx, a = env(S.t, t0, t1, fi, fo) * S.ta;
    if (a <= 0.003) return;
    g.save();
    setup(g, `italic 500 ${size}px "Cormorant Garamond"`, 1.5, 'center');
    draw(g, text, x, y, a);
    g.restore();
  }
  return { year, say, quote, setup, draw, INK };
})();

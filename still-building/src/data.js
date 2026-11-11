/* City positions [lon, lat, weight] for the night-lights maps, and the map projections. */
'use strict';
const CITIES = [
  [-74.0, 40.7, 1], [-118.2, 34.05, 1], [-87.6, 41.9, 0.9], [-95.4, 29.8, 0.8], [-112.1, 33.4, 0.6], [-75.2, 39.95, 0.7], [-98.5, 29.4, 0.5],
  [-117.2, 32.7, 0.6], [-96.8, 32.8, 0.8], [-122.4, 37.8, 0.8], [-121.9, 37.3, 0.6], [-97.7, 30.3, 0.5], [-81.7, 30.3, 0.4], [-83.0, 40.0, 0.5],
  [-80.8, 35.2, 0.5], [-86.2, 39.8, 0.5], [-122.3, 47.6, 0.7], [-105.0, 39.7, 0.6], [-77.0, 38.9, 0.8], [-71.1, 42.4, 0.7], [-86.8, 36.2, 0.5],
  [-83.05, 42.3, 0.6], [-122.7, 45.5, 0.5], [-90.0, 35.1, 0.4], [-115.1, 36.2, 0.5], [-76.6, 39.3, 0.5], [-87.9, 43.0, 0.4], [-106.6, 35.1, 0.3],
  [-94.6, 39.1, 0.5], [-84.4, 33.75, 0.8], [-80.2, 25.8, 0.7], [-93.3, 45.0, 0.6], [-90.1, 30.0, 0.4], [-81.7, 41.5, 0.5], [-82.5, 28.0, 0.5],
  [-90.2, 38.6, 0.5], [-80.0, 40.4, 0.5], [-84.5, 39.1, 0.4], [-81.4, 28.5, 0.5], [-111.9, 40.8, 0.4], [-97.5, 35.5, 0.4], [-78.6, 35.8, 0.4],
  [-96.0, 41.3, 0.3], [-106.5, 31.8, 0.3], [-116.2, 43.6, 0.2], [-78.9, 42.9, 0.3], [-85.8, 38.3, 0.4], [-77.4, 37.5, 0.3], [-121.5, 38.6, 0.4],
  [-110.9, 32.2, 0.3], [-86.8, 33.5, 0.3], [-108.5, 45.8, 0.12], [-96.8, 46.9, 0.12], [-96.7, 43.5, 0.12], [-93.6, 41.6, 0.25], [-92.3, 34.7, 0.2],
  [-90.2, 32.3, 0.15], [-117.4, 47.7, 0.2], [-95.9, 36.15, 0.25], [-97.3, 37.7, 0.2], [-79.9, 32.8, 0.25], [-76.3, 36.9, 0.3], [-72.7, 41.8, 0.3],
  [-73.8, 42.65, 0.2], [-79.4, 43.7, 0.6], [-73.6, 45.5, 0.5], [-123.1, 49.3, 0.4], [-99.1, 19.4, 0.8], [-100.3, 25.7, 0.4], [-103.3, 20.7, 0.4], [-82.4, 23.1, 0.3],
];
const MAPS = (() => {
  const main = GEO.usa.reduce((a, b) => (a.length > b.length ? a : b));
  function inUSA(lon, lat) {
    let c = false;
    for (let i = 0, j = main.length - 1; i < main.length; j = i++) {
      const [xi, yi] = main[i], [xj, yj] = main[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // scattered towns: dense east of the 100th meridian, sparse to the west, clustered near cities
  const towns = [];
  const r = rng(2026);
  while (towns.length < 2600) {
    let lon, lat;
    if (r() < 0.55) { const c = CITIES[Math.floor(r() * 64)], d = Math.pow(r(), 1.4) * 2.6, a = r() * TAU; lon = c[0] + Math.cos(a) * d * 1.25; lat = c[1] + Math.sin(a) * d; }
    else { lon = -124.5 + r() * 57.5; lat = 25 + r() * 24; if (lon < -100 && r() < 0.72) continue; }
    if (inUSA(lon, lat)) towns.push([lon, lat, 0.04 + 0.1 * r() * r()]);
  }
  // Albers equal-area conic for the lower 48
  const p1 = 29.5 * D2R, p2 = 45.5 * D2R, l0 = -96 * D2R, p0 = 37.5 * D2R;
  const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
  /** lon/lat → screen, centred on (cx, cy) with scale k (US ≈ 0.78·k wide). */
  function albers(lon, lat, cx, cy, k) {
    const rho = Math.sqrt(C - 2 * n * Math.sin(lat * D2R)) / n, th = n * (lon * D2R - l0);
    return [cx + rho * Math.sin(th) * k, cy - (rho0 - rho * Math.cos(th)) * k];
  }
  function usaPath(g, cx, cy, k, rings = GEO.usa, close = true) {
    g.beginPath();
    for (const ring of rings) { ring.forEach(([lo, la], i) => { const [x, y] = albers(lo, la, cx, cy, k); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); }
  }
  // equirectangular texture for the planet shader: land in red, city lights in green
  let globe = null;
  function globeTex() {
    if (globe) return globe;
    const c = document.createElement('canvas'); c.width = 4096; c.height = 2048;
    const g = c.getContext('2d'), X = lon => (lon + 180) / 360 * 4096, Y = lat => (90 - lat) / 180 * 2048;
    g.fillStyle = '#000'; g.fillRect(0, 0, 4096, 2048);
    g.fillStyle = '#f00';
    for (const ring of GEO.land) { g.beginPath(); ring.forEach(([lo, la], i) => (i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la)))); g.closePath(); g.fill(); }
    g.beginPath(); for (const ring of GEO.usa) { ring.forEach(([lo, la], i) => (i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la)))); g.closePath(); } g.fill();
    g.globalCompositeOperation = 'lighter';
    const dot = (lo, la, rad, a) => { const x = X(lo), y = Y(la), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,255,0,${a})`); gr.addColorStop(1, 'rgba(0,255,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
    for (const [lo, la, w] of CITIES) { dot(lo, la, 3 + 9 * w, 0.5); dot(lo, la, 1.4 + 3.4 * w, 1); }
    for (const [lo, la, w] of towns) dot(lo, la, 1.1 + w * 6, 0.55 + w * 3);
    return (globe = c);
  }
  return { albers, usaPath, inUSA, towns, globeTex };
})();

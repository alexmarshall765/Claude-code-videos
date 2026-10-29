// The film's map projection: Albers equal-area conic for the contiguous states
// (standard parallels 29.5° N and 45.5° N, centred on 96° W, 37.5° N). Pure functions,
// shared by tools/build_map.mjs and the renderer so baked outlines and live points agree.

const RAD = Math.PI / 180;
const PHI1 = 29.5 * RAD, PHI2 = 45.5 * RAD, PHI0 = 37.5 * RAD, LAM0 = -96 * RAD;
const N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const C = Math.cos(PHI1) ** 2 + 2 * N * Math.sin(PHI1);
const RHO0 = Math.sqrt(C - 2 * N * Math.sin(PHI0)) / N;

/** Longitude, latitude (degrees) → plane coordinates on the unit sphere, y pointing down. */
export function albers(lon, lat) {
  const rho = Math.sqrt(C - 2 * N * Math.sin(lat * RAD)) / N;
  const theta = N * (lon * RAD - LAM0);
  return [rho * Math.sin(theta), -(RHO0 - rho * Math.cos(theta))];
}

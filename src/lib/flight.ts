import type * as THREE from "three";
import { BODY_Y } from "./layout";

// The preloader's camera: one continuous move through the clock as it is put
// together. Keyframes give where the camera is, what it looks at, its roll and
// lens; the path through them is a cubic spline, and its timing follows one
// smooth curve of felt speed (speed over distance to the nearest part), so it
// never lurches. It starts already moving and comes to rest on the hero.
//
// Coordinates are the clock's own frame (its case underside on y = 0). The
// movement (plate, spring barrel, case) starts slid out beside the gear train
// (MOVEMENT_SLIDE, MOVEMENT_DROP): the camera starts inside the open case, its
// jewels waking, rises over the rim, runs just above the turning gears, and
// climbs out as the dial, hands and crystal drop in, swings round the front
// and pulls back into the hero.

export const KB_Y = 4.4; // the clock's pivot, in the world
export const WORLD_Y = KB_Y + BODY_Y;
export const MOVEMENT_SLIDE = -30;
export const MOVEMENT_DROP = 1.5;

// the hero shot (rig orbit: world target, az, el, dist, fov)
export const HERO = { target: [0, 5.6, 1.4], az: -0.06, el: 0.2, dist: 78, fov: 30 };
type V3 = [number, number, number];
const heroPos: V3 = [
  HERO.target[0] + HERO.dist * Math.cos(HERO.el) * Math.sin(HERO.az),
  HERO.target[1] + HERO.dist * Math.sin(HERO.el) - WORLD_Y,
  HERO.target[2] + HERO.dist * Math.cos(HERO.el) * Math.cos(HERO.az),
];
const heroAim: V3 = [HERO.target[0], HERO.target[1] - WORLD_Y, HERO.target[2]];

// [camera, aim, roll, fov] along the path. Each coordinate is interpolated
// without overshoot, so where keys hold a value (the lane's height) the
// camera holds it too, and it never bobs between them.
type Keyframe = [camera: V3, aim: V3, roll: number, fov: number];
const KEYFRAMES: Keyframe[] = [
  // inside the open case, over the slid-out plate with its jewels waking
  [[-33.0, 3.4, 5.5], [-25.0, 0.1, 0.5], -0.12, 44],
  [[-27.5, 3.0, 3.6], [-19.5, 0.6, 0.8], -0.17, 44],
  // rise over the rim, toward the gear train
  [[-21.0, 2.8, 1.5], [-13.0, 1.6, 0.5], -0.22, 43],
  // the lane: just above the turning gears, below where the dial will land
  [[-15.5, 2.9, 0.4], [-9.0, 1.9, 0.0], -0.24, 42],
  [[-10.0, 2.6, 0.6], [-4.0, 1.9, 0.3], -0.3, 42],
  // up and out over the bare gears, rolling, as the dial drops in
  [[-8.0, 5.0, 3.2], [-1.5, 2.2, 0.6], -0.55, 40],
  [[-8.5, 7.4, 7.0], [2.0, 2.4, 0.0], -0.95, 38],
  // back and out over the front-left, the clock a long rolled disc as the
  // crystal lands
  [[-12.0, 9.5, 16.0], [2.0, 2.2, 0.5], -0.85, 36],
  // and back into the hero, levelling out
  [[-9.5, 10.0, 31.0], [0.6, 1.8, 1.0], -0.32, 32],
  [heroPos, heroAim, 0, HERO.fov],
];

// How fast the flight feels, [seconds, relative felt speed]: steady through
// the inside, easing once it's out, then a long settle into the hero. Scaled
// so the path takes exactly FLIGHT_END.
export const FLIGHT_END = 3.9;
const FEEL: [number, number][] = [
  [0.0, 1.7],
  [0.9, 1.6],
  [1.25, 1.3],
  [1.6, 0.75],
  [2.2, 0.38],
  [2.9, 0.18],
  [3.5, 0.06],
  [FLIGHT_END, 0],
];

// the parts the camera flies past, for the felt speed: the clock, and the
// movement where it starts
const BOXES = [
  { x0: -13.4, x1: 13.4, y0: 0, y1: 4.8, z0: -13.4, z1: 13.4 },
  { x0: -13.4 + MOVEMENT_SLIDE, x1: 13.4 + MOVEMENT_SLIDE, y0: -1.5, y1: 2.3, z0: -13.4, z1: 13.4 },
];
const NEAREST = 0.7;

// monotone cubic (Fritsch–Carlson) through (xs, ys): no overshoot
function monotone(xs: number[], ys: number[]) {
  const n = xs.length - 1;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const s = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  const m = ys.map((_, i) => (i === 0 ? s[0] : i === n ? s[n - 1] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2));
  for (let i = 0; i < n; i++) {
    if (s[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const al = m[i] / s[i];
    const be = m[i + 1] / s[i];
    const r = al * al + be * be;
    if (r > 9) {
      const k = 3 / Math.sqrt(r);
      m[i] = k * al * s[i];
      m[i + 1] = k * be * s[i];
    }
  }
  return (x: number) => {
    x = Math.min(xs[n], Math.max(xs[0], x));
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) i++;
    const u = (x - xs[i]) / h[i];
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h[i] * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h[i] * m[i + 1];
  };
}

// the path is parametrised by distance travelled (chord length between keys)
const along = [0];
for (let i = 1; i < KEYFRAMES.length; i++) {
  const [p, q] = [KEYFRAMES[i - 1][0], KEYFRAMES[i][0]];
  along.push(along[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
}
const LENGTH = along[along.length - 1];
const channel = (pick: (k: Keyframe) => number) => monotone(along, KEYFRAMES.map(pick));
const pos = [0, 1, 2].map((j) => channel((k) => k[0][j]));
const aim = [0, 1, 2].map((j) => channel((k) => k[1][j]));
const roll = channel((k) => k[2]);
const fov = channel((k) => k[3]);

// Felt length along the path: ∫ ds / D, D = the camera's distance to the
// nearest part. The FEEL curve is integrated over time and scaled to the
// path's felt length, so the felt speed follows that one smooth curve.
const N = 4000;
const feltAt = new Float64Array(N + 1);
// (a soft floor, so the camera eases into tight spots rather than braking)
const clearance = (q: number[]) =>
  Math.hypot(
    NEAREST,
    Math.min(
      ...BOXES.map((b) =>
        Math.hypot(Math.max(b.x0 - q[0], q[0] - b.x1, 0), Math.max(b.y0 - q[1], q[1] - b.y1, 0), Math.max(b.z0 - q[2], q[2] - b.z1, 0)),
      ),
    ),
  );
{
  // clearance along the path, blurred over a few centimetres either way so
  // the camera starts easing off before it reaches a tight spot
  const pts = Array.from({ length: N + 1 }, (_, i) => pos.map((f) => f((i / N) * LENGTH)));
  let D = pts.map(clearance);
  const R = Math.round((2.5 / LENGTH) * N);
  for (let pass = 0; pass < 3; pass++) {
    const sum = [0];
    for (const v of D) sum.push(sum[sum.length - 1] + v);
    D = D.map((_, i) => {
      const lo = Math.max(0, i - R);
      const hi = Math.min(N, i + R);
      return (sum[hi + 1] - sum[lo]) / (hi - lo + 1);
    });
  }
  for (let i = 1; i <= N; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    feltAt[i] = feltAt[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / D[i];
  }
}
const distanceOfFelt = (f: number) => {
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (feltAt[mid] < f) lo = mid;
    else hi = mid;
  }
  const u = (f - feltAt[lo]) / (feltAt[hi] - feltAt[lo] || 1);
  return ((lo + Math.min(1, Math.max(0, u))) / N) * LENGTH;
};
const STEP = 1 / 500;
const feel = monotone(
  FEEL.map((k) => k[0]),
  FEEL.map((k) => k[1]),
);
const steps = Math.round(FLIGHT_END / STEP);
const felt = new Float64Array(steps + 2);
for (let i = 1; i < felt.length; i++) felt[i] = felt[i - 1] + ((feel((i - 1) * STEP) + feel(i * STEP)) / 2) * STEP;
const scale = feltAt[N] / felt[steps];
const distanceAt = (t: number) => {
  const x = Math.min(FLIGHT_END, Math.max(0, t)) / STEP;
  const i = Math.min(steps, Math.floor(x));
  return distanceOfFelt((felt[i] + (felt[i + 1] - felt[i]) * (x - i)) * scale);
};

// when the camera passes each keyframe (for timing events to the flight)
export const keyTimes = along.map((d) => {
  let i = 0;
  while (i < steps && distanceAt(i * STEP) < d - 1e-6) i++;
  return i * STEP;
});

export interface FlightState {
  mix: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  roll: number;
  fov: number;
  near: number;
  fit: number;
}

// writes the camera at time t into out (pos, target, roll, fov, and fit: how
// far the pull-back has got, for the rig's narrow-screen backing off)
export function flightAt(t: number, out: FlightState) {
  const d = distanceAt(t);
  out.pos.set(pos[0](d), pos[1](d) + WORLD_Y, pos[2](d));
  out.target.set(aim[0](d), aim[1](d) + WORLD_Y, aim[2](d));
  out.roll = roll(d);
  out.fov = fov(d);
  const reach = Math.hypot(out.pos.x - out.target.x, out.pos.y - out.target.y, out.pos.z - out.target.z);
  const f = Math.min(1, Math.max(0, Math.log(reach / 12) / Math.log(HERO.dist / 12)));
  out.fit = f * f * (3 - 2 * f);
  return out;
}

// The clock's layout. Units are centimetres. Compass angles run clockwise from
// 12 o'clock as seen from above; the clock's front (6 o'clock) faces +z, so
// 12 o'clock is -z and 3 o'clock is +x.

export const R_CASE = 13.4; // outer radius of the case
export const R_INNER = 12.45; // inside the case wall
export const R_DIAL = 12.4;
export const R_MARK = 10.3; // radius of the hour markers' centres
// the clock turns about its mid-thickness, not the underside of the case
export const BODY_Y = -2.35;

/* ----------------------------------------------------------- hour markers */

export interface Marker {
  index: number;
  angle: number; // clockwise from 12
  x: number;
  z: number;
  step: number | null; // which process step this marker is (0-3), or null
  len: number;
  width: number;
}

// the four process steps sit at 12, 3, 6 and 9
export const STEP_MARKERS = [0, 3, 6, 9];

export const MARKERS: Marker[] = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const step = STEP_MARKERS.indexOf(i);
  return {
    index: i,
    angle,
    x: Math.sin(angle) * R_MARK,
    z: -Math.cos(angle) * R_MARK,
    step: step < 0 ? null : step,
    len: step < 0 ? 1.5 : 2.5,
    width: step < 0 ? 0.24 : 0.46,
  };
});

/* --------------------------------------------------------------- gear train */

// One module for every wheel, so they mesh: pitch radius = MODULE * teeth / 2.
export const MODULE = 0.3;

interface GearDef {
  teeth: number;
  parent: number | null;
  dir: number; // degrees, from the parent toward this wheel (0 = +x, 90 = +z)
  tone: "gold" | "steel";
}

const DEFS: GearDef[] = [
  { teeth: 28, parent: null, dir: 0, tone: "gold" }, // the centre wheel
  { teeth: 18, parent: 0, dir: 35, tone: "steel" },
  { teeth: 22, parent: 0, dir: 160, tone: "gold" },
  { teeth: 16, parent: 2, dir: 270, tone: "steel" },
  { teeth: 12, parent: 1, dir: -30, tone: "gold" },
];

export interface Gear {
  teeth: number;
  r: number; // pitch radius
  x: number;
  z: number;
  parent: number | null;
  phi: number; // direction from the parent, radians
  tone: "gold" | "steel";
}

export const GEARS: Gear[] = [];
DEFS.forEach((d) => {
  const r = (MODULE * d.teeth) / 2;
  const phi = (d.dir * Math.PI) / 180;
  if (d.parent === null) {
    GEARS.push({ teeth: d.teeth, r, x: 0, z: 0, parent: null, phi, tone: d.tone });
    return;
  }
  const p = GEARS[d.parent];
  const dist = p.r + r;
  GEARS.push({ teeth: d.teeth, r, x: p.x + Math.cos(phi) * dist, z: p.z + Math.sin(phi) * dist, parent: d.parent, phi, tone: d.tone });
});

// Angle of every wheel (radians, toward +z) a moment t into the run. Teeth sit
// at k * 2π / N in each wheel's own frame; a child is turned so its gaps meet
// its parent's teeth at the contact point, and it runs the other way.
export function gearAngles(t: number, out: number[] = []) {
  GEARS.forEach((g, i) => {
    if (g.parent === null) {
      out[i] = t * 0.5;
      return;
    }
    const p = GEARS[g.parent];
    const c = g.phi + Math.PI - (Math.PI - g.phi * p.teeth) / g.teeth;
    out[i] = c - (out[g.parent] * p.teeth) / g.teeth;
  });
  return out;
}

export const BALANCE = { x: 2.2, z: -7.6, r: 2.4 };
export const BARREL = { x: -1.5, z: 1.0, r: 4.6 };

// the glowing jewels: one at every pivot
export const JEWELS: { x: number; z: number }[] = [...GEARS.map((g) => ({ x: g.x, z: g.z })), { x: BALANCE.x, z: BALANCE.z }, { x: BARREL.x, z: BARREL.z }];

// decorative screws round the movement plate
export const SCREWS: { x: number; z: number }[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.5;
  return { x: Math.cos(a) * 11.3, z: Math.sin(a) * 11.3 };
});

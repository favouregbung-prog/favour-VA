import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MARKERS, GEARS, BALANCE, BARREL, JEWELS, SCREWS, MODULE, R_CASE, R_DIAL, BODY_Y, gearAngles } from "./layout";
import type { Surfaces } from "./textures";

// A mantel clock built in code (about 27 cm across), the way real ones are
// built, in seven layers. Top to bottom: sapphire crystal; hands on their arbor;
// the dial with its hour markers; the gear train and balance wheel; the
// movement plate with a glowing jewel at every pivot; the mainspring barrel;
// and the machined case with its crown.
//
// Local y of each layer's origin when assembled (the case's underside sits on
// y = 0) and how far it travels when the clock splits apart.
export const LAYERS = {
  crystal: { y: 4.1, lift: 11.5 },
  hands: { y: 3.7, lift: 8.6 },
  dial: { y: 3.3, lift: 5.6 },
  gears: { y: 1.7, lift: 3.4 },
  plate: { y: 1.35, lift: 1.0 },
  barrel: { y: 0.75, lift: -1.6 },
  base: { y: 1.9, lift: -5.4 },
};
export type LayerName = keyof typeof LAYERS;
export const LAYER_ORDER: LayerName[] = ["crystal", "hands", "dial", "gears", "plate", "barrel", "base"];

const CHAMPAGNE = 0xc9a96a;
export const GOLD = new THREE.Color(1.0, 0.62, 0.2); // the colour of the light
const HOVER_LIFT = 0.16; // how far a marker rises under the cursor
const GEAR_T = 0.3; // wheel thickness
const DIAL_TOP = 0.1; // dial surface, in its layer's frame

/* ------------------------------------------------------------- geometry */

const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map(flat))!;

// a toothed wheel lying in XZ: tooth k centred on angle 2πk/N (toward +z)
function gearGeometry(teeth: number, r: number) {
  const rTip = r + MODULE;
  const rRoot = r - 1.25 * MODULE;
  const pitch = (Math.PI * 2) / teeth;
  const at = (rad: number, a: number): [number, number] => [rad * Math.cos(a), -rad * Math.sin(a)];
  const shape = new THREE.Shape();
  let first = true;
  for (let k = 0; k < teeth; k++) {
    const a = k * pitch;
    for (const [rad, ang] of [
      [rRoot, a - pitch * 0.3],
      [rTip, a - pitch * 0.15],
      [rTip, a + pitch * 0.15],
      [rRoot, a + pitch * 0.3],
    ] as const) {
      const [x, y] = at(rad, ang);
      if (first) shape.moveTo(x, y);
      else shape.lineTo(x, y);
      first = false;
    }
  }
  const hole = (cx: number, cy: number, hr: number) => {
    const p = new THREE.Path();
    p.absarc(cx, cy, hr, 0, Math.PI * 2, true);
    return p;
  };
  shape.holes.push(hole(0, 0, 0.28));
  if (r >= 2.4) {
    const n = r >= 3.3 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const [x, y] = at(r * 0.56, (i / n) * Math.PI * 2 + 0.3);
      shape.holes.push(hole(x, y, r * 0.19));
    }
  }
  const depth = GEAR_T - 0.024;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth / 2, 0);
  const hub = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 24).translate(0, 0.1, 0);
  return merge([g, hub]);
}

class Spiral extends THREE.Curve<THREE.Vector3> {
  r0: number;
  r1: number;
  turns: number;
  constructor(r0: number, r1: number, turns: number) {
    super();
    this.r0 = r0;
    this.r1 = r1;
    this.turns = turns;
  }
  override getPoint(t: number, out = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    const r = this.r0 + (this.r1 - this.r0) * t;
    return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
}

// the balance wheel: a rim, three spokes, a hub
function balanceGeometry() {
  const rim = new THREE.TorusGeometry(BALANCE.r, 0.13, 10, 56).rotateX(Math.PI / 2);
  const spokes = [0, 1, 2].map((k) => new THREE.BoxGeometry(BALANCE.r * 2, 0.08, 0.15).rotateY((k * Math.PI) / 3));
  const hub = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20);
  return merge([rim, ...spokes, hub]);
}

// a tapered leaf hand lying in XZ, its tip toward 12 o'clock (-z)
function handGeometry(len: number, tail: number, w: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -tail);
  s.bezierCurveTo(-w, -tail * 0.3, -w * 1.15, len * 0.35, 0, len);
  s.bezierCurveTo(w * 1.15, len * 0.35, w, -tail * 0.3, 0, -tail);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth / 2, 0);
  return g;
}

function secondGeometry() {
  return merge([
    new THREE.BoxGeometry(0.07, 0.05, 14.2).translate(0, 0, -4.5),
    new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28).translate(0, 0, 2.6),
    new THREE.CylinderGeometry(0.28, 0.28, 0.05, 20).translate(0, 0, -8.6),
  ]);
}

// the case: a machined drum, lathed. Profile (radius, y), centred on its height.
function caseGeometry() {
  const pts: [number, number][] = [
    [0, -1.9],
    [12.7, -1.9],
    [13.15, -1.75],
    [13.38, -1.4],
    [13.4, -1.0],
    [13.4, 1.55],
    [13.33, 1.8],
    [13.15, 1.9],
    [12.62, 1.9],
    [12.5, 1.78],
    [12.45, 1.5],
    [12.45, -1.45],
    [12.2, -1.5],
    [0, -1.5],
  ];
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    128,
  );
}

// the crystal: a very shallow dome
function crystalGeometry() {
  const pts: [number, number][] = [
    [0, 0.32],
    [3, 0.29],
    [6, 0.22],
    [9, 0.12],
    [11.6, 0.04],
    [12.6, 0.0],
    [12.6, -0.08],
  ];
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    128,
  );
}

// a flat disc with a textured top (uv: canvas top = -z), a side wall and a floor
function disc(radius: number, thickness: number, topMat: THREE.Material, sideMat: THREE.Material, bottomMat: THREE.Material) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CircleGeometry(radius, 128).rotateX(-Math.PI / 2).translate(0, thickness / 2, 0), topMat);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 128, 1, true), sideMat);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(radius, 64).rotateX(Math.PI / 2).translate(0, -thickness / 2, 0), bottomMat);
  for (const m of [top, side, bottom]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  g.add(top, side, bottom);
  return g;
}

/* -------------------------------------------------------------- builder */

export interface MarkerState {
  glow: number; // 0 off, ~1 lit, above 1 flaring
  hover: number; // 0-1 (springs past 1 briefly): lift under the cursor
}
export interface JewelState {
  led: number; // 0 off, 1 on (the preloader wakes them in a wave)
  glow: number; // extra light on top (flares)
}
export interface LayerFx {
  dy: number; // extra height (the preloader drops layers in)
  spin: number; // radians, clockwise
  visible: boolean;
}
export type PartName = "hour" | "minute" | "second" | "jewel";

export type Clock = ReturnType<typeof createClock>;

const tau = Math.PI * 2;
const lerpAngle = (a: number, b: number, t: number) => a + ((((b - a + Math.PI) % tau) + tau) % tau - Math.PI) * t;

export function createClock(surf: Surfaces) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = BODY_Y;
  root.add(body);

  const mats = {
    case: new THREE.MeshPhysicalMaterial({ color: 0x2b2722, metalness: 0.85, roughness: 0.34, envMapIntensity: 1.1, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    gold: new THREE.MeshStandardMaterial({ color: CHAMPAGNE, metalness: 1, roughness: 0.26, envMapIntensity: 1.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcfccc6, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2c2926, metalness: 0.9, roughness: 0.4, envMapIntensity: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }),
    plateTop: new THREE.MeshStandardMaterial({
      map: surf.plate,
      metalness: 0.85,
      roughness: 0.42,
      envMapIntensity: 1.1,
      emissive: 0xffffff,
      emissiveMap: surf.plate,
      emissiveIntensity: 0.22,
    }),
    plateEdge: new THREE.MeshStandardMaterial({ color: 0x8a7650, metalness: 1, roughness: 0.35 }),
    dial: new THREE.MeshStandardMaterial({ map: surf.dial, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.22 }),
    dialEdge: new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.8 }),
    hand: new THREE.MeshStandardMaterial({ color: CHAMPAGNE, metalness: 1, roughness: 0.22, envMapIntensity: 1.8 }),
    second: new THREE.MeshStandardMaterial({ color: 0xeac487, metalness: 1, roughness: 0.2, envMapIntensity: 1.8 }),
    crystal: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // light: instance colour carries the intensity
    lume: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    stone: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    capStone: new THREE.MeshBasicMaterial({ color: GOLD.clone() }),
    pad: new THREE.MeshBasicMaterial({ map: surf.pad, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    tick: new THREE.MeshStandardMaterial({ color: 0xcfc6b4, metalness: 0.6, roughness: 0.4 }),
  };

  const shadows = (o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  };
  const instanced = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadow = false) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  };

  const groups = {} as Record<LayerName, THREE.Group>;
  for (const name of LAYER_ORDER) {
    groups[name] = new THREE.Group();
    body.add(groups[name]);
  }

  /* case (origin: mid-height of the drum) */
  const caseMesh = new THREE.Mesh(caseGeometry(), mats.case);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(12.95, 0.17, 12, 128).rotateX(Math.PI / 2).translate(0, 1.9, 0), mats.gold);
  const crown = new THREE.Group();
  crown.add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 28).rotateZ(Math.PI / 2), mats.gold),
    new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16).rotateZ(Math.PI / 2).translate(-0.9, 0, 0), mats.darkSteel),
  );
  const CROWN_X = R_CASE + 0.5;
  crown.position.set(CROWN_X, 0.6, 0);
  groups.base.add(caseMesh, bezel, crown);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.4, 24), mats.rubber);
    foot.position.set(Math.cos(a) * 9.8, -1.9 - 0.18, Math.sin(a) * 9.8);
    groups.base.add(foot);
  }
  groups.base.traverse(shadows);

  /* mainspring barrel */
  const barrel = new THREE.Group();
  barrel.position.set(BARREL.x, 0, BARREL.z);
  barrel.add(
    new THREE.Mesh(new THREE.CylinderGeometry(BARREL.r, BARREL.r, 0.7, 64), mats.darkSteel),
    new THREE.Mesh(new THREE.TorusGeometry(BARREL.r, 0.09, 8, 64).rotateX(Math.PI / 2).translate(0, 0.35, 0), mats.gold),
    new THREE.Mesh(new THREE.TubeGeometry(new Spiral(0.9, 4.1, 6), 480, 0.05, 5, false).translate(0, 0.4, 0), mats.steel),
    new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 20), mats.gold),
  );
  barrel.traverse(shadows);
  groups.barrel.add(barrel);

  /* movement plate: Côtes de Genève top, a jewel at every pivot */
  groups.plate.add(disc(12.3, 0.3, mats.plateTop, mats.plateEdge, mats.darkSteel));
  const screwGeo = merge(SCREWS.map((s) => new THREE.CylinderGeometry(0.34, 0.34, 0.1, 16).translate(s.x, 0.2, s.z)));
  groups.plate.add(new THREE.Mesh(screwGeo, mats.gold));
  const NJ = JEWELS.length;
  const chatons = instanced(groups.plate, new THREE.TorusGeometry(0.42, 0.09, 8, 24).rotateX(Math.PI / 2), mats.gold, NJ);
  const stones = instanced(groups.plate, new THREE.SphereGeometry(0.3, 16, 10), mats.stone, NJ);
  const jewelPads = instanced(groups.plate, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.pad, NJ);
  jewelPads.renderOrder = 1;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);
  JEWELS.forEach((j, i) => {
    m4.makeTranslation(j.x, 0.2, j.z);
    chatons.setMatrixAt(i, m4);
    m4.makeScale(1, 0.55, 1).setPosition(j.x, 0.17, j.z);
    stones.setMatrixAt(i, m4);
    m4.makeScale(4.4, 1, 4.4).setPosition(j.x, 0.158, j.z);
    jewelPads.setMatrixAt(i, m4);
  });

  /* gear train and balance wheel (origin: mid-thickness of the wheels) */
  const gearMeshes = GEARS.map((g) => {
    const m = new THREE.Mesh(gearGeometry(g.teeth, g.r), g.tone === "gold" ? mats.gold : mats.steel);
    m.position.set(g.x, 0, g.z);
    groups.gears.add(m);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 12), mats.darkSteel);
    post.position.set(g.x, -0.05, g.z);
    groups.gears.add(post);
    return m;
  });
  const balance = new THREE.Mesh(balanceGeometry(), mats.gold);
  balance.position.set(BALANCE.x, 0.75, BALANCE.z);
  const hair = new THREE.Mesh(new THREE.TubeGeometry(new Spiral(0.5, 1.8, 7), 320, 0.018, 4, false).translate(0, -0.12, 0), mats.steel);
  balance.add(hair);
  const balancePost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.1, 10), mats.darkSteel);
  balancePost.position.set(BALANCE.x, 0.3, BALANCE.z);
  groups.gears.add(balance, balancePost);
  groups.gears.traverse(shadows);

  /* dial: the face, 48 minute ticks, 12 hour markers with lume */
  groups.dial.add(disc(R_DIAL, 0.2, mats.dial, mats.dialEdge, mats.dialEdge));
  const ticksGeo = new THREE.BoxGeometry(0.06, 0.05, 0.5);
  const ticks = instanced(groups.dial, ticksGeo, mats.tick, 48);
  {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = (i / 60) * tau;
      q.setFromAxisAngle(yAxis, -a);
      p.set(Math.sin(a) * 11.7, DIAL_TOP + 0.025, -Math.cos(a) * 11.7);
      ticks.setMatrixAt(n++, m4.compose(p, q, s.set(1, 1, 1)));
    }
  }
  const NM = MARKERS.length;
  const markerBodies = instanced(groups.dial, new THREE.BoxGeometry(1, 0.14, 1), mats.gold, NM, true);
  const markerLume = instanced(groups.dial, new THREE.BoxGeometry(1, 0.02, 1), mats.lume, NM);
  const markerPads = instanced(groups.dial, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.pad, NM);
  markerPads.renderOrder = 1;

  /* hands, on one arbor (origin: the hour hand's plane) */
  const hands = new THREE.Group();
  groups.hands.add(hands);
  hands.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.9, 14).translate(0, -0.55, 0), mats.gold));
  const hourPivot = new THREE.Group();
  const minutePivot = new THREE.Group();
  const secondPivot = new THREE.Group();
  const capPivot = new THREE.Group();
  hourPivot.add(new THREE.Mesh(handGeometry(6.6, 1.3, 0.62, 0.1), mats.hand));
  minutePivot.add(new THREE.Mesh(handGeometry(10.4, 1.7, 0.42, 0.09), mats.hand));
  secondPivot.add(new THREE.Mesh(secondGeometry(), mats.second));
  capPivot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 28), mats.gold));
  const capStone = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10).scale(1, 0.6, 1).translate(0, 0.17, 0), mats.capStone);
  capPivot.add(capStone);
  hands.add(hourPivot, minutePivot, secondPivot, capPivot);
  const PIVOT_Y = { hour: 0, minute: 0.2, second: 0.4, jewel: 0.55 };
  groups.hands.traverse(shadows);

  /* crystal */
  const crystal = new THREE.Mesh(crystalGeometry(), mats.crystal);
  crystal.renderOrder = 3;
  groups.crystal.add(crystal);

  /* --------------------------------------------------------- live state */

  // Everything that animates is plain data written by the preloader and scroll
  // timelines; update() turns it into transforms once per frame.
  const markers: MarkerState[] = MARKERS.map(() => ({ glow: 0, hover: 0 }));
  const jewels: JewelState[] = JEWELS.map(() => ({ led: 1, glow: 0 }));
  const explode: Record<LayerName, number> = { crystal: 0, hands: 0, dial: 0, gears: 0, plate: 0, barrel: 0, base: 0 };
  // sideways offset (cm, along x) of the lower layers: the preloader starts
  // on the movement slid out from under the gear train
  const slide = { plate: 0, barrel: 0, base: 0 };
  const layerFx = {} as Record<LayerName, LayerFx>;
  for (const name of LAYER_ORDER) layerFx[name] = { dy: 0, spin: 0, visible: true };
  // hands: mix 1 = real time; 0 = the scripted hour / minute (radians clockwise from 12)
  const handState = { mix: 1, hour: 0, minute: 0 };
  // how far each part of the hands lifts when they come apart
  const split = { hour: 0, minute: 0, second: 0, jewel: 0 };
  const look = { jewelBase: 1, stepBase: 0.3, crown: 0 };
  let gearTime = 0;
  const angles: number[] = [];

  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

  function update(dt: number, timeMs: number) {
    gearTime += dt;

    // layers
    for (const name of LAYER_ORDER) {
      const g = groups[name];
      const fx = layerFx[name];
      const sx = name === "plate" || name === "barrel" || name === "base" ? slide[name] : 0;
      g.position.set(sx, LAYERS[name].y + LAYERS[name].lift * explode[name] + fx.dy, 0);
      g.rotation.y = -fx.spin;
      g.visible = fx.visible;
    }

    // wheels
    gearAngles(gearTime, angles);
    gearMeshes.forEach((m, i) => (m.rotation.y = -angles[i]));
    balance.rotation.y = Math.sin(gearTime * tau * 1.6) * 0.85;

    // hour markers: a baton on the dial, a lume strip on it, a pool of light under it
    let lit = 0;
    for (let i = 0; i < NM; i++) {
      const mk = MARKERS[i];
      const st = markers[i];
      q.setFromAxisAngle(yAxis, -mk.angle);
      const rise = st.hover * HOVER_LIFT;
      p.set(mk.x, DIAL_TOP + 0.07 + rise, mk.z);
      markerBodies.setMatrixAt(i, m4.compose(p, q, s.set(mk.width, 1, mk.len)));
      p.set(mk.x, DIAL_TOP + 0.151 + rise, mk.z);
      markerLume.setMatrixAt(i, m4.compose(p, q, s.set(mk.width * 0.56, 1, mk.len * 0.82)));
      const base = mk.step !== null ? look.stepBase : 0.05;
      markerLume.setColorAt(i, c.copy(GOLD).multiplyScalar(base + st.glow * 2.2));
      p.set(mk.x, DIAL_TOP + 0.012, mk.z);
      markerPads.setMatrixAt(i, m4.compose(p, yQ, s.set(3.6, 1, 3.6)));
      markerPads.setColorAt(i, c.copy(GOLD).multiplyScalar(Math.max(0, st.glow) * 0.8));
      lit += st.glow;
    }
    for (const mesh of [markerBodies, markerLume, markerPads, ticks]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // jewels
    for (let i = 0; i < NJ; i++) {
      const jw = jewels[i];
      const v = jw.led * look.jewelBase + jw.glow;
      stones.setColorAt(i, c.copy(GOLD).multiplyScalar(0.12 + v * 1.8));
      jewelPads.setColorAt(i, c.copy(GOLD).multiplyScalar(v * 0.85));
    }
    for (const mesh of [stones, jewelPads]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // hands: real time unless a timeline is steering them
    const d = new Date(timeMs);
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    const liveHour = (hr / 12) * tau;
    const liveMinute = (min / 60) * tau;
    hourPivot.rotation.y = -lerpAngle(handState.hour, liveHour, handState.mix);
    minutePivot.rotation.y = -lerpAngle(handState.minute, liveMinute, handState.mix);
    secondPivot.rotation.y = -((sec / 60) * tau);
    hourPivot.position.y = PIVOT_Y.hour + split.hour;
    minutePivot.position.y = PIVOT_Y.minute + split.minute;
    secondPivot.position.y = PIVOT_Y.second + split.second;
    capPivot.position.y = PIVOT_Y.jewel + split.jewel;
    mats.capStone.color.copy(GOLD).multiplyScalar(0.5 + Math.min(1.5, lit * 0.05) + clamp01(split.jewel) * 1.2);

    crown.position.x = CROWN_X - look.crown;
  }
  const yQ = new THREE.Quaternion();

  // world-space points round a layer at its current height, for label anchors
  const ring = Array.from({ length: 8 }, () => new THREE.Vector3());
  const layerCorners = (name: LayerName) => {
    const y = LAYERS[name].y + LAYERS[name].lift * explode[name] + layerFx[name].dy;
    ring.forEach((v, i) => {
      const a = (i / ring.length) * tau;
      v.set(Math.cos(a) * (R_CASE - 0.4), y, Math.sin(a) * (R_CASE - 0.4));
      body.localToWorld(v);
    });
    return ring;
  };

  // world-space point on the arbor at one hand's height, nudged to its right
  const part = (name: PartName, out: THREE.Vector3) => {
    const y = LAYERS.hands.y + LAYERS.hands.lift * explode.hands + layerFx.hands.dy + PIVOT_Y[name] + split[name];
    out.set(0, y, 0);
    return body.localToWorld(out);
  };

  function dispose() {
    body.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const mat of Object.values(mats)) mat.dispose();
    surf.dial.dispose();
    surf.plate.dispose();
    surf.pad.dispose();
  }

  update(0, 0);
  return { root, body, markers, jewels, explode, slide, layerFx, hands: handState, split, look, update, layerCorners, part, mats, dispose };
}

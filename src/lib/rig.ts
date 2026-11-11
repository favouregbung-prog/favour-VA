import * as THREE from "three";
import type { FlightState } from "./flight";

// The camera is described as an orbit around a target, so every shot is a
// handful of numbers gsap can tween: azimuth / elevation in radians (az 0 is
// straight in front of the clock), distance in cm, a dutch-angle roll, a
// lens shift (fractions of the viewport) and `fit`, how much a shot should
// back off on narrow screens to keep the whole clock in frame.
//
// `flight` overrides the orbit with a free position / target / roll (the
// preloader's fly-through); its `mix` blends from the orbit (0) to the flight
// (1), so tweening mix to 0 lands the camera exactly on the orbit shot. Its
// near plane is closer, for flying a few millimetres from the parts.
const NEAR = 0.3;
const WIDEST = 16 / 9;

export interface CamShot {
  tx: number;
  ty: number;
  tz: number;
  az: number;
  el: number;
  dist: number;
  fov: number;
  roll: number;
  shiftX: number;
  shiftY: number;
  fit: number;
  parallax: number;
  portraitLift: number; // extra lens shift up on portrait screens, where copy sits low
  shake: number; // handheld wobble
}

export type Rig = ReturnType<typeof createRig>;

export function createRig(signal: AbortSignal) {
  const cam: CamShot = {
    tx: 0,
    ty: 0,
    tz: 0,
    az: 0,
    el: 0.3,
    dist: 40,
    fov: 32,
    roll: 0,
    shiftX: 0,
    shiftY: 0,
    fit: 1,
    parallax: 0,
    portraitLift: 0,
    shake: 0,
  };
  let clock = 0;
  // smooth pseudo-noise: a few incommensurate sines
  const wobble = (t: number, a: number) => Math.sin(t * 1.3 + a) * 0.6 + Math.sin(t * 2.9 + a * 2.1) * 0.3 + Math.sin(t * 6.1 + a * 0.7) * 0.1;
  const target = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const flight: FlightState = { mix: 0, pos: new THREE.Vector3(), target: new THREE.Vector3(), roll: 0, fov: 34, near: 0.3, fit: 0 };
  const orbitPos = new THREE.Vector3();
  const flightPos = new THREE.Vector3();

  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
    },
    { signal },
  );

  function apply(camera: THREE.PerspectiveCamera, w: number, h: number, dt = 1 / 60) {
    clock += dt;
    const k = 1 - Math.exp(-dt * 3);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;

    const aspect = w / Math.max(h, 1);
    // keep the 27 cm clock in frame on portrait screens (it may brush the
    // edges; backing off the full amount leaves it tiny)
    const narrow = Math.max(1, 1.55 / aspect) ** 0.78;
    const dist = cam.dist * (1 + (narrow - 1) * cam.fit);
    const az = cam.az + pointer.sx * 0.03 * cam.parallax + wobble(clock, 0.4) * 0.006 * cam.shake;
    const el = cam.el - pointer.sy * 0.02 * cam.parallax + wobble(clock, 2.3) * 0.004 * cam.shake;

    target.set(cam.tx, cam.ty, cam.tz);
    orbitPos.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    const f = flight.mix;
    const back = 1 + (narrow - 1) * cam.fit * flight.fit;
    flightPos.copy(flight.pos).sub(flight.target).multiplyScalar(back).add(flight.target);
    camera.position.lerpVectors(orbitPos, flightPos, f);
    target.lerp(flight.target, f);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(THREE.MathUtils.lerp(cam.roll, flight.roll, f) + wobble(clock, 4.1) * 0.005 * cam.shake);
    camera.fov = THREE.MathUtils.lerp(cam.fov, flight.fov, f);
    camera.near = THREE.MathUtils.lerp(NEAR, flight.near, f);
    camera.aspect = aspect;
    // lens shift: +x moves the subject right, +y moves it up. Copy is sized
    // in vw, so on wider-than-16:10 screens it reaches further down: drop the
    // subject to match, up to 16:9
    const sx = aspect < 1 ? 0 : cam.shiftX;
    let sy = cam.shiftY - Math.max(0, Math.min(aspect, WIDEST) - 1.6) * 0.32;
    if (aspect < 1) sy += cam.portraitLift;
    camera.setViewOffset(w, h, -sx * w * (1 - f), sy * h * (1 - f), w, h);
    camera.updateProjectionMatrix();
  }

  return { cam, target, pointer, flight, apply };
}

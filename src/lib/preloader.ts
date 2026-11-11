import gsap from "gsap";
import { JEWELS, MARKERS } from "./layout";
import { LAYERS, type Clock } from "./clock";
import { flightAt, keyTimes, FLIGHT_END, KB_Y, MOVEMENT_SLIDE, MOVEMENT_DROP, HERO } from "./flight";
import type { Rig } from "./rig";
import type { Post } from "./post";
import type { Stage } from "./stage";
import type { UiRefs } from "./ui";

// The preloader: one continuous camera move (see flight.ts) while the clock is
// put together around it.
//   0     skim the movement plate, slid out beside the gear train, its jewels waking
//   0.8   climb into the lane just above the turning gears
//   1.3   up out over the bare gears, rolling, as the dial drops in
//   2.4   the hands settle, the crystal comes down
//   3.9   pull back into the hero
export const JEWEL_REST = 0.42; // how bright the jewels settle to
export const MARKER_REST = 0.1; // how bright the hour markers settle to
const T = { lane: keyTimes[3], out: keyTimes[5], edge: keyTimes[7], end: FLIGHT_END };

const backOut = gsap.parseEase("back.out(1.3)");
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// a layer's drop: how far above its seat it starts (cm), when it starts and
// how long it takes
const DROPS = {
  dial: { height: 5.5, start: T.out - 0.1, time: 0.65 },
  hands: { height: 6, start: T.out + 0.55, time: 0.55 },
  crystal: { height: 8, start: T.edge - 0.15, time: 0.6 },
};

export type Preloader = ReturnType<typeof createPreloader>;

export function createPreloader({ kb, rig, post, stage, ui, onDone }: { kb: Clock; rig: Rig; post: Post; stage: Stage; ui: UiRefs; onDone: () => void }) {
  const { cam, flight } = rig;
  const { fx } = post;
  const tl = gsap.timeline({ paused: true });

  // the orbit is parked on the hero shot from the start; the flight lands on
  // the same spot and hands over to it at the end
  Object.assign(cam, { tx: 0, ty: 5.6, tz: 1.4, az: -0.06, el: 0.2, dist: HERO.dist, fov: 30, roll: 0, fit: 0.5, portraitLift: -0.26, shiftX: 0.2, shiftY: 0.02, parallax: 0, shake: 0 });
  // (motionBlur: a film shutter while the camera flies)
  Object.assign(fx, { bokeh: 1.5, focusRange: 3, bloom: 1.1, focusRow: 0, motionBlur: 1 });
  Object.assign(flight, { mix: 1, near: 0.04 });
  Object.assign(stage, { desk: 0, idle: 0, tilt: 0, shadow: 0.5, hover: 0, light: 0.3, rim: 0.1, rake: 1 });
  Object.assign(stage.pose, { y: KB_Y, rx: 0, ry: 0, rz: 0 });
  // the movement (plate, barrel, case) starts slid out and dropped below
  for (const name of ["plate", "barrel", "base"] as const) {
    kb.explode[name] = -MOVEMENT_DROP / LAYERS[name].lift;
    kb.slide[name] = MOVEMENT_SLIDE;
  }
  for (const name of ["dial", "hands", "crystal"] as const) kb.layerFx[name].visible = false;
  // the plate reads a touch brighter than it does inside the closed case
  const plateGlow = { v: 0.55 };
  const jewelLevel = { v: 1 };
  const ao = post.ao.configuration;
  const aoState = { radius: 0.1 };

  // the movement slides home under the gears while the camera is in the lane,
  // then rises into place
  for (const name of ["plate", "barrel", "base"] as const) {
    tl.to(kb.slide, { [name]: 0, duration: 0.7, ease: "power2.inOut" }, T.lane + 0.1);
    tl.to(kb.explode, { [name]: 0, duration: 0.35, ease: "power2.out" }, T.lane + 0.8);
  }

  // inside it's dark but for the jewels; the studio comes up as the camera
  // rises out
  tl.to(stage, { light: 1, duration: 0.7, ease: "sine.inOut" }, T.out - 0.2);
  tl.to(stage, { shadow: 1, duration: 0.8, ease: "sine.inOut" }, T.out);
  tl.to(jewelLevel, { v: JEWEL_REST, duration: 1.0, ease: "sine.inOut" }, T.edge - 0.3);
  tl.to(aoState, { radius: 0.45, duration: 0.8, ease: "sine.inOut" }, T.out);
  tl.to(plateGlow, { v: 0.22, duration: 0.5 }, T.lane + 0.6);
  // the lens opens up as the camera rises out, then settles into product shot
  tl.to(fx, { bokeh: 1.2, focusRange: 6, duration: 0.5, ease: "sine.inOut" }, T.out - 0.2);
  tl.to(fx, { bokeh: 0.5, focusRange: 18, duration: 1.0, ease: "sine.inOut" }, T.edge);
  // the clock tips toward us as it's revealed
  tl.to(stage.pose, { rx: 1.1, duration: T.end - keyTimes[8] + 0.25, ease: "power2.inOut" }, keyTimes[8] - 0.25);
  tl.to(flight, { mix: 0, duration: 1.0, ease: "power2.inOut" }, T.end - 1.0);
  tl.to(stage, { rim: 1, duration: 0.6, ease: "sine.inOut" }, T.end - 0.6);
  // the low light across the plate fades as the camera leaves it
  tl.to(stage, { rake: 0, duration: 0.5, ease: "sine.inOut" }, T.lane - 0.3);
  tl.to(fx, { motionBlur: 0, duration: 0.8, ease: "sine.inOut" }, T.end - 1.0);
  tl.to(stage, { idle: 1, tilt: 1, duration: 1.0, ease: "sine.inOut" }, T.end - 0.8);
  tl.to(stage, { hover: 1, duration: 0.5, ease: "sine.out" }, T.end - 0.5);
  tl.to(cam, { parallax: 1, duration: 1, ease: "sine.inOut" }, T.end - 0.8);

  /* UI */
  gsap.set([ui.hero, ui.inside, ui.processCopy, ui.sampleCopy, ui.final], { autoAlpha: 0 });
  gsap.set(ui.nav, { autoAlpha: 1 });
  tl.fromTo(ui.veil, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, ease: "power1.out" }, 0);
  tl.fromTo(ui.hero, { autoAlpha: 0, y: 24, filter: "blur(12px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.0, ease: "power3.out" }, T.end - 0.9);
  tl.call(() => onDone(), undefined, T.end);

  /* ------------------------------------------------------------- clock */

  // The timeline is stepped from the render loop rather than gsap's ticker,
  // and a slow frame only advances it by a capped amount: a hitch slows the
  // flight down for a moment instead of making it jump.
  let playing = false;
  function play() {
    tl.time(0);
    playing = true;
  }
  function advance(dt: number) {
    if (!playing) return;
    const t = Math.min(T.end, tl.time() + Math.min(dt, 1 / 30));
    tl.time(t);
    if (t >= T.end) playing = false;
  }

  /* ------------------------------------------------------ per-frame state */

  // a layer dropping onto its seat, with a little bounce
  function drop(name: "dial" | "hands" | "crystal", t: number) {
    const d = DROPS[name];
    const fxl = kb.layerFx[name];
    const b = (t - d.start) / d.time;
    fxl.visible = b > 0;
    const land = b <= 0 ? 0 : b >= 1 ? 1 : backOut(b);
    fxl.dy = d.height * (1 - land);
    // the dial turns a quarter as it settles
    fxl.spin = name === "dial" ? -(1 - smooth(b)) * 1.1 : 0;
    return b;
  }

  function update() {
    const t = tl.time();
    flightAt(t, flight);
    if (ao.aoRadius !== aoState.radius) ao.aoRadius = aoState.radius;
    kb.mats.plateTop.emissiveIntensity = plateGlow.v;
    kb.look.jewelBase = jewelLevel.v;

    // the jewels wake in a wave that runs on ahead of the camera
    const wave = -31 + t * 32;
    for (let i = 0; i < JEWELS.length; i++) {
      kb.jewels[i].led = kb.slide.plate === 0 ? 1 : smooth((wave - (JEWELS[i].x + kb.slide.plate)) / 1.5);
      kb.jewels[i].glow = 0;
    }

    drop("dial", t);
    drop("hands", t);
    drop("crystal", t);

    // each hour marker flares as the dial lands, sweeping clockwise from 12,
    // then settles to its resting light
    const landed = DROPS.dial.start + DROPS.dial.time * 0.6;
    for (let i = 0; i < MARKERS.length; i++) {
      const since = t - (landed + (i / MARKERS.length) * 0.55);
      const flare = since > 0 ? (1 - Math.exp(-since * 30)) * Math.exp(-since * 4.5) * 0.9 : 0;
      kb.markers[i].glow = MARKER_REST * smooth(since / 0.3) + flare;
    }
    kb.look.stepBase = 0.3;
    kb.look.crown = 0;
  }

  return { tl, play, advance, update, end: T.end };
}

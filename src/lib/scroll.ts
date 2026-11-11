import gsap from "gsap";
import { MARKERS, JEWELS, STEP_MARKERS } from "./layout";
import { LAYER_ORDER, type Clock } from "./clock";
import { JEWEL_REST, MARKER_REST } from "./preloader";
import { BODY_Y } from "./layout";
import type { Rig } from "./rig";
import type { Post } from "./post";
import type { Stage } from "./stage";
import type { UiRefs } from "./ui";

// Scroll is mapped onto one paused timeline 12 units long. The page only
// supplies a progress value; the render loop eases toward it, so the same
// timeline can be pinned to any frame.
//
//   0    – 1.6   lay the tipped clock flat, swing round to a three-quarter view
//   0.6  – 3.8   split vertically into seven layers, labels arrive
//   3.5  – 4.9   hold, slow orbit
//   4.9  – 6.7   layers close up while the camera settles over the dial
//   6.75 – 8.45  the four steps light up in turn, the hour hand stepping 12 → 3 → 6 → 9
//   8.5  – 10.7  zoom onto the hands; they come apart into hour / minute / second / jewel
//   10.9 – 12    they close, the crown is pressed, and light floods out from the centre
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// how far each part of the hands rises when they come apart (cm)
export const SPLIT = { hour: 1.1, minute: 2.5, second: 3.9, jewel: 5.3 };

export interface Glow {
  step: number; // which process step is showing (0–3), fractional in between
  wave: number; // the flood at the end, 0–1
  labels: number;
  partLabels: number;
}

export type Scroll = ReturnType<typeof createScroll>;

export function createScroll({ kb, rig, post, stage, ui, signal }: { kb: Clock; rig: Rig; post: Post; stage: Stage; ui: UiRefs; signal: AbortSignal }) {
  const { cam } = rig;
  const { fx } = post;
  // world height of a point y cm up the clock's own frame
  const at = (y: number) => stage.pose.y + BODY_Y + y;

  const glow: Glow = { step: -1, wave: 0, labels: 0, partLabels: 0 };
  stage.focusOverride = null;
  const steps = Array.from(ui.processCopy.querySelectorAll<HTMLElement>("[data-step]"));
  const jewel = { v: JEWEL_REST };
  const crown = { v: 0 };

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });

  // lay it flat + frame the stack
  tl.to(ui.hero, { autoAlpha: 0, y: -30, filter: "blur(10px)", duration: 0.7, ease: "power1.in" }, 0);
  tl.to(ui.scrollCue, { opacity: 0, duration: 0.3 }, 0);
  tl.to(stage.pose, { rx: 0, duration: 1.6 }, 0);
  tl.to(stage, { idle: 0.25, duration: 1.2 }, 0);
  tl.to(stage, { hover: 0, duration: 0.35 }, 0);
  tl.to(cam, { tx: 0, ty: at(5.5), tz: 0, az: -0.42, el: 0.3, dist: 78, fov: 30, shiftX: -0.05, shiftY: 0.06, fit: 1, portraitLift: 0.04, parallax: 0.6, duration: 1.8 }, 0);
  tl.to(stage, { shadow: 0.3, duration: 1.6 }, 0.8);
  tl.to(fx, { bokeh: 0.35, focusRange: 40, duration: 1.6 }, 0);

  // split
  LAYER_ORDER.forEach((name, i) => {
    tl.to(kb.explode, { [name]: 1, duration: 2.1, ease: "power3.inOut" }, 0.6 + i * 0.17);
  });
  tl.to(jewel, { v: 1, duration: 1.6 }, 1.2);
  tl.to(glow, { labels: 1, duration: 0.01 }, 1.4);
  tl.fromTo(ui.inside, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out" }, 2.0);

  // hold + orbit
  tl.to(cam, { az: -0.24, el: 0.24, duration: 1.4, ease: "sine.inOut" }, 3.5);

  // close up over the dial
  tl.to(ui.inside, { autoAlpha: 0, y: -20, duration: 0.6, ease: "power1.in" }, 4.7);
  tl.to(glow, { labels: 0, duration: 0.01 }, 4.85);
  [...LAYER_ORDER].reverse().forEach((name, i) => {
    tl.to(kb.explode, { [name]: 0, duration: 1.5, ease: "power3.inOut" }, 4.9 + i * 0.1);
  });
  tl.to(jewel, { v: 0.14, duration: 1.4 }, 5.2);
  tl.to(stage, { shadow: 1, duration: 1.2 }, 5.2);
  tl.to(stage, { idle: 0, duration: 1 }, 5.0);
  tl.to(kb.hands, { mix: 0, duration: 1.4 }, 5.0);
  tl.to(cam, { tx: 0, ty: at(3.4), tz: 0, az: -0.1, el: 1.0, dist: 68, shiftX: 0.2, shiftY: 0.02, fit: 0.8, portraitLift: 0.1, parallax: 0.35, duration: 1.8, ease: "power3.inOut" }, 4.9);
  tl.to(fx, { bokeh: 1.8, focusRange: 14, duration: 1.6 }, 5.0);
  tl.fromTo(ui.processCopy, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, 6.5);
  tl.fromTo(glow, { step: -0.6 }, { step: 3.6, duration: 1.7, ease: "none" }, 6.75);

  // zoom onto the hands, which come apart
  tl.to(ui.processCopy, { autoAlpha: 0, y: -20, duration: 0.5, ease: "power1.in" }, 8.45);
  tl.to(kb.hands, { mix: 1, duration: 0.5 }, 8.45);
  tl.to(kb.explode, { crystal: 1, duration: 1.1, ease: "power3.inOut" }, 8.5);
  tl.to(cam, { tx: 0, ty: at(3.8), tz: 0, az: -0.5, el: 0.4, dist: 14, shiftX: 0.1, shiftY: 0, portraitLift: 0.12, fit: 0, duration: 1.2, ease: "power3.inOut" }, 8.5);
  tl.to(fx, { bokeh: 5.5, focusRange: 2.6, duration: 1.1 }, 8.6);
  tl.to(stage, { tilt: 0.3, duration: 1.1 }, 8.5);
  tl.to(kb.split, { hour: SPLIT.hour, minute: SPLIT.minute, second: SPLIT.second, jewel: SPLIT.jewel, duration: 1.1, ease: "power3.inOut" }, 9.55);
  // (on portrait screens the taller stack backs off and rises above the copy)
  tl.to(cam, { ty: at(5.6), el: 0.3, az: -0.42, dist: 38, shiftX: 0.2, shiftY: -0.02, fit: 0.9, portraitLift: 0.24, duration: 1.2, ease: "power2.inOut" }, 9.5);
  tl.to(fx, { focusRange: 5, duration: 1 }, 9.6);
  tl.to(glow, { partLabels: 1, duration: 0.01 }, 10.25);
  tl.fromTo(ui.sampleCopy, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, 10.3);

  // close, press the crown, flood
  tl.to(glow, { partLabels: 0, duration: 0.01 }, 10.9);
  tl.to(ui.sampleCopy, { autoAlpha: 0, y: -20, duration: 0.5, ease: "power1.in" }, 10.85);
  tl.to(kb.split, { hour: 0, minute: 0, second: 0, jewel: 0, duration: 0.6, ease: "power3.inOut" }, 10.95);
  tl.to(kb.explode, { crystal: 0, duration: 0.7, ease: "power3.inOut" }, 11.0);
  tl.to(crown, { v: 0.5, duration: 0.15, ease: "power2.in" }, 11.5);
  tl.to(glow, { wave: 1, duration: 0.45, ease: "none" }, 11.5);
  tl.to(jewel, { v: 1.2, duration: 0.45 }, 11.5);
  tl.to(stage.pose, { rx: 1.1, duration: 1.05, ease: "power2.inOut" }, 10.95);
  tl.to(cam, { tx: 0, ty: at(3.4), tz: 1.4, az: -0.06, el: 0.2, dist: 78, fit: 0.5, shiftX: 0.2, shiftY: 0.02, portraitLift: -0.26, parallax: 1, duration: 1.05, ease: "power2.inOut" }, 10.95);
  tl.to(fx, { bokeh: 0.8, focusRange: 14, duration: 1.0 }, 10.95);
  tl.to(stage, { tilt: 1, duration: 1.0 }, 10.95);
  tl.fromTo(ui.final, { autoAlpha: 0, y: 30, filter: "blur(10px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, 11.55);

  /* ------------------------------------------------- progress + per frame */

  let target = 0;
  let current = 0;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const readScroll = () => {
    const max = maxScroll();
    target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };
  addEventListener("scroll", readScroll, { passive: true, signal });
  addEventListener("resize", readScroll, { signal });
  readScroll();

  // nav jumps glide the timeline to a section (through everything in
  // between) rather than snapping; any scroll input takes over again
  const glide = { p: 0, active: false };
  const release = () => {
    if (!glide.active) return;
    gsap.killTweensOf(glide);
    glide.active = false;
  };
  for (const type of ["wheel", "touchstart", "keydown"]) addEventListener(type, release, { passive: true, signal });

  function goTo(p: number) {
    gsap.killTweensOf(glide);
    Object.assign(glide, { p: current, active: true });
    gsap.to(glide, {
      p,
      duration: 0.9 + Math.abs(p - current) * 2.2,
      ease: "power2.inOut",
      onComplete: () => {
        glide.active = false;
      },
    });
    target = p;
    scrollTo({ top: p * maxScroll(), behavior: "instant" });
  }

  const shownSteps = new Array<string>(steps.length).fill("");

  function update(dt: number) {
    if (glide.active) current = glide.p;
    else current += (target - current) * (1 - Math.exp(-dt * 5));
    if (Math.abs(target - current) < 1e-5) current = target;
    tl.progress(current);

    kb.look.jewelBase = jewel.v;
    kb.look.crown = crown.v;
    kb.look.stepBase = 0.3;
    for (const name of LAYER_ORDER) {
      kb.layerFx[name].dy = 0;
      kb.layerFx[name].spin = 0;
      kb.layerFx[name].visible = true;
    }

    // the flood: a ring of light runs out from the centre across the markers and jewels
    const waveR = glow.wave * 40;
    const crest = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      return Math.max(0, Math.min(1, (waveR - d) / 4)) * Math.exp(-Math.max(0, waveR - d) / 6);
    };
    for (let i = 0; i < JEWELS.length; i++) {
      kb.jewels[i].led = 1;
      kb.jewels[i].glow = crest(JEWELS[i].x, JEWELS[i].z) * 2.4;
    }
    for (let i = 0; i < MARKERS.length; i++) {
      kb.markers[i].glow = MARKER_REST + crest(MARKERS[i].x, MARKERS[i].z) * 2.4;
    }

    // process steps: the marker (and list item) for the step being shown lights up and dips
    STEP_MARKERS.forEach((mi, j) => {
      const bump = smooth(0.65, 0.2, Math.abs(glow.step - j));
      kb.markers[mi].glow += bump * 2.4;
      const v = (0.35 + 0.65 * bump).toFixed(2);
      if (shownSteps[j] !== v && steps[j]) {
        shownSteps[j] = v;
        steps[j].style.setProperty("--on", v);
      }
    });

    // the hour hand steps 12 → 3 → 6 → 9; the minute hand stays on 12
    const s = Math.min(3, Math.max(0, glow.step));
    const whole = Math.floor(s);
    kb.hands.hour = ((whole + smooth(0.3, 0.7, s - whole)) * Math.PI) / 2;
    kb.hands.minute = 0;
    stage.focusOverride = kb.split.jewel > SPLIT.jewel * 0.5 ? "hands" : null;
  }

  function pin(p: number) {
    release();
    target = current = p;
    tl.progress(p);
  }

  const isSettled = () => !glide.active && Math.abs(target - current) < 1e-4;

  function dispose() {
    gsap.killTweensOf(glide);
    tl.kill();
  }

  return { tl, update, pin, goTo, isSettled, glow, progress: () => current, dispose };
}

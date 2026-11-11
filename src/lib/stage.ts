import * as THREE from "three";
import { createSurfaces, createStudioEnvironment } from "./textures";
import { createClock } from "./clock";
import { createRig } from "./rig";
import { createPost } from "./post";
import { createPreloader } from "./preloader";
import { createScroll, type Scroll } from "./scroll";
import { createLabels } from "./labels";
import { createHover } from "./hover";
import { SECTIONS, sectionAt, isSection, type SectionName, type UiRefs } from "./ui";

// values the timelines tween; the frame loop reads them
// tilt: how much the clock leans toward the cursor (0 in the preloader);
// hover: the hour markers rise under the cursor (hero only);
// light: a dimmer on the studio lights (the preloader starts inside, in the dark);
// rim: the back light alone; rake: the same light swung round low across the plate
export interface Stage {
  desk: number;
  idle: number;
  shadow: number;
  tilt: number;
  hover: number;
  light: number;
  rim: number;
  rake: number;
  pose: { y: number; rx: number; ry: number; rz: number };
  focusOverride: "hands" | null;
}

// every face the page uses, loaded before anything is drawn. A face that
// fails (or is slow) must never hold the page up: fall back after a moment.
const FONTS = ['400 1em "Instrument Sans"', '500 1em "Instrument Sans"', '600 1em "Instrument Sans"', 'italic 400 1em "Newsreader"', '500 1em "Newsreader"'];
const loadFonts = () =>
  Promise.race([
    Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => []))),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

export interface Experience {
  goToSection: (name: string) => void;
  dispose: () => void;
}

export async function startExperience({
  canvas,
  ui,
  onSection,
  cancelled,
}: {
  canvas: HTMLCanvasElement;
  ui: UiRefs;
  onSection: (name: SectionName | null) => void;
  // the caller gave up while the fonts loaded (React StrictMode's first mount)
  cancelled: AbortSignal;
}): Promise<Experience | null> {
  await loadFonts();
  if (cancelled.aborted) return null;
  const abort = new AbortController();
  const { signal } = abort;

  history.scrollRestoration = "manual";
  scrollTo(0, 0);

  // DEV stills: ?t=2.1 pins the preloader, ?p=0.35 pins the scroll timeline,
  // both with the clock stopped (for comparing screenshots)
  const params = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams();
  const FROZEN = params.has("t") || params.has("p");
  // frozen stills show a fixed time (10:09:36), otherwise the viewer's own
  const FROZEN_TIME = new Date(2026, 0, 1, 10, 9, 36).getTime();

  /* ----------------------------------------------------------- renderer */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    depth: false,
    // let dual-GPU Macs stay on the integrated GPU
    powerPreference: "default",
  });
  // resolution: capped at 1.25x, and lowered further (to 0.8x) on machines that
  // can't hold the frame rate; see adaptResolution
  const DPR_CAP = Math.min(devicePixelRatio, 1.25);
  let dprScale = 1;
  renderer.setPixelRatio(DPR_CAP);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const env = createStudioEnvironment(renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.3, 400);

  /* -------------------------------------------------------------- stage */

  const kb = createClock(createSurfaces(renderer));
  scene.add(kb.root);

  // matte only: a specular desk sheens grey at grazing angles
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x1c1815 });
  const deskColor = deskMat.color.clone();
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), deskMat);
  desk.receiveShadow = true;
  scene.add(desk);

  const keyLight = new THREE.SpotLight(0xfff0e2, 1.9, 0, 0.42, 1, 0);
  keyLight.position.set(-8, 36, 20);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 15;
  keyLight.shadow.camera.far = 90;
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.radius = 4;
  scene.add(keyLight, keyLight.target);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  const RIM_HOME = new THREE.Vector3(5, 10, -26);
  const RAKE_DIR = new THREE.Vector3(14, 1.7, 8); // low from the front right
  rim.position.copy(RIM_HOME);
  scene.add(rim);

  const stage: Stage = { desk: 0, idle: 0, shadow: 1, tilt: 0, hover: 0, light: 1, rim: 1, rake: 0, pose: { y: 0, rx: 0, ry: 0, rz: 0 }, focusOverride: null };

  // the middle of the dial, in the clock's own frame, for focus pulls
  const dialFocus = new THREE.Vector3(0, 3.4, 0);
  const focusTmp = new THREE.Vector3();

  const rig = createRig(signal);
  // a light spring toward the cursor, so the lean overshoots a touch and settles
  const lean = { x: 0, y: 0, vx: 0, vy: 0 };
  function springLean(dt: number) {
    const h = Math.min(dt, 1 / 30);
    lean.vx += ((rig.pointer.x - lean.x) * 38 - lean.vx * 8.5) * h;
    lean.vy += ((rig.pointer.y - lean.y) * 38 - lean.vy * 8.5) * h;
    lean.x += lean.vx * h;
    lean.y += lean.vy * h;
  }

  const post = createPost(renderer, scene, camera);
  const labels = createLabels({ clock: kb, camera, root: ui.labels });
  const hover = createHover({ clock: kb, camera, signal });

  let W = 0;
  let H = 0;
  function resize() {
    W = innerWidth;
    H = innerHeight;
    renderer.setSize(W, H, false);
    post.composer.setSize(W, H, false);
  }
  addEventListener("resize", resize, { signal });
  resize();

  /* ----------------------------------------------------------- sequence */

  let scroll: Scroll | null = null;
  const preloader = createPreloader({ kb, rig, post, stage, ui, onDone: finishPreloader });

  function finishPreloader() {
    if (scroll) return;
    preloader.tl.pause();
    preloader.update();
    document.body.classList.remove("is-locked");
    scroll = createScroll({ kb, rig, post, stage, ui, signal });
  }

  function skipPreloader() {
    if (scroll) return;
    preloader.tl.seek(preloader.end);
    finishPreloader();
  }

  // nav: glide to a section (skipping the preloader if it's still running) and
  // keep the address shareable
  function goToSection(name: string) {
    if (!isSection(name)) return;
    skipPreloader();
    scroll!.goTo(SECTIONS[name]);
    history.replaceState(null, "", name === "overview" ? location.pathname : `#${name}`);
  }
  let activeSection: SectionName | null | undefined;
  function markSection() {
    const name = scroll ? sectionAt(scroll.progress()) : "overview";
    if (name === activeSection) return;
    activeSection = name;
    onSection(name);
  }

  // scrolling (or swiping, or paging) during the preloader is a request to get on with it
  const impatient = () => preloader.tl.time() > 1 && skipPreloader();
  addEventListener("wheel", (e) => e.deltaY > 30 && impatient(), { passive: true, signal });
  addEventListener("touchmove", impatient, { passive: true, signal });
  addEventListener("keydown", (e) => ["ArrowDown", "PageDown", " ", "Escape"].includes(e.key) && impatient(), { signal });

  /* --------------------------------------------------------------- loop */

  let last = performance.now();
  let frames = 0;

  function frame(now = performance.now()) {
    const dt = FROZEN ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const t = FROZEN ? 0 : now / 1000;

    if (scroll) scroll.update(dt);
    else {
      preloader.advance(dt);
      preloader.update();
    }
    markSection();

    const idle = stage.idle;
    springLean(dt);
    const tilt = stage.tilt;
    kb.root.position.y = stage.pose.y + Math.sin(t * 0.9) * 0.16 * idle - lean.y * 0.3 * tilt;
    kb.root.rotation.set(
      stage.pose.rx + Math.sin(t * 0.7 + 1) * 0.012 * idle + lean.y * 0.05 * tilt,
      stage.pose.ry + Math.sin(t * 0.45) * 0.02 * idle + lean.x * 0.1 * tilt,
      stage.pose.rz + Math.sin(t * 0.55) * 0.012 * idle - lean.x * 0.03 * tilt,
    );
    kb.root.updateMatrixWorld();
    hover.update(dt, stage.hover);
    kb.update(dt, FROZEN ? FROZEN_TIME : Date.now());

    deskMat.color.copy(deskColor).multiplyScalar(stage.desk);
    desk.visible = stage.desk > 0.002;
    keyLight.target.position.set(0, kb.root.position.y, 0);
    keyLight.shadow.intensity = stage.shadow;
    keyLight.intensity = 1.9 * stage.light;
    rim.position.lerpVectors(RIM_HOME, RAKE_DIR, stage.rake);
    rim.intensity = THREE.MathUtils.lerp(0.9 * stage.light * stage.rim, 0.9, stage.rake);
    scene.environmentIntensity = 0.45 * (0.25 + 0.75 * stage.light);

    rig.apply(camera, W, H, dt);
    // labels project through the camera before the render would update it
    camera.updateMatrixWorld();
    kb.body.updateMatrixWorld(true);
    if (stage.focusOverride === "hands") kb.part("minute", post.focusTarget);
    else post.focusTarget.lerpVectors(rig.target, kb.body.localToWorld(focusTmp.copy(dialFocus)), post.fx.focusRow);
    post.apply();

    labels.update(W, H, scroll?.glow);
    post.composer.render(dt);
    if (import.meta.env.DEV) (window as unknown as { __frames: number }).__frames = ++frames;
  }

  renderer.compile(scene, camera);

  // Watch real frame intervals while rendering at full rate: sustained slow
  // frames step the resolution down, sustained fast ones step it back up.
  let slowFor = 0;
  let fastFor = 0;
  function adaptResolution(interval: number) {
    if (interval > 1 / 40) slowFor += interval;
    else slowFor = Math.max(0, slowFor - interval * 0.5);
    if (interval < 1 / 57) fastFor += interval;
    else fastFor = 0;
    let next = dprScale;
    if (slowFor > 1) next = Math.max(0.8 / DPR_CAP, dprScale - 0.12);
    else if (fastFor > 4) next = Math.min(1, dprScale + 0.06);
    if (next !== dprScale) {
      dprScale = next;
      slowFor = fastFor = 0;
      renderer.setPixelRatio(DPR_CAP * dprScale);
      post.composer.setSize(W, H, false);
    }
  }

  // When nothing is moving (no scroll in flight, cursor still), render at
  // 30 fps: the idle float doesn't need 60, and the GPU gets half the work.
  let lastInput = performance.now();
  for (const type of ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"]) {
    addEventListener(type, () => (lastInput = performance.now()), { passive: true, signal });
  }
  let tick = 0;
  let lastLoop = 0;
  function loop(now: number) {
    const resting = scroll !== null && scroll.isSettled() && now - lastInput > 1500;
    if (resting && tick++ % 2) return;
    // (not during the preloader: reallocating the buffers would hitch the flight)
    if (!resting && lastLoop && scroll && !FROZEN) adaptResolution((now - lastLoop) / 1000);
    lastLoop = resting ? 0 : now;
    frame(now);
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setAnimationLoop(loop);
  // DEV: let a test freeze the loop after a frame, so screenshots don't queue behind slow software rendering
  if (import.meta.env.DEV) (window as unknown as { __stop: () => void }).__stop = () => renderer.setAnimationLoop(null);

  const hash = location.hash.slice(1);
  if (params.has("t")) {
    preloader.tl.seek(Number(params.get("t")));
  } else if (params.has("p")) {
    skipPreloader();
    scroll!.pin(Number(params.get("p")));
  } else if (isSection(hash) && hash !== "overview") {
    // arriving on a section link: skip the preloader and land there
    skipPreloader();
    const p = SECTIONS[hash];
    scrollTo({ top: p * (document.documentElement.scrollHeight - innerHeight), behavior: "instant" });
    scroll!.pin(p);
  } else if (reduced) skipPreloader();
  else preloader.play();

  return {
    goToSection,
    dispose() {
      abort.abort();
      renderer.setAnimationLoop(null);
      preloader.tl.kill();
      (scroll as Scroll | null)?.dispose();
      post.composer.dispose();
      kb.dispose();
      env.dispose();
      deskMat.dispose();
      desk.geometry.dispose();
      renderer.dispose();
    },
  };
}

import * as THREE from "three";
import { MARKERS } from "./layout";
import { LAYERS, type Clock } from "./clock";

// In the hero, the hour markers rise a little under the cursor (their
// neighbours a touch) on a springy settle, and the lume under them brightens.
// Picking is analytic: the pointer ray meets the plane of the dial in the
// clock's own frame, and the hit is matched against each marker.
export function createHover({ clock, camera, signal }: { clock: Clock; camera: THREE.Camera; signal: AbortSignal }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const inv = new THREE.Matrix4();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const dial = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LAYERS.dial.y + 0.2));
  const springs = MARKERS.map(() => ({ x: 0, v: 0 }));
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  let px = 0;
  let py = 0;
  let inside = false;
  addEventListener(
    "pointermove",
    (e) => {
      px = (e.clientX / innerWidth) * 2 - 1;
      py = -((e.clientY / innerHeight) * 2 - 1);
      inside = true;
    },
    { signal },
  );
  document.documentElement.addEventListener("pointerleave", () => (inside = false), { signal });
  // a finger lifting off shouldn't leave a marker raised
  addEventListener("pointerup", (e) => e.pointerType !== "mouse" && (inside = false), { signal });

  // weight: 1 in the hero, 0 elsewhere
  function update(dt: number, weight: number) {
    let hx = Infinity;
    let hz = Infinity;
    if (weight > 0.01 && inside) {
      ndc.set(px, py);
      raycaster.setFromCamera(ndc, camera);
      inv.copy(clock.body.matrixWorld).invert();
      ray.copy(raycaster.ray).applyMatrix4(inv);
      if (ray.intersectPlane(dial, hit)) {
        hx = hit.x;
        hz = hit.z;
      }
    }
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < MARKERS.length; i++) {
      const mk = MARKERS[i];
      const out = Math.max(0, Math.hypot(hx - mk.x, hz - mk.z) - 1.1);
      const target = (out === 0 ? 1 : 0.35 * (1 - smooth(0, 2.4, out))) * weight;
      // a spring a little under critical damping: it overshoots, then settles
      const s = springs[i];
      s.v += ((target - s.x) * 190 - s.v * 19) * h;
      s.x += s.v * h;
      const st = clock.markers[i];
      st.hover = s.x;
      st.glow += Math.max(0, s.x) * 0.9;
    }
  }

  return { update };
}

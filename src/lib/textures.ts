import * as THREE from "three";
import { R_DIAL } from "./layout";

// Everything here is drawn in code: no hosted images, nothing to download.

export interface Surfaces {
  dial: THREE.CanvasTexture;
  plate: THREE.CanvasTexture;
  pad: THREE.CanvasTexture;
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return { c, g: c.getContext("2d")! };
}

// letter-spaced text, drawn glyph by glyph (ctx.letterSpacing isn't everywhere)
function spaced(g: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number) {
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    g.fillText(ch, x, y);
    x += widths[i] + gap;
  });
}

// The dial, seen from above: canvas top = 12 o'clock, right = 3 o'clock.
function dialTexture(aniso: number) {
  const S = 2048;
  const { c, g } = canvas(S);
  const mid = S / 2;
  const px = S / (R_DIAL * 2); // pixels per cm
  g.fillStyle = "#0a0908";
  g.fillRect(0, 0, S, S);
  const bg = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
  bg.addColorStop(0, "#1c1a17");
  bg.addColorStop(0.65, "#131210");
  bg.addColorStop(1, "#0b0a09");
  g.fillStyle = bg;
  g.beginPath();
  g.arc(mid, mid, mid, 0, Math.PI * 2);
  g.fill();
  // fine concentric brushing
  for (let r = 8, i = 0; r < mid; r += 4, i++) {
    g.strokeStyle = `rgba(255, 238, 210, ${i % 2 ? 0.035 : 0.012})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(mid, mid, r, 0, Math.PI * 2);
    g.stroke();
  }
  // gold chapter rings
  for (const [r, w, a] of [
    [11.95, 0.05, 0.75],
    [8.6, 0.025, 0.32],
  ] as const) {
    g.strokeStyle = `rgba(201, 169, 106, ${a})`;
    g.lineWidth = w * px;
    g.beginPath();
    g.arc(mid, mid, r * px, 0, Math.PI * 2);
    g.stroke();
  }
  // the name, at 6 o'clock; a line of script at 12
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(242, 237, 228, 0.88)";
  g.font = `600 ${0.62 * px}px "Instrument Sans", system-ui, sans-serif`;
  spaced(g, "FAVOUR EGBUNG", mid, mid + 5.0 * px, 0.34 * px);
  g.fillStyle = "rgba(201, 169, 106, 0.9)";
  g.font = `500 ${0.4 * px}px "Instrument Sans", system-ui, sans-serif`;
  spaced(g, "EXECUTIVE ASSISTANT", mid, mid + 5.95 * px, 0.28 * px);
  g.fillStyle = "rgba(242, 237, 228, 0.7)";
  g.font = `italic 500 ${0.8 * px}px "Newsreader", Georgia, serif`;
  g.textAlign = "center";
  g.fillText("time, assembled", mid, mid - 4.6 * px);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

// Côtes de Genève: straight stripes, each lit across its width
function plateTexture(aniso: number) {
  const S = 1024;
  const { c, g } = canvas(S);
  const w = 9;
  for (let x = 0; x < S; x += w) {
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#1f1c18");
    grad.addColorStop(0.5, "#4d463c");
    grad.addColorStop(1, "#211e19");
    g.fillStyle = grad;
    g.fillRect(x, 0, w, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

// the pool of light a lit jewel or marker throws
function padTexture() {
  const { c, g } = canvas(256);
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.3, "rgba(255,255,255,0.5)");
  rg.addColorStop(0.65, "rgba(255,255,255,0.12)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSurfaces(renderer: THREE.WebGLRenderer): Surfaces {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return { dial: dialTexture(aniso), plate: plateTexture(aniso), pad: padTexture() };
}

/* ------------------------------------------------------------ studio env */

// A black room with a few softboxes, so the polished gold and the glass catch
// crisp product-shot highlights rather than a grey wash.
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const box = (w: number, h: number, color: number, intensity: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  box(7, 3, 0xfff4e8, 3.2, [0, 8, -3], [0, 0, 0]);
  box(14, 1.6, 0xffffff, 2.2, [0, 6.5, -10], [0, 0, 0]);
  box(14, 0.8, 0xffffff, 0.7, [0, 2.2, -10], [0, 0, 0]);
  box(2.2, 6, 0xdde6ff, 1.4, [-10, 3, 3], [0, 0, 0]);
  box(2.5, 4, 0xffb35a, 1.3, [10, 2, -1], [0, 0, 0]);
  box(10, 1, 0xffffff, 0.6, [0, 1.5, 11], [0, 0, 0]);
  // a dim warm bounce from below, so nothing falls to pure black
  box(40, 40, 0x2a1d14, 0.35, [0, -8, 0], [0, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return env;
}

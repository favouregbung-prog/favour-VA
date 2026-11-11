// The DOM the 3D experience drives: React renders it, the timelines fade and
// move it (see preloader.ts, scroll.ts) and the labels follow the model.
export interface UiRefs {
  veil: HTMLElement;
  nav: HTMLElement;
  hero: HTMLElement;
  scrollCue: HTMLElement;
  inside: HTMLElement;
  processCopy: HTMLElement;
  sampleCopy: HTMLElement;
  final: HTMLElement;
  labels: HTMLElement;
}

// Where each nav link lands on the scroll timeline (progress 0-1): the hero,
// the split layers with their callouts, the four process steps lighting up,
// and the hands coming apart beside the sample work.
export const SECTIONS = { overview: 0, services: 0.34, process: 0.57, sample: 0.88 } as const;
export type SectionName = keyof typeof SECTIONS;
export const sectionAt = (p: number): SectionName | null =>
  p < 0.17 ? "overview" : p < 0.46 ? "services" : p < 0.72 ? "process" : p < 0.95 ? "sample" : null;
export const isSection = (name: string): name is SectionName => name in SECTIONS;

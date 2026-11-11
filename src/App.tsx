import { useEffect, useRef, useState } from "react";
import type { Experience } from "./lib/stage";
import type { SectionName } from "./lib/ui";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Panel, StepList, SampleList } from "./components/Panel";
import { Labels } from "./components/Labels";
import { Final } from "./components/Final";
import styles from "./App.module.css";

const INSIDE = {
  eyebrow: "Services",
  title: (
    <>
      Seven services. <br />
      One quiet <em>backend.</em>
    </>
  ),
  body: "Each layer is something you stop doing yourself. Built on Google Workspace, Notion, Trello and AI tools.",
};
const PROCESS = {
  eyebrow: "The process",
  title: (
    <>
      Four steps from <br />
      hello to <em>handled.</em>
    </>
  ),
};
const SAMPLE = {
  eyebrow: "Sample work",
  title: (
    <>
      A sample Monday <br />
      for <em>a busy CEO.</em>
    </>
  ),
};

// The page is one fixed WebGL canvas (the clock) under one fixed layer of
// copy; a tall empty <main> gives the scroll that drives both (src/lib/scroll.ts).
export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const hero = useRef<HTMLElement>(null);
  const cue = useRef<HTMLSpanElement>(null);
  const inside = useRef<HTMLElement>(null);
  const process = useRef<HTMLElement>(null);
  const sample = useRef<HTMLElement>(null);
  const final = useRef<HTMLElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const experience = useRef<Experience | null>(null);
  const [active, setActive] = useState<SectionName | null>("overview");

  const go = (name: SectionName) => experience.current?.goToSection(name);

  useEffect(() => {
    const cancelled = new AbortController();
    // three.js and the post-processing load in their own chunk
    import("./lib/stage")
      .then(({ startExperience }) =>
        startExperience({
          canvas: canvas.current!,
          ui: {
            veil: veil.current!,
            nav: nav.current!,
            hero: hero.current!,
            scrollCue: cue.current!,
            inside: inside.current!,
            processCopy: process.current!,
            sampleCopy: sample.current!,
            final: final.current!,
            labels: labels.current!,
          },
          onSection: setActive,
          cancelled: cancelled.signal,
        }),
      )
      .then((exp) => {
        if (cancelled.signal.aborted) exp?.dispose();
        else experience.current = exp;
      })
      .catch(() => {
        // no WebGL, or the 3D chunk failed to load: show the hero and its booking link
        if (cancelled.signal.aborted) return;
        document.body.classList.remove("is-locked");
        veil.current!.style.display = "none";
        for (const el of [nav.current!, hero.current!]) el.style.cssText += ";opacity:1;visibility:visible";
      });
    return () => {
      cancelled.abort();
      experience.current?.dispose();
      experience.current = null;
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className={styles.gl} aria-hidden="true" />
      <main className={styles.ui} aria-label="Favour Egbung">
        <div ref={veil} className={styles.veil} />
        <Nav ref={nav} active={active} onGo={go} />
        <Hero ref={hero} cueRef={cue} onGo={go} />
        <Panel ref={inside} place="inside" {...INSIDE} />
        <Panel ref={process} place="process" {...PROCESS}>
          <StepList />
        </Panel>
        <Labels ref={labels} />
        <Panel ref={sample} place="sample" {...SAMPLE}>
          <SampleList />
        </Panel>
        <Final ref={final} onGo={go} />
      </main>
      <div className={styles.scroll} aria-hidden="true" />
    </>
  );
}

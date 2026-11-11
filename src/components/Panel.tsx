import type { ReactNode, Ref } from "react";
import styles from "./Panel.module.css";

export function Panel({
  ref,
  place,
  eyebrow,
  title,
  body,
  children,
}: {
  ref: Ref<HTMLElement>;
  place: "inside" | "process" | "sample";
  eyebrow: string;
  title: ReactNode;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section ref={ref} className={`${styles.panel} ${styles[`at-${place}`]}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      {body ? <p className={styles.body}>{body}</p> : null}
      {children}
    </section>
  );
}

// The four steps of a new engagement. scroll.ts sets --on on each item
// (data-step) so the one the clock is showing reads brightest.
const STEPS = [
  ["01", "Discovery call", "We find the bottleneck, your tools and the scope."],
  ["02", "Proposal", "Your pain points matched to a clear package."],
  ["03", "Agreement", "A contract and first invoice, so we start clean."],
  ["04", "Onboarding", "Welcome packet, safe access, kickoff call."],
] as const;

export function StepList() {
  return (
    <ol className={styles.steps}>
      {STEPS.map(([n, t, d], i) => (
        <li key={n} data-step={i}>
          <b>
            <i>{n}</i> {t}
          </b>
          <span>{d}</span>
        </li>
      ))}
    </ol>
  );
}

// Illustrative only: swap for real work as soon as there is some.
const SAMPLE = [
  ["07:30", "Inbox triaged, three replies drafted"],
  ["09:00", "Calendar cleared for deep work"],
  ["11:30", "Board brief ready to read"],
  ["16:00", "Tomorrow's travel booked"],
] as const;

export function SampleList() {
  return (
    <>
      <ul className={styles.sample}>
        {SAMPLE.map(([t, d]) => (
          <li key={t}>
            <b>{t}</b>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <p className={styles.fine}>Illustrative sample, not a client engagement.</p>
    </>
  );
}

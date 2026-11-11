import type { Ref } from "react";
import styles from "./Labels.module.css";

// Callouts the 3D loop pins to the model (src/lib/labels.ts positions them).
const LAYERS = [
  ["crystal", "Social media & content", "Planned, written and scheduled in your voice"],
  ["hands", "Calendar & travel", "Your time protected, trips booked"],
  ["dial", "Inbox & communication", "Triage, drafts, follow-ups"],
  ["gears", "Projects & tasks", "Trello and Notion, kept moving"],
  ["plate", "Systems & SOPs", "Your processes, written down once"],
  ["barrel", "Research & reporting", "Briefs you can read in two minutes"],
  ["base", "Admin & data", "Docs, records and CRM upkeep"],
] as const;

const PARTS = [
  ["hour", "Hour hand", "Calendar, travel & meetings"],
  ["minute", "Minute hand", "Inbox & follow-ups"],
  ["second", "Second hand", "Fast, predictable replies"],
  ["jewel", "The jewel", "The detail work nobody sees"],
] as const;

export function Labels({ ref }: { ref: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref}>
      {LAYERS.map(([id, title, note]) => (
        <div key={id} className={`${styles.label} ${styles.left}`} data-layer={id}>
          <div className={styles.box}>
            <b>{title}</b>
            <span>{note}</span>
          </div>
        </div>
      ))}
      {PARTS.map(([id, title, note]) => (
        <div key={id} className={`${styles.label} ${styles.right}`} data-part={id}>
          <div className={styles.box}>
            <b>{title}</b>
            <span>{note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

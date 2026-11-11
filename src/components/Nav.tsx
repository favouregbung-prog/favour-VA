import type { MouseEvent, Ref } from "react";
import type { SectionName } from "../lib/ui";
import { BOOKING_URL } from "../lib/links";
import { Button } from "./Button";
import styles from "./Nav.module.css";

const LINKS: { name: SectionName; label: string }[] = [
  { name: "overview", label: "Overview" },
  { name: "services", label: "Services" },
  { name: "process", label: "Process" },
  { name: "sample", label: "Sample work" },
];

export function Nav({ ref, active, onGo }: { ref: Ref<HTMLElement>; active: SectionName | null; onGo: (name: SectionName) => void }) {
  const go = (name: SectionName) => (e: MouseEvent) => {
    e.preventDefault();
    onGo(name);
  };
  return (
    <nav ref={ref} className={styles.nav}>
      <a className={styles.logo} href="#overview" onClick={go("overview")}>
        <span>Favour</span> Egbung
      </a>
      <div className={styles.links}>
        {LINKS.map((l) => (
          <a key={l.name} href={`#${l.name}`} className={styles.link} aria-current={active === l.name ? "true" : undefined} onClick={go(l.name)}>
            {l.label}
          </a>
        ))}
      </div>
      <Button small external href={BOOKING_URL}>
        Book a call
      </Button>
    </nav>
  );
}

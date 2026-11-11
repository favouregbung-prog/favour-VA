import type { Ref } from "react";
import type { SectionName } from "../lib/ui";
import { BOOKING_URL } from "../lib/links";
import { Button } from "./Button";
import styles from "./Final.module.css";

export function Final({ ref, onGo }: { ref: Ref<HTMLElement>; onGo: (name: SectionName) => void }) {
  return (
    <section ref={ref} className={styles.final}>
      <h2 className={styles.title}>
        Take back <br />
        <em>your hours.</em>
      </h2>
      <p className={styles.closer}>Executive and virtual assistant for founders and CEOs, with social media built in. HubSpot Academy certified.</p>
      <div className={styles.buttons}>
        <Button external href={BOOKING_URL}>
          Book a discovery call
        </Button>
        <Button
          ghost
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onGo("overview");
          }}
        >
          Back to the start
        </Button>
      </div>
      <p className={styles.note}>Rates are shared on the discovery call.</p>
      <small className={styles.footnote}>© 2026 Favour Egbung</small>
    </section>
  );
}

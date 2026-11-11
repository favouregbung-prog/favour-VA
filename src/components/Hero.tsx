import type { Ref } from "react";
import type { SectionName } from "../lib/ui";
import { BOOKING_URL } from "../lib/links";
import { Button } from "./Button";
import styles from "./Hero.module.css";

export function Hero({ ref, cueRef, onGo }: { ref: Ref<HTMLElement>; cueRef: Ref<HTMLSpanElement>; onGo: (name: SectionName) => void }) {
  return (
    <header ref={ref} className={styles.hero}>
      <p className={styles.eyebrow}>Executive assistant · Virtual assistant</p>
      <h1 className={styles.title}>
        Your time, <br />
        <em>assembled.</em>
      </h1>
      <p className={styles.lede}>
        I help busy CEOs focus on scaling their business by running the backend: calendar, inbox, projects and social media, built into one quiet
        system.
      </p>
      <div className={styles.buttons}>
        <Button external href={BOOKING_URL}>
          Book a discovery call
        </Button>
        <Button
          ghost
          href="#services"
          onClick={(e) => {
            e.preventDefault();
            onGo("services");
          }}
        >
          See what I run
        </Button>
      </div>
      <span ref={cueRef} className={styles.cue}>
        Scroll to take it apart <span className={styles.arrow}>↓</span>
      </span>
    </header>
  );
}

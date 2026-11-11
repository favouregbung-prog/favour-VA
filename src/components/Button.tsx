import type { MouseEvent, ReactNode } from "react";
import styles from "./Button.module.css";

export function Button({
  href = "#",
  small,
  ghost,
  external,
  onClick,
  children,
}: {
  href?: string;
  small?: boolean;
  ghost?: boolean;
  external?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  const cls = [styles.button, small && styles.small, ghost && styles.ghost].filter(Boolean).join(" ");
  return (
    <a className={cls} href={href} onClick={onClick} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

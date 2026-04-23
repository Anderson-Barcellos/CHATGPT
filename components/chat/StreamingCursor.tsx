"use client";

import styles from "./StreamingCursor.module.css";

export function StreamingCursor() {
  return (
    <span aria-hidden="true" data-streaming-cursor="true" className={styles.cursor}>
      <span className={styles.ring}>
        <span className={styles.ringInner} />
      </span>
      <span className={styles.bar} />
    </span>
  );
}

import React from "react";

import styles from "./styles.module.css";

/**
 * Page-level deprecation banner, pinned to the top of the deprecated pages.
 * Deliberately louder than an admonition warning: solid orange background
 * and a bold uppercase title, so a reader cannot scroll past it.
 */
export default function DeprecatedBanner({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <div className={styles.banner} role="alert">
      <p className={styles.title}>{title}</p>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

import React, { type ReactNode } from "react";
import clsx from "clsx";

import type { Props } from "@theme/NotFound/Content";
import Heading from "@theme/Heading";
import Translate from "@docusaurus/Translate";
import Link from "@docusaurus/Link";

import styles from "./styles.module.css";

export default function NotFoundContent({
  className,
}: Readonly<Props>): ReactNode {
  return (
    <main className={clsx("container margin-vert--xl", className)}>
      <div className={clsx("row", styles.wrapper)}>
        <div className={clsx("col col--8", styles.content)}>
          <Heading as="h1" className={styles.title}>
            <Translate
              id="theme.NotFound.title"
              description="The title of the 404 page"
            >
              404: Page not found
            </Translate>
          </Heading>
          <p className={styles.subtitle}>
            <Translate
              id="theme.NotFound.p1"
              description="The first paragraph of the 404 page"
            >
              It seems that this page does not exist.
            </Translate>
          </p>
          <p className={styles.description}>
            <Translate
              id="theme.NotFound.p2"
              description="The 2nd paragraph of the 404 page"
            >
              Please inform the site owner of the broken link, or return to our
              home page.
            </Translate>
          </p>
          <Link className={styles.button} to="/">
            <Translate id="theme.NotFound.back">Back to home page</Translate>
          </Link>
        </div>
      </div>
    </main>
  );
}

import React from "react";
import TOCDesktop from "@theme-original/DocItem/TOC/Desktop";
import type TOCDesktopType from "@theme/DocItem/TOC/Desktop";
import type { WrapperProps } from "@docusaurus/types";
import { useDoc } from "@docusaurus/plugin-content-docs/client";

import PageFeedback from "@site/src/components/PageFeedback";

import styles from "./styles.module.css";

type Props = WrapperProps<typeof TOCDesktopType>;

export default function TOCDesktopWrapper(props: Props): React.ReactNode {
  const { frontMatter } = useDoc();
  // Opt-out per page via the `hide_feedback: true` frontmatter
  // (home, glossary, changelog…).
  const hideFeedback = (frontMatter as { hide_feedback?: boolean })
    .hide_feedback === true;

  // The container carries the sticky and scroll for BOTH blocks: see the
  // comment in styles.module.css.
  return (
    <div className={styles.tocColumn}>
      <TOCDesktop {...props} />
      {!hideFeedback && <PageFeedback />}
    </div>
  );
}

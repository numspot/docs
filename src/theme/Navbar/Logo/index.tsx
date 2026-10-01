import React, { type ReactNode } from "react";
import Logo from "@theme-original/Navbar/Logo";
import type LogoType from "@theme/Navbar/Logo";
import type { WrapperProps } from "@docusaurus/types";
import Translate from "@docusaurus/Translate";

type Props = WrapperProps<typeof LogoType>;

/**
 * Wrapper of the navbar logo (Brand Book 2026):
 * renders the configured wordmark then adds the tagline.
 * Replaces the old pseudo-element hack .navbar__logo::before/::after.
 * Tagline localized via <Translate> (key extracted to i18n/<locale>/code.json).
 */
export default function LogoWrapper(props: Props): ReactNode {
  return (
    <>
      <Logo {...props} />
      <span className="navbar__baseline">
        <Translate
          id="navbar.baseline"
          description="Baseline displayed next to the logo in the navbar"
        >
          Hybrid, sovereign and portable cloud services platform
        </Translate>
      </span>
    </>
  );
}

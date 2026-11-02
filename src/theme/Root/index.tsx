import React, { type ReactNode } from "react";

import ConsentBanner from "../../components/ConsentBanner";

/**
 * Root wrapper (site-wide swizzle): mounts the consent banner around the
 * whole app, on every page. The GA4 tag itself is loaded by the
 * src/client/analytics-consent.ts client module, only once consent is granted.
 */
export default function Root({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      {children}
      <ConsentBanner />
    </>
  );
}

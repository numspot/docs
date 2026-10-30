import React, { useEffect, useState } from "react";
import Translate, { translate } from "@docusaurus/Translate";

import styles from "./styles.module.css";

// Mirrors the constants of src/client/ga4-consent.ts, the contract owner:
// write the choice to localStorage, then dispatch the event the loader
// listens to (immediate tag load on grant, opt-out on withdrawal).
const CONSENT_KEY = "numspot.ga4.consent";
const CONSENT_EVENT = "numspot:ga4-consent";

interface ConsentEventDetail {
  granted: boolean;
}

// Cookie policy of numspot.com, which documents the audience measurement.
const COOKIE_POLICY_URL = "https://numspot.com/politique-cookies/";

type Consent = "granted" | "denied";

function readChoice(): Consent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    return null;
  }
}

export default function ConsentBanner(): React.ReactNode {
  const [choice, setChoice] = useState<Consent | null>(null);

  // Read after mount only: the banner is a browser-only concern and the
  // server render must not depend on storage.
  useEffect(() => {
    setChoice(readChoice());
  }, []);

  const decide = (granted: boolean): void => {
    try {
      window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    } catch {
      // Storage unavailable (private mode): the choice stays session-only
      // (React state) — the loader is wired through the event either way.
    }
    window.dispatchEvent(
      new CustomEvent<ConsentEventDetail>(CONSENT_EVENT, {
        detail: { granted },
      }),
    );
    setChoice(granted ? "granted" : "denied");
  };

  if (choice == null) {
    return (
      <aside className={styles.banner} aria-label={translate({
        id: "consent.aria",
        message: "Analytics cookies consent",
        description: "Accessible label of the consent banner",
      })}>
        <p className={styles.message}>
          <Translate
            id="consent.message"
            description="Consent banner message describing the audience-measurement cookie"
          >
            This site uses an audience-measurement cookie to improve the
            documentation. No data is collected without your consent.
          </Translate>{" "}
          <a
            className={styles.link}
            href={COOKIE_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Translate
              id="consent.learn_more"
              description="Link to the Numspot cookie policy shown in the consent banner"
            >
              Cookie policy
            </Translate>
          </a>
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => decide(false)}
          >
            <Translate id="consent.decline" description="Consent refusal button">
              Decline
            </Translate>
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => decide(true)}
          >
            <Translate id="consent.accept" description="Consent accept button">
              Accept
            </Translate>
          </button>
        </div>
      </aside>
    );
  }

  // Consent must stay revocable (CNIL): the pill reopens the banner.
  // Emoji-only on purpose (aria-label carries the accessible name) — the
  // span is aria-hidden so screen readers announce the label, not "cookie".
  return (
    <button
      type="button"
      className={styles.pill}
      aria-label={translate({
        id: "consent.reopen.aria",
        message: "Change your analytics cookies choice",
        description: "Accessible label of the reopen pill",
      })}
      onClick={() => setChoice(null)}
    >
      <span className={styles.pillEmoji} aria-hidden="true">
        🍪
      </span>
    </button>
  );
}

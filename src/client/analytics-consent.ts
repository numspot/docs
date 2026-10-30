/**
 * Consent-gated GA4 loader (decision D-030) — replaces the preset gtag
 * plugin, whose tag was injected unconditionally into every page <head>.
 *
 * Strict opt-in (CNIL posture): NOTHING leaves the browser before consent —
 * no gtag.js script, no preconnect to the Google hosts, no cookie, no event.
 * The tag loads only when the stored consent says "granted" (returning
 * visitor) or when the ConsentBanner dispatches the consent event; a refusal
 * never loads anything and withdraws a previously given consent.
 */

const MEASUREMENT_ID = "G-QG7XN3BDKR";

// Shared with the ConsentBanner, which WRITES the choice: it persists the
// consent to localStorage then dispatches this event, so an acceptance given
// mid-session loads the tag immediately (no reload needed). The loader is the
// contract owner — the banner mirrors these constants.
const CONSENT_KEY = "numspot.ga4.consent";
const CONSENT_EVENT = "numspot:ga4-consent";

interface ConsentEventDetail {
  granted: boolean;
}

type Gtag = (...args: unknown[]) => void;

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: Gtag;
}

/** Whether the visitor already consented on a previous visit. */
function readStoredConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    // Storage unavailable (private mode): no consent → no tag.
    return false;
  }
}

/** Expire the first-party GA cookies a previous consent had set. */
function clearGaCookies(): void {
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0]?.trim() ?? "";
    if (name === "_ga" || name.startsWith("_ga_")) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

/** Stop and prevent the tag (mid-session consent withdrawal). */
function optOut(): void {
  if (typeof window === "undefined") return;
  // Official GA4 opt-out flag: the loaded tag stops sending immediately.
  (window as unknown as Record<string, unknown>)[`ga-disable-${MEASUREMENT_ID}`] = true;
  if (typeof document !== "undefined") clearGaCookies();
}

/**
 * Inject the gtag.js tag + the same config the removed preset plugin used.
 * Idempotent: guarded by a marker attribute on the injected script.
 */
function loadGa4(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // Same activation scope as the removed plugin: production build only,
  // never `docusaurus start`.
  if (process.env.NODE_ENV !== "production") return;
  if (document.querySelector(`script[data-numspot-ga4="${MEASUREMENT_ID}"]`)) return;

  for (const href of [
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
  ]) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    document.head.appendChild(link);
  }

  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]): void {
    w.dataLayer.push(args);
  };
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.async = true;
  script.setAttribute("data-numspot-ga4", MEASUREMENT_ID);
  document.head.appendChild(script);

  w.gtag("js", new Date());
  w.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
}

interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
}

export default {
  // Same SPA pageview contract as the removed preset plugin's client module:
  // one page_view per ACTUAL route change (path, search or hash), deferred to
  // the next tick so react-helmet-async has updated the document title
  // (facebook/docusaurus#7420). Before consent gtag is absent: no-op.
  onRouteDidUpdate({ location, previousLocation }: {
    location: RouteLocation;
    previousLocation?: RouteLocation | null;
  }): void {
    if (
      !previousLocation ||
      (location.pathname === previousLocation.pathname &&
        location.search === previousLocation.search &&
        location.hash === previousLocation.hash)
    ) {
      return;
    }
    if (typeof window === "undefined") return;
    const { gtag } = window as GtagWindow;
    if (typeof gtag !== "function") return;
    setTimeout(() => {
      window.gtag?.("set", "page_path", location.pathname + location.search + location.hash);
      window.gtag?.("event", "page_view");
    });
  },
};

// Module-level wiring (client modules also evaluate on the server: guarded).
if (typeof window !== "undefined") {
  if (readStoredConsent()) {
    loadGa4();
  }
  window.addEventListener(CONSENT_EVENT, (event) => {
    const granted =
      (event as CustomEvent<ConsentEventDetail>).detail?.granted === true;
    if (granted) {
      loadGa4();
    } else {
      optOut();
    }
  });
}

/**
 * Shared analytics event helpers for the site search tracking (decision
 * D-028).
 *
 * The gtag tag is injected by the docs gtag plugin in the production build
 * only. In dev and on the server gtag is absent: every helper here is a
 * no-op (same contract as the PageFeedback component).
 */

/** Where a search on /search came from, reported as the `method` param. */
export type SearchMethod =
  | "chip" // a home-page keyword chip
  | "dropdown" // a result picked in the navbar search dropdown
  | "see_all_results" // the "See all results" link of the dropdown
  | "search_page"; // a query typed or pasted directly on /search

interface SearchSourceMarker {
  method: SearchMethod;
  /** Dropdown state when "See all results" was clicked: no result shown. */
  emptyResults?: boolean;
}

// The marker travels through sessionStorage (per tab, survives the SPA
// navigation to /search): chip clicks and the "See all results" link only
// NAVIGATE to /search — the `search` event itself is reported once, by the
// search page, which consumes the marker to name the entry point.
const SEARCH_SOURCE_KEY = "numspot.ga4.search-source";

/** Record how the current search was started, for the next /search load. */
export function markSearchSource(marker: SearchSourceMarker): void {
  try {
    sessionStorage.setItem(SEARCH_SOURCE_KEY, JSON.stringify(marker));
  } catch {
    // Storage unavailable (private mode): the event reports the default
    // "search_page" method — no need to surface the failure.
  }
}

/** Read and clear the marker written by markSearchSource(). */
export function consumeSearchSource(): SearchSourceMarker | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_SOURCE_KEY);
    sessionStorage.removeItem(SEARCH_SOURCE_KEY);
    return raw == null ? null : (JSON.parse(raw) as SearchSourceMarker);
  } catch {
    return null;
  }
}

/** Send one analytics event; no-op when gtag is absent (dev build, SSR). */
export function sendGtagEvent(
  name: string,
  params: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}

/**
 * Report a settled search query (standard `search` event). `method`
 * distinguishes the entry points; `emptyResults` is set only for the
 * "See all results" path (the dropdown state the user left behind).
 */
export function trackSearch(
  searchTerm: string,
  method: SearchMethod,
  emptyResults?: boolean,
): void {
  sendGtagEvent("search", {
    search_term: searchTerm,
    method,
    ...(emptyResults != null ? { empty_results: emptyResults } : {}),
  });
}

/** Report a query that returned zero results on the full search page. */
export function trackSearchNoResults(searchTerm: string): void {
  sendGtagEvent("search_no_results", { search_term: searchTerm });
}

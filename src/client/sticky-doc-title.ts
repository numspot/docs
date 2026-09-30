/**
 * Publishes the real height of the sticky doc-page title into the CSS variable
 * --ns-doc-title-height, consumed by the scroll-margin-top of anchors
 * (src/css/custom.css).
 *
 * Why measure at runtime: the H1 is sticky under the navbar, so a click in
 * the TOC must land the target title UNDER it, not behind it. The H1 height
 * depends on how many lines the title occupies — varying with its length and
 * the viewport width — so it cannot be hard-coded in CSS.
 */

const CSS_VAR = "--ns-doc-title-height";

// Two possible renders of the title in Docusaurus: "synthetic" title from
// the frontmatter (wrapped in a <header>), or H1 written in the markdown.
const TITLE_SELECTOR = ".theme-doc-markdown > header, .theme-doc-markdown > h1";

let observer: ResizeObserver | undefined;

const publishTitleHeight = (title: HTMLElement) => {
  document.documentElement.style.setProperty(
    CSS_VAR,
    `${Math.round(title.getBoundingClientRect().height)}px`,
  );
};

const MEASURE_STICKY_TITLE = () => {
  // The title is replaced on every navigation: release the observation of
  // the previous node, otherwise one observer stacks per visited page.
  observer?.disconnect();

  const title = document.querySelector<HTMLElement>(TITLE_SELECTOR);
  if (!title) {
    // Page without a doc title (home, custom page): remove the variable
    // so anchors fall back to the theme's default scroll stop.
    document.documentElement.style.removeProperty(CSS_VAR);
    return;
  }

  publishTitleHeight(title);

  // The height may change after the initial measurement: font loading,
  // or a window resize pushing the title onto 2 lines.
  observer = new ResizeObserver(() => publishTitleHeight(title));
  observer.observe(title);
};

export function onRouteDidUpdate() {
  MEASURE_STICKY_TITLE();
}

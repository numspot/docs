/**
 * Home page search block: the site-wide search bar raised to hero size,
 * with the most-searched keywords as chips under it. Each chip opens the
 * search page pre-filled with the term (and marks the entry point so the
 * site-search `search` event reports the method "chip" — see
 * src/utils/analytics.ts).
 *
 * The placeholder ("Rechercher") comes from the `theme.SearchBar.label`
 * translation (see i18n/fr/code.json).
 */
import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import SearchBar from "@theme/SearchBar";

import { markSearchSource } from "../../utils/analytics";

// Chips: each opens the search page pre-filled with the term.
const POPULAR_KEYWORDS = [
  "Kubernetes",
  "VM",
  "PostgreSQL",
  "Terraform",
  "VPN",
  "Object Storage",
  "IAM",
  "Container Registry",
];

export default function HomeSearch(): ReactNode {
  return (
    <div className="home-search">
      <SearchBar />
      <ul className="home-search__keywords">
        {POPULAR_KEYWORDS.map((keyword) => (
          <li key={keyword}>
            <Link
              className="home-search__keyword"
              to={`/search?q=${encodeURIComponent(keyword)}`}
              onClick={() => markSearchSource({ method: "chip" })}
            >
              {keyword}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

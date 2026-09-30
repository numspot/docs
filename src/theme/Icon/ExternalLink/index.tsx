/**
 * Swizzle of the Docusaurus external-link icon.
 * Replaces the default pictogram with the "link-external" icon from the
 * Numspot brand guidelines (Figma Iconography). Used for all external links:
 * navbar items (e.g. "Products"), external links in pages, etc.
 * `currentColor` => the icon inherits the link color.
 */
import React from 'react';
import {translate} from '@docusaurus/Translate';

export default function IconExternalLink({
  width = 13.5,
  height = 13.5,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      aria-label={translate({
        id: 'theme.IconExternalLink.ariaLabel',
        message: '(opens in new tab)',
        description: 'The ARIA label for the external link icon',
      })}
      style={{marginLeft: '0.3rem', verticalAlign: 'middle'}}>
      <path
        fill="currentColor"
        d="M2 17.625V6.375C2 3.95876 3.95876 2 6.375 2H10.875C11.4273 2 11.875 2.44772 11.875 3C11.875 3.55228 11.4273 4 10.875 4H6.375C5.06332 4 4 5.06334 4 6.375V17.625C4 18.9367 5.06332 20 6.375 20H17.625C18.9367 20 20 18.9367 20 17.625V13.125C20 12.5727 20.4477 12.125 21 12.125C21.5523 12.125 22 12.5727 22 13.125V17.625C22 20.0412 20.0412 22 17.625 22H6.375C3.95876 22 2 20.0412 2 17.625ZM22 8.0625C22 8.61478 21.5523 9.0625 21 9.0625C20.4477 9.0625 20 8.61478 20 8.0625V5.41309L12.1436 13.2695C11.753 13.6598 11.1199 13.6599 10.7295 13.2695C10.3391 12.8791 10.3392 12.246 10.7295 11.8555L18.5859 4H15.374C14.822 3.99977 14.3741 3.55213 14.374 3C14.3742 2.44799 14.822 2.00023 15.374 2H21C21.2652 2 21.5195 2.10544 21.707 2.29297C21.8946 2.4805 22 2.73478 22 3V8.0625Z"
      />
    </svg>
  );
}

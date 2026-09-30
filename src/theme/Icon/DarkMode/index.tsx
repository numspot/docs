/**
 * Swizzle of the "dark mode" (moon) icon of the theme toggle.
 * Icon "half-moon" from the Numspot brand guidelines (Figma Iconography).
 * viewBox 20 20 24 24: isolates the icon (offset 20,20) from the component frame.
 * `fill="currentColor"` → recolored by navbar.css (var(--icon-color)).
 */
import React from 'react';

export default function IconDarkMode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="20 20 24 24" width={24} height={24} {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.8955 22.2393C28.1589 22.1085 28.4717 22.1227 28.7217 22.2774C28.9717 22.4324 29.1239 22.706 29.124 23.0001C29.124 27.124 30.1463 30.0506 32.0479 31.9522C33.9495 33.8539 36.876 34.8761 41 34.8761C41.2941 34.8761 41.5676 35.0284 41.7227 35.2784C41.8775 35.5284 41.8915 35.8412 41.7607 36.1046C40.0692 39.5081 36.5554 41.8497 32.4932 41.8497C26.7808 41.8496 22.1505 37.2192 22.1504 31.5069C22.1505 27.4448 24.4921 23.9309 27.8955 22.2393ZM27.4688 24.4737C25.2771 26.0424 23.8497 28.6086 23.8496 31.5069C23.8497 36.2804 27.7197 40.1503 32.4932 40.1505C35.3917 40.1505 37.9567 38.7222 39.5254 36.5304C35.8414 36.3071 32.9118 35.2204 30.8457 33.1544C28.7795 31.0881 27.6919 28.1581 27.4688 24.4737Z"
      />
    </svg>
  );
}

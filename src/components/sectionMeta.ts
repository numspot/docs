/**
 * Metadata (icon + description) per top-level section, keyed on the
 * className slug ("section-title <slug>" in the _category_.json files).
 *
 * Single source shared between the home page grid (HomeServices) and
 * the category index pages (DocCardList / DocCard), for consistent styling.
 */

import { createContext } from "react";

export type SectionMeta = { icon: string; description: string };

export const SECTION_META: Record<string, SectionMeta> = {
  iam: {
    icon: "/img/sidebar/iam.svg",
    description:
      "Centralized service for authentication and access management across Numspot services.",
  },
  "managed-services": {
    icon: "/img/sidebar/managed-services.svg",
    description:
      "Create and manage containers and databases in the cloud.",
  },
  compute: {
    icon: "/img/sidebar/compute.svg",
    description: "Create and manage compute instances in the cloud.",
  },
  network: {
    icon: "/img/sidebar/network.svg",
    description:
      "Explore advanced networking options to optimize your network infrastructure.",
  },
  storage: {
    icon: "/img/sidebar/storage.svg",
    description:
      "Discover and configure storage solutions to secure and organize your data.",
  },
  connectivity: {
    icon: "/img/sidebar/connectivity.svg",
    description:
      "Explore advanced connectivity options to optimize your network infrastructure.",
  },
  terraform: {
    icon: "/img/sidebar/terraform.svg",
    description:
      "Infrastructure as code (IaC) tool to define and manage cloud resources in an automated way.",
  },
  glossary: {
    icon: "/img/sidebar/glossary.svg",
    description:
      "Definitions of the key terms and concepts of the Numspot platform.",
  },
  catalog: {
    icon: "/img/sidebar/catalog.svg",
    description:
      "Browse the catalog of available resources with their domains, types and pricing.",
  },
  inventory: {
    icon: "/img/sidebar/inventory.svg",
    description:
      "View all the resources deployed in a Numspot space.",
  },
  reference: {
    icon: "/img/sidebar/governance.svg",
    description:
      "Transverse reference pages, such as the API and Terraform provider parameter types.",
  },
  support: {
    icon: "/img/sidebar/support.svg",
    description:
      "Explore support options to ensure the continuity of your services.",
  },
  faq: {
    icon: "/img/sidebar/faq.svg",
    description:
      "Answers to the most common general and technical questions.",
  },
  "getting-started": {
    icon: "/img/sidebar/footprints.svg",
    description:
      "The first-user journey, from first sign-in to first resources.",
  },
};

// Fallback icon for sections without a dedicated entry (e.g. security, resources).
export const DEFAULT_SECTION_ICON = "/img/sidebar/home.svg";

// Extracts the section slug from a "section-title <slug>" className.
export function sectionSlug(className?: string): string | undefined {
  if (!className) return undefined;
  return className.split(/\s+/).find((c) => c && c !== "section-title");
}

// Icon of a section from its className, with fallback.
export function sectionIcon(className?: string): string {
  const slug = sectionSlug(className);
  return (slug && SECTION_META[slug]?.icon) || DEFAULT_SECTION_ICON;
}

// Icon of the parent category, propagated from DocCardList to each DocCard
// (avoids adding a prop to the ambient @theme/DocCard type).
export const SectionIconContext = createContext<string>(DEFAULT_SECTION_ICON);

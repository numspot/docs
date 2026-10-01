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
      "Service centralisé pour l'authentification et la gestion des accès aux services Numspot.",
  },
  "managed-services": {
    icon: "/img/sidebar/managed-services.svg",
    description:
      "Créer et gérer des conteneurs et des bases de données dans le cloud.",
  },
  compute: {
    icon: "/img/sidebar/compute.svg",
    description: "Créer et gérer des instances de calcul dans le cloud.",
  },
  network: {
    icon: "/img/sidebar/network.svg",
    description:
      "Explorer les options de réseau avancées pour optimiser votre infrastructure réseau.",
  },
  storage: {
    icon: "/img/sidebar/storage.svg",
    description:
      "Découvrir et configurer les solutions de stockage pour sécuriser et organiser vos données.",
  },
  connectivity: {
    icon: "/img/sidebar/connectivity.svg",
    description:
      "Explorer les options de connectivité avancées pour optimiser votre infrastructure réseau.",
  },
  terraform: {
    icon: "/img/sidebar/terraform.svg",
    description:
      "Outil d'infrastructure as code (IaC) pour définir et gérer des ressources cloud de manière automatisée.",
  },
  glossary: {
    icon: "/img/sidebar/glossary.svg",
    description:
      "Définitions des termes et concepts clés de la plateforme Numspot.",
  },
  catalog: {
    icon: "/img/sidebar/catalog.svg",
    description:
      "Consulter le catalogue des ressources disponibles avec leurs domaines, types et tarifs.",
  },
  inventory: {
    icon: "/img/sidebar/inventory.svg",
    description:
      "Visualiser l'ensemble des ressources déployées dans un espace Numspot.",
  },
  reference: {
    icon: "/img/sidebar/governance.svg",
    description:
      "Pages de référence transverses, comme les types de paramètres de l'API et du provider Terraform.",
  },
  support: {
    icon: "/img/sidebar/support.svg",
    description:
      "Explorer les options de support pour garantir la continuité de vos services.",
  },
  faq: {
    icon: "/img/sidebar/faq.svg",
    description:
      "Réponses aux questions générales et techniques les plus fréquentes.",
  },
  "getting-started": {
    icon: "/img/sidebar/footprints.svg",
    description:
      "Le parcours du premier utilisateur, de la première connexion aux premières ressources.",
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

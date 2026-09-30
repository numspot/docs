/**
 * Home page content zones:
 *  - "Most popular pages" — curated entries;
 *  - "Get started" — quickstarts and first steps;
 *  - "Labs — Learn & build" — guided scenarios, hidden until the pages ship
 *    (flip LABS_ENABLED to true when they do).
 *
 * Cards reuse the section-card look (.svc-card, shared with DocCard). Entry
 * titles are translatable (i18n code.json); URLs are validated against the
 * real docs tree by linter/tests/home-zones.test.js.
 */
import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import { translate } from "@docusaurus/Translate";
import { SECTION_META } from "../sectionMeta";

// Section key: indexes SECTION_META for the card icon.
type SectionKey =
  | "managed-services"
  | "compute"
  | "network"
  | "storage"
  | "connectivity"
  | "terraform"
  | "getting-started"
  | "glossary"
  | "support"
  | "faq"
  | "iam"
  | "catalog"
  | "inventory";

type HomeEntry = {
  id: string;
  title: string;
  description?: string;
  url: string;
  section: SectionKey;
  // Render the "Read more" button (cards that carry a description).
  readMore?: boolean;
};

// Most popular pages — curated (user decision, 2026-09-23).
const POPULAR_PAGES: HomeEntry[] = [
  {
    id: "kubernetes-concepts",
    title: "Concepts du Kubernetes managé",
    description:
      "Comprendre l'architecture et les objets du Kubernetes managé Numspot.",
    url: "/docs/managed-services/kubernetes/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "managed-concepts",
    title: "Concepts des Services managés",
    description: "Kubernetes, PostgreSQL, Registry : les bases des services managés.",
    url: "/docs/managed-services/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "postgresql-concepts",
    title: "Concepts du PostgreSQL managé",
    description: "Architecture, réplicas et sauvegardes du PostgreSQL managé.",
    url: "/docs/managed-services/postgresql/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "create-vm",
    title: "Créer une VM",
    description: "Créez et configurez une VM sur mesure dans votre VPC.",
    url: "/docs/compute/vms/actions/create/",
    section: "compute",
    readMore: true,
  },
];

// Get started — quickstarts and first steps.
const GET_STARTED_PAGES: HomeEntry[] = [
  {
    id: "getting-started",
    title: "Premiers pas chez Numspot",
    description:
      "Connectez-vous et construisez votre organisation : premier espace, utilisateurs, droits et premières ressources.",
    url: "/docs/getting-started/",
    section: "getting-started",
    readMore: true,
  },
  {
    id: "first-connection",
    title: "Première connexion à la console Numspot",
    description: "Connectez-vous à la console et prenez vos marques.",
    url: "/docs/iam/connection/first-connection/",
    section: "iam",
    readMore: true,
  },
  {
    id: "terraform-quickstart",
    title: "Démarrage rapide : Terraform",
    description: "Provisionnez vos ressources Numspot en infrastructure as code.",
    url: "/docs/terraform/quickstart/",
    section: "terraform",
    readMore: true,
  },
  {
    id: "vm-quickstart",
    title: "Démarrage rapide : créer une VM",
    description: "Déployez votre première VM en quelques minutes.",
    url: "/docs/compute/vms/quickstart/",
    section: "compute",
    readMore: true,
  },
];

// Labs scenarios — placeholders: the pages are not ready yet. The whole
// zone stays hidden until they ship: flip LABS_ENABLED to true (and replace
// the placeholder hrefs) when it does.
const LABS_ENABLED = false;
const LABS_SCENARIOS: HomeEntry[] = [
  {
    id: "labs-container-app",
    title: "Déployer une application conteneurisée",
    description: "Du build de l'image à l'exposition du service sur le cloud.",
    url: "#",
    section: "managed-services",
  },
  {
    id: "labs-private-connectivity",
    title: "Connecter votre SI au cloud Numspot",
    description: "Mettre en place une connectivité privée site-à-site.",
    url: "#",
    section: "connectivity",
  },
  {
    id: "labs-terraform-automation",
    title: "Industrialiser vos déploiements",
    description: "Structurer, versionner et automatiser vos infrastructures.",
    url: "#",
    section: "terraform",
  },
];

function HomeCard({ entry }: Readonly<{ entry: HomeEntry }>): ReactNode {
  const icon = SECTION_META[entry.section].icon;
  return (
    <Link href={entry.url} className="card svc-card svc-card--index">
      <span className="svc-card__header">
        <span className="svc-card__icon">
          <span
            className="svc-card__glyph"
            role="img"
            aria-label={entry.title}
            style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }}
          ></span>
        </span>
        <span className="svc-card__title">
          {translate({
            id: `home.entry.${entry.id}.title`,
            message: entry.title,
            description: "Home page card title",
          })}
        </span>
      </span>
      {entry.description && (
        <span className="svc-card__desc">
          {translate({
            id: `home.entry.${entry.id}.description`,
            message: entry.description,
            description: "Home page card description",
          })}
        </span>
      )}
      {entry.readMore && (
        <span className="home-card__more">
          {translate({
            id: "home.card.read-more",
            message: "En savoir plus",
            description: "Home page card call to action",
          })}
        </span>
      )}
    </Link>
  );
}

export default function HomeZones(): ReactNode {
  return (
    <div className="home-zones">
      <section>
        <p className="home-section__title">
          {translate({
            id: "home.zones.popular.title",
            message: "Pages les plus consultées",
            description: "Home page section title for the most popular pages",
          })}
        </p>
        <div className="svc-grid">
          {POPULAR_PAGES.map((entry) => (
            <HomeCard key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
      <section className="home-zones__section--divided">
        <p className="home-section__title">
          {translate({
            id: "home.zones.get-started.title",
            message: "Pour commencer",
            description: "Home page section title for getting started",
          })}
        </p>
        <div className="svc-grid">
          {GET_STARTED_PAGES.map((entry) => (
            <HomeCard key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
      {LABS_ENABLED && (
        <section className="home-zones__section--divided">
          <p className="home-section__title">
            {translate({
              id: "home.zones.labs.title",
              message: "Labs — Apprendre & construire",
              description: "Home page section title for the labs zone",
            })}
          </p>
          <div className="svc-grid">
            {LABS_SCENARIOS.map((scenario) => (
              <HomeCard key={scenario.id} entry={scenario} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

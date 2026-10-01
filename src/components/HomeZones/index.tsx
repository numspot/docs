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
    title: "Managed Kubernetes concepts",
    description:
      "How the managed Kubernetes works on Numspot: architecture and objects.",
    url: "/docs/managed-services/kubernetes/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "managed-concepts",
    title: "Managed services concepts",
    description: "What managed services cover: Kubernetes, PostgreSQL and Container Registry.",
    url: "/docs/managed-services/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "postgresql-concepts",
    title: "Managed PostgreSQL concepts",
    description: "Architecture, replicas and backups of the managed PostgreSQL.",
    url: "/docs/managed-services/postgresql/concepts/",
    section: "managed-services",
    readMore: true,
  },
  {
    id: "create-vm",
    title: "Create a VM",
    description: "Create and configure a custom VM inside your VPC.",
    url: "/docs/compute/vms/actions/create/",
    section: "compute",
    readMore: true,
  },
];

// Get started — quickstarts and first steps.
const GET_STARTED_PAGES: HomeEntry[] = [
  {
    id: "getting-started",
    title: "First steps with Numspot",
    description:
      "Sign in and build out your organization: first space, users, rights and first resources.",
    url: "/docs/getting-started/",
    section: "getting-started",
    readMore: true,
  },
  {
    id: "first-connection",
    title: "First sign-in to the Numspot console",
    description: "Sign in to the console and get familiar with the interface.",
    url: "/docs/iam/connection/first-connection/",
    section: "iam",
    readMore: true,
  },
  {
    id: "terraform-quickstart",
    title: "Quickstart: Terraform",
    description: "Provision your Numspot resources as code.",
    url: "/docs/terraform/quickstart/",
    section: "terraform",
    readMore: true,
  },
  {
    id: "vm-quickstart",
    title: "Quickstart: create a VM",
    description: "Deploy your first VM in a few minutes.",
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
    title: "Deploy a containerized application end to end",
    description: "From image build to service exposure on the sovereign cloud.",
    url: "#",
    section: "managed-services",
  },
  {
    id: "labs-private-connectivity",
    title: "Connect your IS to the Numspot cloud",
    description: "Set up private site-to-site connectivity.",
    url: "#",
    section: "connectivity",
  },
  {
    id: "labs-terraform-automation",
    title: "Industrialize your deployments",
    description: "Structure, version and automate your infrastructures.",
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
            message: "Read more",
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
            message: "Most popular pages",
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
            message: "Get started",
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
              message: "Labs — Learn & build",
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

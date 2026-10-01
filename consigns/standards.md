# **Writing rules for the public documentation**
## **General rules**
### **Action page titles**
- Use **infinitive verbs** for titles describing an action.  
*Example :* Créer une machine virtuelle
* * *
### **Console labels**
- **Labels exactly as they appear in the console** must:
  - Be written **exactly as in the console**
  - Be wrapped in **quotation marks**
*Example :* "Créer une machine virtuelle"
* * *
### **Addressing the user**
- Use the **formal address (vouvoiement)** for all user actions.  
*Example :* « Cliquez sur… » (and not « Clique sur… »).
* * *
### **Terminology**
- **Component and concept names** must:
  - Match **strictly** the terms used in the console
  - Use the **official name**
- *Examples :* VM, projet, réseau, rôle IAM
- **Anglicisms**:
  - At the **first occurrence** outside a title or console label, add the French translation in parentheses.  
*Example :* subnet (sous-réseau)
  - **Exception**: untranslated acronyms (VM, API, IAM…) require no translation.
- **Acronyms**:
  - At the **first occurrence** outside a title or console label, expand the acronym in parentheses.  
*Example :* VM (Virtual Machine)
  - No plural for acronyms (example: les VM)
  - Acronyms are **never** wrapped in `code` (backticks): they stay plain text.
* * *
### **Permissions and roles**
- Always use the following format:  
**Domaine.Permission**
- Permissions and roles are always **bold**.
*Example :* **Gestion des utilisateurs.Création**
### **Formatting**
|     |     |     |
| --- | --- | --- |
| **Element** | **Format** | **Example** |
| Buttons | **Bold** | **Créer**, **Supprimer** |
| Fields, menus, statuses | In quotation marks, first word capitalized | "Nom", "Compute", "En cours" |
| Resource names | `code` | `maVM-prod-1` |
| Console paths | **Section** → **Sub-section** → **Action** | **Réseau** → **Sous-réseaux** → **Créer** |
| Resource types | Hyperlink to the concept page at first occurrence, plain text afterwards (never `code`) | [VM](/docs/compute/concept), then VM |
| Acronyms (outside resource names) | Plain text, never `code` | API, IP, vCPU |

- Formats must not stack, including default formatting such as headings, menus and tables of contents (h1, h2, …). Headings must not be affected by the formats applied to other elements. Example: **Créer une key pair** → key pair must be neither code nor a link.
* * *
### **Use of the `code` format (backticks)**

The `code` format (backticks) is **reserved for literal tokens** — what is typed as-is or returned as-is by the API, the console or a tool. It **never** applies to prose, a concept name or a resource type.

**Wrap in `code`:**

- **parameter** / **field** names of an API or JSON payload: `spaceId`, `clusterId`, `status` ;
- literal **enum values**: `AUTO`, `ON_DEMAND`, `DELETING`, `PRIMARY` ;
- **endpoints** and requests: `GET /postgresql/spaces/{spaceId}/clusters/{clusterId}` ;
- **commands** and file paths: `kubectl get pods`, `~/.kube/config` ;
- instantiated **resource names**: `maVM-prod-1` ;
- technical identifiers (e.g. permission): `postgresql.cluster.get`.

**Never wrap in `code`** (use the proper format):

- **concept** / **resource-type** names → plain text, or a concept link at first occurrence: ~~`compte de service`~~ → compte de service ; ~~`utilisateur`~~ → utilisateur ;
- **acronyms** → plain text: ~~`API`~~ → API ;
- **buttons** → **bold**: ~~`Créer`~~ → **Créer** ;
- **console fields, menus, statuses** → in quotation marks: ~~`En ligne`~~ → "En ligne" ;
- **prose** / sentences → plain text.

> **Quick test**: if it is not something you **type** or that the API/console **returns literally**, it does not go in backticks.

The linter flags these deviations via `standard:resource_backticks_invalid` (glossary terms wrapped in `code`) and `standard:prose_backticks` (accented prose in backticks, detected automatically).
* * *
### **Resource types (links to concept pages)**
- **Resource types** (terms tagged `RESOURCE` in the glossary) are **never** wrapped in `code`.
- At the **first occurrence** of a resource type in a page's body text:
  - if the term has a `concept_page` field in the glossary, format it as an **inline hyperlink** to that concept page;
  - the link is a plain markdown link (`[term](/docs/…)`), **without** the ↗ icon and **without** opening in a new tab (unlike prerequisites).
- At **subsequent occurrences** in the same page: **plain text**, no formatting.
- If the term has **no** `concept_page` in the glossary: **plain text everywhere** (no link, no `code`).
- **No self-link**: if the term's `concept_page` is the page being written, the term stays **plain text** on that page (a page does not link to itself).
- **One link per concept page**: linking the `concept_page` once on the page is enough. Synonyms pointing to the same page (e.g. « VM » and « virtual machine ») do not each need a link; avoid double links such as `[VM](…) ([Virtual Machine](…))`.
- **Exception — literal API values**: when a term is used as a **value** passed to the API (enum value, e.g. `domain` ∈ `` `compute`, `connectivity`… `` or `kind` ∈ `` `virtual-machine`, `node`, `gpu` ``), it is wrapped in `code` like the other values of the list, **without** a link to its concept page. It is not a concept mention but a technical value.
- **Exceptions** (no link, no `code`): headings (h1-h6), buttons, console labels, tables of contents. The first occurrence is counted in the body text, outside these elements.
- If the term is also an anglicism or an acronym, the translation or expansion in parentheses follows the link at first occurrence.
*Example :* [key pair](/docs/compute/keypairs/concept) (paire de clés) at first occurrence, then key pair afterwards.
* * *
### **Punctuation and style**
- No vague or imprecise sentence (e.g. « il est possible de… », « généralement… »).
- **No nested parentheses**: never place a parenthesis inside another one in prose.
  - When the expansion of an acronym or the translation of an anglicism — mandatory at first occurrence, see « Terminologie » — would fall inside a passage already in parentheses, **remove the outer parenthesis** (replace it with a colon, a dash, a comma, or rephrase). The acronym expansion is **never** dropped.
  *Example :* ~~« dimensionnement (vCPU (virtual CPU), RAM (Random Access Memory)) »~~ → « dimensionnement : vCPU (virtual CPU), RAM (Random Access Memory) ».
  - Parentheses inside `code` or a code block are not concerned (formulas, expressions, commands).
  - The linter flags these deviations via `standard:nested_parentheses`.
- **Bullet lists**:
  - the list must be introduced by:
  - enumerations must start with a lowercase letter
  - enumerations must end with a semicolon ; except the last one, which ends with a period .
  - when preceded by a number or a letter (e.g. A. / 1. ) capital letters at the start of the enumeration are allowed and no semicolon is required at the end of the line
*Example :*
Numbered list:
  1. First line:
    - value 1 ;
    - value 2.
  2. Second line:
    a. Valeur 3.
    b. Valeur 4.
  3. Third line.
## **Content structure**
### **Prerequisites**
- Prerequisites must:
  - Be placed in an **information panel** (note type)
  - Be **hyperlinks** to existing action pages followed by the ↗ icon
  - The whole text and the icon must be clickable
  - Clicking any of these links must open it in a new tab
*Example :*
**Prérequis**
- [Avoir les permissions *X*, *Y* et *Z* ↗](/docs/compute/concept)
- [Créer un projet ↗](/docs/compute/security-groups/actions/add_rule)
* * *
### **Parameters to fill in**
- Use the following **standard table**:
|     |     |     |
| --- | --- | --- |
| **Field** | **Example value** | **Description** |
| Nom | web-prod-1 | Resource identifier |

* * *
### **System messages in Action pages, Console tab**
- Standard introduction message:
*« Depuis le menu latéral gauche, cliquez sur **Section** → **Sous-section ». »*
- Standard confirmation message:
*« Un message de confirmation s’affiche en bas de page indiquant que <'ressource'> est bien créé et vous êtes redirigé vers la page détaillée de <'ressource'>. »*
<!--## **Rules for screenshots**
### **Goal**
Produce **reusable**, **stable** and **low-maintenance** images.
* * *
### **Framing**
|     |     |     |
| --- | --- | --- |
| **Context** | **To show** | **To exclude** |
| Access | Navigation menu | Page content |
| Form | Fields to fill in | Header / footer |
| Result | Status or notification | Full dashboard |
* * *
### **Anonymization**
- Mask all sensitive data:
  - Resource names
  - IDs
  - IPs
  - Emails
- Mandatory method: **opaque grey bar** (no blur).
* * *
### **File naming**
- The file name must **include the language** as a prefix.
- The file name structure must follow one of the formats below, depending on the screenshot level.
**Standard format**:
- fr-<section>-<concept>.png
- en-<section>-<concept>.png
**Extended format (if subsection)**:
- fr-<section>-<subsection>-<concept>.png
- en-<section>-<subsection>-<concept>.png-->

### **Slugs / URLs**
- **All slugs (URLs) are English, in every locale — FR included.** The slug is a technical identifier; only the URL is English, the FR content stays French.
- The slug comes from the **file path** by default. For a page whose path contains a French word (e.g. a `plateforme-ia-mistral` folder), **do not rename the file** (it would break the i18n link between a page and its translation): add an English `slug:` in the frontmatter.
  ```yaml
  slug: /docs/managed-services/mistral-ai-platform/concepts
  ```
- **Never break an already published URL.** If a slug is renamed, the old one must stay alive as a **non-indexed redirect**: add the pair `["old-slug", "new-slug"]` to `SLUG_RENAMES` in `src/plugins/slug-redirects.js`.
- Full details and examples: see **`conventions/slugs.md`**. The rule is enforced by the linter (`i18n:non_english_slug`).

### **Code comments**
- **Comments inside code blocks are part of the page content**: they stay in the page language (French on FR pages, English on EN pages). The code itself (identifiers, commands, values) stays unchanged.
  ```bash
  # Créer le bucket   ✅ (on an FR page — the comment reads as prose)
  aws s3 mb s3://mon-bucket
  ```
- **Exception — maintainer markers**: meta comments intended for the team (`TODO`, `FIXME`, `NOTE`, `HACK`, `XXX`) are in English in every locale: they are engineering artifacts (greppable in git), not content read by the customer.
  ```bash
  # TODO: remove once API v2 is GA   ✅ (even on an FR page)
  # TODO: supprimer quand l'API v2 sera GA   ❌
  ```
- Enforced by the linter: `i18n:french_meta_comment` (French meta markers, FR pages) ; `i18n:french_comment` / `i18n:french_text` (any French comment, EN pages).

### **Review date**
- **Every documentation page displays its review date under the H1** — « Mise à jour le <date> » (FR) / « Reviewed on <date> » (EN, US format). Rendering is done by the theme (`src/components/LastUpdatedDate`, `MDXComponents` swizzle); **the line is never written in the page body**.
- The date comes from the `last_update.date` frontmatter (YYYY-MM-DD):
  ```yaml
  last_update:
    date: 2026-09-11
  ```
- **Any content change requires refreshing the date** (set it to the day of the revision). New page: the frontmatter is mandatory. Page untouched since the rule was introduced: the theme falls back to the last git commit date.
- **The homepage is excluded** (no displayed date, no required frontmatter).
- Enforced by the linter: `linter/tests/last-updated-date.test.js` (presence on new pages, refresh on changed pages — CI jobs).

## **Typography**
- The **Rethink Sans** font must be used everywhere in the documentation: headings, body text, navigation, code blocks, UI components, etc.
- There is no exception: every text displayed on the site uses Rethink Sans.
- Companion monospace font: SFMono-Regular (only for `code` blocks and elements).
* * *
## **Cross-cutting editorial rules**
### **Word count optimization**
- Content must be **short, direct and action-oriented**.
- When using an LLM to produce or enrich the documentation:
  - State explicitly that the target audience is **non-technical**.
  - Ask for **word count optimization** without loss of functional meaning.
* * *
### **Information panels**
- Information panels are used to **contextualize without interrupting the main flow**.
|     |     |
| --- | --- |
| **Panel type** | **Use case** |
| Information / Note | Prerequisites, important reminders, functional context |
| Warning | Risk, irreversible impact, strong point of attention |
| Tip | Good practices, time savers |

* * *
### **Nesting depth**
- The maximum number of indentation levels (headings + lists) in a page is **3**.
- Beyond that, the content must be:
  - Simplified
  - Or split into a new section

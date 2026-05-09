# Tab Grouper: Technical Implementation

> **Note:** This document covers the on-demand **Tab Grouper** wizard. For the background daemon that continuously groups tabs as they are created using rules, see [Auto Tab Grouper (AUTO_TAB_GROUPER.md)](./AUTO_TAB_GROUPER.md).

The Tab Grouper Wizard provides intelligent, deterministic tab grouping without relying on AI. It uses a robust "brand-first" domain parser and heuristics to automatically cluster a user's open tabs into logical groups on demand.

## Core Grouping Strategy

The system defaults to a **merged mode** where tabs are grouped by their root registrable domain. Users can selectively switch specific domains into **split mode**, which separates them by full hostname.

1. **Bucket by Root Domain**: All unpinned, ungrouped tabs are first evaluated. Their URLs are parsed using a Public Suffix List (via `tldts`) to extract the exact eTLD+1 (e.g., `google.com` from `mail.google.com`, or `bbc.co.uk` from `news.bbc.co.uk`).
2. **Apply Domain Preferences**: The system checks `localStorage` for any saved user preferences. If a user has clicked the "split" button for `google.com`, the tabs in that bucket will be split out into separate groups based on their specific subdomains (`mail.google.com`, `docs.google.com`, etc.).
3. **Generate Names**: A pipeline of naming heuristics determines the best title for each group.

## Naming Heuristics

Rather than just using raw hostnames, the system employs smart naming algorithms:

### 1. Title Prefix Extraction (`findCommonTitlePrefix`)
The strongest signal for a group name is often the tab titles themselves. The system looks for the longest common prefix across all tab titles in a cluster. 
- Example: Tabs titled `"Stripe Docs: API Reference"` and `"Stripe Docs: Webhooks"` will yield the prefix `"Stripe Docs"`.
- It intelligently trims to the last clean word boundary to avoid leaving dangling delimiters (like `|` or `-`).

### 2. Subdomain Labelling
If no clear common title prefix exists, the system extracts the subdomain label.
- Example: `admin.stripe.com` becomes `"Stripe · Admin"`.

### 3. Brand Capitalization
If it's a root domain with no distinct subdomains, the system falls back to the registrable domain name. It uses a localized `BRAND_MAP` for correct casing (e.g., `github` → `GitHub`, `youtube` → `YouTube`), or falls back to standard capitalization.

### 4. Deduplication
If the generated name conflicts with an *existing* Chrome Tab Group, it dynamically appends a counter (e.g., `"Google 2"`) to ensure uniqueness.

## Domain Parsing (Phase 1 Update)

To accurately parse domains worldwide, the system relies on `tldts`, a fast and lightweight Public Suffix List parser.

- **`extractRegistrableDomain`**: Extracts and capitalizes the core brand name (e.g., `app.youtube.com` → `YouTube`).
- **`extractRootDomain`**: Returns the full eTLD+1 (e.g., `docs.google.co.uk` → `google.co.uk`).
- **`extractSubdomainLabel`**: Isolates the subdomain (e.g., `company1.slack.com` → `company1`).
- Private domains (like `.github.io` or `.herokuapp.com`) are correctly recognized, ensuring different users/apps are not incorrectly merged into a single generic "GitHub" or "Heroku" group.

## Interactive Wizard Architecture

The UI is built as a complex React state machine (`useWizardState`):
- Tab drag-and-drop between groups using `@dnd-kit`.
- Real-time previews of split/merge operations.
- State exclusion (users can uncheck specific tabs to exclude them from the grouping operation).
- Upon confirmation, it batches `chrome.tabs.group` and `chrome.tabGroups.update` calls, respecting window boundaries since Chrome Tab Groups cannot span multiple windows.

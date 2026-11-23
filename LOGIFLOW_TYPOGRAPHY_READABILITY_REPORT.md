# LogiFlow Typography and Readability Report

## Audit scope

- Reviewed the global stylesheet, Tailwind v4 setup, and shared app shell, sidebar, topbar, profile menu, and brand components.
- Audited the Angular source inventory: 263 application files, including 103 Manufacturer feature files and 88 Distributor feature files.
- Searched workspace templates for font-size utilities. The most frequent small-text patterns were `text-xs` and custom `text-[9px]`/`text-[10px]` labels, especially in warehouse operations, logistics, forms, tables, and status metadata.
- The app had no shared typography tokens or component-specific stylesheet overrides. Most typography is expressed with Tailwind utilities in templates.

## Inconsistencies identified

- Tailwind's default `text-xs` rendered at 12px and `text-sm` at 14px across content-dense screens.
- There were 404 custom 9-11px utility occurrences across the app, including 386 in the Manufacturer and Distributor workspaces, placing many labels and metadata below comfortable reading size.
- Nested sidebar links used `text-xs`, while primary links used `text-sm`.

## Typography scale established

| Use | Size after update |
|---|---:|
| Compact/supporting text (`text-xs`) | 13px, 19.2px line height |
| Standard body, controls, and navigation (`text-sm`) | 15px, 23.2px line height |
| Custom 9-11px labels and 0.65-0.68rem text | 12px, 17.6px line height |
| Base browser text | 16px with 1.5 line height |
| Existing heading utilities | Retained (Tailwind scale, e.g. 24px `text-2xl`) |

## Changes made

- Added shared typography tokens and a 16px root baseline in [styles.css](src/styles.css).
- Raised very small custom labels across both workspaces to a 12px minimum while keeping their existing colors, weights, and layouts.
- Updated nested sidebar links to the same 15px utility as primary navigation in [sidebar.component.html](src/app/layout/app-sidebar/sidebar.component.html).
- Kept typography-only scope; no services, models, endpoints, auth, routing, forms, or business logic were changed.

## Responsive behavior

- Existing mobile/tablet/desktop breakpoints and component arrangements were preserved. The scale applies consistently across breakpoints, and `text-size-adjust: 100%` prevents browser text autosizing from changing the intended scale.
- No screenshot-based review at specific viewport widths was performed; dense screens should receive a visual pass at desktop and mobile sizes before release.

## Verification

- `npm.cmd run build`: passed. Angular reported the existing Leaflet CommonJS optimization warning.
- `npm.cmd test -- --watch=false`: passed, 16 test files and 54 tests.
- `package.json` does not define a lint script, so lint was not available to run.

## Remaining considerations

- Generated purchase-order print/PDF styles define their own typography and are outside the global Tailwind scale.
- A visual pass should confirm that expanded metadata remains comfortable in the densest logistics and warehouse tables on narrow screens.

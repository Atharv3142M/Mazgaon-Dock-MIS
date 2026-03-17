# MDL COMMAND · Digital Shipyard MIS v5.1

> **Enterprise-grade Management Information System prototype for Mazagon Dock Shipbuilders Limited (MDL)**  
> A Navratna Defence Public Sector Undertaking under the Ministry of Defence, Government of India.  
> Live demo: [atharv3142m.github.io/Mazgaon-Dock-MIS](https://atharv3142m.github.io/Mazgaon-Dock-MIS/)

---

## Overview

This is a fully static, browser-deployable MIS prototype that simulates the enterprise data layer of a real-world shipyard command system. It requires **no backend, no database server, and no build step** — deploy it directly on GitHub Pages by dropping three files in a repository root.

All data is persisted in `window.localStorage` using a modular storage abstraction layer that mirrors real SAP BAPI (Business Application Programming Interface) call semantics. Every `localStorage.setItem()` corresponds to a `BAPI_CREATE_*` or `BAPI_CHANGE_*` call in a production SAP environment; every `localStorage.getItem()` corresponds to `RFC_READ_TABLE` or `BAPI_GET_*`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   BROWSER (Static Host)                  │
│                                                         │
│  index.html ──► style.css ──► app.js                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              RBAC ENGINE (app.js)                │   │
│  │  Role Selection ──► JWT Mock ──► DOM Filter      │   │
│  │  Account Switcher ──► Audit Log ──► Re-render    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Chart.js   │  │   Grid.js    │  │  localStorage  │  │
│  │  (CDN)      │  │   (CDN)      │  │  (SAP mock DB) │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### SAP Module Mapping

| MIS Module | SAP Equivalent | localStorage Key |
|---|---|---|
| Financial Command (ESS) | SAP-FI/CO + SAP-BW | `mdl_v5_strategic` |
| Project & Spatial MIS | SAP-PS (Project System) | `mdl_v5_projects` |
| Supply Chain & ROMIS | SAP-MM (Materials Mgmt) | `mdl_v5_materials`, `mdl_v5_inventory`, `mdl_v5_vendors` |
| Human Capital & HSE | SAP-HCM + SAP-EHS | `mdl_v5_hse` |
| RBAC Audit Trail | SAP Security Audit Log | `mdl_v5_audit` |

---

## Features

### 🔐 Role-Based Access Control (RBAC)

The app opens with a **role-selection overlay** implementing the Principle of Least Privilege per ISO/IEC 27001:2022 and IMO MSC.428(98). Six roles are defined:

| Role | Clearance | Accessible Modules |
|---|---|---|
| **Super Administrator** | SECRET | All modules + Audit |
| **Executive Director** | CONFIDENTIAL | ESS · Projects · Compliance · Audit |
| **Project Commander** | SECRET | Projects · Supply · Audit |
| **Financial Controller** | CONFIDENTIAL | ESS · Audit |
| **Supply Chain Officer** | RESTRICTED | Supply · Audit |
| **Floor Supervisor** | RESTRICTED | HCM · Audit |

The **Account Switcher** (top-right dropdown) allows switching between roles within a session, simulating JWT token re-issuance. Every switch is written to the immutable Audit Log with timestamp, previous role, new role, and clearance level.

### 💰 Financial Command (ESS · SAP-FI/CO)

- Six KPI tiles: Revenue ₹11,431.88 Cr (+20.8% YoY), PAT ₹2,324.88 Cr (+25.9%), EBITDA ₹3,228.80 Cr (+95.8%), PBT ₹3,109.20 Cr (+28.2%), Order Book ₹32,260 Cr, Cash Flow ₹21 Bn (+203.9%)
- Dual-axis Chart.js time-series: 5-year Revenue (bars) + PAT (line) trajectory FY21–FY25
- Full P&L comparison table: FY23-24 vs FY24-25 with all 8 financial metrics and YoY variance
- Dividend tracking module: ₹23.19 (1st interim) + ₹3.00 (2nd interim) declared per share
- Promoter holding tracker: 84.83% held by Government of India (Dept. of Defence Production)
- Indigenization doughnut chart: Make in India 76% vs Imports 24%
- Secondary metrics strip: EBITDA margin, Revenue/Employee ₹47.17M, Profit/Employee ₹9.21M, RONW, Debt-to-Equity (0.00x), lifetime deliveries

### 🚢 Project & Spatial MIS (SAP-PS)

- **Order Book Portfolio Grid** (Grid.js): 9 active programmes with WBS codes, contract values, remaining balances, % complete, SPI (Schedule Performance Index), indigenization %, and status tags — sortable, searchable, paginated
- **P15B & P17A Vessel Tracking Table**: granular row-by-row milestone tracking with keel laying dates, launching dates, and commissioning/delivery status for all 8 vessels (INS Visakhapatnam → INS Mahendragiri)
- **Indigenization Progression Bars**: P15 (42%) → P15A (59%) → P15B (72%) → P17A (75%)
- **P-75I Pipeline Alert**: ₹70,000–₹1,00,000 Cr next-generation submarine programme (MDL-TKMS JV)
- **Berth & Dock Utilisation Dashboard**: 8 assets (DD-01, DD-02, SUB-DD, FDD-NH, WB-01..03, CRANE-300T, SLIP-3B+6S, SIF) with real-time utilisation bars and OEE metrics
- **Milestone Event Log**: Tri-Commissioning Jan 15 2025, INS Udaygiri, INS Taragiri target, MPV keel laying

### 📦 Supply Chain & Vendors (SAP-MM · ROMIS)

- **JPC Steel Price Monitor**: Mock API for 4 material types with week-on-week change indicators
- **Import/Export Trade Intelligence**: Key suppliers (Vantage Drilling, Sapura, Oceaneering) and export buyers (Safran, Elbit Systems)
- **Inventory Master Grid**: 8 stock items with stock-vs-minimum-threshold tracking and low-stock ⚠ alerts
- **Vendor Register**: Green Channel status, EMD exemption flags (UDYAM/NSIC), 90-day expiry countdown alerts
- **ROMIS Material Issue Logger**: Form writes to `localStorage` (SAP-MM `BAPI_GOODSMVT_CREATE` mock) and instantly updates the live issues grid
- Supply KPI strip: active vendors, materials issued, items below threshold, expiring registrations

### 👷 Human Capital & HSE (SAP-HCM · SAP-EHS)

- **8-tile Workforce KPI strip**: Permanent 2,614 (−7.11% YoY), Fixed-Term 3,385, Sub-Contractors ~4,800, Revenue/Employee ₹47.17M, Profit/Employee ₹9.21M, LTIFR 0.41
- **5-Year Headcount Trend**: Visual bar chart FY21→FY25 showing automation-driven efficiency gains
- **Board & KMP RBAC Table**: 11 executives with designation, MIS access scope, and security clearance level
- **HSE Incident Logger**: Near-miss, Sub-Contractor Hours, Hazard Observation, Toolbox Talk, Permit-to-Work — with ISO 45001 risk matrix severity selector (LOW / MEDIUM / HIGH / CRITICAL)
- **Live Incident Register**: Updates instantly on form submission via `localStorage`
- **Recruitment Drive Tracker**: 1,388 non-executive vacancies across trades (electricians, fitters, welders), 56 disability-reserved slots

### 🏳️ Indigenization & CSR (Compliance)

- **ISO Certification Strip**: 9001:2015 · 14001:2015 · 50001:2018 · 45001:2018 · IMO MSC.428(98) · ISO/IEC 27001:2022
- **CSR Financial Ledger**: Full Section 135 Companies Act accounting — ₹32.45 Cr obligation vs ₹33.10 Cr actual spend, with carry-forward and set-off logic
- **CSR Sectoral Breakdown Bars**: Health & Nutrition 69% · Education 20% · R&D 2% · Other 9%, with initiative-level detail (2,800 school girls vaccinated; Nair Hospital pulmonary machinery)
- **Production & OEE KPI Cards**: OEE 91%, Machine Uptime 97.2%, Labor Productivity 108 hrs/tonne, P15B On-Time Delivery 100%, Avg. Destroyer Cycle 18 months
- **RDBMS ERD Reference**: All 8 normalized entity schemas with PKs, FKs, and core attributes

### 📋 Audit Log

- Immutable event register logging every: login, role switch, view access, and data creation event
- Columns: Timestamp · User · Role · Clearance · Action · Detail
- Grid.js table with sort and pagination; badge counter in sidebar

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| Tailwind CSS | CDN (latest) | Layout utility classes |
| IBM Plex Mono | Google Fonts | Data / telemetry typography |
| IBM Plex Sans | Google Fonts | UI body copy |
| Rajdhani | Google Fonts | Display headers |
| Font Awesome | 6.5.1 | Icons |
| Chart.js | CDN (latest) | Revenue/PAT dual-axis chart, indigenization doughnut |
| Grid.js | CDN (latest) | Dense, sortable, paginated data grids |

Zero npm dependencies. Zero build step. Zero backend.

---

## Running Locally

```bash
# Clone the repository
git clone https://github.com/atharv3142m/Mazgaon-Dock-MIS.git
cd Mazgaon-Dock-MIS

# Open directly in browser — no server needed
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux

# Or use any static server
npx serve .
python3 -m http.server 8080
```

The app seeds `localStorage` with mock data on first load. To **reset all data**, run in browser console:

```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith("mdl_v5"))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

---

## Deploying to GitHub Pages

### Option A — GitHub Actions (Automatic, Recommended)

The included workflow at `.github/workflows/deploy.yml` deploys automatically on every push to `main`.

1. Go to **Settings → Pages**
2. Set **Source** to `GitHub Actions`
3. Push to `main` — the workflow handles the rest

The workflow uses Node.js 24-compatible action versions:

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true   # fixes Node.js 20 deprecation warning

steps:
  - uses: actions/checkout@v4
  - uses: actions/configure-pages@v5
  - uses: actions/upload-pages-artifact@v3
  - uses: actions/deploy-pages@v4
```

### Option B — Manual (Branch Deploy)

1. Go to **Settings → Pages**
2. Set **Source** to `Deploy from a branch`
3. Select `main` branch, `/ (root)` folder
4. Click Save

---

## File Structure

```
Mazgaon-Dock-MIS/
├── index.html                  # App shell — all 6 views, RBAC overlay, modals
├── style.css                   # Dark control room theme — IBM Plex + Rajdhani
├── app.js                      # RBAC engine, all 5 modules, Chart.js, Grid.js
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment (Node.js 24 fixed)
└── README.md                   # This file
```

---

## Data Reset & localStorage Keys

| Key | Content | SAP Equivalent |
|---|---|---|
| `mdl_v5_initialized` | Bootstrap flag | — |
| `mdl_v5_strategic` | Financial KPIs (FY21–FY25) | SAP-FI/CO P&L |
| `mdl_v5_projects` | WBS project objects | SAP-PS |
| `mdl_v5_inventory` | Inventory master (8 items) | SAP-MM |
| `mdl_v5_vendors` | Vendor master (6 vendors) | SAP-MM Vendor |
| `mdl_v5_materials` | ROMIS material issue log | SAP-MM GM |
| `mdl_v5_hse` | HSE incident register | SAP-EHS |
| `mdl_v5_session` | Active RBAC role (JWT mock) | SAP Auth |
| `mdl_v5_audit` | Immutable audit trail | SAP Security Log |

---

## Changelog

| Version | Changes |
|---|---|
| **v5.1** | Fixed critical JS `SyntaxError` on lines 703/766 (nested template literals in `gridjs.html()` IIFE). RBAC overlay click handlers corrected. All Grid.js cell renderers refactored to use plain helper functions. `bootstrapMockData()` sequencing fixed. |
| **v5.0** | Added RBAC engine with 6 roles and Account Switcher. Full P&L table with corrected FY24-FY25 figures. P15B/P17A vessel tracking table. P-75I pipeline panel. CSR sectoral breakdown. 5-year headcount trend. JPC steel price mock. Audit log view. |
| **v4.0** | 5 modules (Financial, Projects, Supply, HCM, Compliance). Vendor lifecycle, ROMIS logger, inventory master, leadership RBAC table, CSR ledger, RDBMS ERD reference. |
| **v3.0** | 3 modules (ESS, Tactical, HCM). Dark control room theme. Grid.js integration. HSE incident logger. |

---

## Data Sources

All financial figures, project milestone dates, fleet details, and HR demographics are derived from publicly available MDL investor presentations and annual reports:

- MDL Q4 FY24-25 Investor Presentation — [mazagondock.in](https://mazagondock.in)
- MDL Q1 FY25-26 Investor Presentation — [mazagondock.in](https://mazagondock.in)
- MDL Annual Report FY 2024-25 — BSE/NSE Disclosures
- PIB Press Releases — P17A / P15B commissioning events
- MDL Indigenization Book — [mazagondock.in/images/pdf/MDL_Indeginisation_Book.pdf](https://mazagondock.in/images/pdf/MDL_Indeginisation_Book.pdf)

---

## License

This is an academic/prototype project. All MDL branding, financial data, and vessel names are used strictly for educational demonstration purposes and remain the property of Mazagon Dock Shipbuilders Limited and the Government of India.

## MDL MIS Prototype (GitHub Pages Ready)

This is a **front-end only Management Information System (MIS) prototype** for **Mazagon Dock Shipbuilders Limited (MDL)**. It is designed to run entirely in the browser and is fully deployable on **GitHub Pages**.

### Tech Stack & Architecture

- **Frontend**: `HTML5`, `Tailwind CSS` (via CDN), `Vanilla JavaScript`
- **Visualisation**: `Chart.js` (via CDN) for the indigenisation pie chart and autonomy gauge
- **Data Storage**: `window.localStorage` to simulate a persistent client‑side database
- **Files**:
  - `index.html` – Shell layout, sidebar, three views (Strategic / Tactical / Operational)
  - `style.css` – Tailwind-enhanced custom styles for MDL marine/defence theme
  - `app.js` – Modular JavaScript: data bootstrap, storage layer, UI rendering, and form handlers

There is **no backend** and **no external database**. All data resides in the user’s browser.

### Functional Overview

- **Strategic View (ESS)**:
  - Navratna autonomy tracker (₹1,000 Cr limit) with a progress bar and Chart.js gauge‑style doughnut
  - Financial KPIs: Order Book Value and Net Profit Margin
  - Indigenisation index: Make in India vs Imported pie chart

- **Tactical View (MIS)**:
  - Budget vs Actual table for major projects (P15B, P17A, P75, etc.), including cost variance and variance %
  - Critical resource allocation widget for **Heavy‑Lift Crane** and **Dry Dock 1**

- **Operational View (TPS)**:
  - **Material Issue Logger**: form writes entries to `localStorage` and updates “Recent Materials Issued”
  - **Task / e‑Measurement Logger**: form writes activities to `localStorage` and updates an activity feed

All sample data is **pre‑populated into localStorage on first load** via `bootstrapMockData()` in `app.js`.

### How to Run (GitHub Pages or Local)

1. Place `index.html`, `style.css`, and `app.js` in the root of the repository.
2. Commit and push to GitHub.
3. Enable **GitHub Pages** for the repository (e.g., `main` branch, `/root` folder).
4. Open the GitHub Pages URL in a browser – dashboards should be immediately populated using the seeded mock data.

For quick local testing, simply open `index.html` in a modern browser (no build step required).


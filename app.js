/**
 * ═══════════════════════════════════════════════════════════════════
 * MDL MIS ENTERPRISE PLATFORM · app.js
 * Version: 3.0.0 · MDL-MIS-PROTO
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * This file simulates a three-tier SAP integration layer entirely
 * within the browser using window.localStorage as the persistence
 * engine. Each module maps to a real SAP module:
 *
 *   MODULE              SAP EQUIVALENT         localStorage KEY
 *   ─────────────────── ─────────────────────  ──────────────────
 *   Financial (ESS)     SAP-FI/CO + SAP-BW     mdl_v3_strategic
 *   Project (Tactical)  SAP-PS (Project Sys.)  mdl_v3_projects
 *   HSE / HCM (Ops)     SAP-EHS + SAP-HCM      mdl_v3_hse
 *
 * In a production deployment, these localStorage.setItem() calls
 * would be replaced with RFC (Remote Function Calls) to SAP BAPI
 * endpoints via an OData middleware layer (SAP Gateway / BTP).
 *
 * CRUD simulation:
 *   Read   → localStorage.getItem()  [maps to: SAP BAPI_GET_*]
 *   Create → localStorage.setItem()  [maps to: SAP BAPI_CREATE_*]
 *   Update → read → mutate → write   [maps to: SAP BAPI_CHANGE_*]
 *   Delete → filter array → write    [maps to: SAP BAPI_DELETE_*]
 * ═══════════════════════════════════════════════════════════════════
 */

"use strict";

// ─────────────────────────────────────────────────────────────────
// STORAGE KEYS (namespaced to prevent collision with other apps)
// ─────────────────────────────────────────────────────────────────
const KEYS = {
  INIT:       "mdl_v3_initialized",
  STRATEGIC:  "mdl_v3_strategic",    // SAP-FI/CO Financial KPIs
  PROJECTS:   "mdl_v3_projects",     // SAP-PS Project Objects
  HSE:        "mdl_v3_hse",          // SAP-EHS Incident Register
};

// ─────────────────────────────────────────────────────────────────
// STORAGE ABSTRACTION LAYER
// Simulates SAP RFC calls to FI/CO, PS, and EHS modules
// ─────────────────────────────────────────────────────────────────
const DB = {
  /**
   * READ — Equivalent to: RFC_READ_TABLE / BAPI_GET_*
   * @param {string} key  - Storage key (SAP table/object type)
   * @param {*}      fallback - Default if no record found
   */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[MDL-MIS] Storage read error:", key, e);
      return fallback;
    }
  },

  /**
   * WRITE — Equivalent to: BAPI_CREATE_* / BAPI_CHANGE_*
   * In SAP this would trigger a COMMIT WORK after the BAPI call.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("[MDL-MIS] Storage write error:", key, e);
      return false;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
// BOOTSTRAP — Seed mock data on first load
// Simulates: SAP initial data load / BDC (Batch Data Communication)
// ─────────────────────────────────────────────────────────────────
function bootstrapMockData() {
  if (localStorage.getItem(KEYS.INIT)) return;

  // ── SAP-FI/CO: P&L and Balance Sheet KPIs (FY25 Audited) ──
  const strategic = {
    revenue:     { fy21: 4200, fy22: 5100, fy23: 7192, fy24: 9462, fy25: 11432 },
    pat:         { fy21: 620,  fy22: 810,  fy23: 1385, fy24: 1900, fy25: 2325  },
    ebitdaPct:   27.4,
    orderBook:   32260,
    cashFlow:    21000, // ₹ Mn
    indigenization: { domestic: 76, imports: 24 },
  };

  // ── SAP-PS: Project Objects / WBS Elements ──
  const projects = [
    {
      id:          "P17A",
      description: "P17A Project Nilgiri · Stealth Frigates (7 ships)",
      contractValue: 59000,
      remaining:   34200,
      spi:         0.97,
      status:      "On Track",
      createdAt:   Date.now() - 86400000 * 180,
    },
    {
      id:          "P75",
      description: "P75 Scorpène Submarines · 6-boat programme",
      contractValue: 23652,
      remaining:   4100,
      spi:         1.02,
      status:      "On Track",
      createdAt:   Date.now() - 86400000 * 365,
    },
    {
      id:          "NAVI-EXP",
      description: "Navis Merchant Export Programme · Nhava Sheva FDD",
      contractValue: 4400,
      remaining:   2600,
      spi:         0.88,
      status:      "Slight Overrun",
      createdAt:   Date.now() - 86400000 * 60,
    },
  ];

  // ── SAP-EHS: Pre-seeded incident records ──
  const hse = [
    {
      id:          crypto.randomUUID(),
      logType:     "near-miss",
      shift:       "A-East",
      description: "Unsecured toolbox at Dock-2 upper gantry. Potential drop hazard. Corrected immediately.",
      personnel:   "CTR-1922",
      hours:       "",
      severity:    "MED",
      createdAt:   Date.now() - 3600000 * 8,
    },
    {
      id:          crypto.randomUUID(),
      logType:     "subcon",
      shift:       "B-East",
      description: "Erection sub-assembly P17A frame-72. All PPE compliant.",
      personnel:   "CTR-2841",
      hours:       32,
      severity:    "LOW",
      createdAt:   Date.now() - 3600000 * 4,
    },
  ];

  DB.set(KEYS.STRATEGIC,  strategic);
  DB.set(KEYS.PROJECTS,   projects);
  DB.set(KEYS.HSE,        hse);

  localStorage.setItem(KEYS.INIT, "1");
  console.info("[MDL-MIS] Mock data bootstrapped to localStorage.");
}

// ─────────────────────────────────────────────────────────────────
// REAL-TIME CLOCK
// ─────────────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now  = new Date();
    const opts = { weekday: "short", day: "2-digit", month: "short", year: "numeric" };
    document.getElementById("clockDate").textContent =
      now.toLocaleDateString("en-IN", opts);
    document.getElementById("clockTime").textContent =
      now.toLocaleTimeString("en-IN", { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

function stampLastRefresh() {
  const el = document.getElementById("lastRefresh");
  if (el) el.textContent = "Last refreshed: " + new Date().toLocaleTimeString("en-IN", { hour12: false });
}

// ─────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────
const VIEWS = {
  ess:      { el: "view-ess",      breadcrumb: "Financial Command › Executive Overview",      onEnter: renderESS      },
  tactical: { el: "view-tactical", breadcrumb: "Project &amp; Spatial MIS › Portfolio View", onEnter: renderTactical },
  hcm:      { el: "view-hcm",      breadcrumb: "Human Capital &amp; HSE › Incident Register", onEnter: renderHCM      },
};

let currentView = null;

function setActiveView(viewKey) {
  if (currentView === viewKey) return;
  currentView = viewKey;

  // Toggle visibility
  Object.keys(VIEWS).forEach(k => {
    const el = document.getElementById(VIEWS[k].el);
    if (el) el.classList.toggle("hidden", k !== viewKey);
  });

  // Sidebar active state
  document.querySelectorAll(".sidebar-item").forEach(el => {
    el.classList.toggle("active", el.dataset.view === viewKey);
  });

  // Breadcrumb
  const bc = document.getElementById("breadcrumb");
  if (bc) {
    bc.innerHTML = `<span>MDL HQ</span>
      <i class="fas fa-angle-right"></i>
      <span>${VIEWS[viewKey].breadcrumb.replace(" › ", '</span><i class="fas fa-angle-right"></i><span>')}</span>`;
  }

  // On-enter hooks
  if (VIEWS[viewKey].onEnter) VIEWS[viewKey].onEnter();
  stampLastRefresh();
}

function wireNavigation() {
  document.querySelectorAll(".sidebar-item").forEach(el => {
    el.addEventListener("click", () => setActiveView(el.dataset.view));
  });

  // Sidebar toggle (mobile + collapse)
  const toggle  = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      if (window.innerWidth < 900) {
        sidebar.classList.toggle("mobile-open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("spinning");
      setTimeout(() => {
        refreshBtn.classList.remove("spinning");
        if (currentView) VIEWS[currentView].onEnter();
        stampLastRefresh();
      }, 600);
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// MODULE 1: ESS — Financial & Economic Command Center
// SAP-FI/CO + SAP-BW equivalent
// ─────────────────────────────────────────────────────────────────
let chartRevenue    = null;
let chartIndi       = null;

function renderESS() {
  const data = DB.get(KEYS.STRATEGIC, null);
  if (!data) return;

  // ── 5-Year Revenue + PAT Chart ──
  const revYears  = ["FY21", "FY22", "FY23", "FY24", "FY25"];
  const revValues = [data.revenue.fy21, data.revenue.fy22, data.revenue.fy23, data.revenue.fy24, data.revenue.fy25];
  const patValues = [data.pat.fy21, data.pat.fy22, data.pat.fy23, data.pat.fy24, data.pat.fy25];

  const burnCtx = document.getElementById("revenueChart");
  if (burnCtx) {
    if (chartRevenue) chartRevenue.destroy();

    // Chart.js global dark defaults
    Chart.defaults.color           = "#8a94a6";
    Chart.defaults.borderColor     = "rgba(255,255,255,0.06)";
    Chart.defaults.font.family     = "'IBM Plex Mono', monospace";
    Chart.defaults.font.size       = 10;

    chartRevenue = new Chart(burnCtx, {
      data: {
        labels: revYears,
        datasets: [
          {
            type:            "bar",
            label:           "Revenue (₹ Cr)",
            data:            revValues,
            backgroundColor: "rgba(32,117,255,0.55)",
            borderColor:     "#2075ff",
            borderWidth:     1,
            yAxisID:         "yRev",
            order:           2,
          },
          {
            type:             "line",
            label:            "PAT (₹ Cr)",
            data:             patValues,
            borderColor:      "#00e5a0",
            backgroundColor:  "rgba(0,229,160,0.08)",
            pointBackgroundColor: "#00e5a0",
            pointBorderColor:    "#00e5a0",
            pointRadius:      4,
            pointHoverRadius: 6,
            borderWidth:      2,
            fill:             true,
            tension:          0.35,
            yAxisID:          "yPat",
            order:            1,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align:    "end",
            labels:   { boxWidth: 10, padding: 16, font: { size: 10 } },
          },
          tooltip: {
            backgroundColor: "#1a2235",
            borderColor:     "#2075ff",
            borderWidth:     1,
            padding:         10,
            titleFont:       { family: "'IBM Plex Mono'", size: 11 },
            bodyFont:        { family: "'IBM Plex Mono'", size: 11 },
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN")} Cr`,
            },
          },
        },
        scales: {
          yRev: {
            type:     "linear",
            position: "left",
            grid:     { color: "rgba(255,255,255,0.04)" },
            ticks:    { callback: v => "₹" + (v / 1000).toFixed(0) + "k" },
          },
          yPat: {
            type:     "linear",
            position: "right",
            grid:     { drawOnChartArea: false },
            ticks:    { callback: v => "₹" + v },
          },
          x: {
            grid: { color: "rgba(255,255,255,0.04)" },
          },
        },
      },
    });
  }

  // ── Indigenization Doughnut ──
  const indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    chartIndi = new Chart(indiCtx, {
      type: "doughnut",
      data: {
        labels:   ["Make in India", "Imports"],
        datasets: [{
          data:            [data.indigenization.domestic, data.indigenization.imports],
          backgroundColor: ["#2075ff", "#2d3a55"],
          borderColor:     ["#2075ff", "#3a4560"],
          borderWidth:     2,
          hoverOffset:     6,
        }],
      },
      options: {
        responsive: true,
        cutout:     "65%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1a2235",
            borderColor:     "#2075ff",
            borderWidth:     1,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// MODULE 2: TACTICAL — Project Portfolio + Spatial Dashboard
// SAP-PS (Project System) equivalent
// ─────────────────────────────────────────────────────────────────
let projectsGridInstance = null;

function getProjects() {
  return DB.get(KEYS.PROJECTS, []);
}

function saveProjects(projects) {
  DB.set(KEYS.PROJECTS, projects);
}

function spiTag(spi) {
  if      (spi >= 1.0) return `<span class="cell-positive">▲ ${spi.toFixed(2)}</span>`;
  else if (spi >= 0.9) return `<span class="cell-neutral">◆ ${spi.toFixed(2)}</span>`;
  else                 return `<span class="cell-negative">▼ ${spi.toFixed(2)}</span>`;
}

function statusTag(status) {
  const map = {
    "On Track":       "tag-on-track",
    "Slight Overrun": "tag-overrun",
    "Managed Overrun":"tag-managed",
    "Underrun":       "tag-underrun",
    "On Hold":        "tag-hold",
  };
  const cls = map[status] || "tag-hold";
  return `<span class="cell-tag ${cls}">${status.toUpperCase()}</span>`;
}

function renderTactical() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;

  const projects = getProjects();

  const rows = projects.map(p => {
    const remaining  = p.remaining.toLocaleString("en-IN");
    const total      = p.contractValue.toLocaleString("en-IN");
    const pctComplete = (((p.contractValue - p.remaining) / p.contractValue) * 100).toFixed(1);

    return [
      p.id,
      p.description,
      "₹" + total + " Cr",
      "₹" + remaining + " Cr",
      pctComplete + "%",
      gridjs.html(spiTag(p.spi)),
      gridjs.html(statusTag(p.status)),
    ];
  });

  const config = {
    columns: [
      { name: "WBS ID",         width: "80px"  },
      { name: "Programme",      width: "280px" },
      { name: "Contract Value", width: "130px" },
      { name: "Remaining",      width: "120px" },
      { name: "% Complete",     width: "100px" },
      { name: "SPI",            width: "80px"  },
      { name: "Status",         width: "140px" },
    ],
    data:   rows,
    sort:   true,
    search: { enabled: true },
    pagination: { enabled: true, limit: 5 },
  };

  if (!projectsGridInstance) {
    projectsGridInstance = new gridjs.Grid(config);
    projectsGridInstance.render(container);
  } else {
    projectsGridInstance.updateConfig(config).forceRender();
  }
}

// ── Add Project Modal ──
function wireProjectModal() {
  const modal       = document.getElementById("addProjectModal");
  const openBtn     = document.getElementById("openAddProjectModal");
  const closeBtn    = document.getElementById("closeProjectModal");
  const cancelBtn   = document.getElementById("cancelProjectModal");
  const saveBtn     = document.getElementById("saveProjectBtn");
  const msgEl       = document.getElementById("projModalMsg");

  if (!modal) return;

  openBtn?.addEventListener("click",   () => modal.classList.remove("hidden"));
  closeBtn?.addEventListener("click",  () => closeProjectModal());
  cancelBtn?.addEventListener("click", () => closeProjectModal());
  modal.addEventListener("click", e => { if (e.target === modal) closeProjectModal(); });

  function closeProjectModal() {
    modal.classList.add("hidden");
    msgEl.classList.add("hidden");
    ["mProjId","mProjDesc","mProjValue","mProjBalance","mProjSpi"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  saveBtn?.addEventListener("click", () => {
    const id    = document.getElementById("mProjId")?.value.trim();
    const desc  = document.getElementById("mProjDesc")?.value.trim();
    const val   = parseFloat(document.getElementById("mProjValue")?.value);
    const bal   = parseFloat(document.getElementById("mProjBalance")?.value);
    const spi   = parseFloat(document.getElementById("mProjSpi")?.value || "1.00");
    const status= document.getElementById("mProjStatus")?.value;

    if (!id || !desc || isNaN(val) || isNaN(bal)) return;

    // SAP-PS: BAPI_PROJECT_MAINTAIN equivalent — append new WBS element
    const projects = getProjects();
    projects.push({ id, description: desc, contractValue: val, remaining: bal, spi, status, createdAt: Date.now() });
    saveProjects(projects);

    // Refresh grid without page reload (SAP OData $batch equivalent)
    renderTactical();

    msgEl.classList.remove("hidden");
    setTimeout(() => {
      msgEl.classList.add("hidden");
      closeProjectModal();
    }, 1400);
  });
}

// ─────────────────────────────────────────────────────────────────
// MODULE 3: HCM / HSE — Workforce & Incident Register
// SAP-EHS + SAP-HCM equivalent (TPS layer)
// ─────────────────────────────────────────────────────────────────
let hseGridInstance = null;

function getHSELogs() {
  return DB.get(KEYS.HSE, []);
}

function saveHSELogs(logs) {
  DB.set(KEYS.HSE, logs);
}

function logTypeLabel(type) {
  const map = {
    "near-miss": "Near-Miss",
    "subcon":    "Sub-Con Hrs",
    "hazard":    "Hazard Obs.",
    "toolbox":   "Toolbox Talk",
  };
  return map[type] || type;
}

function renderHCM() {
  // Update live KPI counters from localStorage (SAP-EHS BAPI_EHS_INCIDENT_GET equivalent)
  const logs       = getHSELogs();
  const nearMissCount = logs.filter(l => l.logType === "near-miss").length;
  const totalHrs      = logs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

  const nmEl = document.getElementById("kpi-near-miss");
  const hrEl = document.getElementById("kpi-subcon-hrs");
  if (nmEl) nmEl.textContent = nearMissCount;
  if (hrEl) hrEl.textContent = totalHrs.toLocaleString("en-IN");

  // Update entry count badge
  const countBadge = document.getElementById("hseEntryCount");
  if (countBadge) countBadge.textContent = logs.length + " ENTRIES";

  // ── Grid.js render ──
  const container = document.getElementById("hseGrid");
  if (!container) return;

  const rows = logs
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(l => [
      logTypeLabel(l.logType),
      l.shift,
      l.description.length > 60 ? l.description.substring(0, 60) + "…" : l.description,
      l.personnel || "—",
      l.hours ? l.hours + " hrs" : "—",
      gridjs.html(`<span class="sev-tag ${l.severity}">${l.severity}</span>`),
      new Date(l.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    ]);

  const config = {
    columns: [
      { name: "Type",        width: "100px" },
      { name: "Zone/Shift",  width: "110px" },
      { name: "Activity",    width: "240px" },
      { name: "Personnel",   width: "90px"  },
      { name: "Hours",       width: "70px"  },
      { name: "Severity",    width: "80px"  },
      { name: "Logged At",   width: "130px" },
    ],
    data: rows,
    sort: true,
    pagination: { enabled: true, limit: 5 },
  };

  if (!hseGridInstance) {
    hseGridInstance = new gridjs.Grid(config);
    hseGridInstance.render(container);
  } else {
    hseGridInstance.updateConfig(config).forceRender();
  }
}

// ── Severity selector wiring ──
let selectedSeverity = "LOW";

function wireSeveritySelector() {
  const btns = document.querySelectorAll(".sev-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSeverity = btn.dataset.sev;
    });
  });
}

// ── HSE Log Form ──
function wireHSEForm() {
  const logBtn  = document.getElementById("logHseBtn");
  const msgEl   = document.getElementById("hseFormMsg");

  logBtn?.addEventListener("click", () => {
    const logType     = document.getElementById("hseLogType")?.value;
    const shift       = document.getElementById("hseShift")?.value;
    const description = document.getElementById("hseDescription")?.value.trim();
    const personnel   = document.getElementById("hsePersonnel")?.value.trim();
    const hours       = parseFloat(document.getElementById("hseHours")?.value) || null;

    if (!logType || !shift || !description) {
      // Minimal field validation — SAP field-status check equivalent
      document.getElementById("hseDescription")?.focus();
      return;
    }

    /**
     * SAP-EHS: BAPI_EHS_INCIDENT_CREATE equivalent
     * Creates an incident object in the localStorage-based EHS table.
     * In production this would call: /sap/opu/odata/sap/EHS_INCIDENT_SRV/
     */
    const logs = getHSELogs();
    const newEntry = {
      id:          crypto.randomUUID(),
      logType,
      shift,
      description,
      personnel:   personnel || "",
      hours:       hours || "",
      severity:    selectedSeverity,
      createdAt:   Date.now(),
    };

    logs.push(newEntry);
    saveHSELogs(logs);

    // Immediate grid refresh (SAP real-time OData $delta equivalent)
    renderHCM();

    // Flash success message
    msgEl.classList.remove("hidden");
    setTimeout(() => msgEl.classList.add("hidden"), 2000);

    // Reset form fields (SAP screen reset equivalent)
    document.getElementById("hseDescription").value = "";
    document.getElementById("hsePersonnel").value   = "";
    document.getElementById("hseHours").value       = "";
  });
}

// ─────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 1. Seed localStorage with mock data (first-time only)
  bootstrapMockData();

  // 2. Start real-time clock
  startClock();

  // 3. Wire navigation and controls
  wireNavigation();
  wireProjectModal();
  wireSeveritySelector();
  wireHSEForm();

  // 4. Set initial view (ESS — Executive Strategic Summary)
  setActiveView("ess");

  console.info("[MDL-MIS] Platform initialized. localStorage keys:", Object.values(KEYS));
});

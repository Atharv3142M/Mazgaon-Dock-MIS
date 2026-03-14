// -------------------------------
// MDL MIS PROTOTYPE – CORE CONFIG
// -------------------------------

const MDL_STORAGE_KEYS = {
  INIT_FLAG: "mdl_mis_initialized",
  STRATEGIC: "mdl_mis_strategic",
  TACTICAL: "mdl_mis_tactical",
  MATERIALS: "mdl_mis_materials",
  TASKS: "mdl_mis_tasks",
};

// Safe JSON helpers to keep data handling isolated
const StorageService = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to parse localStorage for", key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Failed to write localStorage for", key, e);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn("Failed to remove localStorage for", key, e);
    }
  },
};

// -------------------------------
// DATA INITIALISATION (MOCK DATA)
// -------------------------------

function bootstrapMockData() {
  const alreadyInitialised = window.localStorage.getItem(
    MDL_STORAGE_KEYS.INIT_FLAG
  );
  if (alreadyInitialised) return;

  // Strategic level data (executive)
  const strategicData = {
    // All amounts in Crores (₹ Cr)
    orderBookValue: 38000,
    netProfitMargin: 19.9,
    navratnaAutonomy: {
      limit: 1000,
      utilised: 640, // Illustrative
    },
    indigenisationIndex: {
      domesticPercent: 78,
      importedPercent: 22,
    },
  };

  // Tactical level data (projects + resources)
  const tacticalData = {
    projects: [
      {
        id: "P15B",
        name: "P15B Destroyers",
        budgetedCost: 9500,
        actualCost: 9720,
        status: "Slight Overrun",
      },
      {
        id: "P17A",
        name: "P17A Frigates",
        budgetedCost: 12500,
        actualCost: 12340,
        status: "On Track",
      },
      {
        id: "P75",
        name: "P75 Submarines",
        budgetedCost: 8700,
        actualCost: 8940,
        status: "Managed Overrun",
      },
      {
        id: "MCMV",
        name: "Mine Counter Measure Vessels",
        budgetedCost: 4200,
        actualCost: 4050,
        status: "Underrun",
      },
    ],
    resources: {
      heavyLiftCrane: {
        project: "P17A Frigates – Hull 801",
        status: "Block erection in progress",
      },
      dryDock1: {
        project: "P75 Submarines – Boat 5",
        status: "Outfitting & harbour trials",
      },
    },
  };

  // Operational level starter logs
  const initialMaterials = [
    {
      id: crypto.randomUUID(),
      materialType: "High Tensile Steel Plate",
      heatNumber: "HT-24-019",
      quantity: 24,
      unit: "MT",
      projectRef: "P15B – Hull 127",
      createdAt: Date.now() - 1000 * 60 * 60 * 3, // 3h ago
    },
    {
      id: crypto.randomUUID(),
      materialType: "Bulb Bar Section",
      heatNumber: "BB-24-102",
      quantity: 340,
      unit: "M",
      projectRef: "P17A – Hull 801",
      createdAt: Date.now() - 1000 * 60 * 60, // 1h ago
    },
  ];

  const initialTasks = [
    {
      id: crypto.randomUUID(),
      description: "Keel laying completed for P17A – Hull 801",
      project: "P17A – 801",
      subcontractor: "ABC Shipbuilding Services",
      stage: "Completed",
      measurement: "Verified by QC and WOT",
      createdAt: Date.now() - 1000 * 60 * 60 * 5,
    },
    {
      id: crypto.randomUUID(),
      description:
        "Pressure hull ring welding completed for P75 – Boat 5, Bay 3",
      project: "P75 – Boat 5",
      subcontractor: "Deepsea Fabricators LLP",
      stage: "Inspection Call Raised",
      measurement: "32 m of circumferential weld",
      createdAt: Date.now() - 1000 * 60 * 30,
    },
  ];

  StorageService.set(MDL_STORAGE_KEYS.STRATEGIC, strategicData);
  StorageService.set(MDL_STORAGE_KEYS.TACTICAL, tacticalData);
  StorageService.set(MDL_STORAGE_KEYS.MATERIALS, initialMaterials);
  StorageService.set(MDL_STORAGE_KEYS.TASKS, initialTasks);

  window.localStorage.setItem(MDL_STORAGE_KEYS.INIT_FLAG, "true");
}

// -------------------------------
// DATA ACCESS LAYER
// -------------------------------

const DataAPI = {
  getStrategic() {
    return StorageService.get(MDL_STORAGE_KEYS.STRATEGIC, null);
  },
  getTactical() {
    return StorageService.get(MDL_STORAGE_KEYS.TACTICAL, { projects: [], resources: {} });
  },
  getMaterials() {
    return StorageService.get(MDL_STORAGE_KEYS.MATERIALS, []);
  },
  getTasks() {
    return StorageService.get(MDL_STORAGE_KEYS.TASKS, []);
  },
  addMaterial(material) {
    const current = this.getMaterials();
    const enriched = {
      ...material,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const updated = [enriched, ...current].slice(0, 25); // Keep recent 25
    StorageService.set(MDL_STORAGE_KEYS.MATERIALS, updated);
    return updated;
  },
  addTask(task) {
    const current = this.getTasks();
    const enriched = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const updated = [enriched, ...current].slice(0, 30);
    StorageService.set(MDL_STORAGE_KEYS.TASKS, updated);
    return updated;
  },
  clearTasks() {
    StorageService.set(MDL_STORAGE_KEYS.TASKS, []);
    return [];
  },
};

// -------------------------------
// UI HELPERS
// -------------------------------

const UIHelpers = {
  formatCurrencyCr(amount) {
    if (typeof amount !== "number") return "-";
    return `₹${amount.toLocaleString("en-IN", {
      maximumFractionDigits: 1,
    })} Cr`;
  },
  formatPercent(value) {
    if (typeof value !== "number") return "-";
    return `${value.toFixed(1)}%`;
  },
  formatVariance(budgeted, actual) {
    const variance = actual - budgeted;
    const sign = variance > 0 ? "+" : "";
    return `${sign}${variance.toFixed(1)}`;
  },
  formatVariancePercent(budgeted, actual) {
    if (!budgeted) return "-";
    const variancePct = ((actual - budgeted) / budgeted) * 100;
    const sign = variancePct > 0 ? "+" : "";
    return `${sign}${variancePct.toFixed(1)}%`;
  },
  formatDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  },
};

// -------------------------------
// CHARTS
// -------------------------------

const ChartManager = (function () {
  /** @type {Chart | null} */
  let indigenisationChart = null;
  /** @type {Chart | null} */
  let autonomyGaugeChart = null;

  function destroyIfExists(chart) {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  }

  function renderIndigenisationChart(data) {
    const ctx = document.getElementById("indigenisationChart");
    if (!ctx) return;

    destroyIfExists(indigenisationChart);

    indigenisationChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Make in India", "Imported"],
        datasets: [
          {
            data: [data.domesticPercent, data.importedPercent],
            backgroundColor: ["#22c55e", "#0ea5e9"],
            borderColor: ["#064e3b", "#0f172a"],
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
              font: {
                size: 10,
                family: "Inter, system-ui, sans-serif",
              },
            },
          },
        },
      },
    });
  }

  // Gauge-style doughnut for autonomy utilisation
  function renderAutonomyGauge(limit, utilised) {
    const ctx = document.getElementById("autonomyGaugeChart");
    if (!ctx) return;

    destroyIfExists(autonomyGaugeChart);

    const utilisationPct = Math.min(100, (utilised / limit) * 100);

    autonomyGaugeChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Utilised", "Available"],
        datasets: [
          {
            data: [utilisationPct, 100 - utilisationPct],
            backgroundColor: ["#22c55e", "#1e293b"],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
            cutout: "70%",
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }

  return {
    renderStrategicCharts(strategic) {
      if (!strategic) return;
      renderIndigenisationChart(strategic.indigenisationIndex);
      renderAutonomyGauge(
        strategic.navratnaAutonomy.limit,
        strategic.navratnaAutonomy.utilised
      );
    },
  };
})();

// -------------------------------
// VIEW RENDERING
// -------------------------------

function renderStrategicView() {
  const data = DataAPI.getStrategic();
  if (!data) return;

  // KPI cards
  const orderBookEl = document.getElementById("kpi-order-book");
  const netMarginEl = document.getElementById("kpi-net-margin");
  const autonomyEl = document.getElementById("kpi-autonomy");
  const autonomyProgressBar = document.getElementById("autonomy-progress-bar");
  const autonomyUtilisedLabel = document.getElementById(
    "autonomy-utilised-label"
  );
  const indiDomesticLabel = document.getElementById("indi-domestic-label");
  const indiImportedLabel = document.getElementById("indi-imported-label");

  if (
    !orderBookEl ||
    !netMarginEl ||
    !autonomyEl ||
    !autonomyProgressBar ||
    !autonomyUtilisedLabel ||
    !indiDomesticLabel ||
    !indiImportedLabel
  ) {
    return;
  }

  orderBookEl.textContent = UIHelpers.formatCurrencyCr(data.orderBookValue);
  netMarginEl.textContent = UIHelpers.formatPercent(data.netProfitMargin);

  const { limit, utilised } = data.navratnaAutonomy;
  const utilisationPct = Math.min(100, (utilised / limit) * 100);
  autonomyEl.textContent = `${utilisationPct.toFixed(1)}% Utilised`;
  autonomyUtilisedLabel.textContent = `${UIHelpers.formatCurrencyCr(
    utilised
  )} of ${UIHelpers.formatCurrencyCr(limit)}`;
  autonomyProgressBar.style.width = `${utilisationPct}%`;

  indiDomesticLabel.textContent = `${data.indigenisationIndex.domesticPercent}%`;
  indiImportedLabel.textContent = `${data.indigenisationIndex.importedPercent}%`;

  ChartManager.renderStrategicCharts(data);
}

function renderTacticalView() {
  const data = DataAPI.getTactical();
  const tbody = document.getElementById("projects-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  data.projects.forEach((p) => {
    const variance = p.actualCost - p.budgetedCost;
    const variancePct = ((p.actualCost - p.budgetedCost) / p.budgetedCost) * 100;
    const isOver = variance > 0;

    const tr = document.createElement("tr");
    tr.className = "table-row";
    tr.innerHTML = `
      <td class="table-cell text-left">
        <div class="font-semibold">${p.name}</div>
        <div class="text-[0.65rem] text-slate-400">${p.id}</div>
      </td>
      <td class="table-cell text-right">${p.budgetedCost.toFixed(1)}</td>
      <td class="table-cell text-right">${p.actualCost.toFixed(1)}</td>
      <td class="table-cell text-right ${
        isOver ? "text-amber-300" : "text-emerald-300"
      }">
        ${UIHelpers.formatVariance(p.budgetedCost, p.actualCost)}
      </td>
      <td class="table-cell text-right ${
        isOver ? "text-amber-300" : "text-emerald-300"
      }">
        ${UIHelpers.formatVariancePercent(p.budgetedCost, p.actualCost)}
      </td>
      <td class="table-cell text-center">
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-medium
          ${
            isOver
              ? "bg-amber-500/10 text-amber-200 border border-amber-500/40"
              : "bg-emerald-500/10 text-emerald-200 border border-emerald-500/40"
          }
        ">
          ${p.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Resource allocation
  const craneProject = document.getElementById("resource-crane-project");
  const craneStatus = document.getElementById("resource-crane-status");
  const dockProject = document.getElementById("resource-drydock-project");
  const dockStatus = document.getElementById("resource-drydock-status");
  if (!craneProject || !craneStatus || !dockProject || !dockStatus) return;

  craneProject.textContent = data.resources.heavyLiftCrane.project;
  craneStatus.textContent = data.resources.heavyLiftCrane.status;
  dockProject.textContent = data.resources.dryDock1.project;
  dockStatus.textContent = data.resources.dryDock1.status;
}

function renderMaterialsTable() {
  const tbody = document.getElementById("materials-table-body");
  if (!tbody) return;
  const materials = DataAPI.getMaterials();
  tbody.innerHTML = "";

  if (!materials.length) {
    const tr = document.createElement("tr");
    tr.className = "table-row";
    tr.innerHTML = `
      <td class="table-cell text-left text-[0.7rem] text-slate-400" colspan="5">
        No material issues logged yet. Use the form above to capture the first entry.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  materials.forEach((m) => {
    const tr = document.createElement("tr");
    tr.className = "table-row";
    tr.innerHTML = `
      <td class="table-cell text-left">
        <div class="font-semibold">${m.materialType}</div>
      </td>
      <td class="table-cell text-left">${m.heatNumber}</td>
      <td class="table-cell text-right">
        ${m.quantity} ${m.unit || ""}
      </td>
      <td class="table-cell text-left">${m.projectRef || "-"}</td>
      <td class="table-cell text-right text-[0.65rem] text-slate-400">
        ${UIHelpers.formatDateTime(m.createdAt)}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderActivityFeed() {
  const container = document.getElementById("activity-feed");
  if (!container) return;
  const tasks = DataAPI.getTasks();
  container.innerHTML = "";

  if (!tasks.length) {
    const p = document.createElement("p");
    p.className = "text-[0.7rem] text-slate-400";
    p.textContent =
      "No activities logged yet. Use the form above to add subcontractor milestones and e-measurements.";
    container.appendChild(p);
    return;
  }

  tasks.forEach((t) => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="activity-pill">
          ${t.stage}
        </span>
        <span class="activity-time">
          ${UIHelpers.formatDateTime(t.createdAt)}
        </span>
      </div>
      <p class="activity-description mt-1">
        ${t.description}
      </p>
      <div class="activity-meta">
        <span>Project: <span class="text-slate-200">${t.project}</span></span>
        ${
          t.subcontractor
            ? `<span>Subcontractor: <span class="text-slate-200">${t.subcontractor}</span></span>`
            : ""
        }
        ${
          t.measurement
            ? `<span>Measurement: <span class="text-slate-200">${t.measurement}</span></span>`
            : ""
        }
      </div>
    `;
    container.appendChild(div);
  });
}

// -------------------------------
// NAVIGATION / VIEW SWITCHING
// -------------------------------

function setActiveView(viewKey) {
  // Update sections
  const sections = {
    strategic: document.getElementById("view-strategic"),
    tactical: document.getElementById("view-tactical"),
    operational: document.getElementById("view-operational"),
  };

  Object.entries(sections).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== viewKey);
  });

  // Update title + subtitle copy
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");

  if (title && subtitle) {
    if (viewKey === "strategic") {
      title.textContent = "Strategic View · Executive Support System (ESS)";
      subtitle.textContent =
        "Board-level snapshot of autonomy utilisation, financial KPIs, and indigenisation.";
    } else if (viewKey === "tactical") {
      title.textContent = "Tactical View · Management Information System (MIS)";
      subtitle.textContent =
        "Project-wise budget vs actual performance and critical yard resource allocation.";
    } else {
      title.textContent =
        "Operational View · Transaction Processing System (TPS)";
      subtitle.textContent =
        "Supervisor tools for logging material issues and subcontractor progress.";
    }
  }

  // Sidebar buttons
  document
    .querySelectorAll("#sidebar-nav .nav-item")
    .forEach((btn) =>
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-view") === viewKey
      )
    );

  // Mobile pills
  document
    .querySelectorAll(".mobile-nav-pill")
    .forEach((btn) =>
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-view") === viewKey
      )
    );

  // Ensure relevant data is rendered when switching
  if (viewKey === "strategic") {
    renderStrategicView();
  } else if (viewKey === "tactical") {
    renderTacticalView();
  } else {
    renderMaterialsTable();
    renderActivityFeed();
  }
}

function wireNavigation() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewKey = btn.getAttribute("data-view");
      if (viewKey) {
        setActiveView(viewKey);
      }
    });
  });
}

// -------------------------------
// FORM HANDLERS
// -------------------------------

function wireForms() {
  // Material form
  const materialForm = document.getElementById("material-form");
  const materialMsg = document.getElementById("material-form-message");
  if (materialForm) {
    materialForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(materialForm);
      const payload = {
        materialType: String(formData.get("materialType") || "").trim(),
        heatNumber: String(formData.get("heatNumber") || "").trim(),
        quantity: Number(formData.get("quantity") || 0),
        unit: String(formData.get("unit") || "Nos"),
        projectRef: String(formData.get("projectRef") || "").trim(),
      };

      if (!payload.materialType || !payload.heatNumber || !payload.quantity) {
        return;
      }

      DataAPI.addMaterial(payload);
      materialForm.reset();
      renderMaterialsTable();

      if (materialMsg) {
        materialMsg.classList.remove("hidden");
        setTimeout(() => materialMsg.classList.add("hidden"), 2500);
      }
    });
  }

  // Task form
  const taskForm = document.getElementById("task-form");
  const taskMsg = document.getElementById("task-form-message");
  if (taskForm) {
    taskForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(taskForm);
      const payload = {
        description: String(formData.get("description") || "").trim(),
        project: String(formData.get("project") || "").trim(),
        subcontractor: String(formData.get("subcontractor") || "").trim(),
        stage: String(formData.get("stage") || "Initiated"),
        measurement: String(formData.get("measurement") || "").trim(),
      };

      if (!payload.description || !payload.project) {
        return;
      }

      DataAPI.addTask(payload);
      taskForm.reset();
      renderActivityFeed();

      if (taskMsg) {
        taskMsg.classList.remove("hidden");
        setTimeout(() => taskMsg.classList.add("hidden"), 2500);
      }
    });
  }

  // Clear activity feed
  const clearBtn = document.getElementById("clear-activity-feed");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      DataAPI.clearTasks();
      renderActivityFeed();
    });
  }
}

// -------------------------------
// BOOTSTRAP
// -------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // 1. Seed mock data on first load
  bootstrapMockData();

  // 2. Wire navigation and forms
  wireNavigation();
  wireForms();

  // 3. Render default view
  setActiveView("strategic");
});


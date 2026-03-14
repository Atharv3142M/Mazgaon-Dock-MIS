// ---------------------------------
// Storage keys & helpers
// ---------------------------------
const MDL_KEYS = {
  INIT: "mdl_mis_fiori_initialized",
  STRATEGIC: "mdl_mis_fiori_strategic",
  PROJECTS: "mdl_mis_fiori_projects",
  MATERIALS: "mdl_mis_fiori_materials",
};

const Storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("localStorage parse error", key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage write error", key, e);
    }
  },
};

// ---------------------------------
// Bootstrap mock data (first load)
// ---------------------------------
function bootstrapMockData() {
  if (localStorage.getItem(MDL_KEYS.INIT)) return;

  const strategic = {
    orderBookCr: 38000,
    netMarginPct: 19.9,
    navratnaUtilPct: 64,
    orderBurn: {
      years: ["FY21", "FY22", "FY23", "FY24", "FY25"],
      values: [4000, 6500, 8000, 9500, 11000],
    },
    indigenization: {
      domestic: 76,
      import: 24,
    },
  };

  const projects = [
    {
      id: "P15B",
      description: "P15B Destroyers",
      budget: 9500,
      actual: 9720,
      status: "Slight Overrun",
    },
    {
      id: "P17A",
      description: "P17A Frigates",
      budget: 12500,
      actual: 12340,
      status: "On Track",
    },
    {
      id: "P75",
      description: "P75 Submarines",
      budget: 8700,
      actual: 8940,
      status: "Managed Overrun",
    },
  ];

  const materials = [
    {
      id: crypto.randomUUID(),
      material: "Steel Plate",
      heatNumber: "HT-24-019",
      quantity: 24,
      projectId: "P15B",
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
    },
    {
      id: crypto.randomUUID(),
      material: "Pipes",
      heatNumber: "PP-24-004",
      quantity: 120,
      projectId: "P17A",
      createdAt: Date.now() - 30 * 60 * 1000,
    },
  ];

  Storage.set(MDL_KEYS.STRATEGIC, strategic);
  Storage.set(MDL_KEYS.PROJECTS, projects);
  Storage.set(MDL_KEYS.MATERIALS, materials);

  localStorage.setItem(MDL_KEYS.INIT, "1");
}

// ---------------------------------
// Strategic view rendering
// ---------------------------------
let orderBurnChartInstance = null;
let indigenizationChartInstance = null;

function renderStrategic() {
  const data = Storage.get(MDL_KEYS.STRATEGIC, null);
  if (!data) return;

  document.getElementById("kpi-order-book").textContent =
    "₹" + data.orderBookCr.toLocaleString("en-IN") + " Cr";
  document.getElementById("kpi-net-margin").textContent =
    data.netMarginPct.toFixed(1) + "%";
  document.getElementById("kpi-navratna").textContent =
    data.navratnaUtilPct.toFixed(0) + "%";

  const burnCtx = document.getElementById("orderBurnChart");
  const indiCtx = document.getElementById("indigenizationChart");

  if (orderBurnChartInstance) orderBurnChartInstance.destroy();
  if (indigenizationChartInstance) indigenizationChartInstance.destroy();

  orderBurnChartInstance = new Chart(burnCtx, {
    type: "bar",
    data: {
      labels: data.orderBurn.years,
      datasets: [
        {
          label: "Order Book Recognised (₹ Cr)",
          data: data.orderBurn.values,
          backgroundColor: "#0a6ed1",
          borderColor: "#0859a8",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            font: { size: 10 },
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 10 } },
        },
        y: {
          ticks: { font: { size: 10 } },
        },
      },
    },
  });

  indigenizationChartInstance = new Chart(indiCtx, {
    type: "doughnut",
    data: {
      labels: ["Make in India", "Import"],
      datasets: [
        {
          data: [data.indigenization.domestic, data.indigenization.import],
          backgroundColor: ["#0a6ed1", "#9ca3af"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 10 } },
        },
      },
      cutout: "55%",
    },
  });
}

// ---------------------------------
// Tactical view (projects grid)
// ---------------------------------
let projectsGridInstance = null;

function getProjects() {
  return Storage.get(MDL_KEYS.PROJECTS, []);
}

function saveProjects(projects) {
  Storage.set(MDL_KEYS.PROJECTS, projects);
}

function projectRows() {
  const projects = getProjects();
  return projects.map((p) => {
    const variance = p.actual - p.budget;
    const varianceClass =
      variance >= 0 ? "variance-negative" : "variance-positive";
    const varianceText =
      (variance >= 0 ? "+" : "") + variance.toFixed(1);

    return [
      p.id,
      p.description,
      p.budget.toFixed(1),
      p.actual.toFixed(1),
      gridjs.html(
        `<span class="${varianceClass}">${varianceText}</span>`
      ),
      p.status,
    ];
  });
}

function renderProjectsGrid() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;

  const config = {
    columns: [
      "Project ID",
      "Description",
      "Budgeted Cost (₹ Cr)",
      "Actual Cost (₹ Cr)",
      "Variance (₹ Cr)",
      "Status",
    ],
    data: projectRows(),
    sort: true,
    search: {
      enabled: true,
    },
    pagination: {
      enabled: true,
      limit: 5,
    },
    style: {
      th: {
        "background-color": "#f3f4f6",
        "font-size": "11px",
        "text-transform": "uppercase",
        "color": "#6b7280",
      },
      td: {
        "font-size": "12px",
      },
    },
  };

  if (!projectsGridInstance) {
    projectsGridInstance = new gridjs.Grid(config);
    projectsGridInstance.render(container);
  } else {
    projectsGridInstance.updateConfig(config).forceRender();
  }
}

// ---------------------------------
// Operational view (materials grid)
// ---------------------------------
let materialsGridInstance = null;

function getMaterials() {
  return Storage.get(MDL_KEYS.MATERIALS, []);
}

function saveMaterials(materials) {
  Storage.set(MDL_KEYS.MATERIALS, materials);
}

function materialRows() {
  const m = getMaterials();
  return m
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((row) => [
      row.material,
      row.heatNumber,
      row.quantity,
      row.projectId,
      new Date(row.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ]);
}

function renderMaterialsGrid() {
  const container = document.getElementById("materialsGrid");
  if (!container) return;

  const config = {
    columns: [
      "Material",
      "Heat Number",
      "Quantity",
      "Project ID",
      "Logged At",
    ],
    data: materialRows(),
    sort: true,
    pagination: {
      enabled: true,
      limit: 5,
    },
    style: {
      th: {
        "background-color": "#f3f4f6",
        "font-size": "11px",
        "text-transform": "uppercase",
        "color": "#6b7280",
      },
      td: {
        "font-size": "12px",
      },
    },
  };

  if (!materialsGridInstance) {
    materialsGridInstance = new gridjs.Grid(config);
    materialsGridInstance.render(container);
  } else {
    materialsGridInstance.updateConfig(config).forceRender();
  }
}

// ---------------------------------
// Navigation & breadcrumbs
// ---------------------------------
function setActiveView(view) {
  const sections = {
    strategic: document.getElementById("view-strategic"),
    tactical: document.getElementById("view-tactical"),
    operational: document.getElementById("view-operational"),
  };

  Object.entries(sections).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== view);
  });

  // Sidebar
  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle(
      "active",
      el.getAttribute("data-view") === view
    );
  });

  // Breadcrumbs
  const breadcrumb = document.getElementById("breadcrumb");
  if (breadcrumb) {
    if (view === "strategic") {
      breadcrumb.innerHTML =
        '<span>Home</span><i class="fas fa-chevron-right"></i><span>Strategic</span><i class="fas fa-chevron-right"></i><span>Executive Dashboard</span>';
    } else if (view === "tactical") {
      breadcrumb.innerHTML =
        '<span>Home</span><i class="fas fa-chevron-right"></i><span>Tactical</span><i class="fas fa-chevron-right"></i><span>Budget Variance</span>';
      renderProjectsGrid();
    } else if (view === "operational") {
      breadcrumb.innerHTML =
        '<span>Home</span><i class="fas fa-chevron-right"></i><span>Operational</span><i class="fas fa-chevron-right"></i><span>Material Issue Logger</span>';
      renderMaterialsGrid();
    }
  }

  if (view === "strategic") {
    renderStrategic();
  }
}

function wireNavigation() {
  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.addEventListener("click", () => {
      const view = el.getAttribute("data-view");
      setActiveView(view);
    });
  });

  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      if (sidebar.classList.contains("-translate-x-full")) {
        sidebar.classList.remove("-translate-x-full");
      } else {
        sidebar.classList.add("-translate-x-full");
      }
    });

    if (window.innerWidth < 768) {
      sidebar.classList.add("-translate-x-full");
    }
  }
}

// ---------------------------------
// Modal wiring (Add Project)
// ---------------------------------
function openProjectModal() {
  document.getElementById("projectModal").classList.remove("hidden");
}

function closeProjectModal() {
  document.getElementById("projectModal").classList.add("hidden");
  document.getElementById("projectForm").reset();
  document.getElementById("projectFormMessage").classList.add("hidden");
}

function wireProjectModal() {
  const openBtn = document.getElementById("openProjectModal");
  const closeBtn = document.getElementById("closeProjectModal");
  const cancelBtn = document.getElementById("cancelProjectBtn");
  const modal = document.getElementById("projectModal");

  if (openBtn) openBtn.addEventListener("click", openProjectModal);
  if (closeBtn) closeBtn.addEventListener("click", closeProjectModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeProjectModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProjectModal();
  });

  const form = document.getElementById("projectForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("projId").value.trim();
    const description = document
      .getElementById("projDescription")
      .value.trim();
    const budget = parseFloat(
      document.getElementById("projBudget").value
    );
    const actual = parseFloat(
      document.getElementById("projActual").value
    );
    const status = document.getElementById("projStatus").value;

    if (!id || !description || isNaN(budget) || isNaN(actual)) return;

    const projects = getProjects();
    projects.push({ id, description, budget, actual, status });
    saveProjects(projects);
    renderProjectsGrid();

    const msg = document.getElementById("projectFormMessage");
    msg.classList.remove("hidden");
    setTimeout(() => {
      msg.classList.add("hidden");
      closeProjectModal();
    }, 1200);
  });
}

// ---------------------------------
// Material form wiring
// ---------------------------------
function wireMaterialForm() {
  const btn = document.getElementById("logMaterialBtn");
  const msg = document.getElementById("materialFormMessage");

  btn.addEventListener("click", () => {
    const material = document.getElementById("materialType").value;
    const heatNumber = document.getElementById("heatNumber").value.trim();
    const qtyVal = document.getElementById("quantity").value;
    const quantity = parseFloat(qtyVal);
    const projectId = document.getElementById("projectId").value;

    if (!material || !heatNumber || !qtyVal || isNaN(quantity)) return;

    const materials = getMaterials();
    materials.push({
      id: crypto.randomUUID(),
      material,
      heatNumber,
      quantity,
      projectId,
      createdAt: Date.now(),
    });
    saveMaterials(materials);
    renderMaterialsGrid();

    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 1500);

    document.getElementById("heatNumber").value = "";
    document.getElementById("quantity").value = "";
  });
}

// ---------------------------------
// Bootstrap
// ---------------------------------
document.addEventListener("DOMContentLoaded", () => {
  bootstrapMockData();
  wireNavigation();
  wireProjectModal();
  wireMaterialForm();
  setActiveView("strategic");
});



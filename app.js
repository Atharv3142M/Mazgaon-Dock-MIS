/**
 * ═══════════════════════════════════════════════════════════════════════
 * MDL DIGITAL SHIPYARD MIS v4.0 · app.js
 *
 * ARCHITECTURE: localStorage-based SAP integration mock
 *   MODULE          SAP EQUIVALENT      KEY
 *   Financial (ESS) SAP-FI/CO + BW      mdl_v4_strategic
 *   Projects        SAP-PS              mdl_v4_projects
 *   Supply / ROMIS  SAP-MM              mdl_v4_materials, mdl_v4_inventory, mdl_v4_vendors
 *   HSE / HCM       SAP-EHS + SAP-HCM   mdl_v4_hse
 *   Leadership      SAP-HCM Org         mdl_v4_leadership (static)
 *
 * CRUD → localStorage:
 *   Read   = localStorage.getItem()   → SAP BAPI_GET_*
 *   Create = localStorage.setItem()   → SAP BAPI_CREATE_* + COMMIT WORK
 *   Update = read → mutate → write    → SAP BAPI_CHANGE_*
 *
 * Cybersecurity note (production): All data would transit via
 * encrypted HTTPS through a hardened DMZ gateway, with RBAC
 * enforced per ISO/IEC 27001:2022 and IMO MSC.428(98).
 * ═══════════════════════════════════════════════════════════════════════
 */

"use strict";

// ─── Storage keys ───────────────────────────────────────────────
const KEYS = {
  INIT:       "mdl_v4_initialized",
  STRATEGIC:  "mdl_v4_strategic",
  PROJECTS:   "mdl_v4_projects",
  MATERIALS:  "mdl_v4_materials",
  INVENTORY:  "mdl_v4_inventory",
  VENDORS:    "mdl_v4_vendors",
  HSE:        "mdl_v4_hse",
};

// ─── Storage abstraction (SAP RFC mock) ─────────────────────────
const DB = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn("[MDL-MIS] Read error:", key, e);
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn("[MDL-MIS] Write error:", key, e); return false; }
  },
};

// ─── Bootstrap (SAP BDC initial data load) ──────────────────────
function bootstrapMockData() {
  if (localStorage.getItem(KEYS.INIT)) return;

  // SAP-FI/CO: Standalone audited P&L (FY21–FY25)
  DB.set(KEYS.STRATEGIC, {
    revenue: { fy21: 4200, fy22: 5100, fy23: 7192, fy24: 9462, fy25: 11432 },
    pat:     { fy21: 620,  fy22: 810,  fy23: 1385, fy24: 1900, fy25: 2325  },
    indigenization: { domestic: 76, imports: 24 },
  });

  // SAP-PS: Project WBS objects — real MDL order book (March 31, 2025)
  DB.set(KEYS.PROJECTS, [
    { id:"P17A",     description:"P17A · Nilgiri Class Stealth Frigates (4 vessels, MoD)",      contractValue:28769, remaining:3716,  spi:0.97, indigenization:75, status:"On Track",       createdAt: Date.now()-86400000*180 },
    { id:"P15B",     description:"P15B · Visakhapatnam Class Destroyers (4 vessels, MoD)",      contractValue:27120, remaining:2849,  spi:1.02, indigenization:72, status:"On Track",       createdAt: Date.now()-86400000*365 },
    { id:"P75",      description:"P75 · Kalvari Class Scorpène Submarines (6 boats, MoD)",      contractValue:29078, remaining:2493,  spi:1.02, indigenization:60, status:"On Track",       createdAt: Date.now()-86400000*400 },
    { id:"ICGS",     description:"ICGS · CTS / NGOPV / FPV (21 vessels, Coast Guard)",          contractValue:2829,  remaining:715,   spi:0.95, indigenization:68, status:"Slight Overrun", createdAt: Date.now()-86400000*90  },
    { id:"OFF-PRPJ", description:"Offshore Projects · PRPP / DSF-II / PRP (ONGC, 3 projects)", contractValue:6524,  remaining:5409,  spi:0.91, indigenization:55, status:"Slight Overrun", createdAt: Date.now()-86400000*60  },
    { id:"MRLC",     description:"Submarine MRLC · Medium Refit & Life Extension (MoD)",         contractValue:2381,  remaining:1711,  spi:0.98, indigenization:58, status:"On Track",       createdAt: Date.now()-86400000*50  },
    { id:"AIP",      description:"Air Independent Propulsion (AIP) Retrofit Programme (MoD)",   contractValue:1758,  remaining:1749,  spi:1.00, indigenization:52, status:"On Track",       createdAt: Date.now()-86400000*30  },
    { id:"MPV-EXP",  description:"Multi-Purpose Hybrid Vessels (6 hulls, Navi Merchants DK)",   contractValue:710,   remaining:710,   spi:0.88, indigenization:42, status:"Slight Overrun", createdAt: Date.now()-86400000*10  },
    { id:"MISC",     description:"Miscellaneous Support Projects (Various Entities)",             contractValue:256,   remaining:169,   spi:1.01, indigenization:65, status:"On Track",       createdAt: Date.now()-86400000*5   },
  ]);

  // SAP-MM: Inventory Master (Inventory_Master entity from ERD)
  DB.set(KEYS.INVENTORY, [
    { code:"RM-SP-DH36",  description:"Steel Plate Grade DH36 (Shipbuilding)",  stock:348,  minThreshold:100, unit:"MT",  unitPrice:72000,  vendorId:"V-SAIL-01", status:"OK"  },
    { code:"RM-PP-HP316", description:"High-Pressure Alloy Pipe (SS 316L)",     stock:82,   minThreshold:120, unit:"Nos", unitPrice:15500,  vendorId:"V-TUBE-02", status:"LOW" },
    { code:"RM-BB-STR",   description:"Bulb Bar Structural (KB-300)",            stock:215,  minThreshold:50,  unit:"MT",  unitPrice:68000,  vendorId:"V-SAIL-01", status:"OK"  },
    { code:"EQ-VALVE-DN", description:"DN150 Gate Valve Assembly (Naval Grade)", stock:44,   minThreshold:60,  unit:"Nos", unitPrice:42000,  vendorId:"V-VALVE-03",status:"LOW" },
    { code:"EQ-CBTRAY-A", description:"Cable Tray Assembly (GI, 150mm)",         stock:620,  minThreshold:200, unit:"Nos", unitPrice:1800,   vendorId:"V-ELEC-04", status:"OK"  },
    { code:"EQ-GENSET-M", description:"Generator Set Module (2.5MW Marine)",     stock:4,    minThreshold:2,   unit:"Nos", unitPrice:9200000,vendorId:"V-GEN-05",  status:"OK"  },
    { code:"RM-CABLE-C",  description:"Multi-Core Control Cable (XLPE, 1000V)",  stock:18500,minThreshold:5000,unit:"m",   unitPrice:185,    vendorId:"V-ELEC-04", status:"OK"  },
    { code:"EQ-PUMP-BW",  description:"Ballast Water Pump (600 m³/hr)",          stock:6,    minThreshold:4,   unit:"Nos", unitPrice:1850000,vendorId:"V-PUMP-06", status:"OK"  },
  ]);

  // SAP-MM: Vendor Master — with Green Channel + EMD exemption flags
  DB.set(KEYS.VENDORS, [
    { id:"V-SAIL-01",  name:"SAIL Steel Authority of India",     category:"PSU",    material:"Structural Steel",   greenChannel:false, emdExempt:true,  regExpiry: Date.now()+86400000*400, status:"Active"  },
    { id:"V-TUBE-02",  name:"Patton Tubing Pvt Ltd (MSME)",      category:"MSME",   material:"Pipes & Fittings",    greenChannel:true,  emdExempt:true,  regExpiry: Date.now()+86400000*45,  status:"Active"  },
    { id:"V-VALVE-03", name:"Kirloskar Brothers Limited",         category:"Large",  material:"Valve Assemblies",    greenChannel:true,  emdExempt:false, regExpiry: Date.now()+86400000*300, status:"Active"  },
    { id:"V-ELEC-04",  name:"Havells India Ltd",                  category:"Large",  material:"Cables & Elect.",     greenChannel:false, emdExempt:false, regExpiry: Date.now()+86400000*200, status:"Active"  },
    { id:"V-GEN-05",   name:"BHEL Bhopal (PSU)",                  category:"PSU",    material:"Gensets / Turbines",  greenChannel:true,  emdExempt:true,  regExpiry: Date.now()+86400000*500, status:"Active"  },
    { id:"V-PUMP-06",  name:"Flowserve India Controls (MSME)",    category:"MSME",   material:"Pumps & Compressors", greenChannel:false, emdExempt:true,  regExpiry: Date.now()+86400000*80,  status:"Active"  },
  ]);

  // SAP-MM: ROMIS seed material issues
  DB.set(KEYS.MATERIALS, [
    { id:crypto.randomUUID(), material:"Steel Plate (Grade DH36)", heatNo:"HT-25-019", qty:24, project:"P17A", location:"SY-B2-R4", createdAt: Date.now()-3600000*6 },
    { id:crypto.randomUUID(), material:"High-Pressure Alloy Pipe", heatNo:"PP-25-007", qty:60, project:"P75",  location:"SUB-C3-L2",createdAt: Date.now()-3600000*2 },
  ]);

  // SAP-EHS: Incident register seed entries
  DB.set(KEYS.HSE, [
    { id:crypto.randomUUID(), logType:"near-miss", shift:"A-East",  description:"Unsecured toolbox near Dock-2 upper gantry. No injury. Corrected immediately. PPE compliant.", personnel:"CTR-1922", hours:"", severity:"MED", createdAt: Date.now()-3600000*8 },
    { id:crypto.randomUUID(), logType:"subcon",    shift:"B-East",  description:"Erection sub-assembly P17A frame-72. All PPE compliant. ROMIS material issue coordinated.", personnel:"CTR-2841", hours:32, severity:"LOW", createdAt: Date.now()-3600000*3 },
    { id:crypto.randomUUID(), logType:"toolbox",   shift:"A-Sub",   description:"Daily toolbox talk: confined space entry procedure for submarine ballast tank access.", personnel:"SUP-0441", hours:"", severity:"LOW", createdAt: Date.now()-3600000*1 },
  ]);

  localStorage.setItem(KEYS.INIT, "1");
  console.info("[MDL-MIS v4.0] Bootstrapped. Keys:", Object.values(KEYS).join(", "));
}

// ─── Clock ───────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById("clockDate").textContent =
      now.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
    document.getElementById("clockTime").textContent =
      now.toLocaleTimeString("en-IN", { hour12: false });
  }
  tick(); setInterval(tick, 1000);
}

function stampRefresh() {
  const el = document.getElementById("lastRefresh");
  if (el) el.textContent = "Refreshed: " + new Date().toLocaleTimeString("en-IN", { hour12:false });
}

// ─── Navigation ──────────────────────────────────────────────────
const VIEWS = {
  ess:         { el:"view-ess",        bc:"Financial Command › Executive Overview",       onEnter: renderESS        },
  projects:    { el:"view-projects",   bc:"Project &amp; Spatial MIS › Portfolio View",   onEnter: renderProjects   },
  supply:      { el:"view-supply",     bc:"Supply Chain &amp; Vendors › ROMIS Module",    onEnter: renderSupply     },
  hcm:         { el:"view-hcm",        bc:"Human Capital &amp; HSE › Incident Register",  onEnter: renderHCM        },
  compliance:  { el:"view-compliance", bc:"Indigenization &amp; CSR › Compliance Ctr.",   onEnter: renderCompliance },
};

let currentView = null;

function setActiveView(viewKey) {
  if (currentView === viewKey) return;
  currentView = viewKey;

  Object.keys(VIEWS).forEach(k => {
    const el = document.getElementById(VIEWS[k].el);
    if (el) el.classList.toggle("hidden", k !== viewKey);
  });

  document.querySelectorAll(".sidebar-item").forEach(el => {
    el.classList.toggle("active", el.dataset.view === viewKey);
  });

  const bc = document.getElementById("breadcrumb");
  if (bc) {
    const parts = VIEWS[viewKey].bc.split(" › ");
    bc.innerHTML = `<span>MDL HQ</span><i class="fas fa-angle-right"></i>` +
      parts.map((p,i) => i < parts.length-1
        ? `<span>${p}</span><i class="fas fa-angle-right"></i>`
        : `<span>${p}</span>`).join("");
  }

  if (VIEWS[viewKey].onEnter) VIEWS[viewKey].onEnter();
  stampRefresh();
}

function wireNavigation() {
  document.querySelectorAll(".sidebar-item").forEach(el => {
    el.addEventListener("click", () => setActiveView(el.dataset.view));
  });

  const toggle  = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      if (window.innerWidth < 900) sidebar.classList.toggle("mobile-open");
      else sidebar.classList.toggle("collapsed");
    });
  }

  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    const btn = document.getElementById("refreshBtn");
    btn.classList.add("spinning");
    setTimeout(() => {
      btn.classList.remove("spinning");
      if (currentView) VIEWS[currentView].onEnter();
      stampRefresh();
    }, 600);
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 1 · ESS — Financial Command (SAP-FI/CO + SAP-BW)
// ═══════════════════════════════════════════════════════════════════
let chartRevenue = null;
let chartIndi    = null;

function renderESS() {
  const data = DB.get(KEYS.STRATEGIC, null);
  if (!data) return;

  Chart.defaults.color       = "#8a94a6";
  Chart.defaults.borderColor = "rgba(255,255,255,0.05)";
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size   = 10;

  const revCtx = document.getElementById("revenueChart");
  if (revCtx) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(revCtx, {
      data: {
        labels: ["FY21","FY22","FY23","FY24","FY25"],
        datasets: [
          {
            type:"bar", label:"Revenue (₹ Cr)", yAxisID:"yRev", order:2,
            data: [data.revenue.fy21,data.revenue.fy22,data.revenue.fy23,data.revenue.fy24,data.revenue.fy25],
            backgroundColor:"rgba(32,117,255,0.50)", borderColor:"#2075ff", borderWidth:1,
          },
          {
            type:"line", label:"PAT (₹ Cr)", yAxisID:"yPat", order:1,
            data: [data.pat.fy21,data.pat.fy22,data.pat.fy23,data.pat.fy24,data.pat.fy25],
            borderColor:"#00e5a0", backgroundColor:"rgba(0,229,160,0.07)",
            pointBackgroundColor:"#00e5a0", pointRadius:4, pointHoverRadius:6,
            borderWidth:2, fill:true, tension:0.35,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        interaction: { mode:"index", intersect:false },
        plugins: {
          legend: { position:"top", align:"end", labels:{ boxWidth:10, padding:14, font:{size:10} } },
          tooltip: {
            backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1, padding:10,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN")} Cr` },
          },
        },
        scales: {
          yRev: { type:"linear", position:"left",  grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ callback:v=>"₹"+(v/1000).toFixed(0)+"k" } },
          yPat: { type:"linear", position:"right", grid:{ drawOnChartArea:false }, ticks:{ callback:v=>"₹"+v } },
          x:    { grid:{ color:"rgba(255,255,255,0.04)" } },
        },
      },
    });
  }

  const indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    chartIndi = new Chart(indiCtx, {
      type:"doughnut",
      data: {
        labels:["Make in India","Imports"],
        datasets:[{ data:[data.indigenization.domestic,data.indigenization.imports], backgroundColor:["#2075ff","#2d3a55"], borderColor:["#2075ff","#3a4560"], borderWidth:2, hoverOffset:6 }],
      },
      options: {
        responsive:true, cutout:"65%",
        plugins: {
          legend:{ display:false },
          tooltip: { backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1, callbacks:{ label:ctx=>` ${ctx.label}: ${ctx.parsed}%` } },
        },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 2 · PROJECTS — SAP-PS Project Portfolio
// ═══════════════════════════════════════════════════════════════════
let projectsGrid = null;

function spiTag(spi) {
  if (spi >= 1.0) return `<span class="cell-positive">▲ ${spi.toFixed(2)}</span>`;
  if (spi >= 0.9) return `<span class="cell-neutral">◆ ${spi.toFixed(2)}</span>`;
  return `<span class="cell-negative">▼ ${spi.toFixed(2)}</span>`;
}

function statusTag(s) {
  const m = { "On Track":"tag-on-track","Slight Overrun":"tag-overrun","Managed Overrun":"tag-managed","Underrun":"tag-underrun","On Hold":"tag-hold" };
  return `<span class="cell-tag ${m[s]||"tag-hold"}">${s.toUpperCase()}</span>`;
}

function renderProjects() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;
  const data = DB.get(KEYS.PROJECTS, []);
  const rows = data.map(p => [
    p.id,
    p.description,
    "₹" + p.contractValue.toLocaleString("en-IN") + " Cr",
    "₹" + p.remaining.toLocaleString("en-IN") + " Cr",
    (((p.contractValue - p.remaining) / p.contractValue)*100).toFixed(1) + "%",
    gridjs.html(spiTag(p.spi)),
    (p.indigenization || "—") + "%",
    gridjs.html(statusTag(p.status)),
  ]);
  const cfg = {
    columns: [
      { name:"WBS ID",       width:"75px"  },
      { name:"Programme",    width:"270px" },
      { name:"Contracted",   width:"120px" },
      { name:"Remaining",    width:"110px" },
      { name:"% Complete",   width:"90px"  },
      { name:"SPI",          width:"75px"  },
      { name:"Indi. %",      width:"70px"  },
      { name:"Status",       width:"140px" },
    ],
    data: rows, sort:true, search:{ enabled:true }, pagination:{ enabled:true, limit:6 },
  };
  if (!projectsGrid) { projectsGrid = new gridjs.Grid(cfg); projectsGrid.render(container); }
  else projectsGrid.updateConfig(cfg).forceRender();
  document.getElementById("projCount").textContent = data.length + " ACTIVE PROGRAMMES";
}

// ─── Add Project Modal ──────────────────────────────────────────
function wireProjectModal() {
  const modal     = document.getElementById("addProjectModal");
  const openBtn   = document.getElementById("openAddProjectModal");
  const closeBtn  = document.getElementById("closeProjectModal");
  const cancelBtn = document.getElementById("cancelProjectModal");
  const saveBtn   = document.getElementById("saveProjectBtn");
  const msg       = document.getElementById("projModalMsg");
  if (!modal) return;

  function closeModal() {
    modal.classList.add("hidden");
    msg.classList.add("hidden");
    ["mProjId","mProjDesc","mProjValue","mProjBalance","mProjSpi","mProjIndi"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
  }

  openBtn?.addEventListener("click",   () => modal.classList.remove("hidden"));
  closeBtn?.addEventListener("click",  closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  saveBtn?.addEventListener("click", () => {
    const id    = document.getElementById("mProjId")?.value.trim();
    const desc  = document.getElementById("mProjDesc")?.value.trim();
    const val   = parseFloat(document.getElementById("mProjValue")?.value);
    const bal   = parseFloat(document.getElementById("mProjBalance")?.value);
    const spi   = parseFloat(document.getElementById("mProjSpi")?.value||"1.00");
    const indi  = parseInt(document.getElementById("mProjIndi")?.value||"0");
    const status= document.getElementById("mProjStatus")?.value;
    if (!id || !desc || isNaN(val) || isNaN(bal)) return;

    // SAP-PS: BAPI_PROJECT_MAINTAIN — append WBS element
    const projects = DB.get(KEYS.PROJECTS, []);
    projects.push({ id, description:desc, contractValue:val, remaining:bal, spi, indigenization:indi, status, createdAt:Date.now() });
    DB.set(KEYS.PROJECTS, projects);
    renderProjects();
    msg.classList.remove("hidden");
    setTimeout(() => { msg.classList.add("hidden"); closeModal(); }, 1500);
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 3 · SUPPLY — SAP-MM Materials + ROMIS + Vendors
// ═══════════════════════════════════════════════════════════════════
let inventoryGrid = null;
let vendorGrid    = null;
let materialsGrid = null;

function renderSupply() {
  const inventory = DB.get(KEYS.INVENTORY, []);
  const vendors   = DB.get(KEYS.VENDORS, []);
  const materials = DB.get(KEYS.MATERIALS, []);

  // KPIs
  const low = inventory.filter(i => i.status === "LOW").length;
  const exp = vendors.filter(v => (v.regExpiry - Date.now()) < 86400000*90).length;
  document.getElementById("kpi-vendors").textContent     = vendors.length;
  document.getElementById("kpi-mat-count").textContent   = materials.length;
  document.getElementById("kpi-reorders").textContent    = low;
  document.getElementById("kpi-expiring").textContent    = exp;

  // Inventory grid
  const invContainer = document.getElementById("inventoryGrid");
  if (invContainer) {
    const invRows = inventory.map(i => [
      i.code,
      i.description,
      gridjs.html(i.status==="LOW"
        ? `<span class="stock-low">⚠ ${i.stock} ${i.unit}</span>`
        : `${i.stock} ${i.unit}`),
      i.minThreshold + " " + i.unit,
      "₹" + i.unitPrice.toLocaleString("en-IN"),
      i.vendorId,
    ]);
    const invCfg = {
      columns:[
        { name:"Item Code",    width:"110px" },
        { name:"Description",  width:"220px" },
        { name:"Stock",        width:"90px"  },
        { name:"Min Threshold",width:"110px" },
        { name:"Unit Price",   width:"100px" },
        { name:"Vendor",       width:"100px" },
      ],
      data:invRows, sort:true, pagination:{ enabled:true, limit:5 },
    };
    if (!inventoryGrid) { inventoryGrid = new gridjs.Grid(invCfg); inventoryGrid.render(invContainer); }
    else inventoryGrid.updateConfig(invCfg).forceRender();
  }

  // Vendor grid
  const vContainer = document.getElementById("vendorGrid");
  if (vContainer) {
    const vRows = vendors.map(v => {
      const daysToExp = Math.ceil((v.regExpiry - Date.now()) / 86400000);
      const expLabel = daysToExp < 90
        ? gridjs.html(`<span class="cell-negative">⚠ ${daysToExp}d</span>`)
        : gridjs.html(`<span>${daysToExp}d</span>`);
      return [
        v.id, v.name, v.category, v.material,
        gridjs.html(v.greenChannel ? `<span class="green-channel">✔ GREEN</span>` : "—"),
        gridjs.html(v.emdExempt    ? `<span class="emd-exempt">✔ EXEMPT</span>`  : "—"),
        expLabel,
      ];
    });
    const vCfg = {
      columns:[
        { name:"Vendor ID",    width:"90px"  },
        { name:"Name",         width:"190px" },
        { name:"Category",     width:"70px"  },
        { name:"Material",     width:"140px" },
        { name:"Green Ch.",    width:"80px"  },
        { name:"EMD Exempt",   width:"90px"  },
        { name:"Reg. Expiry",  width:"90px"  },
      ],
      data:vRows, sort:true, pagination:{ enabled:true, limit:4 },
    };
    if (!vendorGrid) { vendorGrid = new gridjs.Grid(vCfg); vendorGrid.render(vContainer); }
    else vendorGrid.updateConfig(vCfg).forceRender();
  }

  // Materials grid (ROMIS)
  renderMaterialsGrid();
}

function renderMaterialsGrid() {
  const container = document.getElementById("materialsGrid");
  if (!container) return;
  const data = DB.get(KEYS.MATERIALS, []).sort((a,b)=>b.createdAt-a.createdAt);
  const rows = data.map(m => [
    m.material, m.heatNo, m.qty, m.project, m.location||"—",
    new Date(m.createdAt).toLocaleString("en-IN",{ day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
  ]);
  const cfg = {
    columns:[
      { name:"Material",    width:"180px" },
      { name:"Heat/Batch",  width:"100px" },
      { name:"Qty",         width:"60px"  },
      { name:"Project",     width:"90px"  },
      { name:"Location",    width:"90px"  },
      { name:"Logged At",   width:"130px" },
    ],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };
  if (!materialsGrid) { materialsGrid = new gridjs.Grid(cfg); materialsGrid.render(container); }
  else materialsGrid.updateConfig(cfg).forceRender();
  document.getElementById("matIssueCount").textContent = data.length + " ISSUES";
}

// ─── ROMIS Material logger ──────────────────────────────────────
function wireMaterialLogger() {
  document.getElementById("logMaterialBtn")?.addEventListener("click", () => {
    const material  = document.getElementById("matType")?.value;
    const project   = document.getElementById("matProject")?.value;
    const heatNo    = document.getElementById("matHeat")?.value.trim();
    const qty       = parseFloat(document.getElementById("matQty")?.value);
    const location  = document.getElementById("matLocation")?.value.trim();
    if (!material || !heatNo || isNaN(qty)) return;

    // SAP-MM: BAPI_GOODSMVT_CREATE — goods movement type 201
    const mats = DB.get(KEYS.MATERIALS, []);
    mats.push({ id:crypto.randomUUID(), material, heatNo, qty, project, location, createdAt:Date.now() });
    DB.set(KEYS.MATERIALS, mats);
    renderMaterialsGrid();

    const msg = document.getElementById("matFormMsg");
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2000);
    document.getElementById("matHeat").value = "";
    document.getElementById("matQty").value  = "";
    document.getElementById("matLocation").value = "";

    if (currentView === "supply") {
      document.getElementById("kpi-mat-count").textContent = mats.length;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 4 · HCM — Workforce + HSE (SAP-HCM + SAP-EHS)
// ═══════════════════════════════════════════════════════════════════
let leadershipGrid = null;
let hseGrid        = null;
let selectedSev    = "LOW";

// Board & KMP data (SAP-HCM personnel master · RBAC assignments)
const LEADERSHIP = [
  { id:"CMD-01", name:"Capt. Jagmohan (Retd.)",       designation:"Chairman & Managing Director (CMD)",         access:"Global Enterprise · All Modules L1",           clearance:"SECRET" },
  { id:"DIR-SB", name:"Mr. Biju George",               designation:"Director (Shipbuilding)",                    access:"Production · PM · Quality Assurance",           clearance:"CONFIDENTIAL" },
  { id:"DIR-FI", name:"Mr. Ruchir Agrawal",            designation:"Director (Finance) & CFO",                   access:"Financial Ledger · Procurement · Corporate Audit",clearance:"CONFIDENTIAL" },
  { id:"DIR-SM", name:"Cmde Shailesh B Jamgaonkar",   designation:"Director (Submarine & Heavy Engineering)",    access:"Submarine Div · Heavy Mfg · IPMS",              clearance:"SECRET" },
  { id:"DIR-CP", name:"Cdr. Vasudev Puranik",          designation:"Director (Corporate Planning & Personnel)",   access:"HR · Strategic Planning · Labor Allocation",    clearance:"RESTRICTED" },
  { id:"GM-CIT", name:"Mr. Chandra Vijay Shrivastava", designation:"GM (F-CA) & GM (CIT)",                       access:"Financial Control · IT Systems · MIS Admin",    clearance:"CONFIDENTIAL" },
  { id:"GM-FPS", name:"Mr. Saurabh Kumar Gupta",       designation:"GM (F-P&S)",                                  access:"Financial Planning & Strategy",                 clearance:"RESTRICTED" },
  { id:"GM-PSO", name:"Mr. Sanjay Kumar Singh",        designation:"GM (PS-Offshore Projects & MOD KILO)",        access:"Offshore Projects · Submarine Refit WOs",       clearance:"SECRET" },
  { id:"GM-QSI", name:"Mr. E R Thomas",                designation:"GM (SB-QA & SI)",                            access:"Quality Assurance · Systems Integration · ISO",  clearance:"CONFIDENTIAL" },
  { id:"GM-INF", name:"Mr. P Dhanraj",                 designation:"GM (SB-Works/NHY)",                          access:"Shipyard Infrastructure · Berth & Dock Mgmt",   clearance:"RESTRICTED" },
  { id:"ED-HR",  name:"Mr. Arun Kumar Chand",          designation:"Executive Director / HOD (HR)",              access:"HR Master · Personnel Demographics · Payroll",   clearance:"RESTRICTED" },
];

function renderHCM() {
  // HSE KPIs
  const logs   = DB.get(KEYS.HSE, []);
  const nmCount = logs.filter(l=>l.logType==="near-miss").length;
  const totalHrs = logs.reduce((s,l)=>s+(parseFloat(l.hours)||0), 0);
  document.getElementById("kpi-near-miss").textContent  = nmCount;
  document.getElementById("kpi-subcon-hrs").textContent = totalHrs.toLocaleString("en-IN");
  document.getElementById("hseEntryCount").textContent  = logs.length + " ENTRIES";

  // Leadership grid
  const lContainer = document.getElementById("leadershipGrid");
  if (lContainer) {
    const lRows = LEADERSHIP.map(p => [
      p.id, p.name, p.designation,
      p.access,
      gridjs.html((() => {
        const m = { SECRET:"cell-negative", CONFIDENTIAL:"cell-neutral", RESTRICTED:"cell-positive" };
        return `<span class="${m[p.clearance]||""}">${p.clearance}</span>`;
      })()),
    ]);
    const lCfg = {
      columns:[
        { name:"Employee ID",   width:"80px"  },
        { name:"Name",          width:"180px" },
        { name:"Designation",   width:"240px" },
        { name:"MIS Access (RBAC)", width:"260px" },
        { name:"Clearance",     width:"100px" },
      ],
      data:lRows, sort:true, pagination:{ enabled:true, limit:6 },
    };
    if (!leadershipGrid) { leadershipGrid = new gridjs.Grid(lCfg); leadershipGrid.render(lContainer); }
    else leadershipGrid.updateConfig(lCfg).forceRender();
  }

  // HSE incident grid
  renderHSEGrid();
}

function renderHSEGrid() {
  const container = document.getElementById("hseGrid");
  if (!container) return;
  const logs = DB.get(KEYS.HSE, []).sort((a,b)=>b.createdAt-a.createdAt);
  const typeMap = { "near-miss":"Near-Miss","subcon":"Sub-Con Hrs","hazard":"Hazard Obs.","toolbox":"Toolbox Talk","permit":"Permit-WTW" };
  const rows = logs.map(l => [
    typeMap[l.logType]||l.logType,
    l.shift,
    l.description.length>55 ? l.description.substring(0,55)+"…" : l.description,
    l.personnel||"—",
    l.hours ? l.hours+" hrs" : "—",
    gridjs.html(`<span class="sev-tag ${l.severity}">${l.severity}</span>`),
    new Date(l.createdAt).toLocaleString("en-IN",{ day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
  ]);
  const cfg = {
    columns:[
      { name:"Type",       width:"90px"  },
      { name:"Zone",       width:"100px" },
      { name:"Activity",   width:"240px" },
      { name:"Personnel",  width:"85px"  },
      { name:"Hours",      width:"70px"  },
      { name:"Severity",   width:"80px"  },
      { name:"Logged At",  width:"120px" },
    ],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };
  if (!hseGrid) { hseGrid = new gridjs.Grid(cfg); hseGrid.render(container); }
  else hseGrid.updateConfig(cfg).forceRender();
}

// Severity selector
function wireSeveritySelector() {
  document.querySelectorAll(".sev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sev-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      selectedSev = btn.dataset.sev;
    });
  });
}

// HSE form
function wireHSEForm() {
  document.getElementById("logHseBtn")?.addEventListener("click", () => {
    const logType    = document.getElementById("hseLogType")?.value;
    const shift      = document.getElementById("hseShift")?.value;
    const description= document.getElementById("hseDescription")?.value.trim();
    const personnel  = document.getElementById("hsePersonnel")?.value.trim();
    const hours      = parseFloat(document.getElementById("hseHours")?.value)||null;
    if (!description) { document.getElementById("hseDescription")?.focus(); return; }

    // SAP-EHS: BAPI_EHS_INCIDENT_CREATE equivalent
    const logs = DB.get(KEYS.HSE, []);
    logs.push({ id:crypto.randomUUID(), logType, shift, description, personnel:personnel||"", hours:hours||"", severity:selectedSev, createdAt:Date.now() });
    DB.set(KEYS.HSE, logs);
    renderHCM();

    const msg = document.getElementById("hseFormMsg");
    msg.classList.remove("hidden");
    setTimeout(()=>msg.classList.add("hidden"),2000);
    document.getElementById("hseDescription").value = "";
    document.getElementById("hsePersonnel").value   = "";
    document.getElementById("hseHours").value       = "";
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 5 · COMPLIANCE — (static render, no CRUD needed)
// ═══════════════════════════════════════════════════════════════════
function renderCompliance() {
  // No dynamic data needed — all values hardcoded from audited docs
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP — DOMContentLoaded
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  bootstrapMockData();
  startClock();
  wireNavigation();
  wireProjectModal();
  wireMaterialLogger();
  wireSeveritySelector();
  wireHSEForm();
  setActiveView("ess");
});

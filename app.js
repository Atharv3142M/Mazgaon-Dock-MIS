/**
 * ═══════════════════════════════════════════════════════════════════════
 * MDL DIGITAL SHIPYARD MIS v5.0 · app.js
 *
 * KEY ADDITIONS IN v5.0 (from MIS_Improvement_and_Data_Integration.docx):
 *
 * 1. RBAC ENGINE
 *    - 6 roles: Super Admin, Executive Director, Project Commander,
 *      Financial Controller, Supply Chain Officer, Floor Supervisor
 *    - Each role sees only its permitted sidebar modules
 *    - Account Switcher re-issues "JWT" (localStorage session token)
 *    - Immutable Audit Log records every role switch + action
 *    - Principle of Least Privilege enforced at DOM level
 *
 * 2. CORRECTED FINANCIAL DATA (from document table)
 *    - Revenue: ₹11,431.88 Cr (FY25) vs ₹9,466.58 Cr (FY24)
 *    - Total Income: ₹12,553.10 Cr vs ₹10,568.10 Cr
 *    - EBITDA: ₹3,228.80 Cr (+95.8% YoY)
 *    - PBT: ₹3,109.20 Cr (+28.2%)
 *    - Depreciation: +38.6% YoY
 *    - Dividend: ₹23.19 (1st interim) + ₹3.00 (2nd interim)
 *    - Finance costs: ↓9.6% YoY
 *    - Promoter holding: 84.83%
 *
 * 3. WORKFORCE TREND (5-year headcount from document)
 *    - FY21: 3,687 → FY22: 3,344 → FY23: 2,988 → FY24: 2,814 → FY25: 2,614
 *    - Revenue/employee: ₹47.17M · Profit/employee: ₹9.21M
 *
 * 4. P15B VESSEL TRACKING TABLE (keel/launch/commission dates)
 * 5. P-75I PIPELINE (₹70,000–₹1,00,000 Cr · MDL-TKMS JV)
 * 6. CSR SECTORAL BREAKDOWN (69% Health, 20% Ed, 2% R&D, 9% Other)
 * 7. JPC steel price mock API + Import/Export trade intelligence
 *
 * RBAC localStorage mock maps to production JWT flow:
 *   Login     → POST /api/auth/login       → JWT {userId, roles[], activeRole}
 *   Switch    → POST /api/auth/switch-role → New JWT {activeRole: newRole}
 *   API calls → Authorization: Bearer <JWT> → Middleware checks activeRole
 * ═══════════════════════════════════════════════════════════════════════
 */

"use strict";

// ─── Storage keys ──────────────────────────────────────────────────
const KEYS = {
  INIT:       "mdl_v5_initialized",
  STRATEGIC:  "mdl_v5_strategic",
  PROJECTS:   "mdl_v5_projects",
  MATERIALS:  "mdl_v5_materials",
  INVENTORY:  "mdl_v5_inventory",
  VENDORS:    "mdl_v5_vendors",
  HSE:        "mdl_v5_hse",
  SESSION:    "mdl_v5_session",    // Active RBAC session (JWT mock)
  AUDIT:      "mdl_v5_audit",      // Immutable audit trail
};

// ─── Storage abstraction ───────────────────────────────────────────
const DB = {
  get(key, fallback) {
    try { const r = localStorage.getItem(key); return r === null ? fallback : JSON.parse(r); }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
};

// ═══════════════════════════════════════════════════════════════════
// RBAC ROLE DEFINITIONS
// Mirrors production backend RBAC matrix (doc §Engineering Account Switcher)
// ═══════════════════════════════════════════════════════════════════
const RBAC_ROLES = [
  {
    key: "super-admin",
    name: "Super Administrator",
    persona: "IT Systems Director",
    icon: "fa-shield-halved",
    clearance: "SECRET",
    clearanceCls: "clr-secret",
    permissions: ["ess","projects","supply","hcm","compliance","audit"],
    description: "Full CRUD · All modules · Role assignments · Audit logs",
    color: "#ff4d4d",
  },
  {
    key: "executive",
    name: "Executive Director",
    persona: "Board Member / C-Suite",
    icon: "fa-briefcase",
    clearance: "CONFIDENTIAL",
    clearanceCls: "clr-conf",
    permissions: ["ess","projects","compliance","audit"],
    description: "Read-only macro dashboards · Financials · Order Book · Strategic KPIs",
    color: "#f5c842",
  },
  {
    key: "project-commander",
    name: "Project Commander",
    persona: "Warship / Submarine Lead",
    icon: "fa-anchor",
    clearance: "SECRET",
    clearanceCls: "clr-secret",
    permissions: ["projects","supply","audit"],
    description: "CRUD on assigned projects · Milestones · Material requests",
    color: "#2075ff",
  },
  {
    key: "financial-controller",
    name: "Financial Controller",
    persona: "Accounting Manager",
    icon: "fa-chart-line",
    clearance: "CONFIDENTIAL",
    clearanceCls: "clr-conf",
    permissions: ["ess","audit"],
    description: "Financial ledger · Cash flow · Vendor payments · Budget approvals",
    color: "#f5c842",
  },
  {
    key: "supply-officer",
    name: "Supply Chain Officer",
    persona: "Procurement Lead",
    icon: "fa-boxes-stacked",
    clearance: "RESTRICTED",
    clearanceCls: "clr-rest",
    permissions: ["supply","audit"],
    description: "Vendor database · Inventory · ROMIS · Indigenization data",
    color: "#00e5a0",
  },
  {
    key: "floor-supervisor",
    name: "Floor Supervisor",
    persona: "Yard Master / Foreman",
    icon: "fa-hard-hat",
    clearance: "RESTRICTED",
    clearanceCls: "clr-rest",
    permissions: ["hcm","audit"],
    description: "Worker attendance · Slipway allocation · LTIFR safety incident reporting",
    color: "#00e5a0",
  },
];

// All sidebar items and which module they map to
const SIDEBAR_MODULES = [
  { view:"ess",        icon:"fa-satellite-dish", title:"Financial Command",     sub:"SAP-FI/CO · ESS Layer"      },
  { view:"projects",   icon:"fa-anchor",          title:"Project & Spatial MIS",sub:"SAP-PS · Portfolio View"    },
  { view:"supply",     icon:"fa-boxes-stacked",   title:"Supply Chain & Vendors",sub:"SAP-MM · ROMIS"            },
  { view:"hcm",        icon:"fa-hard-hat",        title:"Human Capital & HSE",  sub:"SAP-HCM / SAP-EHS · TPS"   },
  { view:"compliance", icon:"fa-flag",            title:"Indigenization & CSR", sub:"Compliance · Aatmanirbhar" },
  { view:"audit",      icon:"fa-scroll",          title:"Audit Log",            sub:"RBAC · Immutable Trail"    },
];

// ─── Active session ─────────────────────────────────────────────────
let activeRole = null;   // full role object
let auditTrail = [];     // in-memory mirror of localStorage audit log

// ─── Audit logger ───────────────────────────────────────────────────
function logAudit(action, detail="") {
  const entry = {
    id:        crypto.randomUUID(),
    ts:        Date.now(),
    userId:    activeRole ? activeRole.name : "SYSTEM",
    role:      activeRole ? activeRole.key : "—",
    clearance: activeRole ? activeRole.clearance : "—",
    action,
    detail,
  };
  const logs = DB.get(KEYS.AUDIT, []);
  logs.unshift(entry);
  DB.set(KEYS.AUDIT, logs);
  auditTrail = logs;
  if (currentView === "audit") renderAuditGrid();
  updateAuditBadge();
}

function updateAuditBadge() {
  const el = document.getElementById("auditCount");
  if (el) el.textContent = DB.get(KEYS.AUDIT, []).length + " EVENTS";
}

// ═══════════════════════════════════════════════════════════════════
// RBAC OVERLAY — role selection on first load
// In production: replaced by SSO/JWT login endpoint
// ═══════════════════════════════════════════════════════════════════
function buildRBACOverlay() {
  const container = document.getElementById("rbacRoles");
  if (!container) return;
  container.innerHTML = "";
  RBAC_ROLES.forEach(role => {
    const btn = document.createElement("button");
    btn.className = "rbac-role-btn";
    btn.innerHTML = `
      <div class="rbac-role-icon" style="color:${role.color};background:rgba(${hexToRgbStr(role.color)},0.1);border:1px solid rgba(${hexToRgbStr(role.color)},0.3)">
        <i class="fas ${role.icon}"></i>
      </div>
      <div style="flex:1;text-align:left">
        <span class="rbac-role-name">${role.name}</span>
        <span class="rbac-role-desc">${role.persona} · ${role.description}</span>
      </div>
      <span class="rbac-role-clearance ${role.clearanceCls}">${role.clearance}</span>
    `;
    btn.addEventListener("click", () => selectRole(role));
    container.appendChild(btn);
  });
}

function hexToRgbStr(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function selectRole(role) {
  activeRole = role;
  // Mock JWT issuance: store session
  DB.set(KEYS.SESSION, { roleKey: role.key, ts: Date.now() });
  logAudit("LOGIN", `Role selected: ${role.name} · Clearance: ${role.clearance}`);

  // Hide overlay, show app
  document.getElementById("rbacOverlay").style.display = "none";
  document.getElementById("appShell").style.display = "flex";

  buildSidebar();
  updateUserChip();
  buildSwitcherDropdown();
  startClock();
  wireNavigation();
  wireProjectModal();
  wireMaterialLogger();
  wireSeveritySelector();
  wireHSEForm();
  wireAccountSwitcher();
  bootstrapMockData();

  // Navigate to first permitted view
  const firstView = role.permissions.filter(p => p !== "audit")[0] || "audit";
  setActiveView(firstView);
}

// ─── Account Switcher (in-session role change) ─────────────────────
function buildSwitcherDropdown() {
  const list = document.getElementById("switcherRoleList");
  if (!list) return;
  list.innerHTML = "";
  RBAC_ROLES.forEach(role => {
    const item = document.createElement("div");
    item.className = "switcher-role-item" + (role.key === activeRole.key ? " active-role" : "");
    item.innerHTML = `
      <i class="fas ${role.icon} sw-role-icon" style="color:${role.color}"></i>
      <div>
        <div class="sw-role-name">${role.name}</div>
        <div class="sw-role-sub">${role.persona}</div>
      </div>
      ${role.key === activeRole.key ? '<span class="sw-active-badge">ACTIVE</span>' : ''}
    `;
    item.addEventListener("click", () => switchRole(role));
    list.appendChild(item);
  });
}

function switchRole(newRole) {
  if (newRole.key === activeRole.key) { toggleSwitcher(false); return; }
  const prevRole = activeRole.name;
  activeRole = newRole;
  DB.set(KEYS.SESSION, { roleKey: newRole.key, ts: Date.now() });
  logAudit("ROLE_SWITCH", `From: ${prevRole} → To: ${newRole.name} · New clearance: ${newRole.clearance}`);

  updateUserChip();
  buildSidebar();
  buildSwitcherDropdown();
  toggleSwitcher(false);

  // Re-render to first permitted view
  const firstView = newRole.permissions.filter(p => p !== "audit")[0] || "audit";
  currentView = null;
  setActiveView(firstView);
}

function updateUserChip() {
  if (!activeRole) return;
  document.getElementById("userNameDisplay").textContent = activeRole.name.toUpperCase();
  document.getElementById("userRoleDisplay").textContent = activeRole.clearance + " CLEARANCE";
  document.getElementById("metaRole").textContent = activeRole.name;
  document.getElementById("metaClearance").textContent = activeRole.clearance + " · " + activeRole.persona;
  const icon = document.getElementById("userAvatarIcon");
  if (icon) icon.innerHTML = `<i class="fas ${activeRole.icon}"></i>`;
}

function wireAccountSwitcher() {
  const btn     = document.getElementById("userChipBtn");
  const dropdown= document.getElementById("switcherDropdown");
  const chevron = document.getElementById("userChevron");
  const auditBtn= document.getElementById("auditLogBtn");

  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains("hidden");
    toggleSwitcher(!isOpen);
  });

  auditBtn?.addEventListener("click", () => {
    toggleSwitcher(false);
    setActiveView("audit");
  });

  document.addEventListener("click", () => toggleSwitcher(false));
  dropdown?.addEventListener("click", e => e.stopPropagation());
}

function toggleSwitcher(open) {
  const dropdown = document.getElementById("switcherDropdown");
  const chevron  = document.getElementById("userChevron");
  if (!dropdown) return;
  dropdown.classList.toggle("hidden", !open);
  chevron?.classList.toggle("open", open);
}

// ─── Sidebar builder (RBAC-filtered) ───────────────────────────────
function buildSidebar() {
  const nav = document.getElementById("sidebarNav");
  if (!nav || !activeRole) return;
  nav.innerHTML = "";
  SIDEBAR_MODULES.forEach(mod => {
    if (!activeRole.permissions.includes(mod.view)) return;
    const el = document.createElement("div");
    el.className = "sidebar-item";
    el.dataset.view = mod.view;
    el.innerHTML = `
      <i class="fas ${mod.icon}"></i>
      <div class="sidebar-item-text">
        <span class="sidebar-item-title">${mod.title}</span>
        <span class="sidebar-item-sub">${mod.sub}</span>
      </div>
      <div class="sidebar-indicator"></div>
    `;
    el.addEventListener("click", () => {
      logAudit("NAV", `Navigated to: ${mod.title}`);
      setActiveView(mod.view);
    });
    nav.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP (SAP BDC initial data load)
// ═══════════════════════════════════════════════════════════════════
function bootstrapMockData() {
  if (localStorage.getItem(KEYS.INIT)) return;

  // SAP-FI/CO: Corrected figures from document
  DB.set(KEYS.STRATEGIC, {
    revenue: { fy21:4200, fy22:5100, fy23:7192, fy24:9467, fy25:11432 },
    pat:     { fy21:620,  fy22:810,  fy23:1385, fy24:1845, fy25:2325  },
    indigenization: { domestic:76, imports:24 },
  });

  // SAP-PS: Full order book (March 31, 2025)
  DB.set(KEYS.PROJECTS, [
    { id:"P17A",    description:"P17A · Nilgiri Class Stealth Frigates (4 of 7 at MDL)",     contractValue:28769, remaining:3716,  spi:0.97, indigenization:75, status:"On Track",       createdAt:Date.now()-86400000*180 },
    { id:"P15B",    description:"P15B · Visakhapatnam Class Destroyers (4 vessels, MoD)",    contractValue:27120, remaining:4,     spi:1.02, indigenization:72, status:"On Track",       createdAt:Date.now()-86400000*365 },
    { id:"P75",     description:"P75 · Kalvari Class Scorpène Submarines (6 boats, MoD)",   contractValue:23814, remaining:2493,  spi:1.02, indigenization:60, status:"On Track",       createdAt:Date.now()-86400000*400 },
    { id:"P75-AIP", description:"P75 AIP Plug Retrofit · Air Independent Propulsion (MoD)", contractValue:1990,  remaining:1749,  spi:1.00, indigenization:52, status:"On Track",       createdAt:Date.now()-86400000*30  },
    { id:"ICGS",    description:"ICGS · CTS / NGOPV / FPV (21 vessels, Coast Guard)",       contractValue:2829,  remaining:715,   spi:0.95, indigenization:68, status:"Slight Overrun", createdAt:Date.now()-86400000*90  },
    { id:"OFF",     description:"Offshore Projects · PRPP / DSF-II / PRP (ONGC)",           contractValue:6524,  remaining:5409,  spi:0.91, indigenization:55, status:"Slight Overrun", createdAt:Date.now()-86400000*60  },
    { id:"MRLC",    description:"Submarine MRLC · Medium Refit & Life Extension (MoD)",     contractValue:2381,  remaining:1711,  spi:0.98, indigenization:58, status:"On Track",       createdAt:Date.now()-86400000*50  },
    { id:"MPV-EXP", description:"MPV Export · 6 Hybrid Vessels (Navi Merchants, Denmark)",  contractValue:710,   remaining:710,   spi:0.88, indigenization:42, status:"Slight Overrun", createdAt:Date.now()-86400000*10  },
    { id:"MISC",    description:"Miscellaneous Support Projects (Various Entities)",          contractValue:256,   remaining:169,   spi:1.01, indigenization:65, status:"On Track",       createdAt:Date.now()-86400000*5   },
  ]);

  // SAP-MM: Inventory
  DB.set(KEYS.INVENTORY, [
    { code:"RM-SP-DH36",  description:"Steel Plate Grade DH36 (Shipbuilding)", stock:348,   minThreshold:100, unit:"MT",  unitPrice:72000,   vendorId:"V-SAIL-01", status:"OK"  },
    { code:"RM-PP-HP316", description:"High-Pressure Alloy Pipe (SS 316L)",    stock:82,    minThreshold:120, unit:"Nos", unitPrice:15500,   vendorId:"V-TUBE-02", status:"LOW" },
    { code:"RM-BB-STR",   description:"Bulb Bar Structural (KB-300)",           stock:215,   minThreshold:50,  unit:"MT",  unitPrice:68000,   vendorId:"V-SAIL-01", status:"OK"  },
    { code:"EQ-VALVE-DN", description:"DN150 Gate Valve Assembly (Naval Grd)", stock:44,    minThreshold:60,  unit:"Nos", unitPrice:42000,   vendorId:"V-VALVE-03",status:"LOW" },
    { code:"EQ-CBTRAY-A", description:"Cable Tray Assembly (GI, 150mm)",       stock:620,   minThreshold:200, unit:"Nos", unitPrice:1800,    vendorId:"V-ELEC-04", status:"OK"  },
    { code:"EQ-GENSET-M", description:"Generator Set Module (2.5MW Marine)",   stock:4,     minThreshold:2,   unit:"Nos", unitPrice:9200000, vendorId:"V-GEN-05",  status:"OK"  },
    { code:"RM-CABLE-C",  description:"Multi-Core Control Cable (XLPE 1000V)", stock:18500, minThreshold:5000,unit:"m",   unitPrice:185,     vendorId:"V-ELEC-04", status:"OK"  },
    { code:"EQ-PUMP-BW",  description:"Ballast Water Pump (600 m³/hr)",        stock:6,     minThreshold:4,   unit:"Nos", unitPrice:1850000, vendorId:"V-PUMP-06", status:"OK"  },
  ]);

  // SAP-MM: Vendor master
  DB.set(KEYS.VENDORS, [
    { id:"V-SAIL-01",  name:"SAIL (Steel Authority of India)",    category:"PSU",   material:"Structural Steel",  greenChannel:false, emdExempt:true,  regExpiry:Date.now()+86400000*400, status:"Active" },
    { id:"V-TUBE-02",  name:"Patton Tubing Pvt Ltd (MSME)",       category:"MSME",  material:"Pipes & Fittings",  greenChannel:true,  emdExempt:true,  regExpiry:Date.now()+86400000*45,  status:"Active" },
    { id:"V-VALVE-03", name:"Kirloskar Brothers Limited",          category:"Large", material:"Valve Assemblies",  greenChannel:true,  emdExempt:false, regExpiry:Date.now()+86400000*300, status:"Active" },
    { id:"V-ELEC-04",  name:"Havells India Ltd",                   category:"Large", material:"Cables & Elect.",   greenChannel:false, emdExempt:false, regExpiry:Date.now()+86400000*200, status:"Active" },
    { id:"V-GEN-05",   name:"BHEL Bhopal (PSU)",                   category:"PSU",   material:"Gensets / Turbines",greenChannel:true,  emdExempt:true,  regExpiry:Date.now()+86400000*500, status:"Active" },
    { id:"V-PUMP-06",  name:"Flowserve India Controls (MSME)",     category:"MSME",  material:"Pumps & Compressors",greenChannel:false, emdExempt:true,  regExpiry:Date.now()+86400000*80,  status:"Active" },
  ]);

  // SAP-MM: ROMIS seeds
  DB.set(KEYS.MATERIALS, [
    { id:crypto.randomUUID(), material:"Steel Plate (Grade DH36)", heatNo:"HT-25-019", qty:24, project:"P17A", location:"SY-B2-R4",  createdAt:Date.now()-3600000*6 },
    { id:crypto.randomUUID(), material:"High-Pressure Alloy Pipe", heatNo:"PP-25-007", qty:60, project:"P75",  location:"SUB-C3-L2", createdAt:Date.now()-3600000*2 },
  ]);

  // SAP-EHS: Incident seeds
  DB.set(KEYS.HSE, [
    { id:crypto.randomUUID(), logType:"near-miss", shift:"A-East",  description:"Unsecured toolbox near Dock-2 upper gantry. No injury. PPE compliant. Corrected immediately.", personnel:"CTR-1922", hours:"",   severity:"MED",  createdAt:Date.now()-3600000*8 },
    { id:crypto.randomUUID(), logType:"subcon",    shift:"B-East",  description:"Erection sub-assembly P17A frame-72. All PPE compliant. ROMIS material issue coordinated.",   personnel:"CTR-2841", hours:32,   severity:"LOW",  createdAt:Date.now()-3600000*3 },
    { id:crypto.randomUUID(), logType:"toolbox",   shift:"A-Sub",   description:"Daily toolbox talk: confined space entry procedure for submarine ballast tank access.",         personnel:"SUP-0441", hours:"",   severity:"LOW",  createdAt:Date.now()-3600000*1 },
  ]);

  localStorage.setItem(KEYS.INIT, "1");
}

// ─── Clock ──────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById("clockDate").textContent = now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
    document.getElementById("clockTime").textContent = now.toLocaleTimeString("en-IN",{hour12:false});
  }
  tick(); setInterval(tick, 1000);
}

function stampRefresh() {
  const el = document.getElementById("lastRefresh");
  if (el) el.textContent = "Refreshed: " + new Date().toLocaleTimeString("en-IN",{hour12:false});
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
const VIEW_META = {
  ess:        { bc:"Financial Command › Executive Overview",        onEnter: renderESS        },
  projects:   { bc:"Project &amp; Spatial MIS › Portfolio View",   onEnter: renderProjects   },
  supply:     { bc:"Supply Chain &amp; Vendors › ROMIS Module",    onEnter: renderSupply     },
  hcm:        { bc:"Human Capital &amp; HSE › Incident Register",  onEnter: renderHCM        },
  compliance: { bc:"Indigenization &amp; CSR › Compliance Ctr.",   onEnter: ()=>{}           },
  audit:      { bc:"Security › RBAC Audit Log",                    onEnter: renderAuditGrid  },
};

let currentView = null;

function setActiveView(viewKey) {
  // RBAC guard: if role doesn't have permission, silently redirect
  if (activeRole && !activeRole.permissions.includes(viewKey)) {
    const fallback = activeRole.permissions[0] || "audit";
    setActiveView(fallback);
    return;
  }
  if (currentView === viewKey) return;
  currentView = viewKey;

  Object.keys(VIEW_META).forEach(k => {
    const el = document.getElementById("view-"+k);
    if (el) el.classList.toggle("hidden", k !== viewKey);
  });

  document.querySelectorAll(".sidebar-item").forEach(el => {
    el.classList.toggle("active", el.dataset.view === viewKey);
  });

  const bc = document.getElementById("breadcrumb");
  if (bc && VIEW_META[viewKey]) {
    const parts = VIEW_META[viewKey].bc.split(" › ");
    bc.innerHTML = `<span>MDL HQ</span><i class="fas fa-angle-right"></i>` +
      parts.map((p,i)=>i<parts.length-1?`<span>${p}</span><i class="fas fa-angle-right"></i>`:`<span>${p}</span>`).join("");
  }

  if (VIEW_META[viewKey]?.onEnter) VIEW_META[viewKey].onEnter();
  stampRefresh();
}

function wireNavigation() {
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
      if (currentView && VIEW_META[currentView]?.onEnter) VIEW_META[currentView].onEnter();
      stampRefresh();
    }, 600);
  });
}

// ═══════════════════════════════════════════════════════════════════
// ESS — Financial Command (SAP-FI/CO + SAP-BW)
// ═══════════════════════════════════════════════════════════════════
let chartRevenue=null, chartIndi=null;

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
          { type:"bar",  label:"Revenue (₹ Cr)", yAxisID:"yRev", order:2, data:[data.revenue.fy21,data.revenue.fy22,data.revenue.fy23,data.revenue.fy24,data.revenue.fy25], backgroundColor:"rgba(32,117,255,0.50)", borderColor:"#2075ff", borderWidth:1 },
          { type:"line", label:"PAT (₹ Cr)",     yAxisID:"yPat", order:1, data:[data.pat.fy21,data.pat.fy22,data.pat.fy23,data.pat.fy24,data.pat.fy25], borderColor:"#00e5a0", backgroundColor:"rgba(0,229,160,0.07)", pointBackgroundColor:"#00e5a0", pointRadius:4, pointHoverRadius:6, borderWidth:2, fill:true, tension:0.35 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:true, interaction:{mode:"index",intersect:false},
        plugins: {
          legend:{ position:"top", align:"end", labels:{ boxWidth:10, padding:14, font:{size:10} } },
          tooltip:{ backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1, padding:10, callbacks:{ label:ctx=>` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN")} Cr` } },
        },
        scales: {
          yRev:{ type:"linear", position:"left",  grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ callback:v=>"₹"+(v/1000).toFixed(0)+"k" } },
          yPat:{ type:"linear", position:"right", grid:{ drawOnChartArea:false },          ticks:{ callback:v=>"₹"+v } },
          x:   { grid:{ color:"rgba(255,255,255,0.04)" } },
        },
      },
    });
  }

  const indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    chartIndi = new Chart(indiCtx, {
      type:"doughnut",
      data:{ labels:["Make in India","Imports"], datasets:[{ data:[data.indigenization.domestic,data.indigenization.imports], backgroundColor:["#2075ff","#2d3a55"], borderColor:["#2075ff","#3a4560"], borderWidth:2, hoverOffset:6 }] },
      options:{ responsive:true, cutout:"65%", plugins:{ legend:{display:false}, tooltip:{ backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1, callbacks:{label:ctx=>` ${ctx.label}: ${ctx.parsed}%`} } } },
    });
  }

  logAudit("VIEW_ACCESS", "Financial Command (ESS) · Read");
}

// ═══════════════════════════════════════════════════════════════════
// PROJECTS — SAP-PS
// ═══════════════════════════════════════════════════════════════════
let projectsGrid=null;

function spiTag(spi) {
  if (spi>=1.0) return `<span class="cell-positive">▲ ${spi.toFixed(2)}</span>`;
  if (spi>=0.9) return `<span class="cell-neutral">◆ ${spi.toFixed(2)}</span>`;
  return `<span class="cell-negative">▼ ${spi.toFixed(2)}</span>`;
}

function statusTag(s) {
  const m={"On Track":"tag-on-track","Slight Overrun":"tag-overrun","Managed Overrun":"tag-managed","Underrun":"tag-underrun","On Hold":"tag-hold"};
  return `<span class="cell-tag ${m[s]||"tag-hold"}">${s.toUpperCase()}</span>`;
}

function renderProjects() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;
  const data = DB.get(KEYS.PROJECTS,[]);
  const rows = data.map(p=>[
    p.id,
    p.description,
    "₹"+p.contractValue.toLocaleString("en-IN")+" Cr",
    "₹"+p.remaining.toLocaleString("en-IN")+" Cr",
    (((p.contractValue-p.remaining)/p.contractValue)*100).toFixed(1)+"%",
    gridjs.html(spiTag(p.spi)),
    (p.indigenization||"—")+"%",
    gridjs.html(statusTag(p.status)),
  ]);
  const cfg = {
    columns:[{name:"WBS ID",width:"75px"},{name:"Programme",width:"260px"},{name:"Contracted",width:"120px"},{name:"Remaining",width:"110px"},{name:"% Done",width:"80px"},{name:"SPI",width:"75px"},{name:"Indi. %",width:"70px"},{name:"Status",width:"140px"}],
    data:rows, sort:true, search:{enabled:true}, pagination:{enabled:true,limit:6},
  };
  if (!projectsGrid) { projectsGrid=new gridjs.Grid(cfg); projectsGrid.render(container); }
  else projectsGrid.updateConfig(cfg).forceRender();
  document.getElementById("projCount").textContent = data.length+" ACTIVE PROGRAMMES";
  logAudit("VIEW_ACCESS","Project Portfolio (SAP-PS) · Read");
}

function wireProjectModal() {
  const modal=document.getElementById("addProjectModal");
  const openBtn=document.getElementById("openAddProjectModal");
  const closeBtn=document.getElementById("closeProjectModal");
  const cancelBtn=document.getElementById("cancelProjectModal");
  const saveBtn=document.getElementById("saveProjectBtn");
  const msg=document.getElementById("projModalMsg");
  if (!modal) return;
  function close() { modal.classList.add("hidden"); msg.classList.add("hidden"); ["mProjId","mProjDesc","mProjValue","mProjBalance","mProjSpi","mProjIndi"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""}); }
  openBtn?.addEventListener("click",()=>modal.classList.remove("hidden"));
  closeBtn?.addEventListener("click",close);
  cancelBtn?.addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  saveBtn?.addEventListener("click",()=>{
    const id=document.getElementById("mProjId")?.value.trim();
    const desc=document.getElementById("mProjDesc")?.value.trim();
    const val=parseFloat(document.getElementById("mProjValue")?.value);
    const bal=parseFloat(document.getElementById("mProjBalance")?.value);
    const spi=parseFloat(document.getElementById("mProjSpi")?.value||"1.00");
    const indi=parseInt(document.getElementById("mProjIndi")?.value||"0");
    const status=document.getElementById("mProjStatus")?.value;
    if (!id||!desc||isNaN(val)||isNaN(bal)) return;
    const projects=DB.get(KEYS.PROJECTS,[]);
    projects.push({id,description:desc,contractValue:val,remaining:bal,spi,indigenization:indi,status,createdAt:Date.now()});
    DB.set(KEYS.PROJECTS,projects);
    renderProjects();
    logAudit("DATA_CREATE",`New WBS: ${id} · ${desc} · ₹${val} Cr`);
    msg.classList.remove("hidden");
    setTimeout(()=>{msg.classList.add("hidden");close();},1500);
  });
}

// ═══════════════════════════════════════════════════════════════════
// SUPPLY — SAP-MM
// ═══════════════════════════════════════════════════════════════════
let inventoryGrid=null, vendorGrid=null, materialsGrid=null;

function renderSupply() {
  const inventory=DB.get(KEYS.INVENTORY,[]);
  const vendors=DB.get(KEYS.VENDORS,[]);
  const materials=DB.get(KEYS.MATERIALS,[]);
  const low=inventory.filter(i=>i.status==="LOW").length;
  const exp=vendors.filter(v=>(v.regExpiry-Date.now())<86400000*90).length;
  document.getElementById("kpi-vendors").textContent=vendors.length;
  document.getElementById("kpi-mat-count").textContent=materials.length;
  document.getElementById("kpi-reorders").textContent=low;
  document.getElementById("kpi-expiring").textContent=exp;

  const invC=document.getElementById("inventoryGrid");
  if (invC) {
    const r=inventory.map(i=>[i.code,i.description,gridjs.html(i.status==="LOW"?`<span class="stock-low">⚠ ${i.stock} ${i.unit}</span>`:`${i.stock} ${i.unit}`),i.minThreshold+" "+i.unit,"₹"+i.unitPrice.toLocaleString("en-IN"),i.vendorId]);
    const c={columns:[{name:"Item Code",width:"110px"},{name:"Description",width:"220px"},{name:"Stock",width:"90px"},{name:"Min Threshold",width:"110px"},{name:"Unit Price",width:"100px"},{name:"Vendor",width:"100px"}],data:r,sort:true,pagination:{enabled:true,limit:5}};
    if(!inventoryGrid){inventoryGrid=new gridjs.Grid(c);inventoryGrid.render(invC);}else inventoryGrid.updateConfig(c).forceRender();
  }

  const vC=document.getElementById("vendorGrid");
  if (vC) {
    const r=vendors.map(v=>{const d=Math.ceil((v.regExpiry-Date.now())/86400000);return[v.id,v.name,v.category,v.material,gridjs.html(v.greenChannel?`<span class="green-channel">✔ GREEN</span>`:"—"),gridjs.html(v.emdExempt?`<span class="emd-exempt">✔ EXEMPT</span>`:"—"),gridjs.html(d<90?`<span class="cell-negative">⚠ ${d}d</span>`:`<span>${d}d</span>`)];});
    const c={columns:[{name:"ID",width:"90px"},{name:"Name",width:"190px"},{name:"Category",width:"70px"},{name:"Material",width:"140px"},{name:"Green Ch.",width:"80px"},{name:"EMD",width:"80px"},{name:"Expiry",width:"80px"}],data:r,sort:true,pagination:{enabled:true,limit:4}};
    if(!vendorGrid){vendorGrid=new gridjs.Grid(c);vendorGrid.render(vC);}else vendorGrid.updateConfig(c).forceRender();
  }
  renderMaterialsGrid();
  logAudit("VIEW_ACCESS","Supply Chain & Vendors (SAP-MM) · Read");
}

function renderMaterialsGrid() {
  const c=document.getElementById("materialsGrid");
  if (!c) return;
  const data=DB.get(KEYS.MATERIALS,[]).sort((a,b)=>b.createdAt-a.createdAt);
  const rows=data.map(m=>[m.material,m.heatNo,m.qty,m.project,m.location||"—",new Date(m.createdAt).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})]);
  const cfg={columns:[{name:"Material",width:"180px"},{name:"Heat/Batch",width:"100px"},{name:"Qty",width:"60px"},{name:"Project",width:"90px"},{name:"Location",width:"90px"},{name:"Logged At",width:"130px"}],data:rows,sort:true,pagination:{enabled:true,limit:5}};
  if(!materialsGrid){materialsGrid=new gridjs.Grid(cfg);materialsGrid.render(c);}else materialsGrid.updateConfig(cfg).forceRender();
  document.getElementById("matIssueCount").textContent=data.length+" ISSUES";
}

function wireMaterialLogger() {
  document.getElementById("logMaterialBtn")?.addEventListener("click",()=>{
    const material=document.getElementById("matType")?.value;
    const project=document.getElementById("matProject")?.value;
    const heatNo=document.getElementById("matHeat")?.value.trim();
    const qty=parseFloat(document.getElementById("matQty")?.value);
    const location=document.getElementById("matLocation")?.value.trim();
    if (!material||!heatNo||isNaN(qty)) return;
    const mats=DB.get(KEYS.MATERIALS,[]);
    mats.push({id:crypto.randomUUID(),material,heatNo,qty,project,location,createdAt:Date.now()});
    DB.set(KEYS.MATERIALS,mats);
    renderMaterialsGrid();
    logAudit("DATA_CREATE",`ROMIS Issue: ${material} · ${qty} units → ${project} @ ${location||"??"}`);
    const msg=document.getElementById("matFormMsg");
    msg.classList.remove("hidden");
    setTimeout(()=>msg.classList.add("hidden"),2000);
    document.getElementById("matHeat").value="";
    document.getElementById("matQty").value="";
    document.getElementById("matLocation").value="";
    if(currentView==="supply") document.getElementById("kpi-mat-count").textContent=mats.length;
  });
}

// ═══════════════════════════════════════════════════════════════════
// HCM — Workforce + HSE (SAP-HCM + SAP-EHS)
// ═══════════════════════════════════════════════════════════════════
let leadershipGrid=null, hseGrid=null, selectedSev="LOW";

const LEADERSHIP = [
  {id:"CMD-01",name:"Capt. Jagmohan (Retd.)",      designation:"Chairman & Managing Director (CMD)",       access:"Global Enterprise · All Modules",clearance:"SECRET"},
  {id:"DIR-SB",name:"Mr. Biju George",              designation:"Director (Shipbuilding)",                  access:"Production · PM · QA",           clearance:"CONFIDENTIAL"},
  {id:"DIR-FI",name:"Mr. Ruchir Agrawal",           designation:"Director (Finance) & CFO",                access:"Financial Ledger · Audit",        clearance:"CONFIDENTIAL"},
  {id:"DIR-SM",name:"Cmde Shailesh B Jamgaonkar",  designation:"Director (Submarine & Heavy Engineering)", access:"Submarine · IPMS · Heavy Mfg",    clearance:"SECRET"},
  {id:"DIR-CP",name:"Cdr. Vasudev Puranik",         designation:"Director (Corporate Planning & Personnel)",access:"HR · Strategic Planning",         clearance:"RESTRICTED"},
  {id:"GM-CIT",name:"Mr. Chandra Vijay Shrivastava",designation:"GM (F-CA) & GM (CIT)",                   access:"Financial Control · IT · MIS",    clearance:"CONFIDENTIAL"},
  {id:"GM-FPS",name:"Mr. Saurabh Kumar Gupta",      designation:"GM (F-P&S)",                               access:"Financial Planning & Strategy",   clearance:"RESTRICTED"},
  {id:"GM-PSO",name:"Mr. Sanjay Kumar Singh",       designation:"GM (PS-Offshore & MOD KILO)",             access:"Offshore Projects · Sub Refit",   clearance:"SECRET"},
  {id:"GM-QSI",name:"Mr. E R Thomas",               designation:"GM (SB-QA & SI)",                         access:"Quality Assurance · ISO",         clearance:"CONFIDENTIAL"},
  {id:"GM-INF",name:"Mr. P Dhanraj",                designation:"GM (SB-Works/NHY)",                       access:"Infrastructure · Berth & Dock",   clearance:"RESTRICTED"},
  {id:"ED-HR", name:"Mr. Arun Kumar Chand",         designation:"Executive Director / HOD (HR)",           access:"HR Master · Payroll · Diversity",  clearance:"RESTRICTED"},
];

function renderHCM() {
  const logs=DB.get(KEYS.HSE,[]);
  const nmCount=logs.filter(l=>l.logType==="near-miss").length;
  const totalHrs=logs.reduce((s,l)=>s+(parseFloat(l.hours)||0),0);
  document.getElementById("kpi-near-miss").textContent=nmCount;
  document.getElementById("kpi-subcon-hrs").textContent=totalHrs.toLocaleString("en-IN");
  document.getElementById("hseEntryCount").textContent=logs.length+" ENTRIES";

  const lC=document.getElementById("leadershipGrid");
  if (lC) {
    const r=LEADERSHIP.map(p=>[p.id,p.name,p.designation,p.access,gridjs.html(()=>{const m={SECRET:"cell-negative",CONFIDENTIAL:"cell-neutral",RESTRICTED:"cell-positive"};return`<span class="${m[p.clearance]||""}">${p.clearance}</span>`}())]);
    const c={columns:[{name:"Employee ID",width:"80px"},{name:"Name",width:"180px"},{name:"Designation",width:"240px"},{name:"MIS Access (RBAC)",width:"230px"},{name:"Clearance",width:"100px"}],data:r,sort:true,pagination:{enabled:true,limit:6}};
    if(!leadershipGrid){leadershipGrid=new gridjs.Grid(c);leadershipGrid.render(lC);}else leadershipGrid.updateConfig(c).forceRender();
  }
  renderHSEGrid();
  logAudit("VIEW_ACCESS","Human Capital & HSE (SAP-HCM) · Read");
}

function renderHSEGrid() {
  const c=document.getElementById("hseGrid");
  if (!c) return;
  const typeMap={"near-miss":"Near-Miss","subcon":"Sub-Con Hrs","hazard":"Hazard Obs.","toolbox":"Toolbox Talk","permit":"Permit-WTW"};
  const logs=DB.get(KEYS.HSE,[]).sort((a,b)=>b.createdAt-a.createdAt);
  const rows=logs.map(l=>[typeMap[l.logType]||l.logType,l.shift,l.description.length>55?l.description.substring(0,55)+"…":l.description,l.personnel||"—",l.hours?l.hours+" hrs":"—",gridjs.html(`<span class="sev-tag ${l.severity}">${l.severity}</span>`),new Date(l.createdAt).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})]);
  const cfg={columns:[{name:"Type",width:"90px"},{name:"Zone",width:"100px"},{name:"Activity",width:"240px"},{name:"Personnel",width:"85px"},{name:"Hours",width:"70px"},{name:"Severity",width:"80px"},{name:"Logged At",width:"120px"}],data:rows,sort:true,pagination:{enabled:true,limit:5}};
  if(!hseGrid){hseGrid=new gridjs.Grid(cfg);hseGrid.render(c);}else hseGrid.updateConfig(cfg).forceRender();
}

function wireSeveritySelector() {
  document.querySelectorAll(".sev-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".sev-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      selectedSev=btn.dataset.sev;
    });
  });
}

function wireHSEForm() {
  document.getElementById("logHseBtn")?.addEventListener("click",()=>{
    const logType=document.getElementById("hseLogType")?.value;
    const shift=document.getElementById("hseShift")?.value;
    const description=document.getElementById("hseDescription")?.value.trim();
    const personnel=document.getElementById("hsePersonnel")?.value.trim();
    const hours=parseFloat(document.getElementById("hseHours")?.value)||null;
    if (!description){document.getElementById("hseDescription")?.focus();return;}
    const logs=DB.get(KEYS.HSE,[]);
    logs.push({id:crypto.randomUUID(),logType,shift,description,personnel:personnel||"",hours:hours||"",severity:selectedSev,createdAt:Date.now()});
    DB.set(KEYS.HSE,logs);
    renderHCM();
    logAudit("DATA_CREATE",`HSE Log: ${logType} · ${shift} · Severity: ${selectedSev}`);
    const msg=document.getElementById("hseFormMsg");
    msg.classList.remove("hidden");
    setTimeout(()=>msg.classList.add("hidden"),2000);
    document.getElementById("hseDescription").value="";
    document.getElementById("hsePersonnel").value="";
    document.getElementById("hseHours").value="";
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════
let auditGrid=null;

function renderAuditGrid() {
  const c=document.getElementById("auditGrid");
  if (!c) return;
  const logs=DB.get(KEYS.AUDIT,[]);
  const rows=logs.map(l=>[
    new Date(l.ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"}),
    l.userId,
    l.role,
    gridjs.html(()=>{const m={SECRET:"cell-negative",CONFIDENTIAL:"cell-neutral",RESTRICTED:"cell-positive"};return`<span class="${m[l.clearance]||""}">${l.clearance}</span>`}()),
    l.action,
    l.detail,
  ]);
  const cfg={columns:[{name:"Timestamp",width:"140px"},{name:"User",width:"160px"},{name:"Role",width:"120px"},{name:"Clearance",width:"100px"},{name:"Action",width:"120px"},{name:"Detail",width:"280px"}],data:rows,sort:true,pagination:{enabled:true,limit:10}};
  if(!auditGrid){auditGrid=new gridjs.Grid(cfg);auditGrid.render(c);}else auditGrid.updateConfig(cfg).forceRender();
  updateAuditBadge();
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  buildRBACOverlay();
  // No auto-login — user must select role from overlay
});

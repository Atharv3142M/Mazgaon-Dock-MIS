/**
 * ═══════════════════════════════════════════════════════════════════════
 * MDL DIGITAL SHIPYARD MIS v5.1 · app.js
 * Bug-fix release — all syntax errors corrected
 *
 * FIXES IN v5.1:
 *   - SyntaxError on lines 703, 766: nested template literal inside
 *     gridjs.html() IIFE caused parser failures. Replaced all IIFE
 *     patterns with plain helper functions that return strings.
 *   - RBAC overlay click handlers now correctly call selectRole()
 *     before any other wiring so DOM elements exist when wired.
 *   - bootstrapMockData() moved inside selectRole() to guarantee
 *     it runs after DOM is visible.
 *   - Account Switcher dropdown z-index and click-outside handler fixed.
 *   - All gridjs.html() calls use simple string concatenation or
 *     pre-built helper functions — no IIFE, no nested backtick quotes.
 *
 * ARCHITECTURE: localStorage-based SAP integration mock
 *   MODULE          SAP EQUIVALENT      localStorage KEY
 *   Financial (ESS) SAP-FI/CO + BW      mdl_v5_strategic
 *   Projects        SAP-PS              mdl_v5_projects
 *   Supply / ROMIS  SAP-MM              mdl_v5_materials / inventory / vendors
 *   HSE / HCM       SAP-EHS + SAP-HCM   mdl_v5_hse
 *   Audit           SAP Security Log    mdl_v5_audit
 * ═══════════════════════════════════════════════════════════════════════
 */

"use strict";

// ─── Storage keys ──────────────────────────────────────────────────
const KEYS = {
  INIT:      "mdl_v5_initialized",
  STRATEGIC: "mdl_v5_strategic",
  PROJECTS:  "mdl_v5_projects",
  MATERIALS: "mdl_v5_materials",
  INVENTORY: "mdl_v5_inventory",
  VENDORS:   "mdl_v5_vendors",
  HSE:       "mdl_v5_hse",
  SESSION:   "mdl_v5_session",
  AUDIT:     "mdl_v5_audit",
};

// ─── Storage layer (SAP RFC mock) ──────────────────────────────────
const DB = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
};

// ═══════════════════════════════════════════════════════════════════
// RBAC ROLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const RBAC_ROLES = [
  {
    key:        "super-admin",
    name:       "Super Administrator",
    persona:    "IT Systems Director",
    icon:       "fa-shield-halved",
    clearance:  "SECRET",
    clsCls:     "clr-secret",
    color:      "#ff4d4d",
    permissions:["ess","projects","supply","hcm","compliance","audit"],
    description:"Full CRUD · All modules · Role assignments · Audit logs",
  },
  {
    key:        "executive",
    name:       "Executive Director",
    persona:    "Board Member / C-Suite",
    icon:       "fa-briefcase",
    clearance:  "CONFIDENTIAL",
    clsCls:     "clr-conf",
    color:      "#f5c842",
    permissions:["ess","projects","compliance","audit"],
    description:"Read-only macro dashboards · Financials · Order Book · Strategic KPIs",
  },
  {
    key:        "project-commander",
    name:       "Project Commander",
    persona:    "Warship / Submarine Lead",
    icon:       "fa-anchor",
    clearance:  "SECRET",
    clsCls:     "clr-secret",
    color:      "#2075ff",
    permissions:["projects","supply","audit"],
    description:"CRUD on assigned projects · Milestones · Material requests",
  },
  {
    key:        "financial-controller",
    name:       "Financial Controller",
    persona:    "Accounting Manager",
    icon:       "fa-chart-line",
    clearance:  "CONFIDENTIAL",
    clsCls:     "clr-conf",
    color:      "#f5c842",
    permissions:["ess","audit"],
    description:"Financial ledger · Cash flow · Vendor payments · Budget approvals",
  },
  {
    key:        "supply-officer",
    name:       "Supply Chain Officer",
    persona:    "Procurement Lead",
    icon:       "fa-boxes-stacked",
    clearance:  "RESTRICTED",
    clsCls:     "clr-rest",
    color:      "#00e5a0",
    permissions:["supply","audit"],
    description:"Vendor database · Inventory · ROMIS · Indigenization data",
  },
  {
    key:        "floor-supervisor",
    name:       "Floor Supervisor",
    persona:    "Yard Master / Foreman",
    icon:       "fa-hard-hat",
    clearance:  "RESTRICTED",
    clsCls:     "clr-rest",
    color:      "#00e5a0",
    permissions:["hcm","audit"],
    description:"Worker attendance · Slipway allocation · HIRA safety incident reporting",
  },
];

// Sidebar module definitions
const SIDEBAR_MODULES = [
  { view:"ess",        icon:"fa-satellite-dish", title:"Financial Command",      sub:"SAP-FI/CO · ESS Layer"       },
  { view:"projects",   icon:"fa-anchor",          title:"Project & Spatial MIS", sub:"SAP-PS · Portfolio View"     },
  { view:"supply",     icon:"fa-boxes-stacked",   title:"Supply Chain & Vendors",sub:"SAP-MM · ROMIS"              },
  { view:"hcm",        icon:"fa-hard-hat",        title:"Human Capital & HSE",   sub:"SAP-HCM / SAP-EHS · TPS"    },
  { view:"compliance", icon:"fa-flag",            title:"Indigenization & CSR",  sub:"Compliance · Aatmanirbhar"  },
  { view:"audit",      icon:"fa-scroll",          title:"Audit Log",             sub:"RBAC · Immutable Trail"     },
];

// ─── Active session state ───────────────────────────────────────────
let activeRole = null;

// ─── Audit logger ───────────────────────────────────────────────────
function logAudit(action, detail) {
  detail = detail || "";
  var entry = {
    id:        crypto.randomUUID(),
    ts:        Date.now(),
    userId:    activeRole ? activeRole.name : "SYSTEM",
    role:      activeRole ? activeRole.key  : "—",
    clearance: activeRole ? activeRole.clearance : "—",
    action:    action,
    detail:    detail,
  };
  var logs = DB.get(KEYS.AUDIT, []);
  logs.unshift(entry);
  DB.set(KEYS.AUDIT, logs);
  updateAuditBadge();
  if (currentView === "audit") renderAuditGrid();
}

function updateAuditBadge() {
  var el = document.getElementById("auditCount");
  if (el) el.textContent = DB.get(KEYS.AUDIT, []).length + " EVENTS";
}

// ═══════════════════════════════════════════════════════════════════
// RBAC OVERLAY — role selection
// ═══════════════════════════════════════════════════════════════════
function buildRBACOverlay() {
  var container = document.getElementById("rbacRoles");
  if (!container) return;
  container.innerHTML = "";

  RBAC_ROLES.forEach(function(role) {
    var btn = document.createElement("button");
    btn.className = "rbac-role-btn";
    btn.type = "button";

    var iconDiv = document.createElement("div");
    iconDiv.className = "rbac-role-icon";
    iconDiv.style.cssText = "color:" + role.color + ";background:rgba(0,0,0,0.2);border:1px solid " + role.color + "44";
    iconDiv.innerHTML = '<i class="fas ' + role.icon + '"></i>';

    var textDiv = document.createElement("div");
    textDiv.style.cssText = "flex:1;text-align:left";

    var nameSpan = document.createElement("span");
    nameSpan.className = "rbac-role-name";
    nameSpan.textContent = role.name;

    var descSpan = document.createElement("span");
    descSpan.className = "rbac-role-desc";
    descSpan.textContent = role.persona + " · " + role.description;

    textDiv.appendChild(nameSpan);
    textDiv.appendChild(descSpan);

    var clrSpan = document.createElement("span");
    clrSpan.className = "rbac-role-clearance " + role.clsCls;
    clrSpan.textContent = role.clearance;

    btn.appendChild(iconDiv);
    btn.appendChild(textDiv);
    btn.appendChild(clrSpan);

    // Use a closure to capture the correct role reference
    (function(r) {
      btn.addEventListener("click", function() {
        selectRole(r);
      });
    })(role);

    container.appendChild(btn);
  });
}

function selectRole(role) {
  activeRole = role;
  DB.set(KEYS.SESSION, { roleKey: role.key, ts: Date.now() });

  // Hide overlay, reveal app
  var overlay = document.getElementById("rbacOverlay");
  var shell   = document.getElementById("appShell");
  if (overlay) overlay.style.display = "none";
  if (shell)   shell.style.display   = "flex";

  // Seed data if first load
  bootstrapMockData();

  // Wire UI
  startClock();
  buildSidebar();
  updateUserChip();
  buildSwitcherDropdown();
  wireNavigation();
  wireProjectModal();
  wireMaterialLogger();
  wireSeveritySelector();
  wireHSEForm();
  wireAccountSwitcher();

  logAudit("LOGIN", "Role: " + role.name + " · Clearance: " + role.clearance);

  // Navigate to first permitted view
  var firstView = role.permissions.filter(function(p) { return p !== "audit"; })[0] || "audit";
  setActiveView(firstView);
}

// ─── Account Switcher (in-session role toggle) ─────────────────────
function buildSwitcherDropdown() {
  var list = document.getElementById("switcherRoleList");
  if (!list) return;
  list.innerHTML = "";

  RBAC_ROLES.forEach(function(role) {
    var item = document.createElement("div");
    item.className = "switcher-role-item" + (activeRole && role.key === activeRole.key ? " active-role" : "");

    var icon = document.createElement("i");
    icon.className = "fas " + role.icon + " sw-role-icon";
    icon.style.color = role.color;

    var textDiv = document.createElement("div");

    var nameDiv = document.createElement("div");
    nameDiv.className = "sw-role-name";
    nameDiv.textContent = role.name;

    var subDiv = document.createElement("div");
    subDiv.className = "sw-role-sub";
    subDiv.textContent = role.persona;

    textDiv.appendChild(nameDiv);
    textDiv.appendChild(subDiv);

    item.appendChild(icon);
    item.appendChild(textDiv);

    if (activeRole && role.key === activeRole.key) {
      var badge = document.createElement("span");
      badge.className = "sw-active-badge";
      badge.textContent = "ACTIVE";
      item.appendChild(badge);
    }

    (function(r) {
      item.addEventListener("click", function() { switchRole(r); });
    })(role);

    list.appendChild(item);
  });
}

function switchRole(newRole) {
  if (activeRole && newRole.key === activeRole.key) {
    toggleSwitcher(false);
    return;
  }
  var prevName = activeRole ? activeRole.name : "none";
  activeRole = newRole;
  DB.set(KEYS.SESSION, { roleKey: newRole.key, ts: Date.now() });
  logAudit("ROLE_SWITCH", "From: " + prevName + " → To: " + newRole.name);

  updateUserChip();
  buildSidebar();
  buildSwitcherDropdown();
  toggleSwitcher(false);

  currentView = null;
  var firstView = newRole.permissions.filter(function(p) { return p !== "audit"; })[0] || "audit";
  setActiveView(firstView);
}

function updateUserChip() {
  if (!activeRole) return;
  var nameEl = document.getElementById("userNameDisplay");
  var roleEl = document.getElementById("userRoleDisplay");
  var metaRole = document.getElementById("metaRole");
  var metaClear = document.getElementById("metaClearance");
  var iconEl = document.getElementById("userAvatarIcon");
  if (nameEl)   nameEl.textContent   = activeRole.name.toUpperCase();
  if (roleEl)   roleEl.textContent   = activeRole.clearance + " CLEARANCE";
  if (metaRole) metaRole.textContent = activeRole.name;
  if (metaClear)metaClear.textContent= activeRole.clearance + " · " + activeRole.persona;
  if (iconEl)   iconEl.innerHTML     = '<i class="fas ' + activeRole.icon + '"></i>';
}

var switcherWired = false;
function wireAccountSwitcher() {
  if (switcherWired) return;
  switcherWired = true;

  var btn      = document.getElementById("userChipBtn");
  var dropdown = document.getElementById("switcherDropdown");
  var auditBtn = document.getElementById("auditLogBtn");

  if (btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var isOpen = dropdown && !dropdown.classList.contains("hidden");
      toggleSwitcher(!isOpen);
    });
  }

  if (auditBtn) {
    auditBtn.addEventListener("click", function() {
      toggleSwitcher(false);
      setActiveView("audit");
    });
  }

  document.addEventListener("click", function() {
    toggleSwitcher(false);
  });

  if (dropdown) {
    dropdown.addEventListener("click", function(e) {
      e.stopPropagation();
    });
  }
}

function toggleSwitcher(open) {
  var dropdown = document.getElementById("switcherDropdown");
  var chevron  = document.getElementById("userChevron");
  if (!dropdown) return;
  if (open) {
    dropdown.classList.remove("hidden");
  } else {
    dropdown.classList.add("hidden");
  }
  if (chevron) chevron.classList.toggle("open", open);
}

// ─── Sidebar builder (RBAC-filtered) ───────────────────────────────
function buildSidebar() {
  var nav = document.getElementById("sidebarNav");
  if (!nav || !activeRole) return;
  nav.innerHTML = "";

  SIDEBAR_MODULES.forEach(function(mod) {
    if (activeRole.permissions.indexOf(mod.view) === -1) return;

    var el = document.createElement("div");
    el.className = "sidebar-item";
    el.dataset.view = mod.view;

    var icon = document.createElement("i");
    icon.className = "fas " + mod.icon;

    var textDiv = document.createElement("div");
    textDiv.className = "sidebar-item-text";

    var titleSpan = document.createElement("span");
    titleSpan.className = "sidebar-item-title";
    titleSpan.textContent = mod.title;

    var subSpan = document.createElement("span");
    subSpan.className = "sidebar-item-sub";
    subSpan.textContent = mod.sub;

    var indicator = document.createElement("div");
    indicator.className = "sidebar-indicator";

    textDiv.appendChild(titleSpan);
    textDiv.appendChild(subSpan);
    el.appendChild(icon);
    el.appendChild(textDiv);
    el.appendChild(indicator);

    (function(view, title) {
      el.addEventListener("click", function() {
        logAudit("NAV", "Navigated to: " + title);
        setActiveView(view);
      });
    })(mod.view, mod.title);

    nav.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP (SAP BDC initial data load)
// ═══════════════════════════════════════════════════════════════════
function bootstrapMockData() {
  if (localStorage.getItem(KEYS.INIT)) return;

  DB.set(KEYS.STRATEGIC, {
    revenue: { fy21:4200,  fy22:5100,  fy23:7192,  fy24:9467,  fy25:11432 },
    pat:     { fy21:620,   fy22:810,   fy23:1385,  fy24:1845,  fy25:2325  },
    indigenization: { domestic:76, imports:24 },
  });

  DB.set(KEYS.PROJECTS, [
    { id:"P17A",    description:"P17A · Nilgiri Class Stealth Frigates (4 of 7 vessels at MDL)",   contractValue:28769, remaining:3716,  spi:0.97, indigenization:75, status:"On Track",       createdAt:Date.now()-86400000*180 },
    { id:"P15B",    description:"P15B · Visakhapatnam Class Destroyers (4 vessels, MoD)",          contractValue:27120, remaining:4,     spi:1.02, indigenization:72, status:"On Track",       createdAt:Date.now()-86400000*365 },
    { id:"P75",     description:"P75 · Kalvari Class Scorpène Submarines (6 boats, MoD)",         contractValue:23814, remaining:2493,  spi:1.02, indigenization:60, status:"On Track",       createdAt:Date.now()-86400000*400 },
    { id:"P75-AIP", description:"P75 AIP Plug Retrofit · Air Independent Propulsion (MoD)",       contractValue:1990,  remaining:1749,  spi:1.00, indigenization:52, status:"On Track",       createdAt:Date.now()-86400000*30  },
    { id:"ICGS",    description:"ICGS · CTS / NGOPV / FPV Fleet (21 vessels, Coast Guard)",       contractValue:2829,  remaining:715,   spi:0.95, indigenization:68, status:"Slight Overrun", createdAt:Date.now()-86400000*90  },
    { id:"OFF",     description:"Offshore Projects · PRPP / DSF-II / PRP (ONGC, 3 projects)",    contractValue:6524,  remaining:5409,  spi:0.91, indigenization:55, status:"Slight Overrun", createdAt:Date.now()-86400000*60  },
    { id:"MRLC",    description:"Submarine MRLC · Medium Refit & Life Extension (MoD)",           contractValue:2381,  remaining:1711,  spi:0.98, indigenization:58, status:"On Track",       createdAt:Date.now()-86400000*50  },
    { id:"MPV-EXP", description:"MPV Export · 6 Hybrid Vessels (Navi Merchants, Denmark)",        contractValue:710,   remaining:710,   spi:0.88, indigenization:42, status:"Slight Overrun", createdAt:Date.now()-86400000*10  },
    { id:"MISC",    description:"Miscellaneous Support Projects (Various Entities)",               contractValue:256,   remaining:169,   spi:1.01, indigenization:65, status:"On Track",       createdAt:Date.now()-86400000*5   },
  ]);

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

  DB.set(KEYS.VENDORS, [
    { id:"V-SAIL-01",  name:"SAIL (Steel Authority of India)",  category:"PSU",   material:"Structural Steel",   greenChannel:false, emdExempt:true,  regExpiry:Date.now()+86400000*400, status:"Active" },
    { id:"V-TUBE-02",  name:"Patton Tubing Pvt Ltd (MSME)",     category:"MSME",  material:"Pipes & Fittings",   greenChannel:true,  emdExempt:true,  regExpiry:Date.now()+86400000*45,  status:"Active" },
    { id:"V-VALVE-03", name:"Kirloskar Brothers Limited",        category:"Large", material:"Valve Assemblies",   greenChannel:true,  emdExempt:false, regExpiry:Date.now()+86400000*300, status:"Active" },
    { id:"V-ELEC-04",  name:"Havells India Ltd",                 category:"Large", material:"Cables & Electrical",greenChannel:false, emdExempt:false, regExpiry:Date.now()+86400000*200, status:"Active" },
    { id:"V-GEN-05",   name:"BHEL Bhopal (PSU)",                 category:"PSU",   material:"Gensets / Turbines", greenChannel:true,  emdExempt:true,  regExpiry:Date.now()+86400000*500, status:"Active" },
    { id:"V-PUMP-06",  name:"Flowserve India Controls (MSME)",   category:"MSME",  material:"Pumps & Compressors",greenChannel:false, emdExempt:true,  regExpiry:Date.now()+86400000*80,  status:"Active" },
  ]);

  DB.set(KEYS.MATERIALS, [
    { id:crypto.randomUUID(), material:"Steel Plate (Grade DH36)", heatNo:"HT-25-019", qty:24, project:"P17A", location:"SY-B2-R4",  createdAt:Date.now()-3600000*6 },
    { id:crypto.randomUUID(), material:"High-Pressure Alloy Pipe", heatNo:"PP-25-007", qty:60, project:"P75",  location:"SUB-C3-L2", createdAt:Date.now()-3600000*2 },
  ]);

  DB.set(KEYS.HSE, [
    { id:crypto.randomUUID(), logType:"near-miss", shift:"A-East", description:"Unsecured toolbox near Dock-2 upper gantry. No injury. PPE compliant.", personnel:"CTR-1922", hours:"",  severity:"MED", createdAt:Date.now()-3600000*8 },
    { id:crypto.randomUUID(), logType:"subcon",    shift:"B-East", description:"Erection sub-assembly P17A frame-72. All PPE compliant. ROMIS coordinated.", personnel:"CTR-2841", hours:32, severity:"LOW", createdAt:Date.now()-3600000*3 },
    { id:crypto.randomUUID(), logType:"toolbox",   shift:"A-Sub",  description:"Daily toolbox talk: confined space entry for submarine ballast tank access.", personnel:"SUP-0441", hours:"",  severity:"LOW", createdAt:Date.now()-3600000*1 },
  ]);

  localStorage.setItem(KEYS.INIT, "1");
}

// ─── Clock ──────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    var now = new Date();
    var dateEl = document.getElementById("clockDate");
    var timeEl = document.getElementById("clockTime");
    if (dateEl) dateEl.textContent = now.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString("en-IN", { hour12:false });
  }
  tick();
  setInterval(tick, 1000);
}

function stampRefresh() {
  var el = document.getElementById("lastRefresh");
  if (el) el.textContent = "Refreshed: " + new Date().toLocaleTimeString("en-IN", { hour12:false });
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
var VIEW_META = {
  ess:        { bc:["Financial Command","Executive Overview"],       onEnter: renderESS       },
  projects:   { bc:["Project & Spatial MIS","Portfolio View"],      onEnter: renderProjects  },
  supply:     { bc:["Supply Chain & Vendors","ROMIS Module"],       onEnter: renderSupply    },
  hcm:        { bc:["Human Capital & HSE","Incident Register"],     onEnter: renderHCM       },
  compliance: { bc:["Indigenization & CSR","Compliance Centre"],    onEnter: function(){}    },
  audit:      { bc:["Security","RBAC Audit Log"],                   onEnter: renderAuditGrid },
};

var currentView = null;

function setActiveView(viewKey) {
  // RBAC guard
  if (activeRole && activeRole.permissions.indexOf(viewKey) === -1) {
    var fallback = activeRole.permissions[0] || "audit";
    setActiveView(fallback);
    return;
  }
  if (currentView === viewKey) return;
  currentView = viewKey;

  Object.keys(VIEW_META).forEach(function(k) {
    var el = document.getElementById("view-" + k);
    if (el) {
      if (k === viewKey) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });

  // Sidebar active state
  var items = document.querySelectorAll(".sidebar-item");
  items.forEach(function(el) {
    el.classList.toggle("active", el.dataset.view === viewKey);
  });

  // Breadcrumb
  var bc = document.getElementById("breadcrumb");
  if (bc && VIEW_META[viewKey]) {
    var parts = VIEW_META[viewKey].bc;
    var html = '<span>MDL HQ</span><i class="fas fa-angle-right"></i>';
    parts.forEach(function(p, i) {
      html += '<span>' + p + '</span>';
      if (i < parts.length - 1) html += '<i class="fas fa-angle-right"></i>';
    });
    bc.innerHTML = html;
  }

  if (VIEW_META[viewKey] && VIEW_META[viewKey].onEnter) {
    VIEW_META[viewKey].onEnter();
  }
  stampRefresh();
}

var navWired = false;
function wireNavigation() {
  if (navWired) return;
  navWired = true;

  var toggle  = document.getElementById("sidebarToggle");
  var sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function() {
      if (window.innerWidth < 900) {
        sidebar.classList.toggle("mobile-open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
  }

  var refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function() {
      refreshBtn.classList.add("spinning");
      setTimeout(function() {
        refreshBtn.classList.remove("spinning");
        if (currentView && VIEW_META[currentView] && VIEW_META[currentView].onEnter) {
          VIEW_META[currentView].onEnter();
        }
        stampRefresh();
      }, 600);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESS — Financial Command (SAP-FI/CO + SAP-BW)
// ═══════════════════════════════════════════════════════════════════
var chartRevenue = null;
var chartIndi    = null;

function renderESS() {
  var data = DB.get(KEYS.STRATEGIC, null);
  if (!data) return;

  Chart.defaults.color       = "#8a94a6";
  Chart.defaults.borderColor = "rgba(255,255,255,0.05)";
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size   = 10;

  var revCtx = document.getElementById("revenueChart");
  if (revCtx) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(revCtx, {
      data: {
        labels: ["FY21","FY22","FY23","FY24","FY25"],
        datasets: [
          {
            type:"bar", label:"Revenue (₹ Cr)", yAxisID:"yRev", order:2,
            data:[data.revenue.fy21, data.revenue.fy22, data.revenue.fy23, data.revenue.fy24, data.revenue.fy25],
            backgroundColor:"rgba(32,117,255,0.50)", borderColor:"#2075ff", borderWidth:1,
          },
          {
            type:"line", label:"PAT (₹ Cr)", yAxisID:"yPat", order:1,
            data:[data.pat.fy21, data.pat.fy22, data.pat.fy23, data.pat.fy24, data.pat.fy25],
            borderColor:"#00e5a0", backgroundColor:"rgba(0,229,160,0.07)",
            pointBackgroundColor:"#00e5a0", pointRadius:4, pointHoverRadius:6,
            borderWidth:2, fill:true, tension:0.35,
          },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:true,
        interaction:{ mode:"index", intersect:false },
        plugins: {
          legend:{ position:"top", align:"end", labels:{ boxWidth:10, padding:14, font:{size:10} } },
          tooltip:{
            backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1, padding:10,
            callbacks:{ label: function(ctx) { return " " + ctx.dataset.label + ": ₹" + ctx.parsed.y.toLocaleString("en-IN") + " Cr"; } },
          },
        },
        scales: {
          yRev:{ type:"linear", position:"left",  grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ callback: function(v) { return "₹" + (v/1000).toFixed(0) + "k"; } } },
          yPat:{ type:"linear", position:"right", grid:{ drawOnChartArea:false },          ticks:{ callback: function(v) { return "₹" + v; } } },
          x:   { grid:{ color:"rgba(255,255,255,0.04)" } },
        },
      },
    });
  }

  var indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    chartIndi = new Chart(indiCtx, {
      type:"doughnut",
      data:{
        labels:["Make in India","Imports"],
        datasets:[{
          data:[data.indigenization.domestic, data.indigenization.imports],
          backgroundColor:["#2075ff","#2d3a55"],
          borderColor:["#2075ff","#3a4560"],
          borderWidth:2, hoverOffset:6,
        }],
      },
      options:{
        responsive:true, cutout:"65%",
        plugins:{
          legend:{ display:false },
          tooltip:{
            backgroundColor:"#1a2235", borderColor:"#2075ff", borderWidth:1,
            callbacks:{ label: function(ctx) { return " " + ctx.label + ": " + ctx.parsed + "%"; } },
          },
        },
      },
    });
  }

  logAudit("VIEW_ACCESS", "Financial Command (ESS)");
}

// ═══════════════════════════════════════════════════════════════════
// PROJECTS — SAP-PS
// ═══════════════════════════════════════════════════════════════════
var projectsGridInst = null;

function spiTag(spi) {
  if (spi >= 1.0) return '<span class="cell-positive">&#9650; ' + spi.toFixed(2) + '</span>';
  if (spi >= 0.9) return '<span class="cell-neutral">&#9670; '  + spi.toFixed(2) + '</span>';
  return '<span class="cell-negative">&#9660; ' + spi.toFixed(2) + '</span>';
}

function statusTag(s) {
  var map = {
    "On Track":       "tag-on-track",
    "Slight Overrun": "tag-overrun",
    "Managed Overrun":"tag-managed",
    "Underrun":       "tag-underrun",
    "On Hold":        "tag-hold",
  };
  var cls = map[s] || "tag-hold";
  return '<span class="cell-tag ' + cls + '">' + s.toUpperCase() + '</span>';
}

function renderProjects() {
  var container = document.getElementById("projectsGrid");
  if (!container) return;
  var data = DB.get(KEYS.PROJECTS, []);

  var rows = data.map(function(p) {
    var pctDone = p.contractValue > 0
      ? (((p.contractValue - p.remaining) / p.contractValue) * 100).toFixed(1)
      : "0.0";
    return [
      p.id,
      p.description,
      "₹" + p.contractValue.toLocaleString("en-IN") + " Cr",
      "₹" + p.remaining.toLocaleString("en-IN") + " Cr",
      pctDone + "%",
      gridjs.html(spiTag(p.spi)),
      (p.indigenization || "—") + "%",
      gridjs.html(statusTag(p.status)),
    ];
  });

  var cfg = {
    columns:[
      { name:"WBS ID",     width:"75px"  },
      { name:"Programme",  width:"255px" },
      { name:"Contracted", width:"120px" },
      { name:"Remaining",  width:"110px" },
      { name:"% Done",     width:"75px"  },
      { name:"SPI",        width:"75px"  },
      { name:"Indi. %",    width:"65px"  },
      { name:"Status",     width:"140px" },
    ],
    data:rows, sort:true, search:{ enabled:true }, pagination:{ enabled:true, limit:6 },
  };

  if (!projectsGridInst) {
    projectsGridInst = new gridjs.Grid(cfg);
    projectsGridInst.render(container);
  } else {
    projectsGridInst.updateConfig(cfg).forceRender();
  }

  var badge = document.getElementById("projCount");
  if (badge) badge.textContent = data.length + " ACTIVE PROGRAMMES";
  logAudit("VIEW_ACCESS", "Project Portfolio (SAP-PS)");
}

// ─── Add Project Modal ──────────────────────────────────────────────
var projModalWired = false;
function wireProjectModal() {
  if (projModalWired) return;
  projModalWired = true;

  var modal     = document.getElementById("addProjectModal");
  var openBtn   = document.getElementById("openAddProjectModal");
  var closeBtn  = document.getElementById("closeProjectModal");
  var cancelBtn = document.getElementById("cancelProjectModal");
  var saveBtn   = document.getElementById("saveProjectBtn");
  var msg       = document.getElementById("projModalMsg");
  if (!modal) return;

  function closeModal() {
    modal.classList.add("hidden");
    if (msg) msg.classList.add("hidden");
    ["mProjId","mProjDesc","mProjValue","mProjBalance","mProjSpi","mProjIndi"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  if (openBtn)   openBtn.addEventListener("click", function() { modal.classList.remove("hidden"); });
  if (closeBtn)  closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function(e) { if (e.target === modal) closeModal(); });

  if (saveBtn) {
    saveBtn.addEventListener("click", function() {
      var id    = (document.getElementById("mProjId")?.value || "").trim();
      var desc  = (document.getElementById("mProjDesc")?.value || "").trim();
      var val   = parseFloat(document.getElementById("mProjValue")?.value || "");
      var bal   = parseFloat(document.getElementById("mProjBalance")?.value || "");
      var spi   = parseFloat(document.getElementById("mProjSpi")?.value || "1.00");
      var indi  = parseInt(document.getElementById("mProjIndi")?.value || "0", 10);
      var status= document.getElementById("mProjStatus")?.value || "On Track";
      if (!id || !desc || isNaN(val) || isNaN(bal)) return;

      var projects = DB.get(KEYS.PROJECTS, []);
      projects.push({ id:id, description:desc, contractValue:val, remaining:bal, spi:spi, indigenization:indi, status:status, createdAt:Date.now() });
      DB.set(KEYS.PROJECTS, projects);
      renderProjects();
      logAudit("DATA_CREATE", "New WBS: " + id + " · " + desc + " · ₹" + val + " Cr");
      if (msg) msg.classList.remove("hidden");
      setTimeout(function() { if (msg) msg.classList.add("hidden"); closeModal(); }, 1500);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUPPLY — SAP-MM
// ═══════════════════════════════════════════════════════════════════
var inventoryGridInst = null;
var vendorGridInst    = null;
var materialsGridInst = null;

function renderSupply() {
  var inventory = DB.get(KEYS.INVENTORY, []);
  var vendors   = DB.get(KEYS.VENDORS, []);
  var materials = DB.get(KEYS.MATERIALS, []);
  var low = inventory.filter(function(i) { return i.status === "LOW"; }).length;
  var exp = vendors.filter(function(v) { return (v.regExpiry - Date.now()) < 86400000 * 90; }).length;

  var kv = document.getElementById("kpi-vendors");
  var km = document.getElementById("kpi-mat-count");
  var kr = document.getElementById("kpi-reorders");
  var ke = document.getElementById("kpi-expiring");
  if (kv) kv.textContent = vendors.length;
  if (km) km.textContent = materials.length;
  if (kr) kr.textContent = low;
  if (ke) ke.textContent = exp;

  // Inventory grid
  var invC = document.getElementById("inventoryGrid");
  if (invC) {
    var invRows = inventory.map(function(i) {
      var stockHtml = i.status === "LOW"
        ? '<span class="stock-low">&#9888; ' + i.stock + " " + i.unit + "</span>"
        : i.stock + " " + i.unit;
      return [i.code, i.description, gridjs.html(stockHtml), i.minThreshold + " " + i.unit, "₹" + i.unitPrice.toLocaleString("en-IN"), i.vendorId];
    });
    var invCfg = {
      columns:[{name:"Item Code",width:"110px"},{name:"Description",width:"220px"},{name:"Stock",width:"90px"},{name:"Min Threshold",width:"110px"},{name:"Unit Price",width:"100px"},{name:"Vendor",width:"100px"}],
      data:invRows, sort:true, pagination:{ enabled:true, limit:5 },
    };
    if (!inventoryGridInst) { inventoryGridInst = new gridjs.Grid(invCfg); inventoryGridInst.render(invC); }
    else inventoryGridInst.updateConfig(invCfg).forceRender();
  }

  // Vendor grid
  var vC = document.getElementById("vendorGrid");
  if (vC) {
    var vRows = vendors.map(function(v) {
      var daysLeft = Math.ceil((v.regExpiry - Date.now()) / 86400000);
      var expiryHtml = daysLeft < 90
        ? '<span class="cell-negative">&#9888; ' + daysLeft + "d</span>"
        : daysLeft + "d";
      var gcHtml  = v.greenChannel ? '<span class="green-channel">&#10004; GREEN</span>' : "—";
      var emdHtml = v.emdExempt    ? '<span class="emd-exempt">&#10004; EXEMPT</span>'  : "—";
      return [v.id, v.name, v.category, v.material, gridjs.html(gcHtml), gridjs.html(emdHtml), gridjs.html(expiryHtml)];
    });
    var vCfg = {
      columns:[{name:"ID",width:"90px"},{name:"Name",width:"190px"},{name:"Category",width:"70px"},{name:"Material",width:"140px"},{name:"Green Ch.",width:"80px"},{name:"EMD",width:"80px"},{name:"Expiry",width:"80px"}],
      data:vRows, sort:true, pagination:{ enabled:true, limit:4 },
    };
    if (!vendorGridInst) { vendorGridInst = new gridjs.Grid(vCfg); vendorGridInst.render(vC); }
    else vendorGridInst.updateConfig(vCfg).forceRender();
  }

  renderMaterialsGrid();
  logAudit("VIEW_ACCESS", "Supply Chain & Vendors (SAP-MM)");
}

function renderMaterialsGrid() {
  var c = document.getElementById("materialsGrid");
  if (!c) return;
  var data = DB.get(KEYS.MATERIALS, []).sort(function(a, b) { return b.createdAt - a.createdAt; });
  var rows = data.map(function(m) {
    return [
      m.material, m.heatNo, m.qty, m.project, m.location || "—",
      new Date(m.createdAt).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
    ];
  });
  var cfg = {
    columns:[{name:"Material",width:"180px"},{name:"Heat/Batch",width:"100px"},{name:"Qty",width:"60px"},{name:"Project",width:"90px"},{name:"Location",width:"90px"},{name:"Logged At",width:"130px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };
  if (!materialsGridInst) { materialsGridInst = new gridjs.Grid(cfg); materialsGridInst.render(c); }
  else materialsGridInst.updateConfig(cfg).forceRender();
  var badge = document.getElementById("matIssueCount");
  if (badge) badge.textContent = data.length + " ISSUES";
}

var matLoggerWired = false;
function wireMaterialLogger() {
  if (matLoggerWired) return;
  matLoggerWired = true;

  var btn = document.getElementById("logMaterialBtn");
  if (!btn) return;

  btn.addEventListener("click", function() {
    var material = (document.getElementById("matType")?.value || "").trim();
    var project  = (document.getElementById("matProject")?.value || "").trim();
    var heatNo   = (document.getElementById("matHeat")?.value || "").trim();
    var qty      = parseFloat(document.getElementById("matQty")?.value || "");
    var location = (document.getElementById("matLocation")?.value || "").trim();
    if (!material || !heatNo || isNaN(qty)) return;

    var mats = DB.get(KEYS.MATERIALS, []);
    mats.push({ id:crypto.randomUUID(), material:material, heatNo:heatNo, qty:qty, project:project, location:location, createdAt:Date.now() });
    DB.set(KEYS.MATERIALS, mats);
    renderMaterialsGrid();
    logAudit("DATA_CREATE", "ROMIS: " + material + " · " + qty + " units → " + project);

    var msg = document.getElementById("matFormMsg");
    if (msg) { msg.classList.remove("hidden"); setTimeout(function() { msg.classList.add("hidden"); }, 2000); }

    var heatEl = document.getElementById("matHeat");
    var qtyEl  = document.getElementById("matQty");
    var locEl  = document.getElementById("matLocation");
    if (heatEl) heatEl.value = "";
    if (qtyEl)  qtyEl.value  = "";
    if (locEl)  locEl.value  = "";

    var badge = document.getElementById("kpi-mat-count");
    if (badge) badge.textContent = mats.length;
  });
}

// ═══════════════════════════════════════════════════════════════════
// HCM — Workforce + HSE (SAP-HCM + SAP-EHS)
// ═══════════════════════════════════════════════════════════════════
var leadershipGridInst = null;
var hseGridInst        = null;
var selectedSev        = "LOW";

var LEADERSHIP = [
  { id:"CMD-01", name:"Capt. Jagmohan (Retd.)",       designation:"Chairman & Managing Director (CMD)",        access:"Global Enterprise · All Modules",  clearance:"SECRET"       },
  { id:"DIR-SB", name:"Mr. Biju George",               designation:"Director (Shipbuilding)",                   access:"Production · PM · QA",             clearance:"CONFIDENTIAL" },
  { id:"DIR-FI", name:"Mr. Ruchir Agrawal",            designation:"Director (Finance) & CFO",                  access:"Financial Ledger · Audit",          clearance:"CONFIDENTIAL" },
  { id:"DIR-SM", name:"Cmde Shailesh B Jamgaonkar",   designation:"Director (Submarine & Heavy Engineering)",   access:"Submarine · IPMS · Heavy Mfg",     clearance:"SECRET"       },
  { id:"DIR-CP", name:"Cdr. Vasudev Puranik",          designation:"Director (Corporate Planning & Personnel)",  access:"HR · Strategic Planning",           clearance:"RESTRICTED"   },
  { id:"GM-CIT", name:"Mr. Chandra Vijay Shrivastava", designation:"GM (F-CA) & GM (CIT)",                      access:"Financial Control · IT · MIS",     clearance:"CONFIDENTIAL" },
  { id:"GM-FPS", name:"Mr. Saurabh Kumar Gupta",       designation:"GM (F-P&S)",                                 access:"Financial Planning & Strategy",    clearance:"RESTRICTED"   },
  { id:"GM-PSO", name:"Mr. Sanjay Kumar Singh",        designation:"GM (PS-Offshore & MOD KILO)",               access:"Offshore Projects · Sub Refit",    clearance:"SECRET"       },
  { id:"GM-QSI", name:"Mr. E R Thomas",                designation:"GM (SB-QA & SI)",                           access:"Quality Assurance · ISO",           clearance:"CONFIDENTIAL" },
  { id:"GM-INF", name:"Mr. P Dhanraj",                 designation:"GM (SB-Works/NHY)",                         access:"Infrastructure · Berth & Dock",    clearance:"RESTRICTED"   },
  { id:"ED-HR",  name:"Mr. Arun Kumar Chand",          designation:"Executive Director / HOD (HR)",             access:"HR Master · Payroll · Diversity",   clearance:"RESTRICTED"   },
];

function clearanceCellHtml(clearance) {
  var classMap = { SECRET:"cell-negative", CONFIDENTIAL:"cell-neutral", RESTRICTED:"cell-positive" };
  var cls = classMap[clearance] || "";
  return '<span class="' + cls + '">' + clearance + '</span>';
}

function renderHCM() {
  var logs = DB.get(KEYS.HSE, []);
  var nmCount   = logs.filter(function(l) { return l.logType === "near-miss"; }).length;
  var totalHrs  = logs.reduce(function(s, l) { return s + (parseFloat(l.hours) || 0); }, 0);

  var nmEl   = document.getElementById("kpi-near-miss");
  var hrsEl  = document.getElementById("kpi-subcon-hrs");
  var cntEl  = document.getElementById("hseEntryCount");
  if (nmEl)  nmEl.textContent  = nmCount;
  if (hrsEl) hrsEl.textContent = totalHrs.toLocaleString("en-IN");
  if (cntEl) cntEl.textContent = logs.length + " ENTRIES";

  // Leadership grid
  var lC = document.getElementById("leadershipGrid");
  if (lC) {
    var lRows = LEADERSHIP.map(function(p) {
      return [p.id, p.name, p.designation, p.access, gridjs.html(clearanceCellHtml(p.clearance))];
    });
    var lCfg = {
      columns:[{name:"Employee ID",width:"80px"},{name:"Name",width:"180px"},{name:"Designation",width:"240px"},{name:"MIS Access (RBAC)",width:"230px"},{name:"Clearance",width:"100px"}],
      data:lRows, sort:true, pagination:{ enabled:true, limit:6 },
    };
    if (!leadershipGridInst) { leadershipGridInst = new gridjs.Grid(lCfg); leadershipGridInst.render(lC); }
    else leadershipGridInst.updateConfig(lCfg).forceRender();
  }

  renderHSEGrid();
  logAudit("VIEW_ACCESS", "Human Capital & HSE (SAP-HCM)");
}

function renderHSEGrid() {
  var c = document.getElementById("hseGrid");
  if (!c) return;
  var typeMap = { "near-miss":"Near-Miss", "subcon":"Sub-Con Hrs", "hazard":"Hazard Obs.", "toolbox":"Toolbox Talk", "permit":"Permit-WTW" };
  var logs = DB.get(KEYS.HSE, []).sort(function(a, b) { return b.createdAt - a.createdAt; });
  var rows = logs.map(function(l) {
    var desc = l.description.length > 55 ? l.description.substring(0, 55) + "…" : l.description;
    var sevHtml = '<span class="sev-tag ' + l.severity + '">' + l.severity + '</span>';
    return [
      typeMap[l.logType] || l.logType,
      l.shift,
      desc,
      l.personnel || "—",
      l.hours ? l.hours + " hrs" : "—",
      gridjs.html(sevHtml),
      new Date(l.createdAt).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
    ];
  });
  var cfg = {
    columns:[{name:"Type",width:"90px"},{name:"Zone",width:"100px"},{name:"Activity",width:"240px"},{name:"Personnel",width:"85px"},{name:"Hours",width:"70px"},{name:"Severity",width:"80px"},{name:"Logged At",width:"120px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };
  if (!hseGridInst) { hseGridInst = new gridjs.Grid(cfg); hseGridInst.render(c); }
  else hseGridInst.updateConfig(cfg).forceRender();
}

var sevWired = false;
function wireSeveritySelector() {
  if (sevWired) return;
  sevWired = true;
  var btns = document.querySelectorAll(".sev-btn");
  btns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      btns.forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      selectedSev = btn.dataset.sev;
    });
  });
}

var hseWired = false;
function wireHSEForm() {
  if (hseWired) return;
  hseWired = true;

  var btn = document.getElementById("logHseBtn");
  if (!btn) return;

  btn.addEventListener("click", function() {
    var logType     = document.getElementById("hseLogType")?.value || "near-miss";
    var shift       = document.getElementById("hseShift")?.value   || "A-East";
    var description = (document.getElementById("hseDescription")?.value || "").trim();
    var personnel   = (document.getElementById("hsePersonnel")?.value || "").trim();
    var hours       = parseFloat(document.getElementById("hseHours")?.value || "") || null;

    if (!description) {
      var descEl = document.getElementById("hseDescription");
      if (descEl) descEl.focus();
      return;
    }

    var logs = DB.get(KEYS.HSE, []);
    logs.push({
      id:          crypto.randomUUID(),
      logType:     logType,
      shift:       shift,
      description: description,
      personnel:   personnel || "",
      hours:       hours || "",
      severity:    selectedSev,
      createdAt:   Date.now(),
    });
    DB.set(KEYS.HSE, logs);
    renderHCM();
    logAudit("DATA_CREATE", "HSE Log: " + logType + " · " + shift + " · Severity: " + selectedSev);

    var msg = document.getElementById("hseFormMsg");
    if (msg) { msg.classList.remove("hidden"); setTimeout(function() { msg.classList.add("hidden"); }, 2000); }

    var descEl2 = document.getElementById("hseDescription");
    var persEl  = document.getElementById("hsePersonnel");
    var hrsEl   = document.getElementById("hseHours");
    if (descEl2) descEl2.value = "";
    if (persEl)  persEl.value  = "";
    if (hrsEl)   hrsEl.value   = "";
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════
var auditGridInst = null;

function renderAuditGrid() {
  var c = document.getElementById("auditGrid");
  if (!c) return;
  var logs = DB.get(KEYS.AUDIT, []);
  var rows = logs.map(function(l) {
    return [
      new Date(l.ts).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", second:"2-digit" }),
      l.userId,
      l.role,
      gridjs.html(clearanceCellHtml(l.clearance)),
      l.action,
      l.detail,
    ];
  });
  var cfg = {
    columns:[{name:"Timestamp",width:"140px"},{name:"User",width:"160px"},{name:"Role",width:"120px"},{name:"Clearance",width:"100px"},{name:"Action",width:"120px"},{name:"Detail",width:"280px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:10 },
  };
  if (!auditGridInst) { auditGridInst = new gridjs.Grid(cfg); auditGridInst.render(c); }
  else auditGridInst.updateConfig(cfg).forceRender();
  updateAuditBadge();
}

// ═══════════════════════════════════════════════════════════════════
// INIT — DOMContentLoaded
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", function() {
  buildRBACOverlay();
});

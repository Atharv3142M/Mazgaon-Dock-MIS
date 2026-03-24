/**
 * MDL DIGITAL SHIPYARD MIS v7.0
 * ─────────────────────────────────────────────────────────────────
 * 100% self-contained. Zero external API dependencies.
 * Works offline, works on GitHub Pages with no configuration.
 * All persistence: localStorage. All CRUD: inline edit/delete.
 *
 * MODULES:
 *   1. DB       — localStorage CRUD layer
 *   2. RBAC     — Role overlay, account switcher, audit log
 *   3. ESS      — Financial Command (charts, P&L, edit KPIs)
 *   4. Projects — Portfolio grid with inline edit/delete + add
 *   5. Supply   — Inventory, Vendors, ROMIS with full CRUD
 *   6. HCM      — Personnel, HSE incidents, attendance with full CRUD
 *   7. Compliance — CSR, OEE, ISO tracker with edit
 *   8. Audit    — Immutable session log
 * ─────────────────────────────────────────────────────────────────
 */
"use strict";

/* ═══════════════════════════════════════════════════════════════
   STORAGE LAYER
   ═══════════════════════════════════════════════════════════════ */
const KEYS = {
  INIT:      "mdl_v7_init",
  FINANCIAL: "mdl_v7_financial",
  PROJECTS:  "mdl_v7_projects",
  INVENTORY: "mdl_v7_inventory",
  VENDORS:   "mdl_v7_vendors",
  MATERIALS: "mdl_v7_materials",
  PERSONNEL: "mdl_v7_personnel",
  HSE:       "mdl_v7_hse",
  ATTENDANCE:"mdl_v7_attendance",
  ASSETS:    "mdl_v7_assets",
  AUDIT:     "mdl_v7_audit",
  SESSION:   "mdl_v7_session",
};

const DB = {
  get(k, fb)  { try { const r = localStorage.getItem(k); return r === null ? fb : JSON.parse(r); } catch(e) { return fb; } },
  set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e) { return false; } },
  push(k, obj){ const arr = this.get(k, []); arr.push(obj); return this.set(k, arr); },
  update(k, id, patch) {
    const arr = this.get(k, []);
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return false;
    arr[idx] = Object.assign({}, arr[idx], patch, { updated_at: Date.now() });
    return this.set(k, arr);
  },
  remove(k, id) {
    const arr = this.get(k, []).filter(r => r.id !== id);
    return this.set(k, arr);
  },
};

function uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); }

/* ═══════════════════════════════════════════════════════════════
   SEED DATA (runs once on first load)
   ═══════════════════════════════════════════════════════════════ */
function seed() {
  if (DB.get(KEYS.INIT, false)) return;

  DB.set(KEYS.FINANCIAL, {
    revenue:  { fy21:4200, fy22:5100, fy23:7192, fy24:9467, fy25:11432 },
    pat:      { fy21:620,  fy22:810,  fy23:1385, fy24:1845, fy25:2325  },
    ebitda:   { fy21:780,  fy22:960,  fy23:1340, fy24:1649, fy25:3229  },
    orderBook: 32260,
    indigenous: 76,
  });

  DB.set(KEYS.PROJECTS, [
    { id:uid(), wbs:"P17A",    desc:"P17A Nilgiri Class Stealth Frigates (4 vessels, MoD)",      value:28769, remaining:3716,  spi:0.97, indi:75, status:"On Track" },
    { id:uid(), wbs:"P15B",    desc:"P15B Visakhapatnam Class Destroyers (4 vessels, MoD)",      value:27120, remaining:4,     spi:1.02, indi:72, status:"On Track" },
    { id:uid(), wbs:"P75",     desc:"P75 Kalvari Class Scorpène Submarines (6 boats, MoD)",      value:23814, remaining:2493,  spi:1.02, indi:60, status:"On Track" },
    { id:uid(), wbs:"P75-AIP", desc:"P75 AIP Plug Retrofit — Air Independent Propulsion",       value:1990,  remaining:1749,  spi:1.00, indi:52, status:"On Track" },
    { id:uid(), wbs:"ICGS",    desc:"ICGS Fleet — CTS / NGOPV / FPV (21 vessels, Coast Guard)", value:2829,  remaining:715,   spi:0.95, indi:68, status:"Slight Overrun" },
    { id:uid(), wbs:"OFF",     desc:"Offshore Projects — PRPP / DSF-II / PRP (ONGC)",           value:6524,  remaining:5409,  spi:0.91, indi:55, status:"Slight Overrun" },
    { id:uid(), wbs:"MRLC",    desc:"Submarine MRLC — Medium Refit & Life Extension",           value:2381,  remaining:1711,  spi:0.98, indi:58, status:"On Track" },
    { id:uid(), wbs:"MPV-EXP", desc:"MPV Export — 6 Hybrid Vessels (Navi Merchants, Denmark)",  value:710,   remaining:710,   spi:0.88, indi:42, status:"Slight Overrun" },
    { id:uid(), wbs:"MISC",    desc:"Miscellaneous Support Projects (Various Entities)",         value:256,   remaining:169,   spi:1.01, indi:65, status:"On Track" },
  ]);

  DB.set(KEYS.INVENTORY, [
    { id:uid(), code:"RM-SP-DH36",  desc:"Steel Plate Grade DH36 (Naval Shipbuilding)",   qty:348,  minQty:100, unit:"MT",  price:72000,   vendor:"V-SAIL-01" },
    { id:uid(), code:"RM-PP-HP316", desc:"High-Pressure Alloy Pipe SS 316L",               qty:82,   minQty:120, unit:"Nos", price:15500,   vendor:"V-TUBE-02" },
    { id:uid(), code:"RM-BB-STR",   desc:"Bulb Bar Structural KB-300",                     qty:215,  minQty:50,  unit:"MT",  price:68000,   vendor:"V-SAIL-01" },
    { id:uid(), code:"EQ-VALVE-DN", desc:"DN150 Gate Valve Assembly (Naval Grade, PN40)",  qty:44,   minQty:60,  unit:"Nos", price:42000,   vendor:"V-VALVE-03" },
    { id:uid(), code:"EQ-CBTRAY-A", desc:"Cable Tray Assembly GI 150mm",                   qty:620,  minQty:200, unit:"Nos", price:1800,    vendor:"V-ELEC-04" },
    { id:uid(), code:"EQ-GENSET-M", desc:"Generator Set Module 2.5MW (Marine)",            qty:4,    minQty:2,   unit:"Nos", price:9200000, vendor:"V-GEN-05" },
    { id:uid(), code:"RM-CABLE-C",  desc:"Multi-Core Control Cable XLPE 1000V",            qty:18500,minQty:5000,unit:"m",   price:185,     vendor:"V-ELEC-04" },
    { id:uid(), code:"EQ-PUMP-BW",  desc:"Ballast Water Pump 600 m³/hr (BWMS)",            qty:6,    minQty:4,   unit:"Nos", price:1850000, vendor:"V-PUMP-06" },
  ]);

  DB.set(KEYS.VENDORS, [
    { id:uid(), code:"V-SAIL-01",  name:"SAIL — Steel Authority of India",        cat:"PSU",   material:"Structural Steel",      greenCh:false, emdEx:true,  expiry:new Date(Date.now()+400*864e5).toISOString().slice(0,10), status:"Active" },
    { id:uid(), code:"V-TUBE-02",  name:"Patton Tubing Pvt Ltd (MSME)",           cat:"MSME",  material:"Pipes & Fittings",       greenCh:true,  emdEx:true,  expiry:new Date(Date.now()+45*864e5).toISOString().slice(0,10),  status:"Active" },
    { id:uid(), code:"V-VALVE-03", name:"Kirloskar Brothers Limited",              cat:"Large", material:"Valve Assemblies",       greenCh:true,  emdEx:false, expiry:new Date(Date.now()+300*864e5).toISOString().slice(0,10), status:"Active" },
    { id:uid(), code:"V-ELEC-04",  name:"Havells India Limited",                  cat:"Large", material:"Cables & Electrical",    greenCh:false, emdEx:false, expiry:new Date(Date.now()+200*864e5).toISOString().slice(0,10), status:"Active" },
    { id:uid(), code:"V-GEN-05",   name:"BHEL Bhopal (PSU)",                      cat:"PSU",   material:"Gensets & Turbines",     greenCh:true,  emdEx:true,  expiry:new Date(Date.now()+500*864e5).toISOString().slice(0,10), status:"Active" },
    { id:uid(), code:"V-PUMP-06",  name:"Flowserve India Controls (MSME)",        cat:"MSME",  material:"Pumps & Compressors",    greenCh:false, emdEx:true,  expiry:new Date(Date.now()+80*864e5).toISOString().slice(0,10),  status:"Active" },
  ]);

  DB.set(KEYS.MATERIALS, [
    { id:uid(), material:"Steel Plate (Grade DH36)",  heatNo:"HT-25-019", qty:24, project:"P17A", loc:"SY-B2-R4",  ts: Date.now()-6*3600000 },
    { id:uid(), material:"High-Pressure Alloy Pipe",  heatNo:"PP-25-007", qty:60, project:"P75",  loc:"SUB-C3-L2", ts: Date.now()-2*3600000 },
  ]);

  DB.set(KEYS.PERSONNEL, [
    { id:uid(), empId:"CMD-01", name:"Capt. Jagmohan (Retd.)",       dept:"Board",      desig:"Chairman & Managing Director", category:"Board",     clearance:"SECRET",       status:"Active" },
    { id:uid(), empId:"DIR-SB", name:"Mr. Biju George",               dept:"Board",      desig:"Director (Shipbuilding)",       category:"Board",     clearance:"CONFIDENTIAL", status:"Active" },
    { id:uid(), empId:"DIR-FI", name:"Mr. Ruchir Agrawal",            dept:"Finance",    desig:"Director (Finance) & CFO",      category:"Board",     clearance:"CONFIDENTIAL", status:"Active" },
    { id:uid(), empId:"ENG-01", name:"Cdr. Vasudev Puranik",          dept:"Corp. Plan", desig:"Director (Corp. Planning)",     category:"Executive", clearance:"RESTRICTED",   status:"Active" },
    { id:uid(), empId:"HR-001", name:"Mr. Arun Kumar Chand",          dept:"HR",         desig:"Executive Director / HOD (HR)", category:"Executive", clearance:"RESTRICTED",   status:"Active" },
    { id:uid(), empId:"IT-001", name:"Mr. C V Shrivastava",           dept:"IT",         desig:"GM (F-CA) & GM (CIT)",          category:"GM",        clearance:"CONFIDENTIAL", status:"Active" },
    { id:uid(), empId:"QA-001", name:"Mr. E R Thomas",                dept:"QA",         desig:"GM (SB-QA & SI)",               category:"GM",        clearance:"CONFIDENTIAL", status:"Active" },
    { id:uid(), empId:"INF-01", name:"Mr. P Dhanraj",                 dept:"Works",      desig:"GM (SB-Works/NHY)",             category:"GM",        clearance:"RESTRICTED",   status:"Active" },
    { id:uid(), empId:"WRK-01", name:"Yard Worker — East Dock A",     dept:"Production", desig:"Senior Fabricator (Welder)",    category:"Workforce", clearance:"RESTRICTED",   status:"Active" },
    { id:uid(), empId:"WRK-02", name:"Yard Worker — Sub Division B",  dept:"Submarine",  desig:"Hull Fitter Grade-II",          category:"Workforce", clearance:"RESTRICTED",   status:"Active" },
  ]);

  DB.set(KEYS.HSE, [
    { id:uid(), type:"near-miss", shift:"A-East",  desc:"Unsecured toolbox near Dock-2 upper gantry. No injury. PPE compliant.", personnel:"CTR-1922", hours:null,   sev:"MED", ts: Date.now()-8*3600000 },
    { id:uid(), type:"subcon",    shift:"B-East",  desc:"Erection sub-assembly P17A frame-72. All PPE compliant.",               personnel:"CTR-2841", hours:32,     sev:"LOW", ts: Date.now()-3*3600000 },
    { id:uid(), type:"toolbox",   shift:"A-Sub",   desc:"Confined space entry procedure for submarine ballast tank.",           personnel:"SUP-0441", hours:null,   sev:"LOW", ts: Date.now()-1*3600000 },
  ]);

  DB.set(KEYS.ATTENDANCE, [
    { id:uid(), empId:"WRK-01", name:"Yard Worker — East Dock A",   date:today(), shift:"A", status:"Present", inTime:"07:00", outTime:"15:30" },
    { id:uid(), empId:"WRK-02", name:"Yard Worker — Sub Division B",date:today(), shift:"B", status:"Present", inTime:"15:00", outTime:"23:30" },
    { id:uid(), empId:"ENG-01", name:"Cdr. Vasudev Puranik",        date:today(), shift:"A", status:"Present", inTime:"09:00", outTime:"18:00" },
  ]);

  DB.set(KEYS.ASSETS, [
    { id:uid(), assetId:"DD-01",     name:"Dry Dock No. 1",                 type:"Dry Dock",    utilPct:88, status:"Occupied",    project:"P17A Ship-3",          nextPM:"2026-03-15" },
    { id:uid(), assetId:"DD-02",     name:"Dry Dock No. 2",                 type:"Dry Dock",    utilPct:72, status:"Occupied",    project:"P15B Refit",            nextPM:"2025-12-01" },
    { id:uid(), assetId:"SUB-DD",    name:"Submarine Dry Dock",             type:"Dry Dock",    utilPct:95, status:"Occupied",    project:"P75 AIP Retrofit",      nextPM:"2026-01-10" },
    { id:uid(), assetId:"FDD-NH",    name:"Nhava Sheva Floating Dry Dock",  type:"Float Dock",  utilPct:52, status:"Partial",     project:"MPV Export Y21001",     nextPM:"2025-11-20" },
    { id:uid(), assetId:"CRANE-300T",name:"300-Tonne Goliath Crane",        type:"Crane",       utilPct:74, status:"Operational", project:"P17A / P15B Lifts",     nextPM:"2025-08-15" },
    { id:uid(), assetId:"WB-01",     name:"Wet Basin No. 1",                type:"Wet Basin",   utilPct:80, status:"Occupied",    project:"P17A Outfitting",       nextPM:"2026-02-01" },
    { id:uid(), assetId:"SIF",       name:"Shore Integration Facility",     type:"Facility",    utilPct:88, status:"Operational", project:"P17A / P75 Trials",     nextPM:"2026-04-01" },
    { id:uid(), assetId:"CNC-01",    name:"CNC Plasma Cutter #1",           type:"Machine",     utilPct:60, status:"Operational", project:"MPV / ICGS Fabrication",nextPM:"2025-09-30" },
  ]);

  DB.set(KEYS.AUDIT, []);
  DB.set(KEYS.SESSION, null);
  DB.set(KEYS.INIT, true);
}

function today() { return new Date().toISOString().slice(0,10); }

/* ═══════════════════════════════════════════════════════════════
   RBAC ROLES
   ═══════════════════════════════════════════════════════════════ */
const ROLES = [
  { key:"super-admin",          name:"Super Administrator",   persona:"IT Systems Director",      icon:"fa-shield-halved", clr:"SECRET",       clrCls:"clr-secret", color:"#ff4d4d", perms:["ess","projects","supply","hcm","assets","compliance","audit"] },
  { key:"executive",            name:"Executive Director",    persona:"Board Member / C-Suite",   icon:"fa-briefcase",     clr:"CONFIDENTIAL", clrCls:"clr-conf",   color:"#f5c842", perms:["ess","projects","compliance","audit"] },
  { key:"project-commander",    name:"Project Commander",     persona:"Warship / Submarine Lead", icon:"fa-anchor",        clr:"SECRET",       clrCls:"clr-secret", color:"#2075ff", perms:["projects","supply","assets","audit"] },
  { key:"financial-controller", name:"Financial Controller",  persona:"Accounting Manager",       icon:"fa-chart-line",    clr:"CONFIDENTIAL", clrCls:"clr-conf",   color:"#f5c842", perms:["ess","audit"] },
  { key:"supply-officer",       name:"Supply Chain Officer",  persona:"Procurement Lead",         icon:"fa-boxes-stacked", clr:"RESTRICTED",   clrCls:"clr-rest",   color:"#00e5a0", perms:["supply","audit"] },
  { key:"floor-supervisor",     name:"Floor Supervisor",      persona:"Yard Master / Foreman",    icon:"fa-hard-hat",      clr:"RESTRICTED",   clrCls:"clr-rest",   color:"#00e5a0", perms:["hcm","assets","audit"] },
];

const SIDEBAR_MODS = [
  { view:"ess",        icon:"fa-satellite-dish",  title:"Financial Command",      sub:"SAP-FI/CO · ESS"         },
  { view:"projects",   icon:"fa-anchor",           title:"Project & Spatial MIS", sub:"SAP-PS · Portfolio"      },
  { view:"supply",     icon:"fa-boxes-stacked",    title:"Supply Chain & Vendors",sub:"SAP-MM · ROMIS"          },
  { view:"hcm",        icon:"fa-hard-hat",         title:"Human Capital & HSE",   sub:"SAP-HCM · EHS"          },
  { view:"assets",     icon:"fa-warehouse",        title:"Infrastructure Assets", sub:"SAP-PM · Dock Mgmt"     },
  { view:"compliance", icon:"fa-flag",             title:"Compliance & CSR",      sub:"ISO · Aatmanirbhar"     },
  { view:"audit",      icon:"fa-scroll",           title:"Audit Log",             sub:"Immutable Trail"        },
];

let activeRole = null;
let currentView = null;

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOGGER
   ═══════════════════════════════════════════════════════════════ */
function auditLog(action, detail) {
  const logs = DB.get(KEYS.AUDIT, []);
  logs.unshift({ id:uid(), ts:Date.now(), user: activeRole ? activeRole.name : "SYSTEM", role: activeRole ? activeRole.key : "—", clr: activeRole ? activeRole.clr : "—", action, detail: detail||"" });
  DB.set(KEYS.AUDIT, logs.slice(0, 500));
  const el = document.getElementById("auditCount");
  if (el) el.textContent = logs.length + " EVENTS";
  if (currentView === "audit") renderAudit();
}

/* ═══════════════════════════════════════════════════════════════
   RBAC OVERLAY  ← THIS IS THE KEY FIX
   ═══════════════════════════════════════════════════════════════ */
function buildOverlay() {
  const wrap = document.getElementById("rbacRoles");
  if (!wrap) return;
  wrap.innerHTML = "";
  ROLES.forEach(role => {
    const btn = document.createElement("button");
    btn.className = "rbac-role-btn";
    btn.type = "button";
    btn.innerHTML = `
      <div class="rbac-role-icon" style="color:${role.color};border-color:${role.color}55;background:${role.color}11">
        <i class="fas ${role.icon}"></i>
      </div>
      <div style="flex:1;text-align:left;min-width:0">
        <span class="rbac-role-name">${role.name}</span>
        <span class="rbac-role-desc">${role.persona} · ${role.perms.length} modules</span>
      </div>
      <span class="rbac-role-clearance ${role.clrCls}">${role.clr}</span>
    `;
    btn.onclick = () => loginAs(role);
    wrap.appendChild(btn);
  });
}

function loginAs(role) {
  activeRole = role;
  DB.set(KEYS.SESSION, { key: role.key, ts: Date.now() });
  const overlay = document.getElementById("rbacOverlay");
  const shell   = document.getElementById("appShell");
  if (overlay) overlay.style.display = "none";
  if (shell)   shell.style.display   = "flex";
  updateChip();
  buildSidebar();
  buildSwitcher();
  wireAppControls();
  auditLog("LOGIN", `Role: ${role.name} · Clearance: ${role.clr}`);
  const first = role.perms.filter(p => p !== "audit")[0] || "audit";
  goTo(first);
}

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SWITCHER
   ═══════════════════════════════════════════════════════════════ */
function buildSwitcher() {
  const list = document.getElementById("switcherRoleList");
  if (!list) return;
  list.innerHTML = "";
  ROLES.forEach(role => {
    const item = document.createElement("div");
    item.className = "switcher-role-item" + (activeRole && role.key === activeRole.key ? " active-role" : "");
    item.innerHTML = `
      <i class="fas ${role.icon} sw-role-icon" style="color:${role.color}"></i>
      <div><div class="sw-role-name">${role.name}</div><div class="sw-role-sub">${role.persona}</div></div>
      ${activeRole && role.key === activeRole.key ? '<span class="sw-active-badge">ACTIVE</span>' : ""}
    `;
    item.onclick = () => switchTo(role);
    list.appendChild(item);
  });
}

function switchTo(role) {
  if (activeRole && role.key === activeRole.key) { closeSwitcher(); return; }
  const prev = activeRole ? activeRole.name : "—";
  activeRole = role;
  DB.set(KEYS.SESSION, { key: role.key, ts: Date.now() });
  auditLog("ROLE_SWITCH", `From: ${prev} → To: ${role.name}`);
  updateChip();
  buildSidebar();
  buildSwitcher();
  closeSwitcher();
  nullGrids();
  currentView = null;
  const first = role.perms.filter(p => p !== "audit")[0] || "audit";
  goTo(first);
}

function updateChip() {
  if (!activeRole) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set("userNameDisplay", activeRole.name.toUpperCase());
  set("userRoleDisplay", activeRole.clr + " CLEARANCE");
  set("metaRole",        activeRole.name);
  set("metaClearance",   activeRole.clr + " · " + activeRole.persona);
  const ic = document.getElementById("userAvatarIcon");
  if (ic) ic.innerHTML = `<i class="fas ${activeRole.icon}"></i>`;
}

let switcherOpen = false;
function toggleSwitcher() {
  switcherOpen = !switcherOpen;
  const dd = document.getElementById("switcherDropdown");
  const ch = document.getElementById("userChevron");
  if (dd) { if (switcherOpen) dd.classList.remove("hidden"); else dd.classList.add("hidden"); }
  if (ch) ch.classList.toggle("open", switcherOpen);
}
function closeSwitcher() {
  switcherOpen = false;
  const dd = document.getElementById("switcherDropdown");
  const ch = document.getElementById("userChevron");
  if (dd) dd.classList.add("hidden");
  if (ch) ch.classList.remove("open");
}

function buildSidebar() {
  const nav = document.getElementById("sidebarNav");
  if (!nav || !activeRole) return;
  nav.innerHTML = "";
  SIDEBAR_MODS.forEach(mod => {
    if (!activeRole.perms.includes(mod.view)) return;
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
    el.onclick = () => { auditLog("NAV", mod.title); goTo(mod.view); };
    nav.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════ */
const VIEW_FN = {
  ess:        renderESS,
  projects:   renderProjects,
  supply:     renderSupply,
  hcm:        renderHCM,
  assets:     renderAssets,
  compliance: renderCompliance,
  audit:      renderAudit,
};

function goTo(view) {
  if (activeRole && !activeRole.perms.includes(view)) { goTo(activeRole.perms[0]||"audit"); return; }
  if (currentView === view) return;
  currentView = view;
  Object.keys(VIEW_FN).forEach(k => {
    const el = document.getElementById("view-"+k);
    if (el) el.classList.toggle("hidden", k !== view);
  });
  document.querySelectorAll(".sidebar-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const mod = SIDEBAR_MODS.find(m => m.view === view);
  const bc = document.getElementById("breadcrumb");
  if (bc && mod) bc.innerHTML = `<span>MDL HQ</span><i class="fas fa-angle-right"></i><span>${mod.title}</span>`;
  const lr = document.getElementById("lastRefresh");
  if (lr) lr.textContent = "Refreshed: " + new Date().toLocaleTimeString("en-IN",{hour12:false});
  VIEW_FN[view] && VIEW_FN[view]();
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
let chartRev = null, chartIndi = null;
const GRIDS = {};

function nullGrids() {
  Object.keys(GRIDS).forEach(k => { GRIDS[k] = null; });
  if (chartRev)  { chartRev.destroy();  chartRev  = null; }
  if (chartIndi) { chartIndi.destroy(); chartIndi = null; }
}

function clrHtml(clr) {
  const m = { SECRET:"cell-negative", CONFIDENTIAL:"cell-neutral", RESTRICTED:"cell-positive" };
  return `<span class="${m[clr]||""}">${clr||"—"}</span>`;
}
function spiHtml(v) {
  v = parseFloat(v);
  if (v >= 1.0) return `<span class="cell-positive">▲ ${v.toFixed(2)}</span>`;
  if (v >= 0.9) return `<span class="cell-neutral">◆ ${v.toFixed(2)}</span>`;
  return `<span class="cell-negative">▼ ${v.toFixed(2)}</span>`;
}
function statusHtml(s) {
  const m = { "On Track":"tag-on-track","Slight Overrun":"tag-overrun","Managed Overrun":"tag-managed","Underrun":"tag-underrun","On Hold":"tag-hold" };
  return `<span class="cell-tag ${m[s]||"tag-hold"}">${(s||"").toUpperCase()}</span>`;
}
function actionBtns(key, id, canEdit=true, canDelete=true) {
  let html = "";
  if (canEdit)   html += `<button class="act-btn edit-btn"   onclick="openEdit('${key}','${id}')"><i class="fas fa-pen"></i></button>`;
  if (canDelete) html += `<button class="act-btn delete-btn" onclick="confirmDelete('${key}','${id}')"><i class="fas fa-trash"></i></button>`;
  return html;
}

function renderGrid(containerId, key, cfg, rows) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const config = Object.assign({ data: rows, sort: true, pagination:{ enabled:true, limit:7 } }, cfg);
  if (!GRIDS[key]) {
    GRIDS[key] = new gridjs.Grid(config);
    GRIDS[key].render(c);
  } else {
    GRIDS[key].updateConfig(config).forceRender();
  }
}

/* ═══════════════════════════════════════════════════════════════
   UNIVERSAL EDIT MODAL
   ═══════════════════════════════════════════════════════════════ */
const EDIT_SCHEMAS = {
  projects:  [
    { f:"wbs",       label:"WBS Code",            type:"text"   },
    { f:"desc",      label:"Programme Description",type:"text"   },
    { f:"value",     label:"Contract Value (₹ Cr)",type:"number" },
    { f:"remaining", label:"Remaining (₹ Cr)",     type:"number" },
    { f:"spi",       label:"SPI (0–2)",             type:"number" },
    { f:"indi",      label:"Indigenization (%)",    type:"number" },
    { f:"status",    label:"Status",                type:"select", opts:["On Track","Slight Overrun","Managed Overrun","Underrun","On Hold"] },
  ],
  inventory: [
    { f:"code",    label:"Item Code",          type:"text"   },
    { f:"desc",    label:"Description",        type:"text"   },
    { f:"qty",     label:"Stock Qty",          type:"number" },
    { f:"minQty",  label:"Min Threshold",      type:"number" },
    { f:"unit",    label:"Unit",               type:"text"   },
    { f:"price",   label:"Unit Price (₹)",     type:"number" },
    { f:"vendor",  label:"Vendor Code",        type:"text"   },
  ],
  vendors:   [
    { f:"code",     label:"Vendor Code",      type:"text"   },
    { f:"name",     label:"Vendor Name",      type:"text"   },
    { f:"cat",      label:"Category",         type:"select", opts:["PSU","MSME","Large"] },
    { f:"material", label:"Material Group",   type:"text"   },
    { f:"greenCh",  label:"Green Channel",    type:"select", opts:["true","false"] },
    { f:"emdEx",    label:"EMD Exempt",       type:"select", opts:["true","false"] },
    { f:"expiry",   label:"Reg. Expiry Date", type:"date"   },
    { f:"status",   label:"Status",           type:"select", opts:["Active","Suspended","Expired"] },
  ],
  personnel: [
    { f:"empId",    label:"Employee ID",   type:"text"   },
    { f:"name",     label:"Full Name",     type:"text"   },
    { f:"dept",     label:"Department",    type:"text"   },
    { f:"desig",    label:"Designation",   type:"text"   },
    { f:"category", label:"Category",      type:"select", opts:["Board","Executive","GM","Workforce","Contractor"] },
    { f:"clearance",label:"Clearance",     type:"select", opts:["SECRET","CONFIDENTIAL","RESTRICTED"] },
    { f:"status",   label:"Status",        type:"select", opts:["Active","On Leave","Retired","Suspended"] },
  ],
  hse:       [
    { f:"type",      label:"Log Type",     type:"select", opts:["near-miss","subcon","hazard","toolbox","permit"] },
    { f:"shift",     label:"Shift / Zone", type:"text"   },
    { f:"desc",      label:"Description",  type:"text"   },
    { f:"personnel", label:"Personnel ID", type:"text"   },
    { f:"hours",     label:"Man-Hours",    type:"number" },
    { f:"sev",       label:"Severity",     type:"select", opts:["LOW","MED","HIGH","CRIT"] },
  ],
  attendance:[
    { f:"empId",   label:"Employee ID",   type:"text"   },
    { f:"name",    label:"Name",          type:"text"   },
    { f:"date",    label:"Date",          type:"date"   },
    { f:"shift",   label:"Shift",         type:"select", opts:["A","B","C","General"] },
    { f:"status",  label:"Status",        type:"select", opts:["Present","Absent","Half Day","On Leave","WFH"] },
    { f:"inTime",  label:"In Time",       type:"text"   },
    { f:"outTime", label:"Out Time",      type:"text"   },
  ],
  assets:    [
    { f:"assetId", label:"Asset ID",        type:"text"   },
    { f:"name",    label:"Asset Name",      type:"text"   },
    { f:"type",    label:"Type",            type:"select", opts:["Dry Dock","Float Dock","Wet Basin","Crane","Machine","Facility","Slipway"] },
    { f:"utilPct", label:"Utilisation (%)", type:"number" },
    { f:"status",  label:"Status",          type:"select", opts:["Occupied","Operational","Partial","Maintenance","Idle"] },
    { f:"project", label:"Current Project", type:"text"   },
    { f:"nextPM",  label:"Next PM Date",    type:"date"   },
  ],
};

let editingKey  = null;
let editingId   = null;
let editingMode = "edit"; // "edit" | "add"

window.openEdit = function(key, id) {
  editingKey  = key;
  editingId   = id;
  editingMode = "edit";
  const record = DB.get(KEYS[key.toUpperCase()], []).find(r => r.id === id);
  if (!record) return;
  showEditModal(key, record);
};

window.openAdd = function(key) {
  editingKey  = key;
  editingId   = null;
  editingMode = "add";
  showEditModal(key, {});
};

function showEditModal(key, data) {
  const schema = EDIT_SCHEMAS[key];
  if (!schema) return;
  const title = editingMode === "add" ? "Add New Record" : "Edit Record";
  const modal = document.getElementById("universalEditModal");
  const titleEl = document.getElementById("editModalTitle");
  const bodyEl  = document.getElementById("editModalBody");
  if (!modal || !bodyEl) return;
  titleEl && (titleEl.textContent = title + " · " + key.toUpperCase());
  bodyEl.innerHTML = schema.map(field => {
    const val = data[field.f] !== undefined ? data[field.f] : "";
    if (field.type === "select") {
      const opts = field.opts.map(o => `<option value="${o}" ${String(val) === String(o) ? "selected":""}>${o}</option>`).join("");
      return `<div class="form-group"><label class="form-label">${field.label}</label><select class="form-select" data-field="${field.f}">${opts}</select></div>`;
    }
    return `<div class="form-group"><label class="form-label">${field.label}</label><input class="form-input" type="${field.type}" data-field="${field.f}" value="${val}"></div>`;
  }).join("");
  modal.classList.remove("hidden");
}

document.addEventListener("click", function(e) {
  if (e.target && e.target.id === "editModalSave") saveEdit();
  if (e.target && e.target.id === "editModalCancel") closeEditModal();
  if (e.target && e.target.id === "universalEditModal") closeEditModal();
});

function saveEdit() {
  if (!editingKey) return;
  const schema = EDIT_SCHEMAS[editingKey];
  const modal  = document.getElementById("universalEditModal");
  const patch  = {};
  schema.forEach(field => {
    const input = modal.querySelector(`[data-field="${field.f}"]`);
    if (!input) return;
    let val = input.value;
    if (field.type === "number") val = parseFloat(val) || 0;
    if (field.f === "greenCh" || field.f === "emdEx") val = val === "true";
    patch[field.f] = val;
  });

  const storeKey = KEYS[editingKey.toUpperCase()];
  if (editingMode === "add") {
    patch.id = uid();
    patch.ts = Date.now();
    patch.created_at = Date.now();
    DB.push(storeKey, patch);
    auditLog("DATA_CREATE", `Added ${editingKey}: ${JSON.stringify(patch).slice(0,80)}`);
  } else {
    DB.update(storeKey, editingId, patch);
    auditLog("DATA_UPDATE", `Updated ${editingKey} id:${editingId}`);
  }

  closeEditModal();
  refreshCurrentView();
}

function closeEditModal() {
  const modal = document.getElementById("universalEditModal");
  if (modal) modal.classList.add("hidden");
  editingKey = editingId = null;
}

window.confirmDelete = function(key, id) {
  if (!confirm("Delete this record? This action is logged and cannot be undone.")) return;
  const storeKey = KEYS[key.toUpperCase()];
  DB.remove(storeKey, id);
  auditLog("DATA_DELETE", `Deleted ${key} id:${id}`);
  refreshCurrentView();
};

function refreshCurrentView() {
  if (!currentView) return;
  nullGrids();
  VIEW_FN[currentView] && VIEW_FN[currentView]();
}

/* ═══════════════════════════════════════════════════════════════
   ESS — FINANCIAL COMMAND
   ═══════════════════════════════════════════════════════════════ */
function renderESS() {
  const d = DB.get(KEYS.FINANCIAL, {});
  const rev  = d.revenue || {};
  const pat  = d.pat     || {};
  const yrs  = ["FY21","FY22","FY23","FY24","FY25"];
  const revV = yrs.map(y => rev[y.toLowerCase()] || 0);
  const patV = yrs.map(y => pat[y.toLowerCase()] || 0);

  Chart.defaults.color       = "#8a94a6";
  Chart.defaults.borderColor = "rgba(255,255,255,0.05)";
  Chart.defaults.font.family = "'IBM Plex Mono',monospace";
  Chart.defaults.font.size   = 10;

  const revCtx = document.getElementById("revenueChart");
  if (revCtx) {
    if (chartRev) chartRev.destroy();
    chartRev = new Chart(revCtx, {
      data:{ labels:yrs, datasets:[
        { type:"bar",  label:"Revenue (₹ Cr)", yAxisID:"yR", order:2, data:revV, backgroundColor:"rgba(32,117,255,0.5)", borderColor:"#2075ff", borderWidth:1 },
        { type:"line", label:"PAT (₹ Cr)",     yAxisID:"yP", order:1, data:patV, borderColor:"#00e5a0", backgroundColor:"rgba(0,229,160,0.07)", pointBackgroundColor:"#00e5a0", pointRadius:4, borderWidth:2, fill:true, tension:0.35 },
      ]},
      options:{
        responsive:true, maintainAspectRatio:true, interaction:{mode:"index",intersect:false},
        plugins:{ legend:{position:"top",align:"end",labels:{boxWidth:10,padding:14}}, tooltip:{ backgroundColor:"#1a2235",borderColor:"#2075ff",borderWidth:1,padding:10, callbacks:{label:c=>` ${c.dataset.label}: ₹${c.parsed.y.toLocaleString("en-IN")} Cr`} } },
        scales:{ yR:{type:"linear",position:"left",grid:{color:"rgba(255,255,255,0.04)"},ticks:{callback:v=>"₹"+(v/1000).toFixed(0)+"k"}}, yP:{type:"linear",position:"right",grid:{drawOnChartArea:false},ticks:{callback:v=>"₹"+v}}, x:{grid:{color:"rgba(255,255,255,0.04)"}} },
      },
    });
  }

  const indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    const dom = d.indigenous || 76;
    chartIndi = new Chart(indiCtx, {
      type:"doughnut",
      data:{ labels:["Make in India","Imports"], datasets:[{ data:[dom,100-dom], backgroundColor:["#2075ff","#2d3a55"], borderColor:["#2075ff","#3a4560"], borderWidth:2, hoverOffset:6 }] },
      options:{ responsive:true, cutout:"65%", plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#1a2235",borderColor:"#2075ff",borderWidth:1,callbacks:{label:c=>` ${c.label}: ${c.parsed}%`}} } },
    });
    const dp = document.getElementById("donutPct");
    if (dp) dp.textContent = dom + "%";
  }

  auditLog("VIEW_ACCESS","Financial Command (ESS)");
}

/* ═══════════════════════════════════════════════════════════════
   PROJECTS
   ═══════════════════════════════════════════════════════════════ */
function renderProjects() {
  const data = DB.get(KEYS.PROJECTS, []);
  const rows = data.map(p => {
    const pct = p.value > 0 ? ((p.value-p.remaining)/p.value*100).toFixed(1) : "0.0";
    return [
      p.wbs, p.desc,
      "₹"+Number(p.value).toLocaleString("en-IN")+" Cr",
      "₹"+Number(p.remaining).toLocaleString("en-IN")+" Cr",
      pct+"%",
      gridjs.html(spiHtml(p.spi)),
      (p.indi||"—")+"%",
      gridjs.html(statusHtml(p.status)),
      gridjs.html(actionBtns("projects", p.id)),
    ];
  });
  const badge = document.getElementById("projCount");
  if (badge) badge.textContent = data.length + " PROGRAMMES";
  renderGrid("projectsGrid","projects-grid",{
    columns:[{name:"WBS",width:"70px"},{name:"Programme",width:"250px"},{name:"Contracted",width:"120px"},{name:"Remaining",width:"110px"},{name:"% Done",width:"75px"},{name:"SPI",width:"70px"},{name:"Indi.",width:"60px"},{name:"Status",width:"140px"},{name:"Actions",width:"80px",sort:false}],
    search:{enabled:true},
  }, rows);
  auditLog("VIEW_ACCESS","Project Portfolio");
}

/* ═══════════════════════════════════════════════════════════════
   SUPPLY CHAIN
   ═══════════════════════════════════════════════════════════════ */
function renderSupply() {
  const inv  = DB.get(KEYS.INVENTORY, []);
  const vend = DB.get(KEYS.VENDORS,   []);
  const mats = DB.get(KEYS.MATERIALS, []);
  const today_ms = Date.now();
  const low  = inv.filter(i => Number(i.qty) < Number(i.minQty)).length;
  const exp  = vend.filter(v => v.expiry && (new Date(v.expiry)-today_ms) < 90*864e5).length;

  const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  set("kpi-vendors",   vend.length);
  set("kpi-mat-count", mats.length);
  set("kpi-reorders",  low);
  set("kpi-expiring",  exp);

  // Inventory grid
  const invRows = inv.map(i => [
    i.code, i.desc,
    gridjs.html(Number(i.qty)<Number(i.minQty)?`<span class="stock-low">⚠ ${i.qty} ${i.unit}</span>`:`${i.qty} ${i.unit}`),
    i.minQty+" "+i.unit,
    "₹"+Number(i.price||0).toLocaleString("en-IN"),
    i.vendor||"—",
    gridjs.html(actionBtns("inventory", i.id)),
  ]);
  renderGrid("inventoryGrid","inv-grid",{
    columns:[{name:"Code",width:"110px"},{name:"Description",width:"220px"},{name:"Stock",width:"90px"},{name:"Min",width:"90px"},{name:"Unit Price",width:"100px"},{name:"Vendor",width:"90px"},{name:"Actions",width:"80px",sort:false}],
  }, invRows);

  // Vendor grid
  const vRows = vend.map(v => {
    const days = v.expiry ? Math.ceil((new Date(v.expiry)-today_ms)/864e5) : null;
    const exHtml = days!==null?(days<90?`<span class="cell-negative">⚠ ${days}d</span>`:`${days}d`):"—";
    return [
      v.code, v.name, v.cat, v.material||"—",
      gridjs.html(v.greenCh?`<span class="green-channel">✔ GREEN</span>`:"—"),
      gridjs.html(v.emdEx?`<span class="emd-exempt">✔ EXEMPT</span>`:"—"),
      gridjs.html(exHtml), v.status||"—",
      gridjs.html(actionBtns("vendors", v.id)),
    ];
  });
  renderGrid("vendorGrid","vend-grid",{
    columns:[{name:"Code",width:"90px"},{name:"Name",width:"180px"},{name:"Cat.",width:"60px"},{name:"Material",width:"130px"},{name:"Green",width:"75px"},{name:"EMD",width:"75px"},{name:"Expiry",width:"70px"},{name:"Status",width:"80px"},{name:"Actions",width:"80px",sort:false}],
  }, vRows);

  // Materials grid
  const mRows = [...mats].sort((a,b)=>b.ts-a.ts).map(m => [
    m.material, m.heatNo||"—", m.qty, m.project, m.loc||"—",
    new Date(m.ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
    gridjs.html(actionBtns("materials", m.id, false, true)),
  ]);
  renderGrid("materialsGrid","mat-grid",{
    columns:[{name:"Material",width:"175px"},{name:"Heat/Batch",width:"100px"},{name:"Qty",width:"55px"},{name:"Project",width:"80px"},{name:"Location",width:"85px"},{name:"Logged",width:"125px"},{name:"Del.",width:"55px",sort:false}],
  }, mRows);
  const mc = document.getElementById("matIssueCount");
  if (mc) mc.textContent = mats.length+" ISSUES";
  auditLog("VIEW_ACCESS","Supply Chain & Vendors");
}

/* ═══════════════════════════════════════════════════════════════
   HCM — PERSONNEL + HSE + ATTENDANCE
   ═══════════════════════════════════════════════════════════════ */
function renderHCM() {
  const personnel  = DB.get(KEYS.PERSONNEL,  []);
  const hse        = DB.get(KEYS.HSE,        []);
  const attendance = DB.get(KEYS.ATTENDANCE, []);

  // KPIs
  const nm    = hse.filter(l=>l.type==="near-miss").length;
  const hrs   = hse.reduce((s,l)=>s+(parseFloat(l.hours)||0),0);
  const today_att = attendance.filter(a=>a.date===today());
  const present   = today_att.filter(a=>a.status==="Present").length;
  const set = (id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set("kpi-near-miss",    nm);
  set("kpi-subcon-hrs",   hrs.toLocaleString("en-IN"));
  set("hseEntryCount",    hse.length+" ENTRIES");
  set("kpi-present-today",present);
  set("kpi-total-att",    today_att.length);

  // Personnel grid
  const pRows = personnel.map(p => [
    p.empId, p.name, p.dept, p.desig, p.category,
    gridjs.html(clrHtml(p.clearance)),
    gridjs.html(statusHtml(p.status)),
    gridjs.html(actionBtns("personnel", p.id)),
  ]);
  renderGrid("personnelGrid","pers-grid",{
    columns:[{name:"ID",width:"75px"},{name:"Name",width:"180px"},{name:"Dept",width:"100px"},{name:"Designation",width:"220px"},{name:"Category",width:"90px"},{name:"Clearance",width:"100px"},{name:"Status",width:"100px"},{name:"Actions",width:"80px",sort:false}],
    search:{enabled:true},
  }, pRows);

  // HSE grid
  const typeMap = {"near-miss":"Near-Miss","subcon":"Sub-Con","hazard":"Hazard","toolbox":"Toolbox","permit":"Permit-WTW"};
  const hseRows = [...hse].sort((a,b)=>b.ts-a.ts).map(l => [
    typeMap[l.type]||l.type, l.shift,
    l.desc.length>55?l.desc.slice(0,55)+"…":l.desc,
    l.personnel||"—",
    l.hours?l.hours+" hrs":"—",
    gridjs.html(`<span class="sev-tag ${l.sev}">${l.sev}</span>`),
    new Date(l.ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
    gridjs.html(actionBtns("hse", l.id)),
  ]);
  renderGrid("hseGrid","hse-grid",{
    columns:[{name:"Type",width:"85px"},{name:"Zone",width:"90px"},{name:"Activity",width:"230px"},{name:"Personnel",width:"80px"},{name:"Hrs",width:"60px"},{name:"Sev.",width:"70px"},{name:"Logged",width:"120px"},{name:"Actions",width:"80px",sort:false}],
  }, hseRows);

  // Attendance grid
  const attRows = [...attendance].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)).map(a => [
    a.empId, a.name, a.date, a.shift,
    gridjs.html(statusHtml(a.status)),
    a.inTime||"—", a.outTime||"—",
    gridjs.html(actionBtns("attendance", a.id)),
  ]);
  renderGrid("attendanceGrid","att-grid",{
    columns:[{name:"ID",width:"75px"},{name:"Name",width:"180px"},{name:"Date",width:"90px"},{name:"Shift",width:"60px"},{name:"Status",width:"120px"},{name:"In",width:"70px"},{name:"Out",width:"70px"},{name:"Actions",width:"80px",sort:false}],
    search:{enabled:true},
  }, attRows);
  auditLog("VIEW_ACCESS","Human Capital & HSE");
}

/* ═══════════════════════════════════════════════════════════════
   INFRASTRUCTURE ASSETS
   ═══════════════════════════════════════════════════════════════ */
function renderAssets() {
  const assets = DB.get(KEYS.ASSETS, []);
  const rows = assets.map(a => {
    const u = Number(a.utilPct)||0;
    const bar = `<div style="width:100%;background:var(--border-subtle);height:6px;overflow:hidden"><div style="height:100%;width:${u}%;background:${u>85?"var(--red)":u>60?"var(--yellow)":"var(--green)"}"></div></div><span style="font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted)">${u}%</span>`;
    const stCls = a.status==="Occupied"?"status-occupied":a.status==="Partial"?"status-partial":"status-operational";
    return [
      a.assetId, a.name, a.type,
      gridjs.html(bar),
      gridjs.html(`<span class="dock-status ${stCls}">${a.status}</span>`),
      a.project||"—", a.nextPM||"—",
      gridjs.html(actionBtns("assets", a.id)),
    ];
  });
  renderGrid("assetsGrid","assets-grid",{
    columns:[{name:"Asset ID",width:"90px"},{name:"Name",width:"200px"},{name:"Type",width:"90px"},{name:"Utilisation",width:"155px"},{name:"Status",width:"110px"},{name:"Project",width:"170px"},{name:"Next PM",width:"95px"},{name:"Actions",width:"80px",sort:false}],
    search:{enabled:true},
  }, rows);

  // Render visual dock cards
  const grid = document.getElementById("dockCardsGrid");
  if (grid) {
    grid.innerHTML = assets.map(a => {
      const u = Number(a.utilPct)||0;
      const stCls = a.status==="Occupied"?"status-occupied":a.status==="Partial"?"status-partial":"status-operational";
      const fillColor = u>85?"var(--red)":u>60?"var(--yellow)":"var(--green)";
      return `<div class="dock-card${a.status==="Partial"?" dock-card-special":""}">
        <div class="dock-header"><div class="dock-id">${a.assetId}</div><div class="dock-status ${stCls}">${a.status.toUpperCase()}</div></div>
        <div class="dock-name">${a.name}</div>
        <div class="dock-project">${a.project||"—"}</div>
        <div class="dock-util-bar"><div style="height:100%;width:${u}%;background:${fillColor};transition:width 0.8s"></div></div>
        <div class="dock-meta">Utilisation: <strong>${u}%</strong> · Next PM: ${a.nextPM||"—"}</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="act-btn edit-btn" onclick="openEdit('assets','${a.id}')" style="flex:1;justify-content:center"><i class="fas fa-pen"></i> Edit</button>
        </div>
      </div>`;
    }).join("");
  }
  auditLog("VIEW_ACCESS","Infrastructure Assets");
}

/* ═══════════════════════════════════════════════════════════════
   COMPLIANCE & CSR
   ═══════════════════════════════════════════════════════════════ */
function renderCompliance() {
  auditLog("VIEW_ACCESS","Compliance & CSR");
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOG
   ═══════════════════════════════════════════════════════════════ */
function renderAudit() {
  const logs = DB.get(KEYS.AUDIT, []);
  const rows = logs.map(l => [
    new Date(l.ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"}),
    l.user, l.role,
    gridjs.html(clrHtml(l.clr)),
    l.action, l.detail,
  ]);
  renderGrid("auditGrid","audit-grid",{
    columns:[{name:"Timestamp",width:"130px"},{name:"User",width:"155px"},{name:"Role",width:"115px"},{name:"Clearance",width:"100px"},{name:"Action",width:"115px"},{name:"Detail",width:"280px"}],
    pagination:{ enabled:true, limit:12 },
  }, rows);
  const el = document.getElementById("auditCount");
  if (el) el.textContent = logs.length+" EVENTS";
}

/* ═══════════════════════════════════════════════════════════════
   FORM WIRING (inline form handlers on supply + HCM views)
   ═══════════════════════════════════════════════════════════════ */
let formsWired = false;
function wireForms() {
  if (formsWired) return; formsWired = true;

  // ROMIS Material Logger
  const logMatBtn = document.getElementById("logMaterialBtn");
  if (logMatBtn) {
    logMatBtn.onclick = () => {
      const material = document.getElementById("matType")?.value;
      const project  = document.getElementById("matProject")?.value;
      const heatNo   = (document.getElementById("matHeat")?.value||"").trim();
      const qty      = parseFloat(document.getElementById("matQty")?.value||"");
      const loc      = (document.getElementById("matLocation")?.value||"").trim();
      if (!heatNo || isNaN(qty) || qty<=0) return;
      DB.push(KEYS.MATERIALS, { id:uid(), material, heatNo, qty, project, loc, ts:Date.now() });
      auditLog("DATA_CREATE", `ROMIS Issue: ${material} · ${qty} → ${project}`);
      ["matHeat","matQty","matLocation"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
      const msg = document.getElementById("matFormMsg");
      if (msg) { msg.classList.remove("hidden"); setTimeout(()=>msg.classList.add("hidden"),2000); }
      GRIDS["mat-grid"] = null;
      renderSupply();
    };
  }

  // HSE Logger
  const logHseBtn = document.getElementById("logHseBtn");
  if (logHseBtn) {
    logHseBtn.onclick = () => {
      const type      = document.getElementById("hseLogType")?.value||"near-miss";
      const shift     = document.getElementById("hseShift")?.value||"A-East";
      const desc      = (document.getElementById("hseDescription")?.value||"").trim();
      const personnel = (document.getElementById("hsePersonnel")?.value||"").trim();
      const hours     = parseFloat(document.getElementById("hseHours")?.value||"")||null;
      if (!desc) { document.getElementById("hseDescription")?.focus(); return; }
      DB.push(KEYS.HSE, { id:uid(), type, shift, desc, personnel, hours, sev:selectedSev, ts:Date.now() });
      auditLog("DATA_CREATE", `HSE: ${type} · ${shift} · ${selectedSev}`);
      ["hseDescription","hsePersonnel","hseHours"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
      const msg = document.getElementById("hseFormMsg");
      if (msg) { msg.classList.remove("hidden"); setTimeout(()=>msg.classList.add("hidden"),2000); }
      nullGrids();
      renderHCM();
    };
  }

  // Severity selector
  document.querySelectorAll(".sev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sev-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      selectedSev = btn.dataset.sev;
    });
  });
}

let selectedSev = "LOW";

/* ═══════════════════════════════════════════════════════════════
   APP CONTROLS (sidebar, refresh, account switcher)
   ═══════════════════════════════════════════════════════════════ */
let appWired = false;
function wireAppControls() {
  if (appWired) return; appWired = true;

  // Sidebar toggle
  const toggle  = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.onclick = () => {
      if (window.innerWidth < 900) sidebar.classList.toggle("mobile-open");
      else sidebar.classList.toggle("collapsed");
    };
  }

  // Refresh button
  const rb = document.getElementById("refreshBtn");
  if (rb) {
    rb.onclick = () => {
      rb.classList.add("spinning");
      nullGrids();
      setTimeout(() => { rb.classList.remove("spinning"); currentView && VIEW_FN[currentView](); }, 500);
    };
  }

  // Account switcher
  const chip = document.getElementById("userChipBtn");
  if (chip) chip.onclick = (e) => { e.stopPropagation(); toggleSwitcher(); };
  document.addEventListener("click", e => {
    if (!e.target.closest("#accountSwitcher")) closeSwitcher();
  });
  const auditBtn = document.getElementById("auditLogBtn");
  if (auditBtn) auditBtn.onclick = () => { closeSwitcher(); goTo("audit"); };

  // Add buttons per section
  document.getElementById("openAddProjectModal")?.addEventListener("click", ()=>window.openAdd("projects"));
  document.getElementById("openAddMaterialModal")?.addEventListener("click", ()=>{
    // Scroll/focus the ROMIS form panel instead of modal
    const el = document.getElementById("logMaterialBtn");
    if (el) el.scrollIntoView({behavior:"smooth",block:"center"});
  });
  document.getElementById("btnAddInventory")?.addEventListener("click",     ()=>window.openAdd("inventory"));
  document.getElementById("btnAddVendor")?.addEventListener("click",        ()=>window.openAdd("vendors"));
  document.getElementById("btnAddPersonnel")?.addEventListener("click",     ()=>window.openAdd("personnel"));
  document.getElementById("btnAddAttendance")?.addEventListener("click",    ()=>window.openAdd("attendance"));
  document.getElementById("btnAddAsset")?.addEventListener("click",         ()=>window.openAdd("assets"));

  wireForms();
}

/* ═══════════════════════════════════════════════════════════════
   CLOCK
   ═══════════════════════════════════════════════════════════════ */
function startClock() {
  const tick = () => {
    const now = new Date();
    const d = document.getElementById("clockDate"), t = document.getElementById("clockTime");
    if (d) d.textContent = now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
    if (t) t.textContent = now.toLocaleTimeString("en-IN",{hour12:false});
  };
  tick(); setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  seed();
  startClock();
  buildOverlay();  // populate RBAC role buttons
});

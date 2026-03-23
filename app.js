/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MDL DIGITAL SHIPYARD MIS v6.0 · app.js
 * Database Migration: localStorage → Supabase (PostgreSQL)
 *
 * ARCHITECTURE CHANGE SUMMARY (v5.1 → v6.0):
 * ───────────────────────────────────────────
 * Before: All data lived in window.localStorage as JSON strings.
 *         Reads were synchronous: DB.get(key, fallback)
 *         Writes were synchronous: DB.set(key, value)
 *
 * After:  All data lives in a hosted Supabase PostgreSQL database.
 *         Reads are async: await supabase.from('table').select('*')
 *         Writes are async: await supabase.from('table').insert({...})
 *         Every data-fetching function is now async and must be awaited.
 *
 * SUPABASE JS CLIENT (CDN):
 *   The Supabase client library is loaded in index.html via:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
 *   This exposes the global: window.supabase.createClient(url, key)
 *
 * HOW TO CONFIGURE:
 *   1. Go to your Supabase project → Settings → API
 *   2. Copy the "Project URL" → paste into SUPABASE_URL below
 *   3. Copy the "anon public" key → paste into SUPABASE_ANON_KEY below
 *   4. Save and deploy.
 *
 * TABLE MAP (Supabase → SAP equivalent):
 *   mdl_financials  → SAP-FI/CO + SAP-BW  (ESS Financial Command)
 *   mdl_projects    → SAP-PS               (Tactical Portfolio Grid)
 *   mdl_materials   → SAP-MM ROMIS         (Material Issue Logger)
 *   mdl_inventory   → SAP-MM Inv. Mgmt.    (Stock Levels)
 *   mdl_vendors     → SAP-MM Vendor Master (Vendor Register)
 *   mdl_hse         → SAP-EHS              (HSE Incident Register)
 *
 * RBAC & AUDIT:
 *   The RBAC engine (role selection, account switcher) continues to use
 *   localStorage for the session token — this is intentional. RBAC state
 *   is per-browser-session metadata, not persistent application data.
 *   The Audit Log is also kept in localStorage (session-scoped).
 *   In a production system these would be server-side JWT + DB-backed logs.
 *
 * ERROR HANDLING PATTERN:
 *   Every Supabase call follows this pattern:
 *     const { data, error } = await supabase.from('...').select('*');
 *     if (error) { showDbError(error.message); return; }
 *     // use data safely
 * ═══════════════════════════════════════════════════════════════════════════
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// ── PART 1: SUPABASE CONFIGURATION ─────────────────────────────────────────
//
// Replace the placeholder strings below with your actual Supabase credentials.
// Find them at: https://app.supabase.com → Your Project → Settings → API
//
// SECURITY NOTE:
//   The anon key is safe to expose in a public frontend. Supabase's RLS
//   (Row Level Security) policies on the database are the actual security
//   boundary. The anon key alone cannot bypass RLS policies.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL      = "https://uwjpsqprxgvwbucmymrh.supabase.co";    // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_8XFEvqzUhjhLcKtFlkLJgw_UIkpm7yN"; // eyJhbGciOi...

/**
 * Initialise the Supabase client.
 *
 * window.supabase.createClient() is exposed by the CDN-loaded Supabase JS v2
 * library. It returns a client instance pre-configured with your project URL
 * and anon key. All subsequent DB calls are made through this single instance.
 *
 * Equivalent to: new pg.Pool({ connectionString: SUPABASE_URL }) in Node.js,
 * but routed through Supabase's auto-generated REST API (PostgREST).
 */
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 2: LIGHTWEIGHT SESSION STORAGE (localStorage — kept intentionally)
//
// Only RBAC session state and the in-browser audit log remain in localStorage.
// These are browser-session metadata, not application data. They reset on
// every new session, which is the correct behaviour for a prototype.
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_KEY = "mdl_v6_session";
const AUDIT_KEY   = "mdl_v6_audit";

const Session = {
  get()        { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; } },
  set(val)     { try { localStorage.setItem(SESSION_KEY, JSON.stringify(val)); } catch(e) {} },
  getAudit()   { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; } catch(e) { return []; } },
  appendAudit(entry) {
    const logs = this.getAudit();
    logs.unshift(entry);
    // Keep the last 500 entries to prevent unbounded localStorage growth
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 500))); } catch(e) {}
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 3: DATABASE API LAYER
//
// These functions are the clean interface between the UI and Supabase.
// Every function is async and returns { data, error }.
// The UI layer never calls supabase.from() directly — always through these.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DB_API — All Supabase data access calls.
 *
 * PATTERN:
 *   Each method performs exactly one Supabase PostgREST operation.
 *   The PostgREST query builder translates method chains into HTTP requests:
 *
 *   .from('table')         → Target the table (like FROM in SQL)
 *   .select('*')           → GET /rest/v1/table?select=* (HTTP GET)
 *   .insert({...})         → POST /rest/v1/table         (HTTP POST)
 *   .order('col',{...})    → &order=col.desc             (appended to query)
 *   .eq('col', val)        → &col=eq.val                 (WHERE col = val)
 */
const DB_API = {

  // ── FINANCIALS ───────────────────────────────────────────────────────────

  /**
   * Fetch all fiscal year rows ordered chronologically.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_financials ORDER BY fiscal_year ASC;
   *
   * Used by: renderESS() to build the 5-year revenue/PAT chart
   *          and the full P&L comparison table.
   */
  async getFinancials() {
    const { data, error } = await supabase
      .from("mdl_financials")
      .select("*")
      .order("fiscal_year", { ascending: true });

    if (error) console.error("[DB_API.getFinancials]", error.message);
    return { data: data || [], error };
  },

  /**
   * Fetch a single fiscal year row.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_financials WHERE fiscal_year = $1 LIMIT 1;
   *
   * @param {string} fy - Fiscal year key, e.g. 'FY25'
   */
  async getFinancialByYear(fy) {
    const { data, error } = await supabase
      .from("mdl_financials")
      .select("*")
      .eq("fiscal_year", fy)
      .single();           // .single() unwraps the array to one object, throws if 0 or 2+ rows

    if (error) console.error("[DB_API.getFinancialByYear]", error.message);
    return { data, error };
  },

  // ── PROJECTS ─────────────────────────────────────────────────────────────

  /**
   * Fetch all WBS projects, ordered by contract value (largest first).
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_projects ORDER BY contract_value_cr DESC;
   *
   * Used by: renderProjects() to populate the SAP-PS portfolio grid.
   */
  async getProjects() {
    const { data, error } = await supabase
      .from("mdl_projects")
      .select("*")
      .order("contract_value_cr", { ascending: false });

    if (error) console.error("[DB_API.getProjects]", error.message);
    return { data: data || [], error };
  },

  /**
   * Insert a new WBS project record.
   *
   * SQL equivalent:
   *   INSERT INTO mdl_projects (wbs_code, description, ...) VALUES ($1, $2, ...);
   *
   * .select() appended after .insert() triggers a RETURNING * so Supabase
   * returns the newly inserted row including its auto-generated 'id' and
   * 'created_at' fields. Without .select(), data would be null.
   *
   * @param {Object} project - Project fields matching the mdl_projects schema
   */
  async insertProject(project) {
    const { data, error } = await supabase
      .from("mdl_projects")
      .insert({
        wbs_code:           project.wbs_code,
        description:        project.description,
        contract_value_cr:  project.contract_value_cr,
        remaining_cr:       project.remaining_cr,
        spi:                project.spi,
        indigenization_pct: project.indigenization_pct,
        status:             project.status,
      })
      .select();  // Return the inserted row(s) for immediate UI refresh

    if (error) console.error("[DB_API.insertProject]", error.message);
    return { data, error };
  },

  // ── MATERIALS (ROMIS) ────────────────────────────────────────────────────

  /**
   * Fetch all material issue events, newest first.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_materials ORDER BY logged_at DESC;
   *
   * Used by: renderMaterialsGrid() to build the live ROMIS issue log.
   */
  async getMaterials() {
    const { data, error } = await supabase
      .from("mdl_materials")
      .select("*")
      .order("logged_at", { ascending: false });

    if (error) console.error("[DB_API.getMaterials]", error.message);
    return { data: data || [], error };
  },

  /**
   * Insert a new material issue event (ROMIS — SAP-MM Movement Type 201).
   *
   * SQL equivalent:
   *   INSERT INTO mdl_materials (material, heat_no, quantity, ...) VALUES (...);
   *
   * @param {Object} issue - Issue fields matching the mdl_materials schema
   */
  async insertMaterial(issue) {
    const { data, error } = await supabase
      .from("mdl_materials")
      .insert({
        material:         issue.material,
        heat_no:          issue.heat_no,
        quantity:         issue.quantity,
        project_id:       issue.project_id,
        staging_location: issue.staging_location,
        // logged_at defaults to NOW() in the database — no need to send it
      })
      .select();

    if (error) console.error("[DB_API.insertMaterial]", error.message);
    return { data, error };
  },

  // ── INVENTORY ────────────────────────────────────────────────────────────

  /**
   * Fetch all inventory items ordered by item code.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_inventory ORDER BY item_code ASC;
   *
   * Items with stock_qty < min_threshold are flagged as 'LOW' by the UI.
   */
  async getInventory() {
    const { data, error } = await supabase
      .from("mdl_inventory")
      .select("*")
      .order("item_code", { ascending: true });

    if (error) console.error("[DB_API.getInventory]", error.message);
    return { data: data || [], error };
  },

  // ── VENDORS ──────────────────────────────────────────────────────────────

  /**
   * Fetch all vendor master records ordered by name.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_vendors ORDER BY name ASC;
   */
  async getVendors() {
    const { data, error } = await supabase
      .from("mdl_vendors")
      .select("*")
      .order("name", { ascending: true });

    if (error) console.error("[DB_API.getVendors]", error.message);
    return { data: data || [], error };
  },

  // ── HSE ──────────────────────────────────────────────────────────────────

  /**
   * Fetch all HSE incident records, newest first.
   *
   * SQL equivalent:
   *   SELECT * FROM mdl_hse ORDER BY logged_at DESC;
   */
  async getHSE() {
    const { data, error } = await supabase
      .from("mdl_hse")
      .select("*")
      .order("logged_at", { ascending: false });

    if (error) console.error("[DB_API.getHSE]", error.message);
    return { data: data || [], error };
  },

  /**
   * Insert a new HSE incident or sub-contractor activity log entry.
   *
   * SQL equivalent:
   *   INSERT INTO mdl_hse (log_type, shift_zone, description, ...) VALUES (...);
   *
   * @param {Object} entry - Incident fields matching the mdl_hse schema
   */
  async insertHSE(entry) {
    const { data, error } = await supabase
      .from("mdl_hse")
      .insert({
        log_type:     entry.log_type,
        shift_zone:   entry.shift_zone,
        description:  entry.description,
        personnel_id: entry.personnel_id || null,
        man_hours:    entry.man_hours    || null,
        severity:     entry.severity,
        // logged_at defaults to NOW() in the database
      })
      .select();

    if (error) console.error("[DB_API.insertHSE]", error.message);
    return { data, error };
  },

};  // END DB_API


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 4: UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show a toast-style error banner when a Supabase query fails.
 * This gives users clear feedback instead of a silent blank grid.
 *
 * @param {string} message - Error message to display
 */
function showDbError(message) {
  console.error("[MDL-MIS DB Error]", message);
  // Find or create a global error toast element
  let toast = document.getElementById("dbErrorToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "dbErrorToast";
    toast.style.cssText = [
      "position:fixed", "bottom:20px", "right:20px", "z-index:9999",
      "background:#1a1a2e", "border:1px solid #ff4d4d", "color:#ff4d4d",
      "font-family:'IBM Plex Mono',monospace", "font-size:11px",
      "padding:10px 16px", "max-width:400px", "box-shadow:0 4px 20px rgba(0,0,0,0.6)",
    ].join(";");
    document.body.appendChild(toast);
  }
  toast.innerHTML = '<i class="fas fa-triangle-exclamation"></i> &nbsp;DB ERROR: ' + message;
  toast.style.display = "block";
  setTimeout(function() { if (toast) toast.style.display = "none"; }, 6000);
}

/**
 * Render a loading skeleton placeholder into a container while data loads.
 * Prevents layout shift and communicates to the user that data is fetching.
 *
 * @param {string} containerId - DOM element id to fill
 * @param {string} message     - Optional custom loading text
 */
function showLoading(containerId, message) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="padding:16px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#505a6e;text-align:center;">'
    + '<i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>'
    + (message || "Fetching from Supabase…") + "</div>";
}

function stampRefresh() {
  var el = document.getElementById("lastRefresh");
  if (el) el.textContent = "Refreshed: " + new Date().toLocaleTimeString("en-IN", { hour12: false });
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 5: RBAC ENGINE (unchanged — session metadata stays in localStorage)
// ═══════════════════════════════════════════════════════════════════════════

const RBAC_ROLES = [
  {
    key:"super-admin", name:"Super Administrator", persona:"IT Systems Director",
    icon:"fa-shield-halved", clearance:"SECRET", clsCls:"clr-secret", color:"#ff4d4d",
    permissions:["ess","projects","supply","hcm","compliance","audit"],
    description:"Full CRUD · All modules · Role assignments · Audit logs",
  },
  {
    key:"executive", name:"Executive Director", persona:"Board Member / C-Suite",
    icon:"fa-briefcase", clearance:"CONFIDENTIAL", clsCls:"clr-conf", color:"#f5c842",
    permissions:["ess","projects","compliance","audit"],
    description:"Read-only macro dashboards · Financials · Order Book · Strategic KPIs",
  },
  {
    key:"project-commander", name:"Project Commander", persona:"Warship / Submarine Lead",
    icon:"fa-anchor", clearance:"SECRET", clsCls:"clr-secret", color:"#2075ff",
    permissions:["projects","supply","audit"],
    description:"CRUD on assigned projects · Milestones · Material requests",
  },
  {
    key:"financial-controller", name:"Financial Controller", persona:"Accounting Manager",
    icon:"fa-chart-line", clearance:"CONFIDENTIAL", clsCls:"clr-conf", color:"#f5c842",
    permissions:["ess","audit"],
    description:"Financial ledger · Cash flow · Vendor payments · Budget approvals",
  },
  {
    key:"supply-officer", name:"Supply Chain Officer", persona:"Procurement Lead",
    icon:"fa-boxes-stacked", clearance:"RESTRICTED", clsCls:"clr-rest", color:"#00e5a0",
    permissions:["supply","audit"],
    description:"Vendor database · Inventory · ROMIS · Indigenization data",
  },
  {
    key:"floor-supervisor", name:"Floor Supervisor", persona:"Yard Master / Foreman",
    icon:"fa-hard-hat", clearance:"RESTRICTED", clsCls:"clr-rest", color:"#00e5a0",
    permissions:["hcm","audit"],
    description:"Worker attendance · Slipway allocation · HIRA safety incident reporting",
  },
];

const SIDEBAR_MODULES = [
  { view:"ess",        icon:"fa-satellite-dish", title:"Financial Command",      sub:"SAP-FI/CO · Supabase"        },
  { view:"projects",   icon:"fa-anchor",          title:"Project & Spatial MIS", sub:"SAP-PS · Supabase"           },
  { view:"supply",     icon:"fa-boxes-stacked",   title:"Supply Chain & Vendors",sub:"SAP-MM · Supabase"           },
  { view:"hcm",        icon:"fa-hard-hat",        title:"Human Capital & HSE",   sub:"SAP-HCM · Supabase"         },
  { view:"compliance", icon:"fa-flag",            title:"Indigenization & CSR",  sub:"Compliance · Static"        },
  { view:"audit",      icon:"fa-scroll",          title:"Audit Log",             sub:"RBAC · Session Storage"     },
];

let activeRole = null;

// ─── Audit logger (session-scoped, stays in localStorage) ─────────────────
function logAudit(action, detail) {
  var entry = {
    id:        crypto.randomUUID(),
    ts:        Date.now(),
    userId:    activeRole ? activeRole.name : "SYSTEM",
    role:      activeRole ? activeRole.key  : "—",
    clearance: activeRole ? activeRole.clearance : "—",
    action:    action,
    detail:    detail || "",
  };
  Session.appendAudit(entry);
  updateAuditBadge();
  if (currentView === "audit") renderAuditGrid();
}

function updateAuditBadge() {
  var el = document.getElementById("auditCount");
  if (el) el.textContent = Session.getAudit().length + " EVENTS";
}

// ─── RBAC Overlay ──────────────────────────────────────────────────────────
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

    (function(r) {
      btn.addEventListener("click", function() { selectRole(r); });
    })(role);

    container.appendChild(btn);
  });
}

function selectRole(role) {
  activeRole = role;
  Session.set({ roleKey: role.key, ts: Date.now() });

  var overlay = document.getElementById("rbacOverlay");
  var shell   = document.getElementById("appShell");
  if (overlay) overlay.style.display = "none";
  if (shell)   shell.style.display   = "flex";

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

  logAudit("LOGIN", "Role: " + role.name + " · Clearance: " + role.clearance + " · DB: Supabase");

  var firstView = role.permissions.filter(function(p) { return p !== "audit"; })[0] || "audit";
  setActiveView(firstView);
}

// ─── Account Switcher ──────────────────────────────────────────────────────
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
    var nameDiv = document.createElement("div"); nameDiv.className = "sw-role-name"; nameDiv.textContent = role.name;
    var subDiv  = document.createElement("div"); subDiv.className  = "sw-role-sub";  subDiv.textContent  = role.persona;
    textDiv.appendChild(nameDiv); textDiv.appendChild(subDiv);
    item.appendChild(icon); item.appendChild(textDiv);
    if (activeRole && role.key === activeRole.key) {
      var badge = document.createElement("span"); badge.className = "sw-active-badge"; badge.textContent = "ACTIVE";
      item.appendChild(badge);
    }
    (function(r) { item.addEventListener("click", function() { switchRole(r); }); })(role);
    list.appendChild(item);
  });
}

function switchRole(newRole) {
  if (activeRole && newRole.key === activeRole.key) { toggleSwitcher(false); return; }
  var prev = activeRole ? activeRole.name : "none";
  activeRole = newRole;
  Session.set({ roleKey: newRole.key, ts: Date.now() });
  logAudit("ROLE_SWITCH", "From: " + prev + " → To: " + newRole.name);
  updateUserChip(); buildSidebar(); buildSwitcherDropdown(); toggleSwitcher(false);
  // Reset grid instances so they are re-created with fresh data for the new view
  resetGridInstances();
  currentView = null;
  var firstView = newRole.permissions.filter(function(p) { return p !== "audit"; })[0] || "audit";
  setActiveView(firstView);
}

function updateUserChip() {
  if (!activeRole) return;
  var els = {
    userNameDisplay: activeRole.name.toUpperCase(),
    userRoleDisplay: activeRole.clearance + " CLEARANCE",
    metaRole:        activeRole.name,
    metaClearance:   activeRole.clearance + " · " + activeRole.persona,
  };
  Object.keys(els).forEach(function(id) {
    var el = document.getElementById(id); if (el) el.textContent = els[id];
  });
  var iconEl = document.getElementById("userAvatarIcon");
  if (iconEl) iconEl.innerHTML = '<i class="fas ' + activeRole.icon + '"></i>';
}

var switcherWired = false;
function wireAccountSwitcher() {
  if (switcherWired) return; switcherWired = true;
  var btn      = document.getElementById("userChipBtn");
  var dropdown = document.getElementById("switcherDropdown");
  var auditBtn = document.getElementById("auditLogBtn");
  if (btn) btn.addEventListener("click", function(e) {
    e.stopPropagation();
    toggleSwitcher(dropdown && !dropdown.classList.contains("hidden") ? false : true);
  });
  if (auditBtn) auditBtn.addEventListener("click", function() { toggleSwitcher(false); setActiveView("audit"); });
  document.addEventListener("click", function() { toggleSwitcher(false); });
  if (dropdown) dropdown.addEventListener("click", function(e) { e.stopPropagation(); });
}

function toggleSwitcher(open) {
  var dropdown = document.getElementById("switcherDropdown");
  var chevron  = document.getElementById("userChevron");
  if (!dropdown) return;
  if (open) { dropdown.classList.remove("hidden"); } else { dropdown.classList.add("hidden"); }
  if (chevron) chevron.classList.toggle("open", open);
}

function buildSidebar() {
  var nav = document.getElementById("sidebarNav");
  if (!nav || !activeRole) return;
  nav.innerHTML = "";
  SIDEBAR_MODULES.forEach(function(mod) {
    if (activeRole.permissions.indexOf(mod.view) === -1) return;
    var el = document.createElement("div"); el.className = "sidebar-item"; el.dataset.view = mod.view;
    el.innerHTML = '<i class="fas ' + mod.icon + '"></i>'
      + '<div class="sidebar-item-text"><span class="sidebar-item-title">' + mod.title + '</span>'
      + '<span class="sidebar-item-sub">' + mod.sub + '</span></div>'
      + '<div class="sidebar-indicator"></div>';
    (function(v, t) { el.addEventListener("click", function() { logAudit("NAV", t); setActiveView(v); }); })(mod.view, mod.title);
    nav.appendChild(el);
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 6: NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

const VIEW_META = {
  ess:        { bc:["Financial Command","Executive Overview"],      onEnter: renderESS       },
  projects:   { bc:["Project & Spatial MIS","Portfolio View"],     onEnter: renderProjects  },
  supply:     { bc:["Supply Chain & Vendors","ROMIS Module"],      onEnter: renderSupply    },
  hcm:        { bc:["Human Capital & HSE","Incident Register"],    onEnter: renderHCM       },
  compliance: { bc:["Indigenization & CSR","Compliance Centre"],   onEnter: function(){}    },
  audit:      { bc:["Security","RBAC Audit Log"],                  onEnter: renderAuditGrid },
};

var currentView = null;

function setActiveView(viewKey) {
  if (activeRole && activeRole.permissions.indexOf(viewKey) === -1) {
    setActiveView(activeRole.permissions[0] || "audit"); return;
  }
  if (currentView === viewKey) return;
  currentView = viewKey;

  Object.keys(VIEW_META).forEach(function(k) {
    var el = document.getElementById("view-" + k);
    if (el) { if (k === viewKey) el.classList.remove("hidden"); else el.classList.add("hidden"); }
  });

  document.querySelectorAll(".sidebar-item").forEach(function(el) {
    el.classList.toggle("active", el.dataset.view === viewKey);
  });

  var bc = document.getElementById("breadcrumb");
  if (bc && VIEW_META[viewKey]) {
    var parts = VIEW_META[viewKey].bc;
    bc.innerHTML = "<span>MDL HQ</span><i class=\"fas fa-angle-right\"></i>"
      + parts.map(function(p, i) {
          return "<span>" + p + "</span>" + (i < parts.length - 1 ? "<i class=\"fas fa-angle-right\"></i>" : "");
        }).join("");
  }

  if (VIEW_META[viewKey] && VIEW_META[viewKey].onEnter) VIEW_META[viewKey].onEnter();
  stampRefresh();
}

var navWired = false;
function wireNavigation() {
  if (navWired) return; navWired = true;
  var toggle  = document.getElementById("sidebarToggle");
  var sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function() {
      if (window.innerWidth < 900) sidebar.classList.toggle("mobile-open");
      else sidebar.classList.toggle("collapsed");
    });
  }
  document.getElementById("refreshBtn")?.addEventListener("click", function() {
    var btn = document.getElementById("refreshBtn");
    btn.classList.add("spinning");
    // Reset grids so data is fully re-fetched from Supabase on refresh
    resetGridInstances();
    setTimeout(function() {
      btn.classList.remove("spinning");
      if (currentView && VIEW_META[currentView] && VIEW_META[currentView].onEnter) {
        VIEW_META[currentView].onEnter();
      }
      stampRefresh();
    }, 600);
  });
}

function startClock() {
  function tick() {
    var now = new Date();
    var d = document.getElementById("clockDate"); var t = document.getElementById("clockTime");
    if (d) d.textContent = now.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
    if (t) t.textContent = now.toLocaleTimeString("en-IN", { hour12:false });
  }
  tick(); setInterval(tick, 1000);
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 7: GRID INSTANCE MANAGEMENT
//
// Grid.js instances are stored at module scope. They are set to null and
// re-created whenever the user switches roles or presses Refresh — this
// forces a fresh DOM render and avoids stale data in the grids.
// ═══════════════════════════════════════════════════════════════════════════

var chartRevenue       = null;
var chartIndi          = null;
var projectsGridInst   = null;
var inventoryGridInst  = null;
var vendorGridInst     = null;
var materialsGridInst  = null;
var leadershipGridInst = null;
var hseGridInst        = null;
var auditGridInst      = null;

/**
 * Destroy all Grid.js instances and set their references to null.
 * Called on role switch and manual refresh to force complete re-render.
 */
function resetGridInstances() {
  [projectsGridInst, inventoryGridInst, vendorGridInst,
   materialsGridInst, leadershipGridInst, hseGridInst, auditGridInst]
    .forEach(function(inst) { /* Grid.js has no destroy() in mermaid theme — null ref is sufficient */ });
  projectsGridInst = inventoryGridInst = vendorGridInst =
  materialsGridInst = leadershipGridInst = hseGridInst = auditGridInst = null;
  if (chartRevenue) { chartRevenue.destroy(); chartRevenue = null; }
  if (chartIndi)    { chartIndi.destroy();    chartIndi    = null; }
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 8: ESS — Financial Command (SAP-FI/CO + SAP-BW)
//
// Migration note: renderESS() is now async. It awaits DB_API.getFinancials()
// which makes a single HTTP GET to the Supabase PostgREST endpoint.
// The returned data array replaces the old DB.get(KEYS.STRATEGIC) call.
// ═══════════════════════════════════════════════════════════════════════════

async function renderESS() {
  // Fetch all fiscal year rows from Supabase.
  // API call: GET https://<project>.supabase.co/rest/v1/mdl_financials?select=*&order=fiscal_year.asc
  const { data: rows, error } = await DB_API.getFinancials();
  if (error) { showDbError(error.message); return; }
  if (!rows || rows.length === 0) { showDbError("No financial data found in mdl_financials table."); return; }

  // The last row is the most recent fiscal year (FY25 in the seed data)
  const latestRow = rows[rows.length - 1];

  Chart.defaults.color       = "#8a94a6";
  Chart.defaults.borderColor = "rgba(255,255,255,0.05)";
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size   = 10;

  // ── Revenue + PAT dual-axis chart ────────────────────────────────────────
  // Map the Supabase rows to the arrays Chart.js expects.
  var labels   = rows.map(function(r) { return r.fiscal_year; });
  var revenues = rows.map(function(r) { return parseFloat(r.revenue_cr);  });
  var pats     = rows.map(function(r) { return parseFloat(r.pat_cr); });

  var revCtx = document.getElementById("revenueChart");
  if (revCtx) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(revCtx, {
      data: {
        labels: labels,
        datasets: [
          {
            type:"bar", label:"Revenue (₹ Cr)", yAxisID:"yRev", order:2,
            data: revenues,
            backgroundColor:"rgba(32,117,255,0.50)", borderColor:"#2075ff", borderWidth:1,
          },
          {
            type:"line", label:"PAT (₹ Cr)", yAxisID:"yPat", order:1,
            data: pats,
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
          yPat:{ type:"linear", position:"right", grid:{ drawOnChartArea:false }, ticks:{ callback: function(v) { return "₹" + v; } } },
          x:   { grid:{ color:"rgba(255,255,255,0.04)" } },
        },
      },
    });
  }

  // ── Indigenization doughnut ───────────────────────────────────────────────
  // Use indigenous_pct and import_pct from the latest (FY25) row.
  var indiCtx = document.getElementById("indiChart");
  if (indiCtx) {
    if (chartIndi) chartIndi.destroy();
    chartIndi = new Chart(indiCtx, {
      type:"doughnut",
      data:{
        labels:["Make in India","Imports"],
        datasets:[{
          data:[parseFloat(latestRow.indigenous_pct), parseFloat(latestRow.import_pct)],
          backgroundColor:["#2075ff","#2d3a55"], borderColor:["#2075ff","#3a4560"], borderWidth:2, hoverOffset:6,
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
    // Update the donut centre label with live data
    var donutPctEl = document.getElementById("donutPct");
    if (donutPctEl) donutPctEl.textContent = latestRow.indigenous_pct + "%";
  }

  logAudit("VIEW_ACCESS", "Financial Command (ESS) · Source: Supabase mdl_financials");
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 9: PROJECTS — SAP-PS Portfolio Grid
//
// Migration note: renderProjects() is now async.
// Was: var data = DB.get(KEYS.PROJECTS, []);
// Now: const { data } = await DB_API.getProjects();
// The field names have changed to match the PostgreSQL column names:
//   wbs_code, contract_value_cr, remaining_cr, indigenization_pct
// ═══════════════════════════════════════════════════════════════════════════

function spiTag(spi) {
  var v = parseFloat(spi);
  if (v >= 1.0) return '<span class="cell-positive">&#9650; ' + v.toFixed(2) + '</span>';
  if (v >= 0.9) return '<span class="cell-neutral">&#9670; '  + v.toFixed(2) + '</span>';
  return '<span class="cell-negative">&#9660; ' + v.toFixed(2) + '</span>';
}

function statusTag(s) {
  var map = { "On Track":"tag-on-track","Slight Overrun":"tag-overrun","Managed Overrun":"tag-managed","Underrun":"tag-underrun","On Hold":"tag-hold" };
  return '<span class="cell-tag ' + (map[s] || "tag-hold") + '">' + s.toUpperCase() + '</span>';
}

async function renderProjects() {
  showLoading("projectsGrid", "Loading order book from Supabase…");

  // Fetch all WBS project records from Supabase.
  // API call: GET /rest/v1/mdl_projects?select=*&order=contract_value_cr.desc
  const { data, error } = await DB_API.getProjects();
  if (error) { showDbError(error.message); return; }

  // Map Supabase column names (snake_case) to Grid.js row arrays
  var rows = data.map(function(p) {
    var contractVal  = parseFloat(p.contract_value_cr)  || 0;
    var remainingVal = parseFloat(p.remaining_cr)        || 0;
    var pctDone      = contractVal > 0 ? ((contractVal - remainingVal) / contractVal * 100).toFixed(1) : "0.0";

    return [
      p.wbs_code,
      p.description,
      "₹" + contractVal.toLocaleString("en-IN")  + " Cr",
      "₹" + remainingVal.toLocaleString("en-IN") + " Cr",
      pctDone + "%",
      gridjs.html(spiTag(p.spi)),
      (p.indigenization_pct || "—") + "%",
      gridjs.html(statusTag(p.status)),
    ];
  });

  var cfg = {
    columns:[
      {name:"WBS ID",     width:"75px" },
      {name:"Programme",  width:"255px"},
      {name:"Contracted", width:"120px"},
      {name:"Remaining",  width:"110px"},
      {name:"% Done",     width:"75px" },
      {name:"SPI",        width:"75px" },
      {name:"Indi. %",    width:"65px" },
      {name:"Status",     width:"140px"},
    ],
    data:rows, sort:true, search:{ enabled:true }, pagination:{ enabled:true, limit:6 },
  };

  var container = document.getElementById("projectsGrid");
  if (!container) return;

  if (!projectsGridInst) {
    projectsGridInst = new gridjs.Grid(cfg);
    projectsGridInst.render(container);
  } else {
    projectsGridInst.updateConfig(cfg).forceRender();
  }

  var badge = document.getElementById("projCount");
  if (badge) badge.textContent = data.length + " ACTIVE PROGRAMMES";
  logAudit("VIEW_ACCESS", "Project Portfolio (SAP-PS) · Source: Supabase mdl_projects");
}

// ─── Add Project Modal ──────────────────────────────────────────────────────
var projModalWired = false;
function wireProjectModal() {
  if (projModalWired) return; projModalWired = true;

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
      var el = document.getElementById(id); if (el) el.value = "";
    });
  }

  if (openBtn)   openBtn.addEventListener("click",   function() { modal.classList.remove("hidden"); });
  if (closeBtn)  closeBtn.addEventListener("click",  closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function(e) { if (e.target === modal) closeModal(); });

  if (saveBtn) {
    saveBtn.addEventListener("click", async function() {
      var wbs_code     = (document.getElementById("mProjId")?.value    || "").trim();
      var description  = (document.getElementById("mProjDesc")?.value  || "").trim();
      var contract_val = parseFloat(document.getElementById("mProjValue")?.value   || "");
      var remaining    = parseFloat(document.getElementById("mProjBalance")?.value || "");
      var spi          = parseFloat(document.getElementById("mProjSpi")?.value     || "1.00");
      var indi         = parseInt(document.getElementById("mProjIndi")?.value      || "0", 10);
      var status       = document.getElementById("mProjStatus")?.value || "On Track";

      if (!wbs_code || !description || isNaN(contract_val) || isNaN(remaining)) return;

      // Disable button during async call to prevent double-submits
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      // INSERT into Supabase.
      // API call: POST /rest/v1/mdl_projects  (Content-Type: application/json)
      const { error } = await DB_API.insertProject({
        wbs_code:           wbs_code,
        description:        description,
        contract_value_cr:  contract_val,
        remaining_cr:       remaining,
        spi:                spi,
        indigenization_pct: indi,
        status:             status,
      });

      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-check"></i> SAVE TO SAP-PS';

      if (error) { showDbError("Insert failed: " + error.message); return; }

      logAudit("DATA_CREATE", "New WBS: " + wbs_code + " · ₹" + contract_val + " Cr → Supabase");

      if (msg) msg.classList.remove("hidden");

      // Re-fetch all projects from Supabase to refresh the grid with the new row
      projectsGridInst = null;
      await renderProjects();

      setTimeout(function() { if (msg) msg.classList.add("hidden"); closeModal(); }, 1500);
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 10: SUPPLY CHAIN — SAP-MM (Inventory + ROMIS + Vendors)
//
// Migration note: renderSupply() is now async. Three parallel Supabase
// queries run via Promise.all() to fetch inventory, vendors, and materials
// simultaneously rather than sequentially — this halves the total wait time.
// ═══════════════════════════════════════════════════════════════════════════

async function renderSupply() {
  // Run all three supply-chain queries in parallel.
  // Promise.all() fires all three HTTP GETs simultaneously and waits for all.
  // If fetched sequentially this would be ~3× slower.
  const [invResult, vendResult, matResult] = await Promise.all([
    DB_API.getInventory(),
    DB_API.getVendors(),
    DB_API.getMaterials(),
  ]);

  if (invResult.error)  { showDbError("Inventory: " + invResult.error.message);  }
  if (vendResult.error) { showDbError("Vendors: "   + vendResult.error.message);  }
  if (matResult.error)  { showDbError("Materials: " + matResult.error.message);  }

  var inventory  = invResult.data  || [];
  var vendors    = vendResult.data || [];
  var materials  = matResult.data  || [];

  // ── Supply KPI strip ─────────────────────────────────────────────────────
  var today         = new Date();
  var ninetyDaysMs  = 90 * 24 * 60 * 60 * 1000;
  var lowStockCount = inventory.filter(function(i) { return parseFloat(i.stock_qty) < parseFloat(i.min_threshold); }).length;
  var expiringCount = vendors.filter(function(v) {
    if (!v.reg_expiry) return false;
    return (new Date(v.reg_expiry) - today) < ninetyDaysMs;
  }).length;

  var setKpi = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  setKpi("kpi-vendors",    vendors.length);
  setKpi("kpi-mat-count",  materials.length);
  setKpi("kpi-reorders",   lowStockCount);
  setKpi("kpi-expiring",   expiringCount);

  // ── Inventory grid ────────────────────────────────────────────────────────
  var invC = document.getElementById("inventoryGrid");
  if (invC && inventory.length > 0) {
    var invRows = inventory.map(function(i) {
      var isLow    = parseFloat(i.stock_qty) < parseFloat(i.min_threshold);
      var stockHtml = isLow
        ? '<span class="stock-low">&#9888; ' + i.stock_qty + " " + i.unit + "</span>"
        : i.stock_qty + " " + i.unit;
      return [i.item_code, i.description, gridjs.html(stockHtml), i.min_threshold + " " + i.unit,
              "₹" + parseFloat(i.unit_price_inr).toLocaleString("en-IN"), i.vendor_id || "—"];
    });
    var invCfg = {
      columns:[{name:"Item Code",width:"110px"},{name:"Description",width:"220px"},{name:"Stock",width:"90px"},
               {name:"Min Threshold",width:"110px"},{name:"Unit Price",width:"100px"},{name:"Vendor",width:"100px"}],
      data:invRows, sort:true, pagination:{ enabled:true, limit:5 },
    };
    if (!inventoryGridInst) { inventoryGridInst = new gridjs.Grid(invCfg); inventoryGridInst.render(invC); }
    else inventoryGridInst.updateConfig(invCfg).forceRender();
  }

  // ── Vendor grid ───────────────────────────────────────────────────────────
  var vC = document.getElementById("vendorGrid");
  if (vC && vendors.length > 0) {
    var vRows = vendors.map(function(v) {
      var expDate  = v.reg_expiry ? new Date(v.reg_expiry) : null;
      var daysLeft = expDate ? Math.ceil((expDate - today) / 86400000) : null;
      var expiryHtml = daysLeft !== null
        ? (daysLeft < 90 ? '<span class="cell-negative">&#9888; ' + daysLeft + "d</span>" : daysLeft + "d")
        : "—";
      var gcHtml  = v.green_channel ? '<span class="green-channel">&#10004; GREEN</span>' : "—";
      var emdHtml = v.emd_exempt    ? '<span class="emd-exempt">&#10004; EXEMPT</span>'  : "—";
      return [v.vendor_code, v.name, v.category, v.material_group || "—",
              gridjs.html(gcHtml), gridjs.html(emdHtml), gridjs.html(expiryHtml)];
    });
    var vCfg = {
      columns:[{name:"Code",width:"90px"},{name:"Name",width:"190px"},{name:"Category",width:"70px"},
               {name:"Material",width:"140px"},{name:"Green Ch.",width:"80px"},{name:"EMD",width:"80px"},{name:"Expiry",width:"80px"}],
      data:vRows, sort:true, pagination:{ enabled:true, limit:4 },
    };
    if (!vendorGridInst) { vendorGridInst = new gridjs.Grid(vCfg); vendorGridInst.render(vC); }
    else vendorGridInst.updateConfig(vCfg).forceRender();
  }

  // ── Materials grid (ROMIS) ────────────────────────────────────────────────
  renderMaterialsGridFromData(materials);
  logAudit("VIEW_ACCESS", "Supply Chain & Vendors · Source: Supabase (3 parallel queries)");
}

/**
 * Render the ROMIS material issue grid from a pre-fetched data array.
 * Separated from renderSupply() so it can also be called after a new INSERT.
 *
 * @param {Array} materials - Array of rows from mdl_materials
 */
function renderMaterialsGridFromData(materials) {
  var c = document.getElementById("materialsGrid");
  if (!c) return;

  var rows = materials.map(function(m) {
    return [
      m.material,
      m.heat_no || "—",
      m.quantity,
      m.project_id,
      m.staging_location || "—",
      // logged_at is an ISO 8601 timestamp string from Supabase, e.g. "2025-06-01T14:30:00+00:00"
      new Date(m.logged_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
    ];
  });

  var cfg = {
    columns:[{name:"Material",width:"180px"},{name:"Heat/Batch",width:"100px"},{name:"Qty",width:"60px"},
             {name:"Project",width:"90px"},{name:"Location",width:"90px"},{name:"Logged At",width:"130px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };

  if (!materialsGridInst) { materialsGridInst = new gridjs.Grid(cfg); materialsGridInst.render(c); }
  else materialsGridInst.updateConfig(cfg).forceRender();

  var badge = document.getElementById("matIssueCount");
  if (badge) badge.textContent = materials.length + " ISSUES";
}

// ─── ROMIS Material Logger form wiring ─────────────────────────────────────
var matLoggerWired = false;
function wireMaterialLogger() {
  if (matLoggerWired) return; matLoggerWired = true;

  var btn = document.getElementById("logMaterialBtn");
  if (!btn) return;

  btn.addEventListener("click", async function() {
    var material = (document.getElementById("matType")?.value     || "").trim();
    var project  = (document.getElementById("matProject")?.value  || "").trim();
    var heatNo   = (document.getElementById("matHeat")?.value     || "").trim();
    var qty      = parseFloat(document.getElementById("matQty")?.value || "");
    var location = (document.getElementById("matLocation")?.value || "").trim();

    if (!material || !heatNo || isNaN(qty) || qty <= 0) return;

    btn.disabled = true;
    btn.textContent = "Committing…";

    // INSERT new material issue into Supabase.
    // API call: POST /rest/v1/mdl_materials
    const { error } = await DB_API.insertMaterial({
      material:         material,
      heat_no:          heatNo,
      quantity:         qty,
      project_id:       project,
      staging_location: location,
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> COMMIT ROMIS ISSUE';

    if (error) { showDbError("ROMIS insert failed: " + error.message); return; }

    logAudit("DATA_CREATE", "ROMIS Issue: " + material + " · " + qty + " units → " + project + " · Supabase");

    var msg = document.getElementById("matFormMsg");
    if (msg) { msg.classList.remove("hidden"); setTimeout(function() { msg.classList.add("hidden"); }, 2000); }

    // Reset form fields
    ["matHeat","matQty","matLocation"].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });

    // Re-fetch and re-render materials grid so the new row appears immediately
    const { data: freshMaterials, error: fetchError } = await DB_API.getMaterials();
    if (!fetchError) {
      materialsGridInst = null;
      renderMaterialsGridFromData(freshMaterials || []);
      var badge = document.getElementById("kpi-mat-count");
      if (badge) badge.textContent = (freshMaterials || []).length;
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 11: HCM — Human Capital & HSE (SAP-HCM + SAP-EHS)
//
// Migration note: renderHCM() is now async. HSE incidents are fetched from
// mdl_hse in Supabase. Leadership data remains static (hardcoded) as it
// doesn't need a separate table for this prototype.
// ═══════════════════════════════════════════════════════════════════════════

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
  return '<span class="' + (classMap[clearance] || "") + '">' + clearance + '</span>';
}

async function renderHCM() {
  // Fetch all HSE incidents from Supabase.
  // API call: GET /rest/v1/mdl_hse?select=*&order=logged_at.desc
  const { data: logs, error } = await DB_API.getHSE();
  if (error) { showDbError("HSE fetch failed: " + error.message); return; }

  var hseData   = logs || [];
  var nmCount   = hseData.filter(function(l) { return l.log_type === "near-miss"; }).length;
  var totalHrs  = hseData.reduce(function(s, l) { return s + (parseFloat(l.man_hours) || 0); }, 0);

  var setKpi = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  setKpi("kpi-near-miss",  nmCount);
  setKpi("kpi-subcon-hrs", totalHrs.toLocaleString("en-IN"));
  setKpi("hseEntryCount",  hseData.length + " ENTRIES");

  // ── Leadership grid (static data — no Supabase call needed) ──────────────
  var lC = document.getElementById("leadershipGrid");
  if (lC) {
    var lRows = LEADERSHIP.map(function(p) {
      return [p.id, p.name, p.designation, p.access, gridjs.html(clearanceCellHtml(p.clearance))];
    });
    var lCfg = {
      columns:[{name:"Employee ID",width:"80px"},{name:"Name",width:"180px"},{name:"Designation",width:"240px"},
               {name:"MIS Access (RBAC)",width:"230px"},{name:"Clearance",width:"100px"}],
      data:lRows, sort:true, pagination:{ enabled:true, limit:6 },
    };
    if (!leadershipGridInst) { leadershipGridInst = new gridjs.Grid(lCfg); leadershipGridInst.render(lC); }
    else leadershipGridInst.updateConfig(lCfg).forceRender();
  }

  // ── HSE incident grid ─────────────────────────────────────────────────────
  renderHSEGridFromData(hseData);
  logAudit("VIEW_ACCESS", "Human Capital & HSE · Source: Supabase mdl_hse");
}

function renderHSEGridFromData(hseData) {
  var c = document.getElementById("hseGrid");
  if (!c) return;
  var typeMap = { "near-miss":"Near-Miss","subcon":"Sub-Con Hrs","hazard":"Hazard Obs.","toolbox":"Toolbox Talk","permit":"Permit-WTW" };
  var rows = hseData.map(function(l) {
    var desc    = (l.description || "").length > 55 ? l.description.substring(0, 55) + "…" : l.description;
    var sevHtml = '<span class="sev-tag ' + l.severity + '">' + l.severity + '</span>';
    return [
      typeMap[l.log_type] || l.log_type,
      l.shift_zone,
      desc,
      l.personnel_id || "—",
      l.man_hours ? l.man_hours + " hrs" : "—",
      gridjs.html(sevHtml),
      new Date(l.logged_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
    ];
  });
  var cfg = {
    columns:[{name:"Type",width:"90px"},{name:"Zone",width:"100px"},{name:"Activity",width:"240px"},
             {name:"Personnel",width:"85px"},{name:"Hours",width:"70px"},{name:"Severity",width:"80px"},{name:"Logged At",width:"120px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:5 },
  };
  if (!hseGridInst) { hseGridInst = new gridjs.Grid(cfg); hseGridInst.render(c); }
  else hseGridInst.updateConfig(cfg).forceRender();
}

var sevWired = false;
function wireSeveritySelector() {
  if (sevWired) return; sevWired = true;
  var btns = document.querySelectorAll(".sev-btn");
  btns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      btns.forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      selectedSev = btn.dataset.sev;
    });
  });
}

var selectedSev = "LOW";
var hseWired    = false;
function wireHSEForm() {
  if (hseWired) return; hseWired = true;

  var btn = document.getElementById("logHseBtn");
  if (!btn) return;

  btn.addEventListener("click", async function() {
    var logType     = document.getElementById("hseLogType")?.value || "near-miss";
    var shiftZone   = document.getElementById("hseShift")?.value   || "A-East";
    var description = (document.getElementById("hseDescription")?.value || "").trim();
    var personnel   = (document.getElementById("hsePersonnel")?.value   || "").trim();
    var hours       = parseFloat(document.getElementById("hseHours")?.value || "") || null;

    if (!description) { document.getElementById("hseDescription")?.focus(); return; }

    btn.disabled = true;
    btn.textContent = "Committing…";

    // INSERT new HSE entry into Supabase.
    // API call: POST /rest/v1/mdl_hse
    const { error } = await DB_API.insertHSE({
      log_type:     logType,
      shift_zone:   shiftZone,
      description:  description,
      personnel_id: personnel || null,
      man_hours:    hours,
      severity:     selectedSev,
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> COMMIT LOG ENTRY';

    if (error) { showDbError("HSE insert failed: " + error.message); return; }

    logAudit("DATA_CREATE", "HSE Log: " + logType + " · " + shiftZone + " · Severity: " + selectedSev + " · Supabase");

    var msg = document.getElementById("hseFormMsg");
    if (msg) { msg.classList.remove("hidden"); setTimeout(function() { msg.classList.add("hidden"); }, 2000); }

    ["hseDescription","hsePersonnel","hseHours"].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });

    // Re-fetch all HSE records from Supabase and re-render the grid
    const { data: freshHSE, error: fetchError } = await DB_API.getHSE();
    if (!fetchError) {
      var newData = freshHSE || [];
      var nmCount  = newData.filter(function(l) { return l.log_type === "near-miss"; }).length;
      var totalHrs = newData.reduce(function(s, l) { return s + (parseFloat(l.man_hours) || 0); }, 0);
      var setKpi = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      setKpi("kpi-near-miss",  nmCount);
      setKpi("kpi-subcon-hrs", totalHrs.toLocaleString("en-IN"));
      setKpi("hseEntryCount",  newData.length + " ENTRIES");
      hseGridInst = null;
      renderHSEGridFromData(newData);
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// ── PART 12: AUDIT LOG (session-scoped localStorage — unchanged)
// ═══════════════════════════════════════════════════════════════════════════

function renderAuditGrid() {
  var c = document.getElementById("auditGrid");
  if (!c) return;
  var logs = Session.getAudit();
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
    columns:[{name:"Timestamp",width:"140px"},{name:"User",width:"160px"},{name:"Role",width:"120px"},
             {name:"Clearance",width:"100px"},{name:"Action",width:"120px"},{name:"Detail",width:"280px"}],
    data:rows, sort:true, pagination:{ enabled:true, limit:10 },
  };
  if (!auditGridInst) { auditGridInst = new gridjs.Grid(cfg); auditGridInst.render(c); }
  else auditGridInst.updateConfig(cfg).forceRender();
  updateAuditBadge();
}


// ═══════════════════════════════════════════════════════════════════════════
// ── INIT ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function() {
  // Validate that Supabase credentials have been configured before rendering
  if (SUPABASE_URL === "YOUR_SUPABASE_URL_HERE" || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY_HERE") {
    document.body.innerHTML = [
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;',
      'background:#0b0e14;font-family:\'IBM Plex Mono\',monospace;flex-direction:column;gap:16px;">',
      '<div style="color:#ff4d4d;font-size:14px;"><i class="fas fa-triangle-exclamation"></i> &nbsp;CONFIGURATION REQUIRED</div>',
      '<div style="color:#8a94a6;font-size:12px;max-width:480px;text-align:center;line-height:1.8;">',
      'Open <strong style="color:#e8edf5">app.js</strong> and replace<br>',
      '<code style="color:#2075ff">SUPABASE_URL</code> and <code style="color:#2075ff">SUPABASE_ANON_KEY</code><br>',
      'with your actual Supabase project credentials.<br><br>',
      '<span style="color:#505a6e;font-size:10px;">Find them at: app.supabase.com → Your Project → Settings → API</span>',
      '</div></div>',
    ].join("");
    return;
  }

  buildRBACOverlay();
});

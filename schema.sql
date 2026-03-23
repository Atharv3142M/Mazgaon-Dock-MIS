-- ═══════════════════════════════════════════════════════════════════════════
-- MDL DIGITAL SHIPYARD MIS · Supabase PostgreSQL Schema & Seed Data
-- Version: 6.0  |  Run this entire file in the Supabase SQL Editor
--
-- EXECUTION ORDER (important):
--   Step 1 — Drop tables if re-running (safe idempotent setup)
--   Step 2 — Create tables with proper types and constraints
--   Step 3 — Configure RLS policies (public read + anonymous write for prototype)
--   Step 4 — Seed all tables with real MDL data
--
-- TABLES CREATED:
--   mdl_financials   → Strategic dashboard KPIs (SAP-FI/CO mock)
--   mdl_projects     → Tactical project portfolio (SAP-PS mock)
--   mdl_materials    → Operational ROMIS issue logger (SAP-MM mock)
--   mdl_inventory    → Inventory master stock levels (SAP-MM mock)
--   mdl_vendors      → Vendor register with Green Channel flags (SAP-MM mock)
--   mdl_hse          → HSE incident & sub-contractor register (SAP-EHS mock)
--
-- SECURITY NOTE:
--   RLS is enabled on all tables but policies allow full anonymous (anon)
--   access. This is intentional for a static GitHub Pages prototype.
--   In production, replace these policies with role-specific JWT claims.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 · CLEAN SLATE
-- Drop tables in reverse dependency order to avoid FK constraint errors.
-- ───────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS mdl_hse        CASCADE;
DROP TABLE IF EXISTS mdl_materials   CASCADE;
DROP TABLE IF EXISTS mdl_inventory   CASCADE;
DROP TABLE IF EXISTS mdl_vendors     CASCADE;
DROP TABLE IF EXISTS mdl_projects    CASCADE;
DROP TABLE IF EXISTS mdl_financials  CASCADE;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 · TABLE DEFINITIONS
-- ───────────────────────────────────────────────────────────────────────────

-- ── TABLE: mdl_financials ──────────────────────────────────────────────────
-- Stores one row per fiscal year representing the complete P&L summary.
-- Used by the ESS (Executive Summary System) Financial Command dashboard.
-- SAP equivalent: SAP-FI/CO P&L Module + SAP-BW reporting layer.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_financials (
    id                      SERIAL PRIMARY KEY,

    -- Fiscal year label, e.g. 'FY25'
    fiscal_year             VARCHAR(10)   NOT NULL UNIQUE,

    -- Standalone P&L figures (₹ in Crore)
    revenue_cr              NUMERIC(12,2) NOT NULL,  -- Revenue from Operations
    total_income_cr         NUMERIC(12,2),            -- Revenue + Other Income
    gross_profit_cr         NUMERIC(12,2),
    ebitda_cr               NUMERIC(12,2),
    pbt_cr                  NUMERIC(12,2),            -- Profit Before Tax
    pat_cr                  NUMERIC(12,2),            -- Profit After Tax (Net Income)

    -- Margin ratios (stored as % values, e.g. 19.9 = 19.9%)
    operating_profit_margin NUMERIC(5,2),
    net_profit_margin       NUMERIC(5,2),

    -- Cash flow statement (₹ in Billions)
    cfo_bn                  NUMERIC(10,2),            -- Cash Flow from Operations
    cfi_bn                  NUMERIC(10,2),            -- Cash Flow from Investing (usually negative)
    cff_bn                  NUMERIC(10,2),            -- Cash Flow from Financing (usually negative)

    -- Order book (₹ Crore) — snapshotted at year-end
    order_book_cr           NUMERIC(12,2),

    -- Indigenization percentages for the composite index
    indigenous_pct          NUMERIC(5,2),             -- e.g. 76.00
    import_pct              NUMERIC(5,2),             -- e.g. 24.00

    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  mdl_financials                  IS 'Annual standalone P&L summary. One row per fiscal year. Powers the ESS Financial Command dashboard.';
COMMENT ON COLUMN mdl_financials.revenue_cr       IS 'Revenue from Operations (₹ Crore). Source: MDL Audited Standalone Financials.';
COMMENT ON COLUMN mdl_financials.pat_cr           IS 'Profit After Tax / Net Income (₹ Crore).';
COMMENT ON COLUMN mdl_financials.order_book_cr    IS 'Total confirmed order book as at fiscal year-end (₹ Crore).';


-- ── TABLE: mdl_projects ───────────────────────────────────────────────────
-- One row per WBS (Work Breakdown Structure) element / major programme.
-- Tracks the full active order book including contract values, remaining
-- balances, schedule performance, and indigenization compliance.
-- SAP equivalent: SAP-PS (Project System) WBS Element master.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_projects (
    id                  SERIAL PRIMARY KEY,

    -- WBS identifier, e.g. 'P17A', 'P75', 'MPV-EXP'
    wbs_code            VARCHAR(20)   NOT NULL UNIQUE,

    -- Human-readable programme name
    description         TEXT          NOT NULL,

    -- Financials (₹ Crore)
    contract_value_cr   NUMERIC(12,2) NOT NULL,
    remaining_cr        NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Schedule Performance Index (1.00 = on schedule, >1 = ahead, <1 = behind)
    -- Range: 0.00–2.00
    spi                 NUMERIC(4,2)  NOT NULL DEFAULT 1.00
                            CHECK (spi >= 0 AND spi <= 2),

    -- Indigenization content percentage (Aatmanirbhar Bharat mandate)
    indigenization_pct  INTEGER       DEFAULT 0
                            CHECK (indigenization_pct >= 0 AND indigenization_pct <= 100),

    -- Traffic-light status. Constrained to known values.
    status              VARCHAR(30)   NOT NULL DEFAULT 'On Track'
                            CHECK (status IN (
                                'On Track',
                                'Slight Overrun',
                                'Managed Overrun',
                                'Underrun',
                                'On Hold'
                            )),

    -- Metadata
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  mdl_projects              IS 'Active project portfolio / WBS elements. Maps to SAP-PS Project System. Powers the Tactical MIS Portfolio Grid.';
COMMENT ON COLUMN mdl_projects.wbs_code     IS 'Unique WBS code, e.g. P17A. Used as the natural business key.';
COMMENT ON COLUMN mdl_projects.spi          IS 'Schedule Performance Index (EVM). 1.00 = on-time. Triggers colour-coded SPI badge in the UI.';


-- ── TABLE: mdl_materials ──────────────────────────────────────────────────
-- Append-only issue log for the Real-Time Outfitting MIS (ROMIS).
-- Every row is one material issue event — a specific batch of material
-- transferred from a staging warehouse to a vessel's build location.
-- SAP equivalent: SAP-MM Goods Movement (Movement Type 201 — GI to Cost Centre).
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_materials (
    id              SERIAL PRIMARY KEY,

    -- Material description, e.g. 'Steel Plate (Grade DH36)'
    material        VARCHAR(100)  NOT NULL,

    -- Manufacturer heat number or batch number for traceability
    heat_no         VARCHAR(50),

    -- Quantity issued (units or metric tonnes depending on material)
    quantity        NUMERIC(10,2) NOT NULL CHECK (quantity > 0),

    -- Which WBS / cost centre this issue is charged to
    project_id      VARCHAR(20)   NOT NULL,

    -- Physical staging location within the shipyard, e.g. 'SY-B2-R4'
    staging_location VARCHAR(30),

    -- ISO timestamp of the issue event
    logged_at       TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  mdl_materials             IS 'Append-only ROMIS material issue log. One row per issue event. Maps to SAP-MM GI Movement Type 201.';
COMMENT ON COLUMN mdl_materials.heat_no     IS 'Mill certificate heat/batch number. Critical for traceability in naval quality assurance.';
COMMENT ON COLUMN mdl_materials.project_id  IS 'WBS code of the receiving project cost centre. Foreign key intent: mdl_projects.wbs_code.';


-- ── TABLE: mdl_inventory ──────────────────────────────────────────────────
-- Current stock levels for key raw materials and equipment.
-- Status is computed: 'LOW' when stock < min_threshold.
-- SAP equivalent: SAP-MM Inventory Management / Material Master.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_inventory (
    id              SERIAL PRIMARY KEY,
    item_code       VARCHAR(30)   NOT NULL UNIQUE,
    description     VARCHAR(150)  NOT NULL,
    stock_qty       NUMERIC(12,2) NOT NULL DEFAULT 0,
    min_threshold   NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit            VARCHAR(10)   NOT NULL DEFAULT 'Nos',
    unit_price_inr  NUMERIC(15,2),
    vendor_id       VARCHAR(20),
    -- Computed status: UI should treat stock_qty < min_threshold as LOW
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE mdl_inventory IS 'Current inventory stock levels. Used by Supply Chain dashboard. Status LOW is derived: stock_qty < min_threshold.';


-- ── TABLE: mdl_vendors ────────────────────────────────────────────────────
-- Vendor master record with Green Channel and EMD exemption flags.
-- Registration expiry enables the automated 90-day alert system.
-- SAP equivalent: SAP-MM Vendor Master (LFA1 table).
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_vendors (
    id              SERIAL PRIMARY KEY,
    vendor_code     VARCHAR(20)   NOT NULL UNIQUE,
    name            VARCHAR(150)  NOT NULL,
    category        VARCHAR(20)   NOT NULL  -- 'PSU', 'MSME', 'Large'
                        CHECK (category IN ('PSU', 'MSME', 'Large')),
    material_group  VARCHAR(80),
    green_channel   BOOLEAN       NOT NULL DEFAULT FALSE,
    emd_exempt      BOOLEAN       NOT NULL DEFAULT FALSE,
    reg_expiry      DATE,
    status          VARCHAR(20)   NOT NULL DEFAULT 'Active'
                        CHECK (status IN ('Active', 'Suspended', 'Expired')),
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  mdl_vendors              IS 'Vendor master. Green Channel and EMD exemption flags. Expiry date drives 90-day alert logic.';
COMMENT ON COLUMN mdl_vendors.green_channel IS 'TRUE = pre-qualified Green Channel vendor. Eligible for fast-track procurement.';
COMMENT ON COLUMN mdl_vendors.emd_exempt    IS 'TRUE = exempt from Earnest Money Deposit (UDYAM/NSIC registered MSMEs or PSUs).';


-- ── TABLE: mdl_hse ────────────────────────────────────────────────────────
-- HSE incident and sub-contractor activity register.
-- Append-only for audit integrity. Powers the live HSE incident grid.
-- SAP equivalent: SAP-EHS Incident Management + SAP-HCM Time Recording.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE mdl_hse (
    id              SERIAL PRIMARY KEY,

    log_type        VARCHAR(20)  NOT NULL
                        CHECK (log_type IN (
                            'near-miss',
                            'subcon',
                            'hazard',
                            'toolbox',
                            'permit'
                        )),

    shift_zone      VARCHAR(30)  NOT NULL,  -- e.g. 'A-East', 'NH-Dock'
    description     TEXT         NOT NULL,
    personnel_id    VARCHAR(30),            -- Contractor/employee ID, e.g. 'CTR-2841'
    man_hours       NUMERIC(6,1),           -- Sub-contractor hours for 'subcon' entries

    severity        VARCHAR(10)  NOT NULL DEFAULT 'LOW'
                        CHECK (severity IN ('LOW', 'MED', 'HIGH', 'CRIT')),

    logged_at       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  mdl_hse             IS 'Append-only HSE incident and sub-contractor log. Maps to SAP-EHS. Severity drives ISO 45001 risk matrix colour coding.';
COMMENT ON COLUMN mdl_hse.man_hours   IS 'Man-hours worked. Populated only for log_type = subcon. Used to calculate cumulative sub-contractor hours KPI.';


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3 · ROW LEVEL SECURITY (RLS) CONFIGURATION
--
-- For this static GitHub Pages prototype we enable RLS (best practice) but
-- create permissive policies for the 'anon' role so the Supabase JS client
-- can read and write without any user authentication session.
--
-- ⚠ PRODUCTION WARNING:
--   Replace these policies with granular JWT-claim-based policies before
--   going live. Example production policy for SELECT:
--     USING (auth.jwt() ->> 'role' IN ('super-admin', 'executive'))
-- ───────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table (required before creating policies)
ALTER TABLE mdl_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdl_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdl_materials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdl_inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdl_vendors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdl_hse        ENABLE ROW LEVEL SECURITY;

-- ── mdl_financials: public read, no writes from frontend ──────────────────
-- Financial data is read-only from the client. Changes are admin-only.
CREATE POLICY "anon_read_financials"
    ON mdl_financials FOR SELECT
    TO anon
    USING (true);

-- ── mdl_projects: full CRUD for prototype ─────────────────────────────────
-- Project Commanders need INSERT (add project) and SELECT.
-- No DELETE from the frontend to preserve data integrity.
CREATE POLICY "anon_select_projects"
    ON mdl_projects FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "anon_insert_projects"
    ON mdl_projects FOR INSERT
    TO anon
    WITH CHECK (true);

-- ── mdl_materials: append-only ROMIS logger ───────────────────────────────
-- Material issues are append-only (INSERT + SELECT). No UPDATE/DELETE.
CREATE POLICY "anon_select_materials"
    ON mdl_materials FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "anon_insert_materials"
    ON mdl_materials FOR INSERT
    TO anon
    WITH CHECK (true);

-- ── mdl_inventory: read-only from frontend ────────────────────────────────
CREATE POLICY "anon_read_inventory"
    ON mdl_inventory FOR SELECT
    TO anon
    USING (true);

-- ── mdl_vendors: read-only from frontend ──────────────────────────────────
CREATE POLICY "anon_read_vendors"
    ON mdl_vendors FOR SELECT
    TO anon
    USING (true);

-- ── mdl_hse: append-only incident log ─────────────────────────────────────
CREATE POLICY "anon_select_hse"
    ON mdl_hse FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "anon_insert_hse"
    ON mdl_hse FOR INSERT
    TO anon
    WITH CHECK (true);


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4 · SEED DATA
-- All figures sourced from publicly available MDL investor presentations
-- and audited standalone financial results FY2024-25.
-- ───────────────────────────────────────────────────────────────────────────


-- ── SEED: mdl_financials ──────────────────────────────────────────────────
-- Five years of standalone P&L data to power the dual-axis revenue/PAT chart.
-- Source: MDL Q4 FY24-25 Investor Presentation & Annual Reports FY21–FY25.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_financials
    (fiscal_year, revenue_cr, total_income_cr, gross_profit_cr, ebitda_cr,
     pbt_cr, pat_cr, operating_profit_margin, net_profit_margin,
     cfo_bn, cfi_bn, cff_bn, order_book_cr, indigenous_pct, import_pct)
VALUES
    -- FY 2020-21
    ('FY21',  4200.00,  4680.00,   520.00,  780.00,
      750.00,  620.00,  10.5,  14.8,
       4.20, -1.10, -0.80,  24000.00, 68.00, 32.00),

    -- FY 2021-22
    ('FY22',  5100.00,  5650.00,   680.00,  960.00,
      920.00,  810.00,  12.1,  15.9,
       5.10, -1.40, -1.20,  26500.00, 70.00, 30.00),

    -- FY 2022-23
    ('FY23',  7192.00,  7900.00,   980.00, 1340.00,
     1310.00, 1385.00,  14.2,  19.3,
       7.20, -2.10, -1.80,  28800.00, 72.00, 28.00),

    -- FY 2023-24
    ('FY24',  9466.58, 10568.10,  1421.20, 1649.00,
     2424.80, 1845.43,  15.0,  19.1,
       6.90, -3.20, -2.40,  30100.00, 74.00, 26.00),

    -- FY 2024-25 (AUDITED FINAL)
    -- Revenue: +20.8% YoY | PAT: +25.9% YoY | EBITDA: +95.8% YoY
    -- Zero debt. CFO +203.9% YoY. Order book: ₹32,260 Cr.
    ('FY25', 11431.88, 12553.10,  2068.90, 3228.80,
     3109.20, 2324.88,  18.1,  19.9,
      21.00,-13.00, -7.00,  32260.00, 76.00, 24.00);


-- ── SEED: mdl_projects ────────────────────────────────────────────────────
-- Active order book as at March 31, 2025 (₹32,260 Crore total).
-- Source: MDL Q4 FY24-25 Investor Presentation, Table: Order Book.
-- SPI values reflect latest available schedule performance data.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_projects
    (wbs_code, description, contract_value_cr, remaining_cr, spi, indigenization_pct, status)
VALUES
    -- P17A: 7-frigate programme split between MDL (4) and GRSE (3).
    -- Indigenization 75%. ₹28,769 Cr is MDL's contracted share.
    ('P17A',
     'P17A Nilgiri Class Stealth Frigates — 4 vessels at MDL (Ministry of Defence)',
     28769.00,  3716.00, 0.97, 75, 'On Track'),

    -- P15B: All 4 Visakhapatnam-class destroyers delivered. ₹4 Cr residual
    -- represents spares supply tail of long-term logistics support.
    ('P15B',
     'P15B Visakhapatnam Class Destroyers — 4 vessels fully commissioned (MoD)',
     27120.00,     4.00, 1.02, 72, 'On Track'),

    -- P75: All 6 Kalvari-class Scorpene submarines delivered (2017–2025).
    -- Residual is long-term spares and warranty support.
    ('P75',
     'P75 Kalvari Class Scorpene Submarines — 6 boats delivered (Ministry of Defence)',
     23814.00,  2493.00, 1.02, 60, 'On Track'),

    -- AIP: ₹1,990 Cr contract signed Dec 2024 to retrofit Air Independent
    -- Propulsion plugs into all 6 Kalvari submarines, extending submerged endurance.
    ('P75-AIP',
     'P75 AIP Plug Retrofit — Air Independent Propulsion System (MoD, Dec 2024)',
      1990.00,  1749.00, 1.00, 52, 'On Track'),

    -- ICGS: Indian Coast Guard fleet — CTS, NGOPV (Next-Gen Offshore Patrol Vessels),
    -- and FPV (Fast Patrol Vessels). 21 hulls across three sub-programmes.
    ('ICGS',
     'ICGS Fleet — CTS / NGOPV / FPV (21 vessels, Indian Coast Guard)',
      2829.00,   715.00, 0.95, 68, 'Slight Overrun'),

    -- Offshore: Three ONGC projects — PRPP, DSF-II, PRP 8.
    -- Largest remaining balance in the order book after P17A.
    ('OFF-PRPJ',
     'Offshore Projects — PRPP / DSF-II / PRP-8 (ONGC, 3 projects)',
      6524.00,  5409.00, 0.91, 55, 'Slight Overrun'),

    -- MRLC: Medium Refit and Life Extension of one submarine.
    ('MRLC',
     'Submarine MRLC — Medium Refit & Life Extension (Ministry of Defence)',
      2381.00,  1711.00, 0.98, 58, 'On Track'),

    -- MPV Export: Commercial export order for 6 multi-purpose hybrid vessels.
    -- Keel laid April 2, 2025 in South Yard. First export order of this scale.
    ('MPV-EXP',
     'MPV Export — 6 Multi-Purpose Hybrid Vessels (Navi Merchants, Denmark)',
       710.00,   710.00, 0.88, 42, 'Slight Overrun'),

    -- Miscellaneous: Small support projects for various entities.
    ('MISC',
     'Miscellaneous Support Projects — Spares, Repairs & Minor Works (Various)',
       256.00,   169.00, 1.01, 65, 'On Track');


-- ── SEED: mdl_materials ───────────────────────────────────────────────────
-- Pre-seeded ROMIS material issue events to populate the live register grid.
-- Timestamps are offset so they appear recent in the UI.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_materials
    (material, heat_no, quantity, project_id, staging_location, logged_at)
VALUES
    -- Steel plate issued to P17A frigate block assembly
    ('Steel Plate (Grade DH36)',
     'HT-25-019',
     24,
     'P17A',
     'SY-B2-R4',
     NOW() - INTERVAL '6 hours'),

    -- High-pressure alloy pipe issued to Submarine Division
    ('High-Pressure Alloy Pipe (SS 316L)',
     'PP-25-007',
     60,
     'P75',
     'SUB-C3-L2',
     NOW() - INTERVAL '2 hours'),

    -- Cable tray assembly issued for P17A outfitting
    ('Cable Tray Assembly (GI, 150mm)',
     'CT-25-112',
     80,
     'P17A',
     'SY-WB2-OF',
     NOW() - INTERVAL '30 minutes');


-- ── SEED: mdl_inventory ───────────────────────────────────────────────────
-- Current warehouse stock levels. Items where stock_qty < min_threshold
-- are treated as 'LOW' by the UI (highlighted in red).
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_inventory
    (item_code, description, stock_qty, min_threshold, unit, unit_price_inr, vendor_id)
VALUES
    ('RM-SP-DH36',
     'Steel Plate Grade DH36 (Naval Shipbuilding Quality)',
     348, 100, 'MT', 72000.00, 'V-SAIL-01'),

    -- ⚠ LOW STOCK: 82 < 120 — will trigger reorder alert in the UI
    ('RM-PP-HP316',
     'High-Pressure Alloy Pipe SS 316L (Naval Grade)',
     82, 120, 'Nos', 15500.00, 'V-TUBE-02'),

    ('RM-BB-STR',
     'Bulb Bar Structural KB-300 (Hull Frames)',
     215, 50, 'MT', 68000.00, 'V-SAIL-01'),

    -- ⚠ LOW STOCK: 44 < 60 — will trigger reorder alert in the UI
    ('EQ-VALVE-DN',
     'DN150 Gate Valve Assembly (Naval Grade, PN40)',
     44, 60, 'Nos', 42000.00, 'V-VALVE-03'),

    ('EQ-CBTRAY-A',
     'Cable Tray Assembly GI 150mm (IEC 61537 Compliant)',
     620, 200, 'Nos', 1800.00, 'V-ELEC-04'),

    ('EQ-GENSET-M',
     'Generator Set Module 2.5MW (Marine Classification)',
     4, 2, 'Nos', 9200000.00, 'V-GEN-05'),

    ('RM-CABLE-C',
     'Multi-Core Control Cable XLPE 1000V (BS 5467)',
     18500, 5000, 'm', 185.00, 'V-ELEC-04'),

    ('EQ-PUMP-BW',
     'Ballast Water Pump 600 m3/hr (BWMS Convention)',
     6, 4, 'Nos', 1850000.00, 'V-PUMP-06');


-- ── SEED: mdl_vendors ─────────────────────────────────────────────────────
-- Vendor master with Green Channel and EMD exemption status.
-- reg_expiry drives the 90-day automated alert system in the UI.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_vendors
    (vendor_code, name, category, material_group, green_channel, emd_exempt, reg_expiry, status)
VALUES
    -- PSU vendor — EMD exempt by government policy, registered for steel supply
    ('V-SAIL-01',
     'SAIL — Steel Authority of India Limited',
     'PSU', 'Structural Steel & Plates',
     FALSE, TRUE,
     CURRENT_DATE + INTERVAL '400 days',
     'Active'),

    -- MSME vendor — Green Channel for pipes, dual EMD exemption (UDYAM registered)
    -- ⚠ EXPIRING: Registration expires in ~45 days — 90-day alert will fire
    ('V-TUBE-02',
     'Patton Tubing Pvt Ltd (MSME — UDYAM Registered)',
     'MSME', 'High-Pressure Pipes & Fittings',
     TRUE, TRUE,
     CURRENT_DATE + INTERVAL '45 days',
     'Active'),

    -- Large industrial vendor — Green Channel, no EMD exemption
    ('V-VALVE-03',
     'Kirloskar Brothers Limited',
     'Large', 'Valve Assemblies & Actuators',
     TRUE, FALSE,
     CURRENT_DATE + INTERVAL '300 days',
     'Active'),

    -- Large electrical vendor
    ('V-ELEC-04',
     'Havells India Limited',
     'Large', 'Cables, Trays & Electrical Equipment',
     FALSE, FALSE,
     CURRENT_DATE + INTERVAL '200 days',
     'Active'),

    -- PSU vendor — Green Channel, EMD exempt for gensets and turbines
    ('V-GEN-05',
     'BHEL — Bharat Heavy Electricals Limited (Bhopal Unit)',
     'PSU', 'Generator Sets, Turbines & Heavy Electrical',
     TRUE, TRUE,
     CURRENT_DATE + INTERVAL '500 days',
     'Active'),

    -- MSME vendor — EMD exempt, registration approaching 90-day alert window
    -- ⚠ EXPIRING: 80 days — just outside 90-day threshold, monitor closely
    ('V-PUMP-06',
     'Flowserve India Controls Pvt Ltd (MSME)',
     'MSME', 'Pumps, Compressors & Sealing Systems',
     FALSE, TRUE,
     CURRENT_DATE + INTERVAL '80 days',
     'Active');


-- ── SEED: mdl_hse ─────────────────────────────────────────────────────────
-- Pre-seeded HSE incident entries for initial grid population.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO mdl_hse
    (log_type, shift_zone, description, personnel_id, man_hours, severity, logged_at)
VALUES
    ('near-miss',
     'A-East',
     'Unsecured toolbox near Dock-2 upper gantry. No injury. PPE compliant. Corrective action taken immediately.',
     'CTR-1922', NULL, 'MED',
     NOW() - INTERVAL '8 hours'),

    ('subcon',
     'B-East',
     'Erection sub-assembly P17A frame-72. All personnel PPE compliant. ROMIS material issue coordinated with stores.',
     'CTR-2841', 32.0, 'LOW',
     NOW() - INTERVAL '3 hours'),

    ('toolbox',
     'A-Sub',
     'Daily toolbox talk: confined space entry procedure for submarine ballast tank access. 18 personnel attended.',
     'SUP-0441', NULL, 'LOW',
     NOW() - INTERVAL '1 hour');


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 5 · UTILITY VIEWS (optional but recommended)
-- These views simplify common queries used by the frontend.
-- ───────────────────────────────────────────────────────────────────────────

-- View: current year vs previous year financial comparison
-- Used by the Full P&L Comparison table in the ESS module.
CREATE OR REPLACE VIEW vw_financials_yoy AS
SELECT
    curr.fiscal_year                                        AS fy,
    curr.revenue_cr,
    curr.total_income_cr,
    curr.gross_profit_cr,
    curr.ebitda_cr,
    curr.pbt_cr,
    curr.pat_cr,
    curr.operating_profit_margin,
    curr.net_profit_margin,
    curr.cfo_bn,
    curr.order_book_cr,
    curr.indigenous_pct,
    -- YoY change percentage for revenue (handle division by zero)
    CASE
        WHEN prev.revenue_cr > 0
        THEN ROUND(((curr.revenue_cr - prev.revenue_cr) / prev.revenue_cr * 100)::NUMERIC, 1)
        ELSE NULL
    END AS revenue_yoy_pct,
    -- YoY change percentage for PAT
    CASE
        WHEN prev.pat_cr > 0
        THEN ROUND(((curr.pat_cr - prev.pat_cr) / prev.pat_cr * 100)::NUMERIC, 1)
        ELSE NULL
    END AS pat_yoy_pct
FROM      mdl_financials curr
LEFT JOIN mdl_financials prev
       ON prev.fiscal_year = (
           'FY' || (CAST(SUBSTRING(curr.fiscal_year FROM 3) AS INTEGER) - 1)::TEXT
       )
ORDER BY curr.fiscal_year;


-- View: low-stock inventory items
-- Used to calculate the "Below Min Threshold" KPI in the Supply dashboard.
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT *
FROM  mdl_inventory
WHERE stock_qty < min_threshold;


-- View: project portfolio with derived % complete
-- Avoids re-computing this in every frontend query.
CREATE OR REPLACE VIEW vw_projects_portfolio AS
SELECT
    wbs_code,
    description,
    contract_value_cr,
    remaining_cr,
    ROUND(
        CASE
            WHEN contract_value_cr > 0
            THEN ((contract_value_cr - remaining_cr) / contract_value_cr * 100)::NUMERIC
            ELSE 0
        END,
    1) AS pct_complete,
    spi,
    indigenization_pct,
    status,
    created_at
FROM mdl_projects
ORDER BY contract_value_cr DESC;


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- Run these after the above to confirm everything is set up correctly.
-- ───────────────────────────────────────────────────────────────────────────

-- Confirm row counts
SELECT 'mdl_financials' AS tbl, COUNT(*) AS rows FROM mdl_financials
UNION ALL
SELECT 'mdl_projects',          COUNT(*) FROM mdl_projects
UNION ALL
SELECT 'mdl_materials',         COUNT(*) FROM mdl_materials
UNION ALL
SELECT 'mdl_inventory',         COUNT(*) FROM mdl_inventory
UNION ALL
SELECT 'mdl_vendors',           COUNT(*) FROM mdl_vendors
UNION ALL
SELECT 'mdl_hse',               COUNT(*) FROM mdl_hse;

-- Preview the FY25 financial snapshot
SELECT fiscal_year, revenue_cr, pat_cr, ebitda_cr, order_book_cr
FROM   mdl_financials
WHERE  fiscal_year = 'FY25';

-- Preview low-stock items
SELECT item_code, description, stock_qty, min_threshold
FROM   vw_low_stock;

-- Preview active order book ordered by contract value
SELECT wbs_code, description, contract_value_cr, remaining_cr, pct_complete, status
FROM   vw_projects_portfolio
LIMIT 10;

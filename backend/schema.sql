-- ============================================================
-- SmartVend consolidated local schema (replaces Supabase entirely)
-- Multi-tenant: each Organization is an independent vending business.
-- Role hierarchy: platform_admin -> route_owner (per org) -> driver (per org)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Enums ----------
CREATE TYPE app_role AS ENUM ('platform_admin', 'route_owner', 'driver');
CREATE TYPE payment_method AS ENUM ('cash', 'cashless');
CREATE TYPE machine_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');
CREATE TYPE payout_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE entity_type AS ENUM ('warehouse', 'vehicle', 'machine');
CREATE TYPE route_frequency AS ENUM ('daily', 'weekly', 'custom');
CREATE TYPE route_stop_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
CREATE TYPE telemetry_event_type AS ENUM ('sale', 'door_open', 'alert', 'error', 'restock');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE commission_status AS ENUM ('draft', 'pending', 'paid');

-- ---------- Organizations (tenants) ----------
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Users (replaces auth.users + profiles + user_roles) ----------
-- org_id is NULL only for platform_admin (a global account, not tied to one business)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  dashboard_layout JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_required_unless_platform_admin
    CHECK ( (role = 'platform_admin' AND org_id IS NULL) OR (role != 'platform_admin' AND org_id IS NOT NULL) )
);

CREATE INDEX idx_users_org ON users(org_id);

-- ---------- Domain tables (all tenant-scoped via org_id) ----------

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_size TEXT,
  units_per_case INTEGER,
  cost_price DECIMAL(10,2) NOT NULL,
  sell_price DECIMAL(10,2) NOT NULL,
  barcode TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  reorder_point INTEGER DEFAULT 0,
  order_up_to_level INTEGER,
  warehouse_stock INTEGER DEFAULT 0,
  last_supplier TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(org_id, sku)
);

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plate TEXT NOT NULL,
  capacity DECIMAL(10,2),
  assigned_driver_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(org_id, plate)
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  working_hours TEXT,
  working_days TEXT[] DEFAULT '{MON,TUE,WED,THU,FRI,SAT,SUN}',
  notes TEXT,
  next_visit DATE,
  commission_type commission_type NOT NULL DEFAULT 'percentage',
  commission_value DECIMAL(10,2) NOT NULL,
  payout_frequency payout_frequency NOT NULL DEFAULT 'monthly',
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT,
  external_code TEXT,
  description TEXT,
  machine_type TEXT,
  asset_tag TEXT NOT NULL,
  model TEXT NOT NULL,
  serial TEXT NOT NULL,
  key_code TEXT,
  placed_on DATE,
  notes TEXT,
  track_vend_meter BOOLEAN DEFAULT false,
  track_cash_meter BOOLEAN DEFAULT false,
  track_credit_card_sales BOOLEAN DEFAULT false,
  column_map_template TEXT,
  location_id UUID REFERENCES locations(id),
  planogram_id UUID,
  column_count INTEGER,
  cashless_enabled BOOLEAN DEFAULT false,
  telemetry_device_id TEXT,
  status machine_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(org_id, asset_tag),
  UNIQUE(org_id, serial)
);

CREATE TABLE machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE machine_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  price_override DECIMAL(10,2), -- overrides product.sell_price for this coil/location; editable by route_owner and driver
  dex_price DECIMAL(10,2), -- price as reported by the machine's telemetry/DEX; can drift from price_override
  last_count INTEGER, -- count recorded at the previous visit, for reference
  par_level INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL,
  current_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(machine_id, position)
);

CREATE TABLE inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_doc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency route_frequency NOT NULL DEFAULT 'daily',
  start_warehouse_id UUID REFERENCES warehouses(id),
  assigned_driver_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_id UUID REFERENCES routes(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  trip_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned | in_progress | completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id),
  planned_date DATE NOT NULL,
  sequence INTEGER NOT NULL,
  status route_stop_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE restock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_stop_id UUID NOT NULL REFERENCES route_stops(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id),
  product_id UUID REFERENCES products(id),
  current_count INTEGER,       -- what the driver found in the coil before restocking
  last_filled_qty INTEGER,     -- snapshot of the previous visit's filled_qty, for reference
  filled_qty INTEGER,          -- what the driver loaded in on this visit
  price_at_restock DECIMAL(10,2), -- price being charged at this coil at the time of this visit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_stop_id, slot_id)
);

CREATE TABLE refill_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id UUID NOT NULL REFERENCES route_stops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  required_qty INTEGER NOT NULL,
  picked_qty INTEGER DEFAULT 0,
  fulfilled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id),
  event_type telemetry_event_type NOT NULL,
  payload_json JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cash_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id),
  route_stop_id UUID REFERENCES route_stops(id),
  expected_cash DECIMAL(10,2) NOT NULL,
  counted_cash DECIMAL(10,2) NOT NULL,
  variance DECIMAL(10,2) GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales DECIMAL(10,2) NOT NULL,
  adjustments DECIMAL(10,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) NOT NULL,
  status commission_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id),
  priority ticket_priority NOT NULL DEFAULT 'medium',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  assigned_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sell_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id)
);

CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL,
  location_id UUID NOT NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL,
  expiry_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shelf_label TEXT, -- free-text physical location tag (e.g. "Shelf A3"), set by the route owner
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  from_location_type TEXT NOT NULL,
  from_location_id UUID,
  to_location_type TEXT NOT NULL,
  to_location_id UUID,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition_json JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id),
  rule_id UUID REFERENCES alert_rules(id),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{"read"}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'inventory_purchase', -- 'inventory_purchase' | 'expense'
  expense_category TEXT, -- set when document_type = 'expense' (e.g. Fuel, Vehicle Maintenance, Equipment)
  vendor_name TEXT,
  receipt_date DATE,
  receipt_time TEXT,
  source TEXT NOT NULL DEFAULT 'upload',
  raw_text TEXT,
  filename TEXT NOT NULL,
  file_path TEXT, -- where the uploaded file actually lives on disk
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | confirmed | rejected
  total_amount NUMERIC,
  missing_prices BOOLEAN NOT NULL DEFAULT false,
  extraction_provider TEXT, -- 'glm_ocr' | 'claude_vision' | 'gemini_vision' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);

CREATE TABLE receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL DEFAULT 'product', -- product | discount | void | unknown
  product_raw TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  is_new_product BOOLEAN NOT NULL DEFAULT false,
  match_confidence TEXT NOT NULL DEFAULT 'matched', -- matched | new | needs_review
  quantity INTEGER NOT NULL,
  units_per_case INTEGER,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  expiry_date DATE,
  shelf_label TEXT, -- carried into the InventoryBatch this line creates on confirm
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_supplier_packaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  units_per_case INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, product_id, supplier_name)
);

CREATE TABLE machine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sales_date DATE NOT NULL,
  quantity_sold INTEGER NOT NULL
);

CREATE TABLE mileage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  trip_id UUID REFERENCES trips(id),
  log_date DATE NOT NULL,
  start_odometer NUMERIC,
  end_odometer NUMERIC,
  miles NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  vendor_name TEXT,
  amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  photo_path TEXT, -- optional proof photo (handwritten note, informal receipt, etc.)
  receipt_id UUID REFERENCES receipts(id), -- set when this expense came from an uploaded receipt
  trip_id UUID REFERENCES trips(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------- Indexes ----------
CREATE INDEX idx_machines_org ON machines(org_id);
CREATE INDEX idx_machines_location ON machines(location_id);
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_slots_machine ON slots(machine_id);
CREATE INDEX idx_inventory_entity ON inventory_ledger(entity_type, entity_id);
CREATE INDEX idx_route_stops_route ON route_stops(route_id);
CREATE INDEX idx_route_stops_machine ON route_stops(machine_id);
CREATE INDEX idx_route_stops_trip ON route_stops(trip_id);
CREATE INDEX idx_trips_org ON trips(org_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_restock_entries_route_stop ON restock_entries(route_stop_id);
CREATE INDEX idx_sales_org ON sales(org_id);
CREATE INDEX idx_sales_machine ON sales(machine_id);
CREATE INDEX idx_sales_occurred ON sales(occurred_at);
CREATE INDEX idx_telemetry_machine ON telemetry_events(machine_id);
CREATE INDEX idx_telemetry_occurred ON telemetry_events(occurred_at);
CREATE INDEX idx_rate_limits_key_endpoint ON api_rate_limits(api_key_id, endpoint, window_start);

-- ---------- updated_at trigger helper ----------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_machines_updated_at BEFORE UPDATE ON machines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_slots_updated_at BEFORE UPDATE ON slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_ledger_updated_at BEFORE UPDATE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_route_stops_updated_at BEFORE UPDATE ON route_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_restock_entries_updated_at BEFORE UPDATE ON restock_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_refill_orders_updated_at BEFORE UPDATE ON refill_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_commission_statements_updated_at BEFORE UPDATE ON commission_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_price_lists_updated_at BEFORE UPDATE ON price_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_price_list_items_updated_at BEFORE UPDATE ON price_list_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_batches_updated_at BEFORE UPDATE ON inventory_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

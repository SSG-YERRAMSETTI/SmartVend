-- Create enum types
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

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_size TEXT,
  cost_price DECIMAL(10,2) NOT NULL,
  sell_price DECIMAL(10,2) NOT NULL,
  barcode TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  capacity DECIMAL(10,2),
  assigned_driver_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_name TEXT,
  commission_type commission_type NOT NULL DEFAULT 'percentage',
  commission_value DECIMAL(10,2) NOT NULL,
  payout_frequency payout_frequency NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Machines table
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  serial TEXT NOT NULL UNIQUE,
  location_id UUID REFERENCES public.locations(id),
  planogram_id UUID,
  cashless_enabled BOOLEAN DEFAULT false,
  telemetry_device_id TEXT,
  status machine_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Slots table (machine inventory positions)
CREATE TABLE public.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  par_level INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL,
  current_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(machine_id, position)
);

-- Inventory Ledger table
CREATE TABLE public.inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  qty_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_doc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Routes table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  frequency route_frequency NOT NULL DEFAULT 'daily',
  start_warehouse_id UUID REFERENCES public.warehouses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Route Stops table
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  planned_date DATE NOT NULL,
  sequence INTEGER NOT NULL,
  status route_stop_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Refill Orders table
CREATE TABLE public.refill_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id UUID NOT NULL REFERENCES public.route_stops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  required_qty INTEGER NOT NULL,
  picked_qty INTEGER DEFAULT 0,
  fulfilled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Telemetry Events table
CREATE TABLE public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  event_type telemetry_event_type NOT NULL,
  payload_json JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cash Collections table
CREATE TABLE public.cash_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  route_stop_id UUID REFERENCES public.route_stops(id),
  expected_cash DECIMAL(10,2) NOT NULL,
  counted_cash DECIMAL(10,2) NOT NULL,
  variance DECIMAL(10,2) GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Commission Statements table
CREATE TABLE public.commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales DECIMAL(10,2) NOT NULL,
  adjustments DECIMAL(10,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) NOT NULL,
  status commission_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES public.machines(id),
  priority ticket_priority NOT NULL DEFAULT 'medium',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  assigned_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Price Lists table
CREATE TABLE public.price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Price List Items table
CREATE TABLE public.price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  sell_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id)
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refill_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Products
CREATE POLICY "Admins and dispatchers can manage products" ON public.products
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers and accountants can view products" ON public.products
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['driver', 'accountant']::app_role[]));

-- RLS Policies for Warehouses
CREATE POLICY "Admins and dispatchers can manage warehouses" ON public.warehouses
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view warehouses" ON public.warehouses
  FOR SELECT USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Vehicles
CREATE POLICY "Admins and dispatchers can manage vehicles" ON public.vehicles
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view their assigned vehicle" ON public.vehicles
  FOR SELECT USING (
    has_role(auth.uid(), 'driver'::app_role) AND 
    (assigned_driver_id = auth.uid() OR assigned_driver_id IS NULL)
  );

-- RLS Policies for Locations
CREATE POLICY "Admins and dispatchers can manage locations" ON public.locations
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Accountants can view locations" ON public.locations
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Location partners can view their own location" ON public.locations
  FOR SELECT USING (has_role(auth.uid(), 'location_partner'::app_role));

-- RLS Policies for Machines
CREATE POLICY "Admins and dispatchers can manage machines" ON public.machines
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers and accountants can view machines" ON public.machines
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['driver', 'accountant']::app_role[]));

-- RLS Policies for Slots
CREATE POLICY "Admins and dispatchers can manage slots" ON public.slots
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view and update slots" ON public.slots
  FOR SELECT USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers can update slot quantities" ON public.slots
  FOR UPDATE USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Inventory Ledger
CREATE POLICY "Admins and dispatchers can manage inventory" ON public.inventory_ledger
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can create inventory entries" ON public.inventory_ledger
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Accountants can view inventory" ON public.inventory_ledger
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS Policies for Routes
CREATE POLICY "Admins and dispatchers can manage routes" ON public.routes
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view routes" ON public.routes
  FOR SELECT USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Route Stops
CREATE POLICY "Admins and dispatchers can manage route stops" ON public.route_stops
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view and update route stops" ON public.route_stops
  FOR SELECT USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers can update route stop status" ON public.route_stops
  FOR UPDATE USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Refill Orders
CREATE POLICY "Admins and dispatchers can manage refill orders" ON public.refill_orders
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Drivers can view and update refill orders" ON public.refill_orders
  FOR SELECT USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers can update refill orders" ON public.refill_orders
  FOR UPDATE USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Telemetry Events
CREATE POLICY "Admins and dispatchers can view telemetry" ON public.telemetry_events
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "System can insert telemetry events" ON public.telemetry_events
  FOR INSERT WITH CHECK (true);

-- RLS Policies for Sales
CREATE POLICY "Admins and dispatchers can view all sales" ON public.sales
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Accountants can view sales" ON public.sales
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Drivers can create sales" ON public.sales
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Cash Collections
CREATE POLICY "Admins and dispatchers can view cash collections" ON public.cash_collections
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Accountants can view cash collections" ON public.cash_collections
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Drivers can create cash collections" ON public.cash_collections
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

-- RLS Policies for Commission Statements
CREATE POLICY "Admins can manage commission statements" ON public.commission_statements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view and create statements" ON public.commission_statements
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert statements" ON public.commission_statements
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Location partners can view their statements" ON public.commission_statements
  FOR SELECT USING (
    has_role(auth.uid(), 'location_partner'::app_role) AND
    location_id IN (SELECT id FROM public.locations)
  );

-- RLS Policies for Tickets
CREATE POLICY "Anyone authenticated can view tickets" ON public.tickets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can create tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and dispatchers can manage tickets" ON public.tickets
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

CREATE POLICY "Assigned users can update their tickets" ON public.tickets
  FOR UPDATE USING (assigned_user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin', 'dispatcher']::app_role[]));

-- RLS Policies for Price Lists
CREATE POLICY "Admins can manage price lists" ON public.price_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Others can view price lists" ON public.price_lists
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for Price List Items
CREATE POLICY "Admins can manage price list items" ON public.price_list_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Others can view price list items" ON public.price_list_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_machines_location ON public.machines(location_id);
CREATE INDEX idx_machines_status ON public.machines(status);
CREATE INDEX idx_slots_machine ON public.slots(machine_id);
CREATE INDEX idx_inventory_entity ON public.inventory_ledger(entity_type, entity_id);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id);
CREATE INDEX idx_route_stops_machine ON public.route_stops(machine_id);
CREATE INDEX idx_sales_machine ON public.sales(machine_id);
CREATE INDEX idx_sales_occurred ON public.sales(occurred_at);
CREATE INDEX idx_telemetry_machine ON public.telemetry_events(machine_id);
CREATE INDEX idx_telemetry_occurred ON public.telemetry_events(occurred_at);

-- Trigger for updated_at on all tables
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON public.slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_ledger_updated_at BEFORE UPDATE ON public.inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_stops_updated_at BEFORE UPDATE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refill_orders_updated_at BEFORE UPDATE ON public.refill_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_statements_updated_at BEFORE UPDATE ON public.commission_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_list_items_updated_at BEFORE UPDATE ON public.price_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
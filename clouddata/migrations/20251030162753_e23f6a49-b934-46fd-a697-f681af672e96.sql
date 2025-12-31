-- Add reorder point and valuation fields to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS reorder_point integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS warehouse_stock integer DEFAULT 0;

-- Create inventory_batches table for expiry tracking (FIFO)
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_type text NOT NULL CHECK (location_type IN ('warehouse', 'vehicle', 'machine')),
  location_id uuid NOT NULL,
  batch_number text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL,
  expiry_date date,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON public.inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_location ON public.inventory_batches(location_type, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- Create inventory_transfers table
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  from_location_type text NOT NULL CHECK (from_location_type IN ('warehouse', 'vehicle', 'machine')),
  from_location_id uuid NOT NULL,
  to_location_type text NOT NULL CHECK (to_location_type IN ('warehouse', 'vehicle', 'machine')),
  to_location_id uuid NOT NULL,
  quantity integer NOT NULL,
  batch_id uuid REFERENCES public.inventory_batches(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text,
  transferred_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_batches
CREATE POLICY "Admins and dispatchers can manage inventory batches"
ON public.inventory_batches
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'dispatcher'::app_role]));

CREATE POLICY "Drivers can view inventory batches"
ON public.inventory_batches
FOR SELECT
USING (has_role(auth.uid(), 'driver'::app_role));

-- RLS policies for inventory_transfers
CREATE POLICY "Admins and dispatchers can manage transfers"
ON public.inventory_transfers
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'dispatcher'::app_role]));

CREATE POLICY "Drivers can view and create transfers"
ON public.inventory_transfers
FOR SELECT
USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers can create transfers"
ON public.inventory_transfers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_inventory_batches_updated_at
BEFORE UPDATE ON public.inventory_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_transfers_updated_at
BEFORE UPDATE ON public.inventory_transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
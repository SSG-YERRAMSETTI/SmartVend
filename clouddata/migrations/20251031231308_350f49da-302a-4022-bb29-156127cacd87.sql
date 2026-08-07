-- Create alert_rules table for defining alert conditions
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'door_open', 'temperature_high', 'no_sales', 'cash_box_full'
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_value NUMERIC,
  threshold_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create alerts table for triggered alerts
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Alert rules policies
CREATE POLICY "Admins and dispatchers can manage alert rules"
  ON public.alert_rules
  FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'dispatcher'::app_role]));

CREATE POLICY "All authenticated users can view alert rules"
  ON public.alert_rules
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Alerts policies
CREATE POLICY "Admins and dispatchers can manage alerts"
  ON public.alerts
  FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'dispatcher'::app_role]));

CREATE POLICY "All authenticated users can view alerts"
  ON public.alerts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers can acknowledge alerts"
  ON public.alerts
  FOR UPDATE
  USING (has_role(auth.uid(), 'driver'::app_role));

-- Add indexes
CREATE INDEX idx_alerts_machine_id ON public.alerts(machine_id);
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
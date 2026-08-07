import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTelemetryEvents(limit = 50) {
  return useQuery({
    queryKey: ["telemetry-events", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telemetry_events")
        .select(`
          *,
          machines:machine_id (
            asset_tag,
            serial,
            locations:location_id (name)
          )
        `)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

export function useSalesPerHour(hours = 24) {
  return useQuery({
    queryKey: ["sales-per-hour", hours],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const { data, error } = await supabase
        .from("sales")
        .select("occurred_at, qty, unit_price")
        .gte("occurred_at", startDate.toISOString())
        .order("occurred_at", { ascending: true });

      if (error) throw error;

      // Group by hour
      const hourlyData = new Map<string, { sales: number; revenue: number }>();
      
      data.forEach((sale) => {
        const hour = new Date(sale.occurred_at).toISOString().slice(0, 13) + ":00:00";
        const current = hourlyData.get(hour) || { sales: 0, revenue: 0 };
        hourlyData.set(hour, {
          sales: current.sales + sale.qty,
          revenue: current.revenue + (sale.qty * Number(sale.unit_price)),
        });
      });

      return Array.from(hourlyData.entries()).map(([hour, data]) => ({
        hour,
        ...data,
      }));
    },
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          *,
          machines:machine_id (asset_tag, serial, location_id),
          alert_rules:alert_rule_id (name, rule_type)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: {
      name: string;
      rule_type: string;
      enabled: boolean;
      threshold_value?: number;
      threshold_duration_minutes?: number;
    }) => {
      const { data, error } = await supabase
        .from("alert_rules")
        .insert([rule])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      toast.success("Alert rule created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create alert rule: " + error.message);
    },
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("alert_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      toast.success("Alert rule updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update alert rule: " + error.message);
    },
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      toast.success("Alert rule deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete alert rule: " + error.message);
    },
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ 
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert acknowledged");
    },
    onError: (error) => {
      toast.error("Failed to acknowledge alert: " + error.message);
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ 
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert resolved");
    },
    onError: (error) => {
      toast.error("Failed to resolve alert: " + error.message);
    },
  });
}

export function useSimulateTelemetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ machineId, eventType, payload }: {
      machineId: string;
      eventType: string;
      payload: any;
    }) => {
      const { error } = await supabase
        .from("telemetry_events")
        .insert([{
          machine_id: machineId,
          event_type: eventType as any, // Allow any event type for demo purposes
          payload_json: payload,
          occurred_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telemetry-events"] });
      toast.success("Telemetry event simulated");
    },
    onError: (error) => {
      toast.error("Failed to simulate telemetry: " + error.message);
    },
  });
}

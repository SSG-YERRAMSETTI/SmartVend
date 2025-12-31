import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfYesterday, endOfYesterday, subDays, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

export function useMachines() {
  return useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(`
          *,
          location:locations(id, name, address),
          slots(id, product_id, current_qty, par_level)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      asset_tag: string;
      serial: string;
      model: string;
      status?: "active" | "inactive" | "maintenance";
      cashless_enabled?: boolean;
      telemetry_device_id?: string | null;
      location_id?: string | null;
      newLocation?: {
        name: string;
        address: string;
        contact_name?: string;
        commission_type?: "percentage" | "fixed";
        commission_value?: number;
        payout_frequency?: "weekly" | "biweekly" | "monthly";
      };
    }) => {
      const {
        newLocation,
        location_id,
        asset_tag,
        serial,
        model,
        status = "active",
        cashless_enabled = false,
        telemetry_device_id = null,
      } = params;

      let locationId = location_id || null;

      if (newLocation) {
        const { data: location, error: locationError } = await supabase
          .from("locations")
          .insert({
            name: newLocation.name,
            address: newLocation.address,
            contact_name: newLocation.contact_name || null,
            commission_type: newLocation.commission_type || "percentage",
            commission_value: newLocation.commission_value ?? 0,
            payout_frequency: newLocation.payout_frequency || "monthly",
          })
          .select()
          .single();

        if (locationError) throw locationError;
        locationId = location?.id || null;
      }

      const { data, error } = await supabase
        .from("machines")
        .insert({
          asset_tag,
          serial,
          model,
          status,
          cashless_enabled,
          telemetry_device_id,
          location_id: locationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create machine: ${error.message}`);
    },
  });
}

export function useMachine(machineId: string) {
  return useQuery({
    queryKey: ["machine", machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(`
          *,
          location:locations(id, name, address, contact_name),
          slots(
            id,
            position,
            capacity,
            par_level,
            current_qty,
            product:products(id, name, sku, category, sell_price)
          )
        `)
        .eq("id", machineId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useMachineYesterdaySales(machineId: string) {
  return useQuery({
    queryKey: ["machine-yesterday-sales", machineId],
    queryFn: async () => {
      const yesterday = startOfYesterday();
      const yesterdayEnd = endOfYesterday();

      const { data, error } = await supabase
        .from("sales")
        .select("qty, unit_price")
        .eq("machine_id", machineId)
        .gte("occurred_at", yesterday.toISOString())
        .lte("occurred_at", yesterdayEnd.toISOString());

      if (error) throw error;

      const total = data.reduce((sum, sale) => sum + sale.qty * sale.unit_price, 0);
      return total;
    },
  });
}

export function useMachineCashBoxEstimate(machineId: string) {
  return useQuery({
    queryKey: ["machine-cash-box", machineId],
    queryFn: async () => {
      // Get the last cash collection
      const { data: lastCollection } = await supabase
        .from("cash_collections")
        .select("collected_at")
        .eq("machine_id", machineId)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startDate = lastCollection
        ? new Date(lastCollection.collected_at)
        : subDays(new Date(), 30);

      // Get cash sales since last collection
      const { data, error } = await supabase
        .from("sales")
        .select("qty, unit_price")
        .eq("machine_id", machineId)
        .eq("payment_method", "cash")
        .gte("occurred_at", startDate.toISOString());

      if (error) throw error;

      const estimate = data.reduce((sum, sale) => sum + sale.qty * sale.unit_price, 0);
      return estimate;
    },
  });
}

export function useMachineLastService(machineId: string) {
  return useQuery({
    queryKey: ["machine-last-service", machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("completed_at")
        .eq("machine_id", machineId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.completed_at ? new Date(data.completed_at) : null;
    },
  });
}

export function useMachineTelemetry(machineId: string) {
  return useQuery({
    queryKey: ["machine-telemetry", machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telemetry_events")
        .select("*")
        .eq("machine_id", machineId)
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });
}

export function useMachineSales(machineId: string, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["machine-sales", machineId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq("machine_id", machineId)
        .gte("occurred_at", startOfDay(startDate).toISOString())
        .lte("occurred_at", endOfDay(endDate).toISOString())
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useMachineTickets(machineId: string) {
  return useQuery({
    queryKey: ["machine-tickets", machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useProductSalesVelocity(machineId: string, productId: string, days: number = 7) {
  return useQuery({
    queryKey: ["product-sales-velocity", machineId, productId, days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      const { data, error } = await supabase
        .from("sales")
        .select("qty")
        .eq("machine_id", machineId)
        .eq("product_id", productId)
        .gte("occurred_at", startDate.toISOString());

      if (error) throw error;

      const totalQty = data.reduce((sum, sale) => sum + sale.qty, 0);
      const avgPerDay = totalQty / days;
      return avgPerDay;
    },
  });
}

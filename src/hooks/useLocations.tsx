import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useLocations = () => {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};

export const useLocation = (locationId: string) => {
  return useQuery({
    queryKey: ["location", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });
};

export const useLocationMachines = (locationId: string) => {
  return useQuery({
    queryKey: ["location-machines", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("location_id", locationId)
        .order("asset_tag");

      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });
};

export const useLocationSales = (locationId: string, filters?: {
  startDate?: Date;
  endDate?: Date;
}) => {
  return useQuery({
    queryKey: ["location-sales", locationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          machines!inner(location_id, asset_tag),
          products(name, sku, tax_rate)
        `)
        .eq("machines.location_id", locationId)
        .order("occurred_at", { ascending: false });

      if (filters?.startDate) {
        query = query.gte("occurred_at", filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte("occurred_at", filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });
};

export const useCommissionStatements = (locationId?: string) => {
  return useQuery({
    queryKey: ["commission-statements", locationId],
    queryFn: async () => {
      let query = supabase
        .from("commission_statements")
        .select(`
          *,
          locations(name, address, commission_type, commission_value)
        `)
        .order("period_start", { ascending: false });

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useGenerateCommissionStatement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      locationId: string;
      periodStart: Date;
      periodEnd: Date;
    }) => {
      const { locationId, periodStart, periodEnd } = params;

      // Get location details
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .select("commission_type, commission_value")
        .eq("id", locationId)
        .single();

      if (locationError) throw locationError;

      // Get sales for the period
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          unit_price,
          qty,
          products(tax_rate),
          machines!inner(location_id)
        `)
        .eq("machines.location_id", locationId)
        .gte("occurred_at", periodStart.toISOString())
        .lte("occurred_at", periodEnd.toISOString());

      if (salesError) throw salesError;

      // Calculate gross sales (including tax)
      const grossSales = sales.reduce((sum, sale: any) => {
        const subtotal = sale.unit_price * sale.qty;
        const taxRate = sale.products?.tax_rate || 0;
        const tax = subtotal * (taxRate / 100);
        return sum + subtotal + tax;
      }, 0);

      // Calculate commission
      let commissionAmount = 0;
      if (location.commission_type === "percentage") {
        commissionAmount = grossSales * (location.commission_value / 100);
      } else {
        commissionAmount = location.commission_value;
      }

      // Create statement
      const { data: statement, error: statementError } = await supabase
        .from("commission_statements")
        .insert({
          location_id: locationId,
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          gross_sales: grossSales,
          commission_amount: commissionAmount,
          adjustments: 0,
          status: "draft",
        })
        .select()
        .single();

      if (statementError) throw statementError;
      return statement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-statements"] });
      toast.success("Commission statement generated");
    },
    onError: (error: any) => {
      toast.error("Failed to generate statement: " + error.message);
    },
  });
};

export const useUpdateStatementStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      statementId: string;
      status: "draft" | "pending" | "paid";
    }) => {
      const { data, error } = await supabase
        .from("commission_statements")
        .update({ status: params.status })
        .eq("id", params.statementId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-statements"] });
      toast.success("Statement status updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update status: " + error.message);
    },
  });
};

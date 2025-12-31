import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";

interface SalesFilters {
  dateRange?: DateRange;
  machineId?: string;
  productId?: string;
  locationId?: string;
  paymentMethod?: string;
}

export const useSales = (filters?: SalesFilters) => {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          machines!inner(id, asset_tag, serial, locations(id, name)),
          products!inner(id, name, sku, category, tax_rate)
        `)
        .order("occurred_at", { ascending: false });

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }
      if (filters?.machineId) {
        query = query.eq("machine_id", filters.machineId);
      }
      if (filters?.productId) {
        query = query.eq("product_id", filters.productId);
      }
      if (filters?.paymentMethod) {
        query = query.eq("payment_method", filters.paymentMethod as any);
      }
      if (filters?.locationId) {
        query = query.eq("machines.location_id", filters.locationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useSalesPerHour = () => {
  return useQuery({
    queryKey: ["sales-per-hour"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from("sales")
        .select("occurred_at, unit_price, qty, products(tax_rate)")
        .gte("occurred_at", twentyFourHoursAgo.toISOString());

      if (error) throw error;
      return data;
    },
  });
};

export const useCashCollections = (filters?: { dateRange?: DateRange }) => {
  return useQuery({
    queryKey: ["cash-collections", filters],
    queryFn: async () => {
      let query = supabase
        .from("cash_collections")
        .select(`
          *,
          machines(asset_tag, serial, locations(name)),
          route_stops(routes(name))
        `)
        .order("collected_at", { ascending: false });

      if (filters?.dateRange?.from) {
        query = query.gte("collected_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("collected_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateCashCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      machine_id: string;
      route_stop_id?: string;
      expected_cash: number;
      counted_cash: number;
      variance: number;
      photo_urls?: string[];
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("cash_collections")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-collections"] });
      toast.success("Cash collection recorded");
    },
    onError: (error) => {
      toast.error("Failed to record cash collection: " + error.message);
    },
  });
};

export const useCashlessSettlements = (filters?: { 
  dateRange?: DateRange;
  groupBy?: "daily" | "weekly";
}) => {
  return useQuery({
    queryKey: ["cashless-settlements", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          machines(asset_tag, locations(name)),
          products(name, tax_rate)
        `)
        .eq("payment_method", "cashless")
        .order("occurred_at", { ascending: false });

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by day or week
      const grouped = data?.reduce((acc: any, sale: any) => {
        const date = new Date(sale.occurred_at);
        let key: string;

        if (filters?.groupBy === "weekly") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        } else {
          key = date.toISOString().split("T")[0];
        }

        if (!acc[key]) {
          acc[key] = {
            date: key,
            transactions: [],
            totalAmount: 0,
            totalTax: 0,
            count: 0,
          };
        }

        const subtotal = sale.unit_price * sale.qty;
        const taxRate = sale.products?.tax_rate || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        acc[key].transactions.push({ ...sale, tax, subtotal, total });
        acc[key].totalAmount += total;
        acc[key].totalTax += tax;
        acc[key].count += 1;

        return acc;
      }, {});

      return Object.values(grouped || {});
    },
  });
};

export const useTaxSummary = (filters?: { dateRange?: DateRange }) => {
  return useQuery({
    queryKey: ["tax-summary", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("unit_price, qty, products(name, tax_rate, category)")
        .order("occurred_at", { ascending: false });

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate tax per product/category
      const summary = data?.reduce((acc: any, sale: any) => {
        const subtotal = sale.unit_price * sale.qty;
        const taxRate = sale.products?.tax_rate || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        return {
          totalSales: acc.totalSales + subtotal,
          totalTax: acc.totalTax + tax,
          totalWithTax: acc.totalWithTax + total,
          transactionCount: acc.transactionCount + 1,
        };
      }, { totalSales: 0, totalTax: 0, totalWithTax: 0, transactionCount: 0 });

      return summary;
    },
  });
};

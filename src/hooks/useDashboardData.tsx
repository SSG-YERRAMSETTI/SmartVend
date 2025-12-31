import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, endOfDay } from "date-fns";

export const useTodaysSales = (dateRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: ["today-sales", dateRange],
    queryFn: async () => {
      const start = dateRange?.start || startOfDay(new Date());
      const end = dateRange?.end || endOfDay(new Date());

      const { data, error } = await supabase
        .from("sales")
        .select("payment_method, unit_price, qty")
        .gte("occurred_at", start.toISOString())
        .lte("occurred_at", end.toISOString());

      if (error) throw error;

      const cash = data
        ?.filter((s) => s.payment_method === "cash")
        .reduce((sum, s) => sum + Number(s.unit_price) * s.qty, 0) || 0;

      const cashless = data
        ?.filter((s) => s.payment_method === "cashless")
        .reduce((sum, s) => sum + Number(s.unit_price) * s.qty, 0) || 0;

      return {
        cash,
        cashless,
        total: cash + cashless,
      };
    },
  });
};

export const useLast7DaysSales = () => {
  return useQuery({
    queryKey: ["last-7-days-sales"],
    queryFn: async () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date);
        const end = endOfDay(date);

        const { data, error } = await supabase
          .from("sales")
          .select("unit_price, qty")
          .gte("occurred_at", start.toISOString())
          .lte("occurred_at", end.toISOString());

        if (error) throw error;

        const total = data?.reduce((sum, s) => sum + Number(s.unit_price) * s.qty, 0) || 0;
        days.push({ date: start, value: total });
      }
      return days;
    },
  });
};

export const useStockoutRisk = () => {
  return useQuery({
    queryKey: ["stockout-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slots")
        .select(`
          id,
          position,
          current_qty,
          par_level,
          machine:machines (
            id,
            asset_tag,
            location:locations (
              name
            )
          ),
          product:products (
            name
          )
        `);

      if (error) throw error;

      return data?.filter((slot) => slot.current_qty < slot.par_level) || [];
    },
  });
};

export const useTopProducts = (dateRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: ["top-products", dateRange],
    queryFn: async () => {
      const start = dateRange?.start || subDays(new Date(), 30);
      const end = dateRange?.end || new Date();

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(`
          product_id,
          qty,
          unit_price,
          product:products (
            id,
            name,
            cost_price
          )
        `)
        .gte("occurred_at", start.toISOString())
        .lte("occurred_at", end.toISOString());

      if (error) throw error;

      const productStats = salesData?.reduce((acc, sale) => {
        const productId = sale.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            name: sale.product?.name || "Unknown",
            units: 0,
            revenue: 0,
            cost: 0,
            margin: 0,
          };
        }
        acc[productId].units += sale.qty;
        acc[productId].revenue += Number(sale.unit_price) * sale.qty;
        acc[productId].cost += Number(sale.product?.cost_price || 0) * sale.qty;
        return acc;
      }, {} as Record<string, any>);

      const products = Object.values(productStats || {}).map((p: any) => ({
        ...p,
        margin: p.revenue - p.cost,
      }));

      return {
        byUnits: products.sort((a, b) => b.units - a.units).slice(0, 5),
        byMargin: products.sort((a, b) => b.margin - a.margin).slice(0, 5),
      };
    },
  });
};

export const useRouteEfficiency = (dateRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: ["route-efficiency", dateRange],
    queryFn: async () => {
      const start = dateRange?.start || startOfDay(new Date());
      const end = dateRange?.end || endOfDay(new Date());

      const { data, error } = await supabase
        .from("route_stops")
        .select(`
          id,
          status,
          route:routes (
            name
          )
        `)
        .gte("planned_date", start.toISOString().split("T")[0])
        .lte("planned_date", end.toISOString().split("T")[0]);

      if (error) throw error;

      const planned = data?.length || 0;
      const completed = data?.filter((s) => s.status === "completed").length || 0;

      return {
        planned,
        completed,
        efficiency: planned > 0 ? Math.round((completed / planned) * 100) : 0,
      };
    },
  });
};

export const useOpenTickets = () => {
  return useQuery({
    queryKey: ["open-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, priority, status, subject, machine:machines(asset_tag)")
        .in("status", ["open", "in_progress"]);

      if (error) throw error;

      const byPriority = {
        urgent: data?.filter((t) => t.priority === "urgent").length || 0,
        high: data?.filter((t) => t.priority === "high").length || 0,
        medium: data?.filter((t) => t.priority === "medium").length || 0,
        low: data?.filter((t) => t.priority === "low").length || 0,
      };

      return { tickets: data || [], byPriority };
    },
  });
};

export const useCashVariance = (dateRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: ["cash-variance", dateRange],
    queryFn: async () => {
      const start = dateRange?.start || subDays(new Date(), 7);
      const end = dateRange?.end || new Date();

      const { data, error } = await supabase
        .from("cash_collections")
        .select(`
          id,
          expected_cash,
          counted_cash,
          variance,
          collected_at,
          machine:machines (
            asset_tag
          )
        `)
        .gte("collected_at", start.toISOString())
        .lte("collected_at", end.toISOString())
        .order("collected_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const totalVariance = data?.reduce((sum, c) => sum + Number(c.variance), 0) || 0;
      const avgVariance = data?.length ? totalVariance / data.length : 0;

      return {
        collections: data || [],
        totalVariance,
        avgVariance,
      };
    },
  });
};

export const useCommissionsDue = () => {
  return useQuery({
    queryKey: ["commissions-due"],
    queryFn: async () => {
      const { data: statements, error } = await supabase
        .from("commission_statements")
        .select(`
          id,
          period_start,
          period_end,
          commission_amount,
          status,
          location:locations (
            id,
            name,
            payout_frequency
          )
        `)
        .in("status", ["draft", "pending"])
        .order("period_end", { ascending: true });

      if (error) throw error;

      const totalDue = statements?.reduce((sum, s) => sum + Number(s.commission_amount), 0) || 0;

      return {
        statements: statements || [],
        totalDue,
      };
    },
  });
};

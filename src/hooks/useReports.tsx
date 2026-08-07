import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

export interface ReportFilters {
  dateRange?: DateRange;
  locationId?: string;
  machineId?: string;
  productId?: string;
  routeId?: string;
  limit?: number;
}

export const useSalesByProduct = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-sales-by-product", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          product_id,
          products(name, sku, category),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }
      if (filters?.productId) {
        query = query.eq("product_id", filters.productId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by product
      const grouped = data.reduce((acc: any, sale: any) => {
        const productId = sale.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            product_name: sale.products?.name,
            sku: sale.products?.sku,
            category: sale.products?.category,
            total_units: 0,
            total_revenue: 0,
          };
        }
        acc[productId].total_units += sale.qty;
        acc[productId].total_revenue += sale.unit_price * sale.qty;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });
};

export const useSalesByMachine = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-sales-by-machine", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          machine_id,
          machines(asset_tag, model, locations(name)),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }
      if (filters?.machineId) {
        query = query.eq("machine_id", filters.machineId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const machineId = sale.machine_id;
        if (!acc[machineId]) {
          acc[machineId] = {
            machine_id: machineId,
            asset_tag: sale.machines?.asset_tag,
            model: sale.machines?.model,
            location_name: sale.machines?.locations?.name,
            total_units: 0,
            total_revenue: 0,
            transaction_count: 0,
          };
        }
        acc[machineId].total_units += sale.qty;
        acc[machineId].total_revenue += sale.unit_price * sale.qty;
        acc[machineId].transaction_count += 1;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });
};

export const useSalesByLocation = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-sales-by-location", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          machines!inner(location_id, locations(name, address)),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }
      if (filters?.locationId) {
        query = query.eq("machines.location_id", filters.locationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const locationId = sale.machines?.location_id;
        if (!acc[locationId]) {
          acc[locationId] = {
            location_id: locationId,
            location_name: sale.machines?.locations?.name,
            address: sale.machines?.locations?.address,
            total_units: 0,
            total_revenue: 0,
          };
        }
        acc[locationId].total_units += sale.qty;
        acc[locationId].total_revenue += sale.unit_price * sale.qty;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });
};

export const useMarginByProduct = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-margin-by-product", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          product_id,
          products(name, sku, cost_price, sell_price),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const productId = sale.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            product_name: sale.products?.name,
            sku: sale.products?.sku,
            cost_price: sale.products?.cost_price || 0,
            sell_price: sale.products?.sell_price || 0,
            total_units: 0,
            total_revenue: 0,
            total_cost: 0,
          };
        }
        acc[productId].total_units += sale.qty;
        acc[productId].total_revenue += sale.unit_price * sale.qty;
        acc[productId].total_cost += (sale.products?.cost_price || 0) * sale.qty;
        return acc;
      }, {});

      return Object.values(grouped).map((item: any) => ({
        ...item,
        gross_profit: item.total_revenue - item.total_cost,
        margin_percent: item.total_revenue > 0 
          ? ((item.total_revenue - item.total_cost) / item.total_revenue) * 100 
          : 0,
      }));
    },
  });
};

export const useCashVarianceReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-cash-variance", filters],
    queryFn: async () => {
      let query = supabase
        .from("cash_collections")
        .select(`
          *,
          machines(asset_tag, locations(name))
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("collected_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("collected_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        location_name: item.machines?.locations?.name,
        asset_tag: item.machines?.asset_tag,
      }));
    },
  });
};

export const useRoutePerformanceReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-route-performance", filters],
    queryFn: async () => {
      let query = supabase
        .from("route_stops")
        .select(`
          *,
          routes(name),
          machines(asset_tag, locations(name))
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("planned_date", filters.dateRange.from.toISOString().split("T")[0]);
      }
      if (filters?.dateRange?.to) {
        query = query.lte("planned_date", filters.dateRange.to.toISOString().split("T")[0]);
      }
      if (filters?.routeId) {
        query = query.eq("route_id", filters.routeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((stop: any) => {
        const planned = new Date(stop.planned_date);
        const completed = stop.completed_at ? new Date(stop.completed_at) : null;
        const serviceTime = completed 
          ? Math.round((completed.getTime() - planned.getTime()) / (1000 * 60))
          : null;

        return {
          ...stop,
          route_name: stop.routes?.name,
          location_name: stop.machines?.locations?.name,
          asset_tag: stop.machines?.asset_tag,
          service_time_minutes: serviceTime,
          on_time: serviceTime ? serviceTime <= 30 : null, // 30 min threshold
        };
      });
    },
  });
};

export const useAlertHistoryReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-alert-history", filters],
    queryFn: async () => {
      let query = supabase
        .from("alerts")
        .select(`
          *,
          machines(asset_tag, locations(name)),
          alert_rules(name)
        `)
        .order("created_at", { ascending: false });

      if (filters?.dateRange?.from) {
        query = query.gte("created_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("created_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    },
  });
};

export const useTopProductsReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-top-products", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          product_id,
          products(name, sku, category),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const productId = sale.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            product_name: sale.products?.name,
            sku: sale.products?.sku,
            category: sale.products?.category,
            total_units: 0,
            total_revenue: 0,
          };
        }
        acc[productId].total_units += sale.qty;
        acc[productId].total_revenue += sale.unit_price * sale.qty;
        return acc;
      }, {});

      const sorted = Object.values(grouped).sort((a: any, b: any) => 
        b.total_revenue - a.total_revenue
      );

      return sorted.slice(0, filters?.limit || 10);
    },
  });
};

export const useUnderperformingMachinesReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: ["report-underperforming-machines", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          machine_id,
          machines(asset_tag, model, locations(name)),
          qty,
          unit_price
        `);

      if (filters?.dateRange?.from) {
        query = query.gte("occurred_at", filters.dateRange.from.toISOString());
      }
      if (filters?.dateRange?.to) {
        query = query.lte("occurred_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const machineId = sale.machine_id;
        if (!acc[machineId]) {
          acc[machineId] = {
            machine_id: machineId,
            asset_tag: sale.machines?.asset_tag,
            model: sale.machines?.model,
            location_name: sale.machines?.locations?.name,
            total_revenue: 0,
            transaction_count: 0,
          };
        }
        acc[machineId].total_revenue += sale.unit_price * sale.qty;
        acc[machineId].transaction_count += 1;
        return acc;
      }, {});

      const sorted = Object.values(grouped).sort((a: any, b: any) => 
        a.total_revenue - b.total_revenue
      );

      return sorted.slice(0, filters?.limit || 10);
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRoutes() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          warehouse:warehouses(id, name, address),
          stops:route_stops(count)
        `)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
}

export function useRoute(routeId: string) {
  return useQuery({
    queryKey: ["route", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          warehouse:warehouses(id, name, address),
          stops:route_stops(
            *,
            machine:machines(
              *,
              location:locations(id, name, address, latitude, longitude),
              slots(id, product_id, capacity, par_level, current_qty, product:products(id, name, sku))
            )
          )
        `)
        .eq("id", routeId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!routeId,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (route: any) => {
      const { data, error } = await supabase
        .from("routes")
        .insert([route])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create route: ${error.message}`);
    },
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("routes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update route: ${error.message}`);
    },
  });
}

export function useRouteStops(routeId: string, plannedDate?: string) {
  return useQuery({
    queryKey: ["route-stops", routeId, plannedDate],
    queryFn: async () => {
      let query = supabase
        .from("route_stops")
        .select(`
          *,
          machine:machines(
            *,
            location:locations(id, name, address, latitude, longitude),
            slots(id, product_id, capacity, par_level, current_qty, product:products(id, name, sku))
          ),
          refill_orders(*)
        `)
        .eq("route_id", routeId)
        .order("sequence");
      
      if (plannedDate) {
        query = query.eq("planned_date", plannedDate);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!routeId,
  });
}

export function useCreateRouteStop() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stop: any) => {
      const { data, error } = await supabase
        .from("route_stops")
        .insert([stop])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast.success("Stop added to route");
    },
    onError: (error: any) => {
      toast.error(`Failed to add stop: ${error.message}`);
    },
  });
}

export function useUpdateRouteStop() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("route_stops")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast.success("Stop updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update stop: ${error.message}`);
    },
  });
}

export function useUpdateRouteStopsSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stops: { id: string; sequence: number }[]) => {
      const updates = stops.map(stop => 
        supabase
          .from("route_stops")
          .update({ sequence: stop.sequence })
          .eq("id", stop.id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast.success("Stop sequence updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update sequence: ${error.message}`);
    },
  });
}

export function useGenerateRefillOrders() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (routeStopId: string) => {
      // Fetch the route stop with machine slots
      const { data: stop, error: stopError } = await supabase
        .from("route_stops")
        .select(`
          *,
          machine:machines(
            slots(id, product_id, capacity, par_level, current_qty)
          )
        `)
        .eq("id", routeStopId)
        .single();
      
      if (stopError) throw stopError;
      
      // Calculate required quantities
      const refillOrders = stop.machine.slots
        .filter((slot: any) => slot.product_id) // Only slots with products
        .map((slot: any) => {
          const target = Math.min(slot.capacity, slot.par_level);
          const required = Math.max(0, target - slot.current_qty);
          return {
            route_stop_id: routeStopId,
            product_id: slot.product_id,
            required_qty: required,
            picked_qty: 0,
            fulfilled: false,
          };
        })
        .filter((order: any) => order.required_qty > 0); // Only create orders for items that need refilling
      
      if (refillOrders.length === 0) {
        throw new Error("No items need refilling for this stop");
      }
      
      const { data, error } = await supabase
        .from("refill_orders")
        .insert(refillOrders)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refill-orders"] });
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast.success("Refill orders generated");
    },
    onError: (error: any) => {
      toast.error(`Failed to generate refill orders: ${error.message}`);
    },
  });
}

export function usePickList(routeId: string, plannedDate: string) {
  return useQuery({
    queryKey: ["pick-list", routeId, plannedDate],
    queryFn: async () => {
      const { data: stops, error } = await supabase
        .from("route_stops")
        .select(`
          id,
          sequence,
          machine:machines(
            id,
            asset_tag,
            location:locations(name),
            slots(product_id, capacity, par_level, current_qty, product:products(id, name, sku))
          ),
          refill_orders(id, product_id, required_qty, picked_qty, product:products(id, name, sku))
        `)
        .eq("route_id", routeId)
        .eq("planned_date", plannedDate)
        .order("sequence");
      
      if (error) throw error;
      
      // Aggregate by product
      const productMap = new Map();
      
      stops.forEach((stop: any) => {
        stop.refill_orders?.forEach((order: any) => {
          const productId = order.product_id;
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              product_id: productId,
              product: order.product,
              total_required: 0,
              stops: [],
            });
          }
          const item = productMap.get(productId);
          item.total_required += order.required_qty;
          item.stops.push({
            stop_id: stop.id,
            sequence: stop.sequence,
            machine_tag: stop.machine.asset_tag,
            location: stop.machine.location.name,
            required_qty: order.required_qty,
          });
        });
      });
      
      return Array.from(productMap.values());
    },
    enabled: !!routeId && !!plannedDate,
  });
}

export function useCompleteRouteStop() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stopId: string) => {
      const { data, error } = await supabase
        .from("route_stops")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", stopId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast.success("Stop completed");
    },
    onError: (error: any) => {
      toast.error(`Failed to complete stop: ${error.message}`);
    },
  });
}

export function useUpdateRefillOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("refill_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refill-orders"] });
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update refill order: ${error.message}`);
    },
  });
}

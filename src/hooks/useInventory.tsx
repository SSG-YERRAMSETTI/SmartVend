import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: any) => {
      const { data, error } = await supabase
        .from("products")
        .insert([product])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });
}

export function useInventoryBatches(filters?: {
  locationId?: string;
  locationType?: string;
  productId?: string;
}) {
  return useQuery({
    queryKey: ["inventory-batches", filters],
    queryFn: async () => {
      let query = supabase
        .from("inventory_batches")
        .select(`
          *,
          product:products(id, name, sku, category)
        `)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      
      if (filters?.locationId) {
        query = query.eq("location_id", filters.locationId);
      }
      if (filters?.locationType) {
        query = query.eq("location_type", filters.locationType);
      }
      if (filters?.productId) {
        query = query.eq("product_id", filters.productId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
}

export function useExpiringProducts(daysAhead: number = 30) {
  return useQuery({
    queryKey: ["expiring-products", daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      
      const { data, error } = await supabase
        .from("inventory_batches")
        .select(`
          *,
          product:products(id, name, sku, category)
        `)
        .not("expiry_date", "is", null)
        .lte("expiry_date", futureDate.toISOString().split("T")[0])
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ["low-stock-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .gt("reorder_point", 0);
      
      if (error) throw error;
      
      // Filter on client side for low stock
      return data.filter(p => p.warehouse_stock < p.reorder_point);
    },
  });
}

export function useInventoryTransfers(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["inventory-transfers", filters],
    queryFn: async () => {
      let query = supabase
        .from("inventory_transfers")
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .order("created_at", { ascending: false });
      
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transfer: any) => {
      const { data, error } = await supabase
        .from("inventory_transfers")
        .insert([transfer])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Transfer created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });
}

export function useCompleteTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transferId: string) => {
      const { data, error } = await supabase
        .from("inventory_transfers")
        .update({ 
          status: "completed",
          transferred_at: new Date().toISOString()
        })
        .eq("id", transferId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast.success("Transfer completed successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to complete transfer: ${error.message}`);
    },
  });
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: ["inventory-valuation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("quantity, unit_cost, product:products(name, sku)")
        .gt("quantity", 0);
      
      if (error) throw error;
      
      const totalValue = data.reduce((sum, batch) => 
        sum + (batch.quantity * Number(batch.unit_cost)), 0
      );
      
      return { batches: data, totalValue };
    },
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Users Management
export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles(role)
        `);

      if (error) throw error;
      return data;
    },
  });
};

export const useInviteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      email: string;
      role: string;
      fullName: string;
    }) => {
      // In a real implementation, this would send an invite email
      // For now, we'll just create a placeholder
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(params.email);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User invited successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to invite user: " + error.message);
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      role: "admin" | "dispatcher" | "driver" | "accountant" | "location_partner";
    }) => {
      // Delete existing roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", params.userId);

      // Add new role
      const { data, error } = await supabase
        .from("user_roles")
        .insert({
          user_id: params.userId,
          role: params.role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User role updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update role: " + error.message);
    },
  });
};

// Warehouses Management
export const useCreateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      address: string;
      contact?: string;
    }) => {
      const { data, error } = await supabase
        .from("warehouses")
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse created");
    },
    onError: (error: any) => {
      toast.error("Failed to create warehouse: " + error.message);
    },
  });
};

export const useUpdateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      address: string;
      contact?: string;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("warehouses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update warehouse: " + error.message);
    },
  });
};

export const useDeleteWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete warehouse: " + error.message);
    },
  });
};

// Vehicles Management
export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      plate: string;
      capacity?: number;
      assigned_driver_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("vehicles")
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle created");
    },
    onError: (error: any) => {
      toast.error("Failed to create vehicle: " + error.message);
    },
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      plate: string;
      capacity?: number;
      assigned_driver_id?: string;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("vehicles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update vehicle: " + error.message);
    },
  });
};

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete vehicle: " + error.message);
    },
  });
};

// Price Lists Management
export const usePriceLists = () => {
  return useQuery({
    queryKey: ["price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};

export const usePriceListItems = (priceListId: string) => {
  return useQuery({
    queryKey: ["price-list-items", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select(`
          *,
          products(name, sku, cost_price)
        `)
        .eq("price_list_id", priceListId);

      if (error) throw error;
      return data;
    },
    enabled: !!priceListId,
  });
};

export const useCreatePriceList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string }) => {
      const { data, error } = await supabase
        .from("price_lists")
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success("Price list created");
    },
    onError: (error: any) => {
      toast.error("Failed to create price list: " + error.message);
    },
  });
};

export const useUpdatePriceListItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      sell_price: number;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("price_list_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items"] });
      toast.success("Price updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update price: " + error.message);
    },
  });
};

export const useAddPriceListItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      price_list_id: string;
      product_id: string;
      sell_price: number;
    }) => {
      const { data, error } = await supabase
        .from("price_list_items")
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items"] });
      toast.success("Product added to price list");
    },
    onError: (error: any) => {
      toast.error("Failed to add product: " + error.message);
    },
  });
};

// API Keys Management (Placeholder - would need a proper table)
export const useApiKeys = () => {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      // Placeholder - in real implementation would query api_keys table
      return [
        {
          id: "1",
          name: "Production API",
          key: "vms_prod_*********************",
          scopes: ["read", "write"],
          created_at: new Date().toISOString(),
          last_used: new Date().toISOString(),
        },
      ];
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ApiKey[];
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      scopes,
    }: {
      name: string;
      scopes: string[];
    }) => {
      // Generate a random API key
      const prefix = "vms";
      const env = "prod";
      const randomPart = Array.from({ length: 32 }, () =>
        Math.random().toString(36)[2]
      ).join("");
      const fullKey = `${prefix}_${env}_${randomPart}`;

      const { data, error } = await supabase
        .from("api_keys")
        .insert({
          name,
          key_prefix: `${prefix}_${env}`,
          key_hash: fullKey, // In production, hash this
          scopes,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, full_key: fullKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete API key: ${error.message}`);
    },
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      url,
      events,
    }: {
      name: string;
      url: string;
      events: string[];
    }) => {
      // Generate a random secret for webhook signing
      const secret = Array.from({ length: 32 }, () =>
        Math.random().toString(36)[2]
      ).join("");

      const { data, error } = await supabase
        .from("webhooks")
        .insert({
          name,
          url,
          events,
          secret,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, secret };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create webhook: ${error.message}`);
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { enabled?: boolean };
    }) => {
      const { error } = await supabase
        .from("webhooks")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update webhook: ${error.message}`);
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete webhook: ${error.message}`);
    },
  });
}

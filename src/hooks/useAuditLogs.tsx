import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuditLogs(tableName: string, recordId: string) {
  return useQuery({
    queryKey: ["audit-logs", tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useTableAuditLogs(tableName: string) {
  return useQuery({
    queryKey: ["audit-logs", tableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });
}

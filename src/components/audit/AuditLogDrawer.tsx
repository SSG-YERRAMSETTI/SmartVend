import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { History, User, FileText } from "lucide-react";

interface AuditLogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  recordId: string;
}

export function AuditLogDrawer({ open, onOpenChange, tableName, recordId }: AuditLogDrawerProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", tableName, recordId],
    queryFn: async () => {
      const { data: logsData, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = logsData?.map(log => log.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return logsData?.map(log => ({ ...log, profiles: null }));

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Map profiles to logs
      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      return logsData?.map(log => ({
        ...log,
        profiles: log.user_id ? profileMap.get(log.user_id) || null : null,
      }));
    },
    enabled: open,
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-success text-success-foreground";
      case "UPDATE":
        return "bg-primary text-primary-foreground";
      case "DELETE":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getChangedFields = (log: any) => {
    if (!log.old_data || !log.new_data) return null;

    const changes: { field: string; old: any; new: any }[] = [];
    const oldData = log.old_data;
    const newData = log.new_data;

    Object.keys(newData).forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]) && 
          key !== "updated_at" && key !== "updated_by") {
        changes.push({
          field: key,
          old: oldData[key],
          new: newData[key],
        });
      }
    });

    return changes.length > 0 ? changes : null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Log
          </SheetTitle>
          <SheetDescription>
            Change history for this {tableName.replace(/_/g, " ")} record
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading history...
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => {
                const changes = getChangedFields(log);
                return (
                  <div key={log.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "PPp")}
                        </span>
                      </div>
                    </div>

                    {log.profiles && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {log.profiles.full_name || log.profiles.email}
                        </span>
                      </div>
                    )}

                    {changes && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="h-3 w-3" />
                          Changes:
                        </div>
                        <div className="space-y-2 text-sm">
                          {changes.map((change, idx) => (
                            <div key={idx} className="bg-muted rounded p-2">
                              <div className="font-medium">{change.field}</div>
                              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Old: </span>
                                  <span className="line-through text-destructive">
                                    {typeof change.old === "object" 
                                      ? JSON.stringify(change.old) 
                                      : String(change.old)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">New: </span>
                                  <span className="text-success">
                                    {typeof change.new === "object" 
                                      ? JSON.stringify(change.new) 
                                      : String(change.new)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mb-2 opacity-50" />
              <p>No audit history available</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

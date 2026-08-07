import { useAlerts, useAcknowledgeAlert, useResolveAlert } from "@/hooks/useTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export function NotificationCenter() {
  const { data: alerts, isLoading } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const navigate = useNavigate();

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "outline",
      high: "default",
      critical: "destructive",
    };
    return colors[severity] || "outline";
  };

  const activeAlerts = alerts?.filter(a => a.status === "active") || [];
  const acknowledgedAlerts = alerts?.filter(a => a.status === "acknowledged") || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
          {activeAlerts.length > 0 && (
            <Badge variant="destructive">{activeAlerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[500px] overflow-auto">
          {activeAlerts.length === 0 && acknowledgedAlerts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No alerts</p>
          )}

          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 border rounded-lg space-y-2 bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(alert.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm text-muted-foreground">
                    Machine: {alert.machines?.asset_tag || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => acknowledge.mutate(alert.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolve.mutate(alert.id)}
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
                {alert.machine_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/app/machines/${alert.machine_id}`)}
                  >
                    View Machine
                  </Button>
                )}
              </div>
            </div>
          ))}

          {acknowledgedAlerts.length > 0 && (
            <>
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Acknowledged</h4>
              </div>
              {acknowledgedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border rounded-lg bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">{alert.severity}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), "MMM d, HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolve.mutate(alert.id)}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

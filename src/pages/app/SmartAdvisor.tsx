// frontend/src/pages/app/SmartAdvisor.tsx
import { useMemo } from "react";
import { useRestockRecommendations } from "@/hooks/useRestockRecommendations";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SmartAdvisorPage() {
  const { data, loading, error } = useRestockRecommendations();

  // group by machine_id for nicer display
  const grouped = useMemo(() => {
    const byMachine: Record<string, typeof data> = {};
    for (const rec of data) {
      if (!byMachine[rec.machine_id]) {
        byMachine[rec.machine_id] = [];
      }
      byMachine[rec.machine_id].push(rec);
    }
    return byMachine;
  }, [data]);

  const machineIds = Object.keys(grouped);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Restock Advisor</h1>
        <p className="text-sm text-muted-foreground">
          AI-style suggestions based on recent sales, predicted demand, and current stock.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading recommendations…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">Error: {error}</p>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recommendations yet. Try adding machine inventory and some sales data.
        </p>
      )}

      {!loading && !error && machineIds.map((machineId) => (
        <Card key={machineId} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Machine</p>
              <p className="text-sm text-muted-foreground">{machineId}</p>
              {/* Later we can show machine name instead of ID if backend returns it */}
            </div>
            <Badge variant="outline">
              {grouped[machineId].length} product{grouped[machineId].length > 1 ? "s" : ""} need attention
            </Badge>
          </div>

          <div className="border-t pt-3 space-y-2">
            {grouped[machineId].map((rec) => {
              const severity =
                rec.recommended_restock >= 20
                  ? "high"
                  : rec.recommended_restock >= 10
                  ? "medium"
                  : "low";

              return (
                <div
                  key={rec.product_id}
                  className="flex flex-col gap-1 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{rec.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Current stock: {rec.current_stock} &nbsp;•&nbsp; Predicted need (3 days):{" "}
                        {rec.predicted_need.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Recommended restock</p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          severity === "high" && "text-red-500",
                          severity === "medium" && "text-yellow-500",
                          severity === "low" && "text-green-500"
                        )}
                      >
                        +{rec.recommended_restock}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rec.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

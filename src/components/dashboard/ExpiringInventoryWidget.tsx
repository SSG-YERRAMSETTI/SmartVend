import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { useExpiringProducts } from "@/hooks/useInventory";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";

export function ExpiringInventoryWidget() {
  const { data: expiringProducts, isLoading } = useExpiringProducts(30);

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft < 7) return "bg-destructive/10 text-destructive border-destructive/20";
    if (daysLeft < 14) return "bg-warning/10 text-warning border-warning/20";
    return "bg-muted text-muted-foreground";
  };

  const getUrgencyText = (daysLeft: number) => {
    if (daysLeft < 0) return "EXPIRED";
    if (daysLeft === 0) return "TODAY";
    if (daysLeft === 1) return "TOMORROW";
    return `${daysLeft} DAYS`;
  };

  const criticalCount = expiringProducts?.filter(
    (batch: any) => differenceInDays(new Date(batch.expiry_date), new Date()) < 7
  ).length || 0;

  const warningCount = expiringProducts?.filter(
    (batch: any) => {
      const days = differenceInDays(new Date(batch.expiry_date), new Date());
      return days >= 7 && days < 14;
    }
  ).length || 0;

  return (
    <DashboardWidget
      title="Expiring Inventory"
      icon={<AlertTriangle className="h-5 w-5 text-warning" />}
      linkTo="/app/inventory"
      onExport={() =>
        expiringProducts &&
        exportToCSV(
          expiringProducts.map((batch: any) => ({
            batch_number: batch.batch_number,
            product: batch.product?.name,
            location: batch.location_type === "warehouse" 
              ? "Warehouse" 
              : batch.location_type === "vehicle" 
              ? `Vehicle ${batch.location_id}` 
              : "Unknown",
            quantity: batch.quantity,
            expiry_date: batch.expiry_date,
            days_left: differenceInDays(new Date(batch.expiry_date), new Date()),
          })),
          "expiring_inventory"
        )
      }
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Summary Counts */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">{criticalCount} Critical</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warning/10 text-warning">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-semibold">{warningCount} Warning</span>
          </div>
        </div>

        {/* Expiring Items List */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto">
          {expiringProducts && expiringProducts.length > 0 ? (
            expiringProducts.slice(0, 8).map((batch: any) => {
              const daysLeft = differenceInDays(new Date(batch.expiry_date), new Date());
              
              return (
                <div
                  key={batch.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${getUrgencyColor(daysLeft)}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {batch.product?.name || "Unknown Product"}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5">
                      Batch: {batch.batch_number} • Qty: {batch.quantity}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      Expires: {format(new Date(batch.expiry_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge 
                      variant="outline" 
                      className={`font-bold ${getUrgencyColor(daysLeft)} border`}
                    >
                      {getUrgencyText(daysLeft)}
                    </Badge>
                    {daysLeft < 7 && (
                      <span className="text-xs font-medium opacity-90">
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : "Action needed"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No expiring inventory</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                All products have sufficient shelf life
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardWidget>
  );
}

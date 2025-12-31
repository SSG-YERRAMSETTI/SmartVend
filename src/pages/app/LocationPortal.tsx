import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationDetails } from "@/components/commissions/LocationDetails";
import { CommissionStatementsTable } from "@/components/commissions/CommissionStatementsTable";
import { useLocations, useLocationMachines, useLocationSales, useCommissionStatements } from "@/hooks/useLocations";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/csvExport";

export default function LocationPortal() {
  const { data: allLocations, isLoading: locationsLoading } = useLocations();
  const [locationId, setLocationId] = useState<string>("");

  // Get the location for the current user (assuming they're a location partner)
  useEffect(() => {
    if (allLocations && allLocations.length > 0) {
      setLocationId(allLocations[0].id);
    }
  }, [allLocations]);

  const { data: location } = useLocations();
  const { data: machines } = useLocationMachines(locationId);
  const { data: sales } = useLocationSales(locationId);
  const { data: statements } = useCommissionStatements(locationId);

  // Calculate metrics
  const totalSales = sales?.reduce((sum: number, sale: any) => {
    const subtotal = sale.unit_price * sale.qty;
    const taxRate = sale.products?.tax_rate || 0;
    const tax = subtotal * (taxRate / 100);
    return sum + subtotal + tax;
  }, 0) || 0;

  const activeMachines = machines?.filter((m: any) => m.status === "active").length || 0;

  const pendingStatements = statements?.filter((s: any) => s.status !== "paid").length || 0;

  if (locationsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!locationId || !location?.[0]) {
    return (
      <Alert>
        <AlertDescription>
          No location assigned to your account. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  const currentLocation = location[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Location Portal</h1>
        <p className="text-muted-foreground">View your location's performance and statements</p>
      </div>

      {/* Metrics */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Machines</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMachines}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {machines?.length || 0} total machines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Statements</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingStatements}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Location Details */}
      <LocationDetails location={currentLocation} />

      {/* Commission Statements */}
      {statements && statements.length > 0 ? (
        <CommissionStatementsTable statements={statements} showLocation={false} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No commission statements yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

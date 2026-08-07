import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Route as RouteIcon } from "lucide-react";
import { useRoutesList, useOrgUsers, useTrips } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

export default function RoutesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: routes, isLoading } = useRoutesList();
  const { data: users } = useOrgUsers({ enabled: canManage });
  const { data: trips } = useTrips();

  const driverName = (id?: string | null) => {
    const u = users?.find((x) => x.id === id);
    return u ? u.full_name || u.email : "—";
  };
  const tripForRoute = (routeId: string) => trips?.find((t) => t.route_id === routeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Routes</h1>
        <p className="text-muted-foreground">
          Routes are created automatically whenever a trip is assigned to a driver.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading routes...</p>
      ) : routes && routes.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Frequency</TableHead>
                  {canManage && <TableHead>Driver</TableHead>}
                  <TableHead>Trip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => {
                  const trip = tripForRoute(r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{r.frequency}</Badge></TableCell>
                      {canManage && <TableCell>{driverName(r.assigned_driver_id)}</TableCell>}
                      <TableCell>
                        {trip ? (
                          <Link to={`/app/trips/${trip.id}`} className="text-primary hover:underline">
                            View trip
                          </Link>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <RouteIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No routes yet — assign a trip to create one.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

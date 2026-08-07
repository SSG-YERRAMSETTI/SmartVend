import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Truck } from "lucide-react";
import {
  useTrips, useCreateTrip, useMachines, useOrgUsers, useLocations,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

const statusVariant = (s: string) =>
  s === "completed" ? "default" : s === "in_progress" ? "secondary" : "outline";

export default function Trips() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");

  const { data: trips, isLoading } = useTrips();
  const { data: machines } = useMachines();
  const { data: locations } = useLocations();
  const { data: users } = useOrgUsers({ enabled: canManage });
  const createTrip = useCreateTrip();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  const drivers = users?.filter((u) => u.role === "driver" && u.is_active) ?? [];
  const driverName = (id: string) => {
    const d = users?.find((u) => u.id === id);
    return d ? d.full_name || d.email : id.slice(0, 8);
  };
  const locationName = (id?: string | null) =>
    locations?.find((l) => l.id === id)?.name ?? "Unassigned";

  const toggleMachine = (id: string) =>
    setSelectedMachines((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  const handleCreate = () => {
    createTrip.mutate(
      { driver_id: driverId, trip_date: tripDate, machine_ids: selectedMachines },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedMachines([]);
          setDriverId("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trips</h1>
          <p className="text-muted-foreground">
            {canManage ? "Assign restocking trips to drivers" : "Your assigned restocking trips"}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Trip
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading trips...</p>
      ) : trips && trips.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {canManage && <TableHead>Driver</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.trip_date}</TableCell>
                    {canManage && <TableCell>{driverName(t.driver_id)}</TableCell>}
                    <TableCell>
                      <Badge variant={statusVariant(t.status)}>{t.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.completed_at ? new Date(t.completed_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" asChild>
                        <Link to={`/app/trips/${t.id}`}>
                          {t.status === "completed" ? "View Results" : "Enter Trip Results"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {canManage ? "No trips assigned yet." : "You have no trips assigned."}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Trip</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Driver *</Label>
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.full_name || d.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {drivers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No drivers yet — create one under Team.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Trip Date *</Label>
                <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Machines to visit ({selectedMachines.length} selected)</Label>
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {machines?.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMachines.includes(m.id)}
                      onCheckedChange={() => toggleMachine(m.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.name || m.asset_tag}</p>
                      <p className="text-xs text-muted-foreground">{locationName(m.location_id)}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Stops are ordered as selected. The driver sees them grouped by location.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!driverId || selectedMachines.length === 0 || createTrip.isPending}
            >
              Assign Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

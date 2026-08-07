import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, MapPin, CheckCircle2, ChevronRight } from "lucide-react";
import {
  useTripDetail, useSubmitRestock, useCompleteTrip, useProducts, MachineVisit,
} from "@/hooks/useApi";

interface CoilRow {
  slot_id: string;
  position: string;
  product_id: string;
  product_name?: string | null;
  price: string;
  capacity: number;
  par_level: number;
  qty_before: number;
  current_count: string;
  filled_qty: string;
  last_filled_qty?: number | null;
}

export default function TripDetail() {
  const { id: tripId } = useParams<{ id: string }>();
  const { data, isLoading } = useTripDetail(tripId);
  const { data: products } = useProducts();
  const submitRestock = useSubmitRestock();
  const completeTrip = useCompleteTrip();

  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [rows, setRows] = useState<CoilRow[]>([]);

  // Flatten every machine visit across all locations, preserving order
  const allVisits: Array<{ locationName: string; visit: MachineVisit }> =
    data?.locations.flatMap((loc) =>
      loc.machines.map((visit) => ({ locationName: loc.location_name, visit }))
    ) ?? [];

  const activeEntry = allVisits.find((v) => v.visit.route_stop_id === activeStopId);
  const activeVisit = activeEntry?.visit;

  // Load the active machine's coils into editable rows
  useEffect(() => {
    if (!activeVisit) {
      setRows([]);
      return;
    }
    setRows(
      activeVisit.coils.map((c) => ({
        slot_id: c.slot_id,
        position: c.position,
        product_id: c.product_id ?? "",
        product_name: c.product_name,
        price: c.price != null ? String(c.price) : "",
        capacity: c.capacity,
        par_level: c.par_level,
        qty_before: c.current_qty_before_trip,
        current_count: c.current_count != null ? String(c.current_count) : "",
        filled_qty: c.filled_qty != null ? String(c.filled_qty) : "",
        last_filled_qty: c.last_filled_qty,
      }))
    );
  }, [activeVisit]);

  const setRow = (slotId: string, patch: Partial<CoilRow>) =>
    setRows((prev) => prev.map((r) => (r.slot_id === slotId ? { ...r, ...patch } : r)));

  const handleSubmit = () => {
    if (!activeStopId) return;
    submitRestock.mutate(
      {
        routeStopId: activeStopId,
        entries: rows.map((r) => ({
          slot_id: r.slot_id,
          current_count: r.current_count === "" ? null : Number(r.current_count),
          filled_qty: r.filled_qty === "" ? 0 : Number(r.filled_qty),
          product_id: r.product_id || null,
          price_override: r.price === "" ? null : Number(r.price),
        })),
        markCompleted: true,
      },
      { onSuccess: () => setActiveStopId(null) }
    );
  };

  if (isLoading) return <p className="text-muted-foreground">Loading trip...</p>;
  if (!data) return <p className="text-muted-foreground">Trip not found.</p>;

  const totalStops = allVisits.length;
  const doneStops = allVisits.filter((v) => v.visit.status === "completed").length;
  const allDone = totalStops > 0 && doneStops === totalStops;

  // ---------- Machine coil entry view ----------
  if (activeVisit) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setActiveStopId(null)} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to trip
          </Button>
          <h1 className="text-2xl font-bold">
            {activeVisit.machine_name || activeVisit.asset_tag}
          </h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {activeEntry?.locationName}
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Coil</TableHead>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  <TableHead className="w-28">Price</TableHead>
                  <TableHead className="w-24 text-right">Last Filled</TableHead>
                  <TableHead className="w-28">Current Count</TableHead>
                  <TableHead className="w-28">Filled</TableHead>
                  <TableHead className="w-20 text-right">Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.slot_id}>
                    <TableCell className="font-mono font-medium">{r.position}</TableCell>
                    <TableCell>
                      <Select
                        value={r.product_id}
                        onValueChange={(v) => setRow(r.slot_id, { product_id: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="— empty —" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-9"
                        type="number"
                        step="0.01"
                        value={r.price}
                        onChange={(e) => setRow(r.slot_id, { price: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.last_filled_qty ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-9"
                        type="number"
                        placeholder={String(r.qty_before)}
                        value={r.current_count}
                        onChange={(e) => setRow(r.slot_id, { current_count: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-9"
                        type="number"
                        value={r.filled_qty}
                        onChange={(e) => setRow(r.slot_id, { filled_qty: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.capacity}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      This machine has no coils configured yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setActiveStopId(null)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rows.length === 0 || submitRestock.isPending}>
            {submitRestock.isPending ? "Saving..." : "Save & Complete Machine"}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Trip overview: locations -> machines ----------
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/app/trips"><ArrowLeft className="h-4 w-4 mr-1" /> Trips</Link>
          </Button>
          <h1 className="text-3xl font-bold">Trip — {data.trip.trip_date}</h1>
          <p className="text-muted-foreground">
            {doneStops} of {totalStops} machines completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={data.trip.status === "completed" ? "default" : "secondary"}>
            {data.trip.status.replace("_", " ")}
          </Badge>
          {data.trip.status !== "completed" && (
            <Button
              onClick={() => completeTrip.mutate(data.trip.id)}
              disabled={!allDone || completeTrip.isPending}
              title={allDone ? "" : "Submit every machine first"}
            >
              Complete Trip
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {data.locations.map((loc) => (
          <Card key={loc.location_id ?? loc.location_name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {loc.location_name}
                <span className="text-sm font-normal text-muted-foreground">
                  ({loc.machines.length} machine{loc.machines.length === 1 ? "" : "s"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loc.machines.map((m) => {
                const done = m.status === "completed";
                return (
                  <button
                    key={m.route_stop_id}
                    onClick={() => setActiveStopId(m.route_stop_id)}
                    className="w-full flex items-center justify-between rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <div>
                        <p className="font-medium">{m.machine_name || m.asset_tag}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.coils.length} coil{m.coils.length === 1 ? "" : "s"}
                          {done ? " — submitted" : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Gauge } from "lucide-react";
import { useMileageLogs, useCreateMileageLog, useDeleteMileageLog, useTrips } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

export default function MileageLog() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: logs, isLoading } = useMileageLogs();
  const { data: trips } = useTrips();
  const createLog = useCreateMileageLog();
  const deleteLog = useDeleteMileageLog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().split("T")[0],
    start_odometer: "", end_odometer: "", miles: "", notes: "", trip_id: "",
  });

  const totalMiles = logs?.reduce((sum, l) => sum + Number(l.miles), 0) ?? 0;

  const submit = () => {
    const start = form.start_odometer === "" ? undefined : Number(form.start_odometer);
    const end = form.end_odometer === "" ? undefined : Number(form.end_odometer);
    const miles = form.miles === "" && start != null && end != null ? end - start : Number(form.miles || 0);
    createLog.mutate(
      {
        log_date: form.log_date,
        start_odometer: start,
        end_odometer: end,
        miles,
        notes: form.notes || undefined,
        trip_id: form.trip_id || undefined,
      },
      { onSuccess: () => { setDialogOpen(false); setForm({ log_date: new Date().toISOString().split("T")[0], start_odometer: "", end_odometer: "", miles: "", notes: "", trip_id: "" }); } }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mileage Log</h1>
          <p className="text-muted-foreground">{logs ? `${totalMiles.toFixed(1)} total miles logged` : "Track driving distance per trip"}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Log Mileage</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs && logs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Start</TableHead>
                  <TableHead className="text-right">End</TableHead>
                  <TableHead className="text-right">Miles</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.log_date}</TableCell>
                    <TableCell className="text-right">{l.start_odometer ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.end_odometer ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{Number(l.miles).toFixed(1)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.notes || "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteLog.mutate(l.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Gauge className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No mileage logged yet.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Mileage</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Trip (optional)</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.trip_id}
                  onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
                >
                  <option value="">None</option>
                  {trips?.map((t) => <option key={t.id} value={t.id}>{t.trip_date}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Odometer</Label>
                <Input type="number" value={form.start_odometer} onChange={(e) => setForm({ ...form, start_odometer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Odometer</Label>
                <Input type="number" value={form.end_odometer} onChange={(e) => setForm({ ...form, end_odometer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Miles</Label>
                <Input type="number" value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })}
                  placeholder="auto if start/end set" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createLog.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

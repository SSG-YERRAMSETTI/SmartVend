import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Settings2 } from "lucide-react";
import {
  useMachines, useCreateMachine, useUpdateMachine, useLocations, Machine,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = {
  name: "",
  asset_tag: "",
  model: "",
  serial: "",
  location_id: "",
  column_count: "",
  telemetry_device_id: "",
  status: "active",
  cashless_enabled: false,
};

export default function Machines() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: machines, isLoading } = useMachines();
  const { data: locations } = useLocations();
  const createMachine = useCreateMachine();
  const updateMachine = useUpdateMachine();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState(emptyForm);

  const locationName = (id?: string | null) =>
    locations?.find((l) => l.id === id)?.name ?? "—";

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: Machine) => {
    setEditing(m);
    setForm({
      name: m.name ?? "",
      asset_tag: m.asset_tag,
      model: m.model,
      serial: m.serial,
      location_id: m.location_id ?? "",
      column_count: m.column_count?.toString() ?? "",
      telemetry_device_id: m.telemetry_device_id ?? "",
      status: m.status,
      cashless_enabled: m.cashless_enabled,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name || null,
      asset_tag: form.asset_tag,
      model: form.model || "Unknown",
      serial: form.serial || form.asset_tag,
      location_id: form.location_id || null,
      column_count: form.column_count === "" ? null : Number(form.column_count),
      telemetry_device_id: form.telemetry_device_id || null,
      status: form.status,
      cashless_enabled: form.cashless_enabled,
    };
    if (editing) {
      updateMachine.mutate({ id: editing.id, ...body }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMachine.mutate(body, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Machines</h1>
          <p className="text-muted-foreground">
            {machines ? `${machines.length} machines` : "Manage your vending machines"}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Machine
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading machines...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Columns</TableHead>
                  <TableHead>Telemetry ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <Link to={`/app/machines/${m.id}`} className="hover:underline">
                        {m.name || m.asset_tag}
                      </Link>
                    </TableCell>
                    <TableCell>{locationName(m.location_id)}</TableCell>
                    <TableCell className="text-right">{m.column_count ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {m.telemetry_device_id || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/app/machines/${m.id}`}>
                            <Settings2 className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {machines?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No machines yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Machine" : "Add Machine"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Carroll HS - Gym Hall Snack" />
            </div>
            <div className="space-y-2">
              <Label>Asset Tag *</Label>
              <Input value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Serial</Label>
              <Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Columns (coils)</Label>
              <Input type="number" value={form.column_count}
                onChange={(e) => setForm({ ...form, column_count: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Telemetry Device ID</Label>
              <Input value={form.telemetry_device_id}
                onChange={(e) => setForm({ ...form, telemetry_device_id: e.target.value })}
                placeholder="e.g. VK200067010" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.asset_tag || createMachine.isPending || updateMachine.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

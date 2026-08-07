import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil } from "lucide-react";
import {
  useLocations, useCreateLocation, useUpdateLocation, useMachines, Location,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = {
  name: "",
  address: "",
  city: "",
  zip: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  working_hours: "",
  commission_type: "percentage",
  commission_value: "0",
  payout_frequency: "monthly",
};

export default function Locations() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: locations, isLoading } = useLocations();
  const { data: machines } = useMachines();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);

  const machineCount = (locationId: string) =>
    machines?.filter((m) => m.location_id === locationId).length ?? 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (l: Location) => {
    setEditing(l);
    setForm({
      name: l.name,
      address: l.address,
      city: l.city ?? "",
      zip: l.zip ?? "",
      contact_name: l.contact_name ?? "",
      contact_phone: l.contact_phone ?? "",
      contact_email: l.contact_email ?? "",
      working_hours: l.working_hours ?? "",
      commission_type: l.commission_type,
      commission_value: l.commission_value?.toString() ?? "0",
      payout_frequency: l.payout_frequency,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name,
      address: form.address,
      city: form.city || null,
      zip: form.zip || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      working_hours: form.working_hours || null,
      commission_type: form.commission_type,
      commission_value: Number(form.commission_value || 0),
      payout_frequency: form.payout_frequency,
    };
    if (editing) {
      updateLocation.mutate({ id: editing.id, ...body }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createLocation.mutate(body, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Locations</h1>
          <p className="text-muted-foreground">
            {locations ? `${locations.length} locations` : "Manage your locations"}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading locations...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead className="text-right">Machines</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <Link to={`/app/locations/${l.id}`} className="hover:underline">
                        {l.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{l.address}</TableCell>
                    <TableCell>{l.city || "—"}</TableCell>
                    <TableCell>{l.zip || "—"}</TableCell>
                    <TableCell className="text-right">{machineCount(l.id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.working_hours || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.commission_type === "percentage"
                        ? `${Number(l.commission_value)}%`
                        : `$${Number(l.commission_value).toFixed(2)}`}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {locations?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 8 : 7} className="text-center py-10 text-muted-foreground">
                      No locations yet.
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
            <DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Address *</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Working Hours</Label>
              <Input value={form.working_hours}
                onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
                placeholder="e.g. 8AM - 5PM" />
            </div>
            <div className="space-y-2">
              <Label>Commission Type</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commission Value</Label>
              <Input type="number" step="0.01" value={form.commission_value}
                onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Payout Frequency</Label>
              <Select value={form.payout_frequency} onValueChange={(v) => setForm({ ...form, payout_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}
              disabled={!form.name || !form.address || createLocation.isPending || updateLocation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

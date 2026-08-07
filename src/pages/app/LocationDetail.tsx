import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Pencil, X, Trash2, MapPin as MapPinIcon } from "lucide-react";
import { useLocation as useLocationHook, useUpdateLocation, useDeleteLocation, useMachines } from "@/hooks/useApi";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function LocationDetail() {
  const { id: locationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: location } = useLocationHook(locationId);
  const { data: machines } = useMachines();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean | string[]>>({});

  const startEdit = () => {
    if (!location) return;
    setForm({
      code: location.code ?? "",
      active: location.active,
      name: location.name,
      address: location.address,
      address_line2: location.address_line2 ?? "",
      city: location.city ?? "",
      state_province: location.state_province ?? "",
      zip: location.zip ?? "",
      country: location.country ?? "United States",
      contact_name: location.contact_name ?? "",
      contact_phone: location.contact_phone ?? "",
      contact_email: location.contact_email ?? "",
      working_hours: location.working_hours ?? "",
      working_days: location.working_days ?? [...DAYS],
      notes: location.notes ?? "",
      commission_type: location.commission_type,
      commission_value: location.commission_value?.toString() ?? "0",
      payout_frequency: location.payout_frequency,
    });
    setEditing(true);
  };

  const toggleDay = (day: string) => {
    const current = (form.working_days as string[]) ?? [];
    setForm({
      ...form,
      working_days: current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    });
  };

  const saveEdit = () => {
    if (!locationId) return;
    updateLocation.mutate(
      { id: locationId, ...form, commission_value: Number(form.commission_value) },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleDelete = () => {
    if (!locationId) return;
    if (!confirm(`Delete "${location?.name}"? This cannot be undone.`)) return;
    deleteLocation.mutate(locationId, { onSuccess: () => navigate("/app/locations") });
  };

  const locationMachines = machines?.filter((m) => m.location_id === locationId) ?? [];

  if (!location) return <p className="text-muted-foreground">Loading location...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/app/locations"><ArrowLeft className="h-4 w-4 mr-1" /> Locations</Link>
        </Button>
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <Badge variant={location.active ? "default" : "secondary"} className="mt-1">
          {location.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-[1fr_220px] gap-6">
        <div>
          <Tabs defaultValue="address">
            <TabsList>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="machines">Machines</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
            </TabsList>

            <TabsContent value="address" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {editing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input value={String(form.code ?? "")} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                      </div>
                      <div className="flex items-center gap-2 pt-7">
                        <Checkbox checked={!!form.active} onCheckedChange={(c) => setForm({ ...form, active: !!c })} />
                        <Label>Active</Label>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Name *</Label>
                        <Input value={String(form.name ?? "")} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 1 *</Label>
                        <Input value={String(form.address ?? "")} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 2</Label>
                        <Input value={String(form.address_line2 ?? "")} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={String(form.city ?? "")} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>State/Province</Label>
                        <Input value={String(form.state_province ?? "")} onChange={(e) => setForm({ ...form, state_province: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>ZIP</Label>
                        <Input value={String(form.zip ?? "")} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input value={String(form.country ?? "")} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Name</Label>
                        <Input value={String(form.contact_name ?? "")} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Phone</Label>
                        <Input value={String(form.contact_phone ?? "")} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Contact Email</Label>
                        <Input value={String(form.contact_email ?? "")} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Working Hours</Label>
                        <Input value={String(form.working_hours ?? "")} onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
                          placeholder="e.g. 24 hours" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={String(form.notes ?? "")} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Working Days</Label>
                        <div className="flex gap-1">
                          {DAYS.map((day) => {
                            const active = ((form.working_days as string[]) ?? []).includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                                  active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                        <Button onClick={saveEdit} disabled={updateLocation.isPending}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <Field label="Code" value={location.code} />
                      <Field label="Active" value={location.active ? "Yes" : "No"} />
                      <Field label="Address Line 1" value={location.address} span2 />
                      <Field label="Address Line 2" value={location.address_line2} span2 />
                      <Field label="City" value={location.city} />
                      <Field label="State/Province" value={location.state_province} />
                      <Field label="ZIP" value={location.zip} />
                      <Field label="Country" value={location.country} />
                      <Field label="Contact Name" value={location.contact_name} />
                      <Field label="Contact Phone" value={location.contact_phone} />
                      <Field label="Contact Email" value={location.contact_email} span2 />
                      <Field label="Working Hours" value={location.working_hours} />
                      <Field label="Notes" value={location.notes} span2 />
                      <div className="col-span-2 pt-2 border-t">
                        <dt className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Working Days</dt>
                        <div className="flex gap-1">
                          {DAYS.map((day) => {
                            const active = location.working_days?.includes(day);
                            return (
                              <span
                                key={day}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                                  active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                                }`}
                              >
                                {day}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {editing ? (
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      <div className="space-y-2">
                        <Label>Commission Type</Label>
                        <Select value={String(form.commission_type ?? "percentage")} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Commission Value</Label>
                        <Input type="number" step="0.01" value={String(form.commission_value ?? "0")}
                          onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Payout Frequency</Label>
                        <Select value={String(form.payout_frequency ?? "monthly")} onValueChange={(v) => setForm({ ...form, payout_frequency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                        <Button onClick={saveEdit} disabled={updateLocation.isPending}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm max-w-md">
                      <Field label="Commission Type" value={location.commission_type} />
                      <Field
                        label="Commission Value"
                        value={
                          location.commission_type === "percentage"
                            ? `${Number(location.commission_value)}%`
                            : `$${Number(location.commission_value).toFixed(2)}`
                        }
                      />
                      <Field label="Payout Frequency" value={location.payout_frequency} span2 />
                    </dl>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="machines" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {locationMachines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No machines at this location yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {locationMachines.map((m) => (
                        <Link
                          key={m.id}
                          to={`/app/machines/${m.id}`}
                          className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-medium">{m.name || m.asset_tag}</span>
                          <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="map" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {location.latitude && location.longitude ? (
                    <iframe
                      title="Location map"
                      className="w-full h-96 rounded-md border"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                        Number(location.longitude) - 0.01
                      }%2C${Number(location.latitude) - 0.01}%2C${Number(location.longitude) + 0.01}%2C${
                        Number(location.latitude) + 0.01
                      }&marker=${location.latitude}%2C${location.longitude}`}
                    />
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <MapPinIcon className="h-10 w-10 mx-auto mb-2" />
                      <p>No coordinates set for this location yet.</p>
                      <p className="text-sm mt-1">{location.address}, {location.city}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground mb-2 px-2">Actions</p>
          {!editing && <ActionItem icon={Pencil} label="Edit" onClick={startEdit} />}
          {editing && <ActionItem icon={X} label="Close" onClick={() => setEditing(false)} />}
          <ActionItem icon={Trash2} label="Delete Location" onClick={handleDelete} destructive />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, span2 }: { label: string; value?: string | null; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function ActionItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 text-sm px-2 py-2 rounded-md hover:bg-muted transition-colors text-left ${
        destructive ? "text-destructive" : ""
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import QRCode from "qrcode";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Pencil, X, Wrench, History, TrendingUp, Camera, Paperclip,
  Percent, QrCode, Trash2, Plus,
} from "lucide-react";
import {
  useMachine, useUpdateMachine, useDeleteMachine, useLocations,
  useMachineSlots, useCreateSlot, useUpdateSlot, useProducts,
  useMachinePhotos, useUploadMachinePhoto, useMachineAttachments, useUploadMachineAttachment,
  useTickets, useCreateTicket, useUpdateTicket, useUpdateLocation, Slot, Machine, Location,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL } from "@/config/api";

export default function MachineDetail() {
  const { id: machineId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");

  const { data: machine } = useMachine(machineId);
  const { data: locations } = useLocations();
  const updateMachine = useUpdateMachine();
  const deleteMachine = useDeleteMachine();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  const startEdit = () => {
    if (!machine) return;
    setForm({
      name: machine.name ?? "",
      external_code: machine.external_code ?? "",
      description: machine.description ?? "",
      machine_type: machine.machine_type ?? "",
      model: machine.model ?? "",
      placed_on: machine.placed_on ?? "",
      key_code: machine.key_code ?? "",
      serial: machine.serial ?? "",
      notes: machine.notes ?? "",
      track_vend_meter: machine.track_vend_meter,
      track_cash_meter: machine.track_cash_meter,
      track_credit_card_sales: machine.track_credit_card_sales,
      telemetry_device_id: machine.telemetry_device_id ?? "",
      column_map_template: machine.column_map_template ?? "",
      location_id: machine.location_id ?? "",
      status: machine.status,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!machineId) return;
    updateMachine.mutate(
      {
        id: machineId,
        ...form,
        placed_on: form.placed_on || null,
        location_id: form.location_id || null,
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleDelete = () => {
    if (!machineId) return;
    if (!confirm(`Delete "${machine?.name || machine?.asset_tag}"? This cannot be undone.`)) return;
    deleteMachine.mutate(machineId, { onSuccess: () => navigate("/app/machines") });
  };

  // ---- Actions panel state ----
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [serviceHistoryOpen, setServiceHistoryOpen] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const photoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { data: photos } = useMachinePhotos(machineId);
  const uploadPhoto = useUploadMachinePhoto(machineId!);
  const { data: attachments } = useMachineAttachments(machineId);
  const uploadAttachment = useUploadMachineAttachment(machineId!);

  const generateQr = async () => {
    const url = `${window.location.origin}/app/machines/${machineId}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
    setQrDataUrl(dataUrl);
    setQrOpen(true);
  };

  const location = locations?.find((l) => l.id === machine?.location_id);

  if (!machine) return <p className="text-muted-foreground">Loading machine...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/app/machines"><ArrowLeft className="h-4 w-4 mr-1" /> Machines</Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {machine.external_code ? `[${machine.external_code}] ` : ""}
            {machine.name || machine.asset_tag}
          </h1>
          <Badge variant={machine.status === "active" ? "default" : "secondary"} className="mt-1">
            {machine.status}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        {/* Main content */}
        <div>
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="planogram">Planogram</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-4">
              <Card>
                <CardContent className="p-6">
                  {editing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input value={String(form.external_code ?? "")} onChange={(e) => setForm({ ...form, external_code: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={String(form.machine_type ?? "")} onValueChange={(v) => setForm({ ...form, machine_type: v })}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Snack">Snack</SelectItem>
                            <SelectItem value="Beverage">Beverage</SelectItem>
                            <SelectItem value="Combo">Combo</SelectItem>
                            <SelectItem value="Food">Food</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Description</Label>
                        <Input value={String(form.description ?? "")} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Make/Model</Label>
                        <Input value={String(form.model ?? "")} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Placed On</Label>
                        <Input type="date" value={String(form.placed_on ?? "")} onChange={(e) => setForm({ ...form, placed_on: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Key</Label>
                        <Input value={String(form.key_code ?? "")} onChange={(e) => setForm({ ...form, key_code: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Serial Number</Label>
                        <Input value={String(form.serial ?? "")} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telemetry ID</Label>
                        <Input value={String(form.telemetry_device_id ?? "")} onChange={(e) => setForm({ ...form, telemetry_device_id: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Column Map Template</Label>
                        <Input value={String(form.column_map_template ?? "")} onChange={(e) => setForm({ ...form, column_map_template: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Select value={String(form.location_id ?? "")} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                          <SelectContent>
                            {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={String(form.status ?? "active")} onValueChange={(v) => setForm({ ...form, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={String(form.notes ?? "")} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                      </div>
                      <div className="col-span-2 flex flex-wrap gap-6 pt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!form.track_vend_meter} onCheckedChange={(c) => setForm({ ...form, track_vend_meter: !!c })} />
                          Track Vend Meter
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!form.track_cash_meter} onCheckedChange={(c) => setForm({ ...form, track_cash_meter: !!c })} />
                          Track Cash Meter
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!form.track_credit_card_sales} onCheckedChange={(c) => setForm({ ...form, track_credit_card_sales: !!c })} />
                          Track Credit Card Sales
                        </label>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                        <Button onClick={saveEdit} disabled={updateMachine.isPending}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <Field label="Code" value={machine.external_code} />
                      <Field label="Type" value={machine.machine_type} />
                      <Field label="Description" value={machine.description} span2 />
                      <Field label="Make/Model" value={machine.model} />
                      <Field label="Placed On" value={machine.placed_on} />
                      <Field label="Key" value={machine.key_code} />
                      <Field label="Serial Number" value={machine.serial} />
                      <Field label="Telemetry ID" value={machine.telemetry_device_id} />
                      <Field label="Column Map Template" value={machine.column_map_template} />
                      <Field label="Location" value={location?.name} />
                      <Field label="Notes" value={machine.notes} span2 />
                      <div className="col-span-2 flex flex-wrap gap-6 pt-2 border-t">
                        <CheckField label="Track Vend Meter" checked={machine.track_vend_meter} />
                        <CheckField label="Track Cash Meter" checked={machine.track_cash_meter} />
                        <CheckField label="Track Credit Card Sales" checked={machine.track_credit_card_sales} />
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>

              {/* Photo log */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Photos</h3>
                  </div>
                  {photos && photos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-3">
                      {photos.map((p) => (
                        <div key={p.id} className="space-y-1">
                          <img
                            src={`${API_BASE_URL}/uploads/${p.file_path.split("uploads/")[1] ?? p.file_path}`}
                            className="rounded-md border aspect-square object-cover w-full"
                            alt="Machine"
                          />
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.taken_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No photos yet.</p>
                  )}
                </CardContent>
              </Card>

              {attachments && attachments.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-medium mb-3">Attachments</h3>
                    <ul className="space-y-1 text-sm">
                      {attachments.map((a) => (
                        <li key={a.id}>
                          <a
                            href={`${API_BASE_URL}/uploads/${a.file_path.split("uploads/")[1] ?? a.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {a.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="planogram" className="mt-4">
              <PlanogramTab machineId={machineId!} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions panel */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground mb-2 px-2">Actions</p>
          {canManage && !editing && (
            <ActionItem icon={Pencil} label="Edit" onClick={startEdit} />
          )}
          {editing && (
            <ActionItem icon={X} label="Close" onClick={() => setEditing(false)} />
          )}
          {canManage && (
            <>
              <ActionItem icon={Wrench} label="Maintenance" onClick={() => setMaintenanceOpen(true)} />
              <ActionItem icon={History} label="Service History" onClick={() => setServiceHistoryOpen(true)} />
              <ActionItem icon={TrendingUp} label="Predictions" onClick={() => setPredictionsOpen(true)} />
              <ActionItem icon={Camera} label="Upload Photo" onClick={() => photoInputRef.current?.click()} />
              <ActionItem icon={Paperclip} label="Add Attachment" onClick={() => attachmentInputRef.current?.click()} />
              <ActionItem icon={Percent} label="Commission" onClick={() => setCommissionOpen(true)} />
              <ActionItem icon={QrCode} label="Generate QRCode" onClick={generateQr} />
              <ActionItem icon={Trash2} label="Delete Machine" onClick={handleDelete} destructive />
            </>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadPhoto.mutate(e.target.files[0])}
          />
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAttachment.mutate(e.target.files[0])}
          />
        </div>
      </div>

      <MaintenanceDialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen} machineId={machineId!} />
      <ServiceHistoryDialog open={serviceHistoryOpen} onOpenChange={setServiceHistoryOpen} machineId={machineId!} />
      <PredictionsDialog open={predictionsOpen} onOpenChange={setPredictionsOpen} machine={machine} />
      {location && (
        <CommissionDialog open={commissionOpen} onOpenChange={setCommissionOpen} location={location} />
      )}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Machine QR Code</DialogTitle></DialogHeader>
          {qrDataUrl && <img src={qrDataUrl} alt="QR code" className="mx-auto" />}
          <Button asChild>
            <a href={qrDataUrl} download={`machine-${machine.asset_tag}-qr.png`}>Download</a>
          </Button>
        </DialogContent>
      </Dialog>
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

function CheckField({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} disabled />
      {label}
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

function PlanogramTab({ machineId }: { machineId: string }) {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: slots, isLoading } = useMachineSlots(machineId);
  const { data: products } = useProducts();
  const createSlot = useCreateSlot(machineId);
  const updateSlot = useUpdateSlot();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    position: "", product_id: "", price_override: "", dex_price: "",
    capacity: "10", par_level: "0", current_qty: "0",
  });

  const productName = (id?: string | null) => products?.find((p) => p.id === id)?.name ?? "— empty —";

  const openCreate = () => {
    setEditing(null);
    setForm({ position: "", product_id: "", price_override: "", dex_price: "", capacity: "10", par_level: "0", current_qty: "0" });
    setDialogOpen(true);
  };
  const openEdit = (s: Slot) => {
    setEditing(s);
    setForm({
      position: s.position,
      product_id: s.product_id ?? "",
      price_override: s.price_override?.toString() ?? "",
      dex_price: s.dex_price?.toString() ?? "",
      capacity: s.capacity.toString(),
      par_level: s.par_level.toString(),
      current_qty: s.current_qty.toString(),
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      position: form.position,
      product_id: form.product_id || null,
      price_override: form.price_override === "" ? null : Number(form.price_override),
      dex_price: form.dex_price === "" ? null : Number(form.dex_price),
      capacity: Number(form.capacity || 0),
      par_level: Number(form.par_level || 0),
      current_qty: Number(form.current_qty || 0),
    };
    if (editing) {
      updateSlot.mutate({ id: editing.id, ...body }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createSlot.mutate(body, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Coil</Button>
        </div>
      )}
      {isLoading ? (
        <p className="text-muted-foreground">Loading coils...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current Count</TableHead>
                  <TableHead className="text-right">Last Count</TableHead>
                  <TableHead className="text-right">Max Capacity</TableHead>
                  <TableHead className="text-right">Vend Price</TableHead>
                  <TableHead className="text-right">DEX Price</TableHead>
                  <TableHead className="text-right">Units Needed</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots?.map((s) => {
                  const unitsNeeded = Math.max(0, s.capacity - s.current_qty);
                  const priceMismatch =
                    s.dex_price != null && s.price_override != null && Number(s.dex_price) !== Number(s.price_override);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-medium">{s.position}</TableCell>
                      <TableCell className={s.product_id ? "" : "text-muted-foreground italic"}>
                        {productName(s.product_id)}
                      </TableCell>
                      <TableCell className="text-right">{s.current_qty}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.last_count ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.capacity}</TableCell>
                      <TableCell className="text-right">
                        {s.price_override != null ? `$${Number(s.price_override).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.dex_price != null ? (
                          <span className={priceMismatch ? "text-amber-600 font-medium" : ""}>
                            ${Number(s.dex_price).toFixed(2)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{unitsNeeded}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {slots?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground">
                      No coils configured for this machine yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? `Edit Coil ${editing.position}` : "Add Coil"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Column *</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. 110" />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vend Price</Label>
                <Input type="number" step="0.01" value={form.price_override} onChange={(e) => setForm({ ...form, price_override: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>DEX Price</Label>
                <Input type="number" step="0.01" value={form.dex_price} onChange={(e) => setForm({ ...form, dex_price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Current Qty</Label>
                <Input type="number" value={form.current_qty} onChange={(e) => setForm({ ...form, current_qty: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Par Level</Label>
                <Input type="number" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.position || createSlot.isPending || updateSlot.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaintenanceDialog({ open, onOpenChange, machineId }: { open: boolean; onOpenChange: (v: boolean) => void; machineId: string }) {
  const createTicket = useCreateTicket();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const submit = () => {
    createTicket.mutate(
      { machine_id: machineId, subject, description, priority },
      { onSuccess: () => { onOpenChange(false); setSubject(""); setDescription(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Maintenance Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Coin mechanism jammed" />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!subject || !description || createTicket.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServiceHistoryDialog({ open, onOpenChange, machineId }: { open: boolean; onOpenChange: (v: boolean) => void; machineId: string }) {
  const { data: tickets } = useTickets(machineId);
  const updateTicket = useUpdateTicket();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Service History</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {tickets && tickets.length > 0 ? tickets.map((t) => (
            <div key={t.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{t.subject}</p>
                <Badge variant={t.status === "resolved" || t.status === "closed" ? "default" : "secondary"}>
                  {t.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString()} · {t.priority}
                </span>
                {t.status !== "resolved" && t.status !== "closed" && (
                  <Button size="sm" variant="outline" onClick={() => updateTicket.mutate({ id: t.id, status: "resolved" })}>
                    Mark Resolved
                  </Button>
                )}
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No service history yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PredictionsDialog({ open, onOpenChange, machine }: { open: boolean; onOpenChange: (v: boolean) => void; machine: Machine }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Predictions</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Restock predictions for this machine are generated from recent sales velocity in the Smart Advisor.
          Check back here once vend/telemetry data starts flowing for {machine?.name || machine?.asset_tag}.
        </p>
        <DialogFooter>
          <Button asChild><Link to="/app/advisor">Open Smart Advisor</Link></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommissionDialog({ open, onOpenChange, location }: { open: boolean; onOpenChange: (v: boolean) => void; location: Location }) {
  const updateLocation = useUpdateLocation();
  const [type, setType] = useState(location.commission_type);
  const [value, setValue] = useState(location.commission_value?.toString() ?? "0");

  const save = () => {
    updateLocation.mutate(
      { id: location.id, commission_type: type, commission_value: Number(value) },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Commission — {location.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Commission is set per location, since all machines at a location share the same payout terms.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Value</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={updateLocation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

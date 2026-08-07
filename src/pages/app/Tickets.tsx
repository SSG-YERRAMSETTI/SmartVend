import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useTickets, useCreateTicket, useUpdateTicket, useMachines } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

export default function TicketsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner") || hasRole("driver");
  const { data: tickets, isLoading } = useTickets();
  const { data: machines } = useMachines();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ machine_id: "", subject: "", description: "", priority: "medium" });

  const machineName = (id?: string | null) => machines?.find((m) => m.id === id)?.name ?? null;

  const submit = () => {
    createTicket.mutate(
      { machine_id: form.machine_id || undefined, subject: form.subject, description: form.description, priority: form.priority },
      { onSuccess: () => { setDialogOpen(false); setForm({ machine_id: "", subject: "", description: "", priority: "medium" }); } }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tickets</h1>
          <p className="text-muted-foreground">Maintenance requests and issues across all machines</p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Ticket</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading tickets...</p>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    {machineName(t.machine_id) && (
                      <p className="text-xs text-muted-foreground">{machineName(t.machine_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.priority}</Badge>
                    <Badge variant={t.status === "resolved" || t.status === "closed" ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                  {t.status !== "resolved" && t.status !== "closed" && canManage && (
                    <Button size="sm" variant="outline" onClick={() => updateTicket.mutate({ id: t.id, status: "resolved" })}>
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No tickets yet.</CardContent></Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Machine (optional)</Label>
              <Select value={form.machine_id} onValueChange={(v) => setForm({ ...form, machine_id: v })}>
                <SelectTrigger><SelectValue placeholder="General / not machine-specific" /></SelectTrigger>
                <SelectContent>
                  {machines?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.asset_tag}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
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
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.subject || !form.description || createTicket.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

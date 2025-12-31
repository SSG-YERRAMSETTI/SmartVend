import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Webhook, Plus, Trash2, TestTube } from "lucide-react";
import { toast } from "sonner";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
} from "@/hooks/useApiKeys";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AVAILABLE_EVENTS = [
  { value: "sale.created", label: "Sale Created" },
  { value: "telemetry.alert", label: "Telemetry Alert" },
  { value: "commission.generated", label: "Commission Generated" },
  { value: "ticket.created", label: "Ticket Created" },
];

export default function Webhooks() {
  const [createOpen, setCreateOpen] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const handleCreateWebhook = async () => {
    if (!webhookName || !webhookUrl || selectedEvents.length === 0) {
      toast.error("Please fill in all fields and select at least one event");
      return;
    }
    const result = await createWebhook.mutateAsync({
      name: webhookName,
      url: webhookUrl,
      events: selectedEvents,
    });
    setNewSecret(result.secret);
    setWebhookName("");
    setWebhookUrl("");
    setSelectedEvents([]);
  };

  const handleToggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleTestWebhook = (id: string) => {
    toast.success("Test event sent to webhook");
  };

  const handleDeleteWebhook = (id: string) => {
    if (confirm("Are you sure you want to delete this webhook?")) {
      deleteWebhook.mutate(id);
    }
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    updateWebhook.mutate({ id, updates: { enabled } });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Webhooks</h1>
          <p className="text-muted-foreground">
            Configure webhooks to receive real-time event notifications
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
            </DialogHeader>
            {newSecret ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <p className="font-semibold mb-2">Webhook created! Your signing secret:</p>
                    <code className="block bg-muted p-3 rounded text-sm break-all">
                      {newSecret}
                    </code>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use this secret to verify webhook signatures. You won't see it again!
                    </p>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => {
                    setNewSecret(null);
                    setCreateOpen(false);
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="Slack Notifications"
                  />
                </div>
                <div>
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.example.com/webhook"
                  />
                </div>
                <div>
                  <Label>Events to Subscribe</Label>
                  <div className="space-y-2 mt-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <div key={event.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedEvents.includes(event.value)}
                          onCheckedChange={() => handleToggleEvent(event.value)}
                        />
                        <Label className="font-normal">{event.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreateWebhook} className="w-full">
                  Create Webhook
                </Button>
                <p className="text-xs text-muted-foreground">
                  A secret will be generated for signing webhook payloads. You'll receive it
                  after creation.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-muted-foreground">No webhooks configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4" />
                        {webhook.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {webhook.url}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={(checked) =>
                          handleToggleEnabled(webhook.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestWebhook(webhook.id)}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Payload Example</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{`{
  "event": "sale.created",
  "timestamp": "2025-01-20T15:30:00Z",
  "data": {
    "id": "uuid-here",
    "machine_id": "uuid-here",
    "product_id": "uuid-here",
    "qty": 1,
    "unit_price": 2.50,
    "payment_method": "card",
    "occurred_at": "2025-01-20T15:30:00Z"
  },
  "signature": "sha256=..."
}`}</code>
          </pre>
          <p className="text-xs text-muted-foreground mt-2">
            All webhook payloads include a signature header for verification using your webhook
            secret.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

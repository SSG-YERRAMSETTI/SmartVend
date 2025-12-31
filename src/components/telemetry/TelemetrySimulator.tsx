import { useState } from "react";
import { useMachines } from "@/hooks/useMachines";
import { useSimulateTelemetry } from "@/hooks/useTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Zap, Loader2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "sale", label: "Sale" },
  { value: "door_open", label: "Door Open" },
  { value: "door_close", label: "Door Close" },
  { value: "temperature", label: "Temperature Reading" },
  { value: "error", label: "Error" },
  { value: "maintenance", label: "Maintenance" },
];

export function TelemetrySimulator() {
  const [enabled, setEnabled] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [eventType, setEventType] = useState("");
  const [payload, setPayload] = useState("{}");

  const { data: machines, isLoading: loadingMachines } = useMachines();
  const simulate = useSimulateTelemetry();

  const handleSimulate = async () => {
    try {
      const parsedPayload = JSON.parse(payload);
      await simulate.mutateAsync({
        machineId,
        eventType,
        payload: parsedPayload,
      });
    } catch (error) {
      console.error("Invalid JSON payload", error);
    }
  };

  const generateRandomEvent = async () => {
    const randomMachine = machines?.[Math.floor(Math.random() * machines.length)];
    const randomEventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    
    let randomPayload = {};
    switch (randomEventType.value) {
      case "sale":
        randomPayload = { amount: (Math.random() * 5 + 1).toFixed(2), product: "Random Product" };
        break;
      case "temperature":
        randomPayload = { temperature: (Math.random() * 10 + 20).toFixed(1), unit: "C" };
        break;
      case "door_open":
      case "door_close":
        randomPayload = { door: "main", timestamp: new Date().toISOString() };
        break;
      case "error":
        randomPayload = { code: "E" + Math.floor(Math.random() * 100), message: "Simulated error" };
        break;
    }

    if (randomMachine) {
      await simulate.mutateAsync({
        machineId: randomMachine.id,
        eventType: randomEventType.value,
        payload: randomPayload,
      });
    }
  };

  if (loadingMachines) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Demo Simulator
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="simulator-toggle">Enable</Label>
            <Switch
              id="simulator-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="machine">Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {machines?.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.asset_tag} - {machine.location?.name || "No location"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payload">Payload (JSON)</Label>
            <Textarea
              id="payload"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder='{"key": "value"}'
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSimulate}
              disabled={!machineId || !eventType || simulate.isPending}
              className="flex-1"
            >
              {simulate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Event
            </Button>
            <Button
              variant="outline"
              onClick={generateRandomEvent}
              disabled={simulate.isPending}
            >
              Random Event
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

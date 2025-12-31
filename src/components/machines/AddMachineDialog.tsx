import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useCreateMachine } from "@/hooks/useMachines";
import { useLocations } from "@/hooks/useLocations";

interface AddMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddMachineDialog({ open, onOpenChange, onSuccess }: AddMachineDialogProps) {
  const [machineData, setMachineData] = useState({
    asset_tag: "",
    serial: "",
    model: "",
    status: "active",
    cashless_enabled: false,
    telemetry_device_id: "",
  });
  const [locationSelection, setLocationSelection] = useState<string>("");
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    contact_name: "",
    commission_type: "percentage",
    commission_value: 10,
    payout_frequency: "monthly",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const { data: locations } = useLocations();
  const createMachine = useCreateMachine();

  useEffect(() => {
    if (!open) {
      setErrors([]);
    }
  }, [open]);

  const resetForm = () => {
    setMachineData({
      asset_tag: "",
      serial: "",
      model: "",
      status: "active",
      cashless_enabled: false,
      telemetry_device_id: "",
    });
    setLocationSelection("");
    setNewLocation({
      name: "",
      address: "",
      contact_name: "",
      commission_type: "percentage",
      commission_value: 10,
      payout_frequency: "monthly",
    });
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors: string[] = [];

    if (!machineData.asset_tag.trim()) validationErrors.push("Asset tag is required.");
    if (!machineData.serial.trim()) validationErrors.push("Serial is required.");
    if (!machineData.model.trim()) validationErrors.push("Model is required.");

    if (locationSelection === "new") {
      if (!newLocation.name.trim()) validationErrors.push("Location name is required.");
      if (!newLocation.address.trim()) validationErrors.push("Location address is required.");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);

    try {
      await createMachine.mutateAsync({
        ...machineData,
        telemetry_device_id: machineData.telemetry_device_id || null,
        location_id:
          locationSelection && locationSelection !== "new" ? locationSelection : undefined,
        newLocation: locationSelection === "new" ? newLocation : undefined,
      });
      onSuccess?.();
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      setErrors([error.message || "Failed to create machine."]);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Machine</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {errors.map((error, idx) => (
                    <div key={idx} className="text-sm">
                      {error}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset_tag">Asset Tag *</Label>
              <Input
                id="asset_tag"
                value={machineData.asset_tag}
                onChange={(e) => setMachineData({ ...machineData, asset_tag: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number *</Label>
              <Input
                id="serial"
                value={machineData.serial}
                onChange={(e) => setMachineData({ ...machineData, serial: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={machineData.model}
                onChange={(e) => setMachineData({ ...machineData, model: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={machineData.status}
                onValueChange={(value) =>
                  setMachineData({ ...machineData, status: value as typeof machineData.status })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telemetry_device_id">Telemetry Device ID</Label>
              <Input
                id="telemetry_device_id"
                value={machineData.telemetry_device_id}
                onChange={(e) =>
                  setMachineData({ ...machineData, telemetry_device_id: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 flex items-center gap-3">
              <div className="space-y-1">
                <Label>Cashless Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enable if machine accepts cashless payments
                </p>
              </div>
              <Switch
                checked={machineData.cashless_enabled}
                onCheckedChange={(checked) =>
                  setMachineData({ ...machineData, cashless_enabled: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Location</Label>
            <Select
              value={locationSelection}
              onValueChange={(value) => setLocationSelection(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select or create a location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No location</SelectItem>
                {locations?.map((location: any) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">Create new location</SelectItem>
              </SelectContent>
            </Select>

            {locationSelection === "new" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
                <div className="space-y-2">
                  <Label htmlFor="location-name">Location Name *</Label>
                  <Input
                    id="location-name"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-address">Address *</Label>
                  <Input
                    id="location-address"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-contact">Contact Name</Label>
                  <Input
                    id="location-contact"
                    value={newLocation.contact_name}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, contact_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commission Type</Label>
                  <Select
                    value={newLocation.commission_type}
                    onValueChange={(value) =>
                      setNewLocation({
                        ...newLocation,
                        commission_type: value as typeof newLocation.commission_type,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_value">Commission Value</Label>
                  <Input
                    id="commission_value"
                    type="number"
                    step="0.01"
                    value={newLocation.commission_value}
                    onChange={(e) =>
                      setNewLocation({
                        ...newLocation,
                        commission_value: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payout Frequency</Label>
                  <Select
                    value={newLocation.payout_frequency}
                    onValueChange={(value) =>
                      setNewLocation({
                        ...newLocation,
                        payout_frequency: value as typeof newLocation.payout_frequency,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMachine.isPending}>
              {createMachine.isPending ? "Saving..." : "Save Machine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

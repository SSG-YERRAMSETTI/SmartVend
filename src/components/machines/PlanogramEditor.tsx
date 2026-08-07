import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Calculator, Package, Upload, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProductSalesVelocity } from "@/hooks/useMachines";
import { PlanogramCSVImportDialog } from "./PlanogramCSVImportDialog";
import { exportToCSV } from "@/lib/csvExport";

interface Slot {
  id: string;
  position: string;
  capacity: number;
  par_level: number;
  current_qty: number;
  product_id?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    category?: string;
    sell_price?: number;
  } | null;
}

interface PlanogramEditorProps {
  machineId: string;
  slots: Slot[];
}

export function PlanogramEditor({ machineId, slots }: PlanogramEditorProps) {
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [targetMachineId, setTargetMachineId] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["machines-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, asset_tag")
        .neq("id", machineId);
      if (error) throw error;
      return data;
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: async (slot: Partial<Slot> & { id: string }) => {
      const { error } = await supabase
        .from("slots")
        .update({
          product_id: slot.product_id,
          capacity: slot.capacity,
          par_level: slot.par_level,
          current_qty: slot.current_qty,
        })
        .eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine", machineId] });
      toast.success("Slot updated successfully");
      setEditDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update slot");
    },
  });

  const copyPlanogramMutation = useMutation({
    mutationFn: async (targetId: string) => {
      // Delete existing slots for target machine
      await supabase.from("slots").delete().eq("machine_id", targetId);

      // Copy slots from source machine
      const slotsToCreate = slots.map((slot) => ({
        machine_id: targetId,
        position: slot.position,
        capacity: slot.capacity,
        par_level: slot.par_level,
        current_qty: 0,
        product_id: slot.product?.id || slot.product_id || null,
      }));

      const { error } = await supabase.from("slots").insert(slotsToCreate);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planogram copied successfully");
      setCopyDialogOpen(false);
      setTargetMachineId("");
    },
    onError: () => {
      toast.error("Failed to copy planogram");
    },
  });

  const handleSlotClick = (slot: Slot) => {
    setSelectedSlot({
      ...slot,
      product_id: slot.product?.id || slot.product_id || null,
    });
    setEditDialogOpen(true);
  };

  const handleSaveSlot = () => {
    if (selectedSlot) {
      updateSlotMutation.mutate(selectedSlot);
    }
  };

  const handleCopyPlanogram = () => {
    if (targetMachineId) {
      copyPlanogramMutation.mutate(targetMachineId);
    }
  };

  const exportPlanogram = () => {
    const formatted = sortedSlots.map(s => ({
      position: s.position,
      product_id: s.product_id || "",
      product_name: s.product?.name || "",
      capacity: s.capacity,
      par_level: s.par_level,
      current_qty: s.current_qty,
    }));
    exportToCSV(formatted, `planogram-${machineId}`);
  };

  const sortedSlots = [...slots].sort((a, b) => a.position.localeCompare(b.position));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportPlanogram}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
        <Button onClick={() => setCopyDialogOpen(true)}>
          <Copy className="h-4 w-4 mr-2" />
          Copy to Another Machine
        </Button>
        <Button variant="outline" onClick={() => setSimulateDialogOpen(true)}>
          <Calculator className="h-4 w-4 mr-2" />
          Simulate 7-Day Depletion
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {sortedSlots.map((slot) => {
          const fillPercentage = (slot.current_qty / slot.capacity) * 100;
          const isLow = slot.current_qty < slot.par_level;

          return (
            <Card
              key={slot.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSlotClick(slot)}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="font-semibold text-sm">{slot.position}</div>
                  {slot.product && (
                    <div className="text-xs text-muted-foreground truncate" title={slot.product.name}>
                      {slot.product.name}
                    </div>
                  )}
                  {!slot.product && (
                    <div className="text-xs text-muted-foreground italic">Empty</div>
                  )}
                  <div className="text-xs font-medium">
                    {slot.current_qty}/{slot.capacity}
                  </div>
                  {isLow && (
                    <Badge variant="destructive" className="text-xs">
                      Low
                    </Badge>
                  )}
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isLow ? "bg-destructive" : "bg-success"}`}
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Slot Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Slot {selectedSlot?.position}</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select
                  value={selectedSlot.product_id || ""}
                  onValueChange={(value) =>
                    setSelectedSlot({ ...selectedSlot, product_id: value || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={selectedSlot.capacity}
                  onChange={(e) =>
                    setSelectedSlot({
                      ...selectedSlot,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Par Level</Label>
                <Input
                  type="number"
                  value={selectedSlot.par_level}
                  onChange={(e) =>
                    setSelectedSlot({
                      ...selectedSlot,
                      par_level: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Current Quantity</Label>
                <Input
                  type="number"
                  value={selectedSlot.current_qty}
                  onChange={(e) =>
                    setSelectedSlot({
                      ...selectedSlot,
                      current_qty: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlot}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Planogram Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Planogram to Another Machine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will replace all slots in the target machine with the current planogram configuration.
            </p>
            <div>
              <Label>Target Machine</Label>
              <Select value={targetMachineId} onValueChange={setTargetMachineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target machine" />
                </SelectTrigger>
                <SelectContent>
                  {machines?.map((machine) => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.asset_tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyPlanogram} disabled={!targetMachineId}>
              Copy Planogram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulate Depletion Dialog */}
      <Dialog open={simulateDialogOpen} onOpenChange={setSimulateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>7-Day Depletion Simulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Based on historical sales data from the last 7 days
            </p>
            <div className="space-y-3">
              {sortedSlots
                .filter((slot) => slot.product_id)
                .map((slot) => (
                  <SlotDepletionRow key={slot.id} slot={slot} machineId={machineId} />
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSimulateDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanogramCSVImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["machine", machineId] });
        }}
        machineId={machineId}
      />
    </div>
  );
}

function SlotDepletionRow({ slot, machineId }: { slot: Slot; machineId: string }) {
  const { data: velocity } = useProductSalesVelocity(
    machineId,
    slot.product_id!,
    7
  );

  const projectedQty = Math.max(0, slot.current_qty - Math.round((velocity || 0) * 7));
  const willStockout = projectedQty === 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium">
              {slot.position} - {slot.product?.name}
            </div>
            <div className="text-sm text-muted-foreground">
              Current: {slot.current_qty} | Velocity: {velocity?.toFixed(1) || "0"}/day
            </div>
          </div>
          <div className="text-right">
            <div className={`font-semibold ${willStockout ? "text-destructive" : ""}`}>
              Projected: {projectedQty}
            </div>
            {willStockout && (
              <Badge variant="destructive" className="mt-1">
                Will Stock Out
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

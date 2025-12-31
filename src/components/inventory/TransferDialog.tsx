import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTransfer, useProducts, useWarehouses, useVehicles } from "@/hooks/useInventory";
import { useMachines } from "@/hooks/useMachines";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
  const [formData, setFormData] = useState({
    product_id: "",
    from_location_type: "",
    from_location_id: "",
    to_location_type: "",
    to_location_id: "",
    quantity: 0,
    notes: "",
  });

  const { data: products } = useProducts();
  const { data: warehouses } = useWarehouses();
  const { data: vehicles } = useVehicles();
  const { data: machines } = useMachines();
  const createTransfer = useCreateTransfer();

  const getLocations = (type: string) => {
    if (type === "warehouse") return warehouses || [];
    if (type === "vehicle") return vehicles || [];
    if (type === "machine") return machines || [];
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTransfer.mutateAsync(formData);
    onOpenChange(false);
    setFormData({
      product_id: "",
      from_location_type: "",
      from_location_id: "",
      to_location_type: "",
      to_location_id: "",
      quantity: 0,
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Inventory Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Location Type *</Label>
                <Select
                  value={formData.from_location_type}
                  onValueChange={(value) => setFormData({ ...formData, from_location_type: value, from_location_id: "" })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="machine">Machine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Location *</Label>
                <Select
                  value={formData.from_location_id}
                  onValueChange={(value) => setFormData({ ...formData, from_location_id: value })}
                  required
                  disabled={!formData.from_location_type}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {getLocations(formData.from_location_type).map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name || location.asset_tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>To Location Type *</Label>
                <Select
                  value={formData.to_location_type}
                  onValueChange={(value) => setFormData({ ...formData, to_location_type: value, to_location_id: "" })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="machine">Machine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To Location *</Label>
                <Select
                  value={formData.to_location_id}
                  onValueChange={(value) => setFormData({ ...formData, to_location_id: value })}
                  required
                  disabled={!formData.to_location_type}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {getLocations(formData.to_location_type).map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name || location.asset_tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this transfer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Transfer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

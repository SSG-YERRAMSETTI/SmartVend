import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWarehouses } from "@/hooks/useInventory";
import { useCreateRoute, useUpdateRoute } from "@/hooks/useRoutes";

interface RouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: any;
}

export function RouteDialog({ open, onOpenChange, route }: RouteDialogProps) {
  const [name, setName] = useState(route?.name || "");
  const [frequency, setFrequency] = useState(route?.frequency || "daily");
  const [startWarehouseId, setStartWarehouseId] = useState(route?.start_warehouse_id || "");
  
  const { data: warehouses } = useWarehouses();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const routeData = {
      name,
      frequency,
      start_warehouse_id: startWarehouseId || null,
    };
    
    if (route) {
      await updateRoute.mutateAsync({ id: route.id, ...routeData });
    } else {
      await createRoute.mutateAsync(routeData);
    }
    
    onOpenChange(false);
    setName("");
    setFrequency("daily");
    setStartWarehouseId("");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{route ? "Edit Route" : "Create Route"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Route Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Downtown Route"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="warehouse">Start Warehouse (Optional)</Label>
            <Select value={startWarehouseId} onValueChange={setStartWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {warehouses?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {route ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

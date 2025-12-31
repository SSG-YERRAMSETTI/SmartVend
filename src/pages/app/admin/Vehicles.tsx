import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useVehicles } from "@/hooks/useInventory";
import {
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  useUsers,
} from "@/hooks/useAdmin";

export default function Vehicles() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    plate: "",
    capacity: "",
    assigned_driver_id: "",
  });

  const { data: vehicles, isLoading } = useVehicles();
  const { data: users } = useUsers();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const drivers = users?.filter((u) => {
    const userRole = (u.user_roles as any)?.[0]?.role;
    return userRole === "driver";
  });

  const handleSubmit = async () => {
    const payload = {
      name: formData.name,
      plate: formData.plate,
      capacity: formData.capacity ? Number(formData.capacity) : undefined,
      assigned_driver_id: formData.assigned_driver_id || undefined,
    };

    if (editingId) {
      await updateVehicle.mutateAsync({ id: editingId, ...payload });
    } else {
      await createVehicle.mutateAsync(payload);
    }
    setDialogOpen(false);
    setEditingId(null);
    setFormData({ name: "", plate: "", capacity: "", assigned_driver_id: "" });
  };

  const handleEdit = (vehicle: any) => {
    setEditingId(vehicle.id);
    setFormData({
      name: vehicle.name,
      plate: vehicle.plate,
      capacity: vehicle.capacity?.toString() || "",
      assigned_driver_id: vehicle.assigned_driver_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle?")) {
      await deleteVehicle.mutateAsync(id);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Vehicles</h1>
          <p className="text-muted-foreground">Manage fleet vehicles</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({ name: "", plate: "", capacity: "", assigned_driver_id: "" });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Add"} Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Delivery Van 1"
                />
              </div>
              <div>
                <Label htmlFor="plate">License Plate</Label>
                <Input
                  id="plate"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  placeholder="ABC-1234"
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity (kg)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div>
                <Label htmlFor="driver">Assigned Driver</Label>
                <Select
                  value={formData.assigned_driver_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigned_driver_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No driver</SelectItem>
                    {drivers?.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.full_name || driver.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update" : "Create"} Vehicle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles?.map((vehicle) => {
                const driver = users?.find((u) => u.id === vehicle.assigned_driver_id);
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{vehicle.plate}</TableCell>
                    <TableCell>{vehicle.capacity ? `${vehicle.capacity} kg` : "N/A"}</TableCell>
                    <TableCell>{driver?.full_name || driver?.email || "Unassigned"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(vehicle)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(vehicle.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

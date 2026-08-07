import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2, ArrowUpDown } from "lucide-react";
import { useMachines } from "@/hooks/useMachines";
import { useCreateRouteStop, useUpdateRouteStop, useUpdateRouteStopsSequence } from "@/hooks/useRoutes";
import { toast } from "sonner";

interface RouteStopsManagerProps {
  routeId: string;
  stops: any[];
}

export function RouteStopsManager({ routeId, stops: initialStops }: RouteStopsManagerProps) {
  const [stops, setStops] = useState(initialStops);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split("T")[0]);
  
  const { data: machines } = useMachines();
  const createStop = useCreateRouteStop();
  const updateStop = useUpdateRouteStop();
  const updateSequence = useUpdateRouteStopsSequence();
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newStops = [...stops];
    const draggedStop = newStops[draggedIndex];
    newStops.splice(draggedIndex, 1);
    newStops.splice(index, 0, draggedStop);
    
    setStops(newStops);
    setDraggedIndex(index);
  };
  
  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    
    // Update sequences in database
    const updates = stops.map((stop, index) => ({
      id: stop.id,
      sequence: index + 1,
    }));
    
    await updateSequence.mutateAsync(updates);
    setDraggedIndex(null);
  };
  
  const handleAddStop = async () => {
    if (!selectedMachineId) {
      toast.error("Please select a machine");
      return;
    }
    
    const maxSequence = stops.length > 0 ? Math.max(...stops.map(s => s.sequence)) : 0;
    
    await createStop.mutateAsync({
      route_id: routeId,
      machine_id: selectedMachineId,
      planned_date: plannedDate,
      sequence: maxSequence + 1,
      status: "pending",
    });
    
    setIsAdding(false);
    setSelectedMachineId("");
  };
  
  const handleDeleteStop = async (stopId: string) => {
    await updateStop.mutateAsync({ id: stopId, status: "cancelled" });
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Route Stops</CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Stop
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <div className="space-y-2">
              <Label>Machine</Label>
              <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select machine" />
                </SelectTrigger>
                <SelectContent>
                  {machines?.filter(m => !stops.some(s => s.machine_id === m.id)).map((machine) => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.asset_tag} - {machine.location?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Planned Date</Label>
              <Input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleAddStop} size="sm">Add</Button>
              <Button onClick={() => setIsAdding(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 cursor-move"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{stop.sequence}</Badge>
                  <span className="font-medium">{stop.machine?.asset_tag}</span>
                  <span className="text-sm text-muted-foreground">
                    {stop.machine?.location?.name}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {new Date(stop.planned_date).toLocaleDateString()} • {stop.status}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteStop(stop.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {stops.length === 0 && !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              No stops added yet. Click "Add Stop" to begin.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

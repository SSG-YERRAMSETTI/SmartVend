import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { useUpdateRouteStopsSequence } from "@/hooks/useRoutes";
import { toast } from "sonner";

interface RouteOptimizerProps {
  stops: any[];
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest neighbor algorithm (greedy TSP approximation)
function optimizeRouteSequence(stops: any[]): any[] {
  if (stops.length <= 1) return stops;
  
  // Filter stops with valid coordinates
  const validStops = stops.filter(
    stop => stop.machine?.location?.latitude && stop.machine?.location?.longitude
  );
  
  if (validStops.length === 0) {
    toast.error("No stops have location coordinates set");
    return stops;
  }
  
  const optimized = [];
  const remaining = [...validStops];
  
  // Start with the first stop
  let current = remaining.shift()!;
  optimized.push(current);
  
  // Find nearest neighbor for each step
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.machine.location.latitude,
        current.machine.location.longitude,
        remaining[i].machine.location.latitude,
        remaining[i].machine.location.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }
  
  return optimized;
}

export function RouteOptimizer({ stops }: RouteOptimizerProps) {
  const updateSequence = useUpdateRouteStopsSequence();
  
  const handleOptimize = async () => {
    const optimized = optimizeRouteSequence(stops);
    
    if (optimized.length === 0) return;
    
    // Update sequences
    const updates = optimized.map((stop, index) => ({
      id: stop.id,
      sequence: index + 1,
    }));
    
    await updateSequence.mutateAsync(updates);
    
    toast.success(`Route optimized! Reordered ${optimized.length} stops by shortest path.`);
  };
  
  return (
    <Button onClick={handleOptimize} variant="outline" size="sm">
      <ArrowUpDown className="h-4 w-4 mr-2" />
      Optimize Sequence
    </Button>
  );
}

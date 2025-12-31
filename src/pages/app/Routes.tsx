import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, MapPin, Calendar, Truck, Download } from "lucide-react";
import { useRoutes, useRoute, useRouteStops, useGenerateRefillOrders } from "@/hooks/useRoutes";
import { RouteDialog } from "@/components/routes/RouteDialog";
import { RouteStopsManager } from "@/components/routes/RouteStopsManager";
import { PickListView } from "@/components/routes/PickListView";
import { RouteOptimizer } from "@/components/routes/RouteOptimizer";
import { exportToCSV } from "@/lib/csvExport";

export default function Routes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split("T")[0]);
  
  const { data: routes } = useRoutes();
  const { data: selectedRoute } = useRoute(selectedRouteId || "");
  const { data: stops } = useRouteStops(selectedRouteId || "", plannedDate);
  const generateRefillOrders = useGenerateRefillOrders();

  const exportRoutes = () => {
    if (routes) {
      const formatted = routes.map((r: any) => ({
        name: r.name,
        frequency: r.frequency,
        warehouse: r.warehouse?.name || "",
        stops_count: r.stops?.[0]?.count || 0,
      }));
      exportToCSV(formatted, "routes");
    }
  };
  
  const handleGenerateRefillOrders = async () => {
    if (!stops) return;
    
    for (const stop of stops) {
      try {
        await generateRefillOrders.mutateAsync(stop.id);
      } catch (error) {
        // Continue with other stops even if one fails
        console.error(`Failed to generate orders for stop ${stop.id}:`, error);
      }
    }
  };
  
  if (selectedRouteId && selectedRoute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" onClick={() => setSelectedRouteId(null)}>
              ← Back to Routes
            </Button>
            <h1 className="text-3xl font-bold mt-2">{selectedRoute.name}</h1>
            <p className="text-muted-foreground">
              {selectedRoute.frequency} route
              {selectedRoute.warehouse && ` • Starts from ${selectedRoute.warehouse.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-auto"
            />
            {stops && stops.length > 0 && (
              <>
                <RouteOptimizer stops={stops} />
                <Button onClick={handleGenerateRefillOrders} variant="outline">
                  Generate Refill Orders
                </Button>
              </>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="stops">
          <TabsList>
            <TabsTrigger value="stops">
              <MapPin className="h-4 w-4 mr-2" />
              Stops
            </TabsTrigger>
            <TabsTrigger value="picklist">
              <Truck className="h-4 w-4 mr-2" />
              Pick List
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="stops" className="space-y-4">
            <RouteStopsManager 
              routeId={selectedRouteId} 
              stops={stops || []} 
            />
          </TabsContent>
          
          <TabsContent value="picklist">
            <PickListView routeId={selectedRouteId} plannedDate={plannedDate} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Routes & Service</h1>
          <p className="text-muted-foreground">Plan and optimize service routes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportRoutes}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Route
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {routes?.map((route: any) => (
          <Card 
            key={route.id}
            className="cursor-pointer hover:bg-accent/50"
            onClick={() => setSelectedRouteId(route.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{route.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {route.warehouse?.name || "No warehouse assigned"}
                  </p>
                </div>
                <Badge variant="secondary">{route.frequency}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Stops</p>
                    <p className="font-medium">{route.stops?.[0]?.count || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Frequency</p>
                    <p className="font-medium capitalize">{route.frequency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Warehouse</p>
                    <p className="font-medium">{route.warehouse?.name || "None"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {!routes?.length && (
          <div className="text-center py-12 text-muted-foreground">
            No routes created yet. Click "Create Route" to begin.
          </div>
        )}
      </div>
      
      <RouteDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}

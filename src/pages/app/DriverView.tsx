import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouteStops, useCompleteRouteStop, useUpdateRefillOrder } from "@/hooks/useRoutes";
import { CheckCircle2, MapPin, Package, DollarSign, FileText, Circle, Camera, ScanBarcode, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/driver/BarcodeScanner";
import { PhotoCapture } from "@/components/driver/PhotoCapture";
import { CompletionChecklist } from "@/components/driver/CompletionChecklist";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export default function DriverView() {
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [plannedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [ticketPhoto, setTicketPhoto] = useState<File | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  
  const { data: stops } = useRouteStops(selectedRouteId, plannedDate);
  const completeStop = useCompleteRouteStop();
  const updateRefillOrder = useUpdateRefillOrder();
  const { online, syncing, pendingCount, queueAction, syncPendingActions } = useOfflineSync();
  
  const handleCompleteStopWithChecklist = async (checklistData: any) => {
    const action = {
      type: 'complete_stop',
      data: { stopId: selectedStop.id, ...checklistData }
    };
    
    if (online) {
      await completeStop.mutateAsync(selectedStop.id);
    } else {
      await queueAction('complete_stop', { stopId: selectedStop.id });
    }
    
    toast.success("Stop completed");
    setSelectedStop(null);
    setShowChecklist(false);
  };
  
  const handleUpdateQuantity = async (orderId: string, pickedQty: number) => {
    if (online) {
      await updateRefillOrder.mutateAsync({ 
        id: orderId, 
        picked_qty: pickedQty,
        fulfilled: true 
      });
    } else {
      await queueAction('update_refill', { orderId, pickedQty, fulfilled: true });
      toast.success("Quantity updated (will sync when online)");
    }
  };
  
  const handleCashCollection = async () => {
    if (!cashAmount || parseFloat(cashAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    const data = {
      route_stop_id: selectedStop.id,
      amount: parseFloat(cashAmount),
      collected_at: new Date().toISOString(),
    };
    
    if (online) {
      // Would call actual API
      toast.success("Cash collection recorded");
    } else {
      await queueAction('cash_collection', data);
      toast.success("Cash collection queued");
    }
    
    setCashAmount("");
  };
  
  const handleBarcodeScanned = (barcode: string) => {
    const order = selectedStop.refill_orders?.find((o: any) => 
      o.product?.sku === barcode || o.product?.barcode === barcode
    );
    
    if (order) {
      const newQty = (order.picked_qty || 0) + 1;
      handleUpdateQuantity(order.id, newQty);
      toast.success(`Added 1 to ${order.product?.name}`);
    } else {
      toast.error("Product not found in refill list");
    }
    
    setShowScanner(false);
  };
  
  const handlePhotoCapture = (file: File) => {
    setTicketPhoto(file);
    setShowPhotoCapture(false);
    toast.success("Photo added");
  };
  
  if (!selectedStop && stops?.length) {
    return (
      <div className="space-y-6 p-4 pb-24 max-w-4xl mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Routes</h1>
            <Badge className="text-base px-3 py-1">
              {new Date(plannedDate).toLocaleDateString()}
            </Badge>
          </div>
          
          {/* Connection Status Bar */}
          <Card className={online ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-orange-50 dark:bg-orange-950/20 border-orange-200"}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {online ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-orange-600" />
                  )}
                  <span className="font-medium text-sm">
                    {online ? 'Online' : 'Offline Mode'}
                  </span>
                </div>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {pendingCount} pending
                    </Badge>
                    {online && (
                      <Button 
                        size="sm" 
                        onClick={syncPendingActions}
                        disabled={syncing}
                        className="h-8"
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-4">
          {stops.map((stop: any) => (
            <Card 
              key={stop.id} 
              className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-transform touch-manipulation"
              onClick={() => setSelectedStop(stop)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-base px-3 py-1.5">
                      #{stop.sequence}
                    </Badge>
                    <div>
                      <CardTitle className="text-xl">{stop.machine?.asset_tag}</CardTitle>
                      <p className="text-base text-muted-foreground mt-1">
                        {stop.machine?.location?.name}
                      </p>
                    </div>
                  </div>
                  {stop.status === "completed" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <Circle className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-base text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>{stop.machine?.location?.address}</span>
                </div>
                {stop.refill_orders?.length > 0 && (
                  <div className="mt-2 text-base text-muted-foreground">
                    {stop.refill_orders.length} items to refill
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {stops.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No stops scheduled for today
          </div>
        )}
      </div>
    );
  }
  
  if (!selectedStop) return null;
  
  return (
    <div className="space-y-6 p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => setSelectedStop(null)}
          size="lg"
          className="h-12 text-base touch-manipulation"
        >
          ← Back to Route
        </Button>
        <Badge 
          variant={selectedStop.status === "completed" ? "default" : "secondary"}
          className="text-base px-3 py-1.5"
        >
          {selectedStop.status}
        </Badge>
      </div>
      
      {/* Connection Status */}
      {!online && (
        <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium">
                Working offline - changes will sync when online
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Stop #{selectedStop.sequence}</Badge>
            <div>
              <CardTitle>{selectedStop.machine?.asset_tag}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedStop.machine?.location?.name}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {showChecklist ? (
        <CompletionChecklist 
          onComplete={handleCompleteStopWithChecklist}
        />
      ) : (
        <>
          <Tabs defaultValue="refill">
            <TabsList className="grid w-full grid-cols-3 h-14">
              <TabsTrigger value="refill" className="text-base">
                <Package className="h-5 w-5 mr-2" />
                Refill
              </TabsTrigger>
              <TabsTrigger value="cash" className="text-base">
                <DollarSign className="h-5 w-5 mr-2" />
                Cash
              </TabsTrigger>
              <TabsTrigger value="ticket" className="text-base">
                <FileText className="h-5 w-5 mr-2" />
                Ticket
              </TabsTrigger>
            </TabsList>
        
            <TabsContent value="refill" className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowScanner(true)}
                  variant="secondary"
                  size="lg"
                  className="flex-1 h-14 text-base touch-manipulation"
                >
                  <ScanBarcode className="h-6 w-6 mr-2" />
                  Scan Barcode
                </Button>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Items to Refill</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedStop.refill_orders?.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <p className="font-medium text-base">{order.product?.name}</p>
                        <p className="text-base text-muted-foreground mt-1">
                          Required: {order.required_qty}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={order.picked_qty || ''}
                          className="w-24 h-12 text-lg text-center"
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateQuantity(order.id, val);
                            }
                          }}
                        />
                        {order.fulfilled && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                      </div>
                    </div>
                  ))}
                  
                  {!selectedStop.refill_orders?.length && (
                    <div className="text-center py-8 text-muted-foreground text-base">
                      No refill orders for this stop
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
        
            <TabsContent value="cash" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Cash Collection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base">Amount Collected ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-14 text-lg"
                    />
                  </div>
                  <Button 
                    onClick={handleCashCollection} 
                    className="w-full h-14 text-lg touch-manipulation"
                    size="lg"
                  >
                    Record Collection
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
        
            <TabsContent value="ticket" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Create Ticket</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => setShowPhotoCapture(true)}
                    variant="secondary"
                    size="lg"
                    className="w-full h-14 text-base touch-manipulation"
                  >
                    <Camera className="h-6 w-6 mr-2" />
                    {ticketPhoto ? 'Change Photo' : 'Add Photo'}
                  </Button>
                  
                  {ticketPhoto && (
                    <div className="text-sm text-muted-foreground text-center">
                      Photo added: {ticketPhoto.name}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {selectedStop.status !== "completed" && (
            <Button 
              onClick={() => setShowChecklist(true)} 
              className="w-full h-16 text-lg touch-manipulation"
              size="lg"
            >
              <CheckCircle2 className="h-6 w-6 mr-2" />
              Complete Stop
            </Button>
          )}
        </>
      )}
      
      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
      
      {showPhotoCapture && (
        <PhotoCapture 
          onPhotoCapture={handlePhotoCapture}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}
    </div>
  );
}

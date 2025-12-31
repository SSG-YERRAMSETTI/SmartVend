import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Package } from "lucide-react";
import { usePickList } from "@/hooks/useRoutes";

interface PickListViewProps {
  routeId: string;
  plannedDate: string;
}

export function PickListView({ routeId, plannedDate }: PickListViewProps) {
  const { data: pickList, isLoading } = usePickList(routeId, plannedDate);
  
  const handlePrint = () => {
    window.print();
  };
  
  if (isLoading) {
    return <div>Loading pick list...</div>;
  }
  
  if (!pickList || pickList.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No items to pick for this route.</p>
            <p className="text-sm mt-2">Generate refill orders for stops first.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pre-Kitting Pick List</CardTitle>
          <Button onClick={handlePrint} size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead>Destinations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickList.map((item: any) => (
              <TableRow key={item.product_id}>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell>{item.product.sku}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{item.total_required}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {item.stops.map((stop: any) => (
                      <div key={stop.stop_id} className="text-sm text-muted-foreground">
                        Stop #{stop.sequence}: {stop.machine_tag} ({stop.location}) - {stop.required_qty} units
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-4 p-4 bg-muted rounded-lg print:hidden">
          <h4 className="font-semibold mb-2">Summary</h4>
          <p className="text-sm text-muted-foreground">
            Total products to pick: {pickList.length}
          </p>
          <p className="text-sm text-muted-foreground">
            Total items: {pickList.reduce((sum: number, item: any) => sum + item.total_required, 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

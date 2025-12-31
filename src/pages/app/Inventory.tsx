import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWarehouseInventory } from "@/hooks/useWarehouseInventory";
import { Plus, Package, Upload, ArrowLeftRight, Download, AlertTriangle, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProducts,
  useDeleteProduct,
  useInventoryBatches,
  useExpiringProducts,
  useLowStockProducts,
  useInventoryTransfers,
  useCompleteTransfer,
  useInventoryValuation,
} from "@/hooks/useInventory";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { CSVImportDialog } from "@/components/inventory/CSVImportDialog";
import { TransferDialog } from "@/components/inventory/TransferDialog";
import { formatCurrency, exportToCSV } from "@/lib/csvExport";
import { format } from "date-fns";

export default function Inventory() {
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const { items, loading, error } = useWarehouseInventory();
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockFilter, setStockFilter] = useState<{ type: string; id: string } | null>(null);

  const { data: products, refetch: refetchProducts } = useProducts();
  const { data: warehouseBatches } = useInventoryBatches({ locationType: "warehouse" });
  const { data: vehicleBatches } = useInventoryBatches({ locationType: "vehicle" });
  const { data: machineBatches } = useInventoryBatches({ locationType: "machine" });
  const { data: expiringProducts } = useExpiringProducts(30);
  const { data: lowStockProducts } = useLowStockProducts();
  const { data: transfers } = useInventoryTransfers();
  const { data: valuation } = useInventoryValuation();
  const deleteMutation = useDeleteProduct();
  const completeMutation = useCompleteTransfer();
  const inventoryItems = items ?? [];

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const exportProducts = () => {
    if (products) {
      exportToCSV(products, "products");
    }
  };

  const exportTransfers = () => {
    if (transfers) {
      const formatted = transfers.map(t => ({
        product: t.product?.name,
        from: `${t.from_location_type} (${t.from_location_id})`,
        to: `${t.to_location_type} (${t.to_location_id})`,
        quantity: t.quantity,
        status: t.status,
        created: format(new Date(t.created_at), "PP"),
      }));
      exportToCSV(formatted, "transfers");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Products & Inventory</h1>
          <p className="text-muted-foreground">Manage products, stock levels, and transfers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => {
            setSelectedProduct(null);
            setProductDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Need reordering</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valuation?.totalValue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">FIFO valuation</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse Stock</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle Stock</TabsTrigger>
          <TabsTrigger value="machine">Machine Stock</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Management</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Product Catalog</CardTitle>
              <Button variant="outline" size="sm" onClick={exportProducts}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Warehouse Stock</TableHead>
                    <TableHead>Reorder Point</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{formatCurrency(Number(product.cost_price))}</TableCell>
                      <TableCell>{formatCurrency(Number(product.sell_price))}</TableCell>
                      <TableCell>
                        <Badge variant={product.warehouse_stock < product.reorder_point ? "destructive" : "default"}>
                          {product.warehouse_stock}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.reorder_point}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(product)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        


        <TabsContent value="warehouse">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Unit Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">
                        Loading inventory...
                      </TableCell>
                    </TableRow>
                  )}

                  {error && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-sm text-destructive">
                        {error}
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && !error && inventoryItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">
                        No inventory yet. Try uploading a receipt.
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && !error && inventoryItems.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="py-2 px-3 font-medium">{item.name}</TableCell>
                      <TableCell className="py-2 px-3">{item.sku ?? "-"}</TableCell>
                      <TableCell className="py-2 px-3 text-right">{item.quantity}</TableCell>
                      <TableCell className="py-2 px-3 text-right">
                        {formatCurrency(Number(item.avg_unit_cost))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Expiry Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouseBatches?.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product?.name}</TableCell>
                      <TableCell>{batch.batch_number}</TableCell>
                      <TableCell>{batch.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(batch.unit_cost))}</TableCell>
                      <TableCell>{formatCurrency(batch.quantity * Number(batch.unit_cost))}</TableCell>
                      <TableCell>
                        {batch.expiry_date ? format(new Date(batch.expiry_date), "PP") : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicle">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Vehicle ID</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleBatches?.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product?.name}</TableCell>
                      <TableCell>{batch.location_id.substring(0, 8)}...</TableCell>
                      <TableCell>{batch.quantity}</TableCell>
                      <TableCell>
                        {batch.expiry_date ? format(new Date(batch.expiry_date), "PP") : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machine">
          <Card>
            <CardHeader>
              <CardTitle>Machine Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Machine ID</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machineBatches?.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product?.name}</TableCell>
                      <TableCell>{batch.location_id.substring(0, 8)}...</TableCell>
                      <TableCell>{batch.quantity}</TableCell>
                      <TableCell>
                        {batch.expiry_date ? format(new Date(batch.expiry_date), "PP") : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Inventory Transfers</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportTransfers}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm" onClick={() => setTransferDialogOpen(true)}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  New Transfer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers?.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">{transfer.product?.name}</TableCell>
                      <TableCell>{transfer.from_location_type}</TableCell>
                      <TableCell>{transfer.to_location_type}</TableCell>
                      <TableCell>{transfer.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={transfer.status === "completed" ? "default" : transfer.status === "pending" ? "secondary" : "destructive"}>
                          {transfer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(transfer.created_at), "PP")}</TableCell>
                      <TableCell>
                        {transfer.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => completeMutation.mutate(transfer.id)}
                          >
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiry">
          <Card>
            <CardHeader>
              <CardTitle>Products Expiring Soon (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Location Type</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringProducts?.map((batch) => {
                    const daysRemaining = Math.ceil(
                      (new Date(batch.expiry_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.product?.name}</TableCell>
                        <TableCell>{batch.location_type}</TableCell>
                        <TableCell>{batch.batch_number}</TableCell>
                        <TableCell>{batch.quantity}</TableCell>
                        <TableCell>{format(new Date(batch.expiry_date!), "PP")}</TableCell>
                        <TableCell>
                          <Badge variant={daysRemaining < 7 ? "destructive" : "secondary"}>
                            {daysRemaining} days
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock & Reorder Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Reorder Point</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.warehouse_stock}</TableCell>
                      <TableCell>{product.reorder_point}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Low Stock</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
      />
      <CSVImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onSuccess={refetchProducts}
      />
      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </div>
  );
}

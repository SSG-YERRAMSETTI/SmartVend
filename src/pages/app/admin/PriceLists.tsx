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
import { Plus, DollarSign } from "lucide-react";
import {
  usePriceLists,
  usePriceListItems,
  useCreatePriceList,
  useUpdatePriceListItem,
  useAddPriceListItem,
} from "@/hooks/useAdmin";
import { useProducts } from "@/hooks/useInventory";
import { formatCurrency } from "@/lib/csvExport";

export default function PriceLists() {
  const [createOpen, setCreateOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedPriceList, setSelectedPriceList] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const { data: priceLists } = usePriceLists();
  const { data: products } = useProducts();
  const { data: priceListItems } = usePriceListItems(selectedPriceList);
  const createPriceList = useCreatePriceList();
  const updatePriceListItem = useUpdatePriceListItem();
  const addPriceListItem = useAddPriceListItem();

  const handleCreateList = async () => {
    await createPriceList.mutateAsync({ name: newListName });
    setCreateOpen(false);
    setNewListName("");
  };

  const handleAddProduct = async () => {
    if (!selectedPriceList || !selectedProduct || !newPrice) return;
    
    await addPriceListItem.mutateAsync({
      price_list_id: selectedPriceList,
      product_id: selectedProduct,
      sell_price: Number(newPrice),
    });
    setAddProductOpen(false);
    setSelectedProduct("");
    setNewPrice("");
  };

  const handleUpdatePrice = async (itemId: string, newPrice: number) => {
    await updatePriceListItem.mutateAsync({
      id: itemId,
      sell_price: newPrice,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Price Lists</h1>
          <p className="text-muted-foreground">Manage product pricing for different contexts</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Price List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Price List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Premium Locations"
                />
              </div>
              <Button onClick={handleCreateList} className="w-full">
                Create Price List
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Price Lists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priceLists?.map((list) => (
                <Button
                  key={list.id}
                  variant={selectedPriceList === list.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedPriceList(list.id)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {list.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Products & Pricing</CardTitle>
              {selectedPriceList && (
                <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Product to Price List</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Product</Label>
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
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
                      <div>
                        <Label>Sell Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <Button onClick={handleAddProduct} className="w-full">
                        Add Product
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedPriceList ? (
              <p className="text-center text-muted-foreground py-8">
                Select a price list to view products
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Sell Price</TableHead>
                    <TableHead>Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceListItems?.map((item: any) => {
                    const margin = item.products?.cost_price
                      ? ((item.sell_price - item.products.cost_price) / item.sell_price) * 100
                      : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.products?.name}</TableCell>
                        <TableCell>{item.products?.sku}</TableCell>
                        <TableCell>{formatCurrency(item.products?.cost_price || 0)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            defaultValue={item.sell_price}
                            onBlur={(e) =>
                              handleUpdatePrice(item.id, Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <span className={margin > 30 ? "text-green-600" : "text-yellow-600"}>
                            {margin.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Price List Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Assign price lists to specific machines or locations. This feature will be implemented
            with additional database schema.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Assign to Location</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Coming soon" />
                </SelectTrigger>
              </Select>
            </div>
            <div>
              <Label>Assign to Machine</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Coming soon" />
                </SelectTrigger>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

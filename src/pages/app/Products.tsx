import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, AlertTriangle, Clock } from "lucide-react";
import { useProducts, useCreateProduct, useUpdateProduct, useExpiringSoon, Product } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = {
  name: "",
  sku: "",
  category: "Food",
  units_per_case: "",
  reorder_point: "",
  order_up_to_level: "",
  barcode: "",
  cost_price: "",
  sell_price: "",
  active: true,
  initial_quantity: "",
  initial_unit_cost: "",
};

export default function Products() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: products, isLoading } = useProducts();
  const { data: expiringSoon } = useExpiringSoon(14);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      units_per_case: p.units_per_case?.toString() ?? "",
      reorder_point: p.reorder_point?.toString() ?? "",
      order_up_to_level: p.order_up_to_level?.toString() ?? "",
      barcode: p.barcode ?? "",
      cost_price: p.cost_price?.toString() ?? "",
      sell_price: p.sell_price?.toString() ?? "",
      active: p.active,
      initial_quantity: "",
      initial_unit_cost: "",
    });
    setDialogOpen(true);
  };

  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  const handleSave = () => {
    const base = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      units_per_case: numOrNull(form.units_per_case),
      reorder_point: numOrNull(form.reorder_point) ?? 0,
      order_up_to_level: numOrNull(form.order_up_to_level),
      barcode: form.barcode || null,
      cost_price: Number(form.cost_price || 0),
      sell_price: Number(form.sell_price || 0),
      active: form.active,
    };

    if (editing) {
      updateProduct.mutate({ id: editing.id, ...base }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createProduct.mutate(
        {
          ...base,
          initial_quantity: numOrNull(form.initial_quantity) ?? 0,
          initial_unit_cost: numOrNull(form.initial_unit_cost),
        },
        { onSuccess: () => setDialogOpen(false) }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Products</h1>
          <p className="text-muted-foreground">
            {products ? `${products.length} products` : "Manage your product catalog"}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Product
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or code..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {expiringSoon && expiringSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">
                {expiringSoon.length} batch{expiringSoon.length === 1 ? "" : "es"} expiring within 14 days
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {expiringSoon.slice(0, 8).map((b) => (
                <Badge key={b.batch_id} variant="outline" className="bg-white">
                  {b.product_name} — {b.quantity} units, {b.days_until_expiry}d
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading products...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">In Warehouse</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">
                      {Number(p.cost_price) === 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> $0.00
                        </span>
                      ) : (
                        `$${Number(p.cost_price).toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">${Number(p.sell_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className={(p.warehouse_stock ?? 0) < 0 ? "text-destructive font-medium" : ""}>
                        {p.warehouse_stock ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.last_supplier || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground">
                      No products match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Create Product"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id="active"
                    checked={form.active}
                    onCheckedChange={(c) => setForm({ ...form, active: !!c })}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Code *</Label>
                  <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Type *</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Food / Beverage"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="upc">Units Per Case</Label>
                  <Input id="upc" type="number" value={form.units_per_case}
                    onChange={(e) => setForm({ ...form, units_per_case: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rp">Reorder Point</Label>
                  <Input id="rp" type="number" value={form.reorder_point}
                    onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Minimum quantity</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oul">Order Up to Level</Label>
                  <Input id="oul" type="number" value={form.order_up_to_level}
                    onChange={(e) => setForm({ ...form, order_up_to_level: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Maximum quantity</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price</Label>
                  <Input id="cost" type="number" step="0.01" value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell">Sell Price</Label>
                  <Input id="sell" type="number" step="0.01" value={form.sell_price}
                    onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
              </div>
            </div>

            {!editing && (
              <div className="border rounded-lg p-4 space-y-4 h-fit">
                <p className="text-sm font-medium">Initial Inventory Setup</p>
                <div className="space-y-2">
                  <Label htmlFor="iq">Quantity (single units)</Label>
                  <Input id="iq" type="number" value={form.initial_quantity}
                    onChange={(e) => setForm({ ...form, initial_quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iuc">Unit Cost</Label>
                  <Input id="iuc" type="number" step="0.01" value={form.initial_unit_cost}
                    onChange={(e) => setForm({ ...form, initial_unit_cost: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates the first warehouse batch for this product.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.sku || createProduct.isPending || updateProduct.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

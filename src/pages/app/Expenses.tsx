import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Receipt as ReceiptIcon, Image as ImageIcon, X } from "lucide-react";
import { useExpenses, useCreateExpense, useDeleteExpense, useUploadExpensePhoto } from "@/hooks/useApi";
import { API_BASE_URL } from "@/config/api";

const CATEGORIES = ["Fuel", "Vehicle Maintenance", "Equipment", "Supplies", "Tolls", "Insurance", "Other"];

const photoUrl = (path: string) => `${API_BASE_URL}/uploads/${path.split("uploads/")[1] ?? path}`;

export default function Expenses() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: expenses, isLoading } = useExpenses(dateFrom || undefined, dateTo || undefined);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const uploadPhoto = useUploadExpensePhoto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "Fuel", vendor_name: "", amount: "", notes: "",
  });
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const total = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const resetForm = () => {
    setForm({ expense_date: new Date().toISOString().split("T")[0], category: "Fuel", vendor_name: "", amount: "", notes: "" });
    setPendingPhoto(null);
  };

  const submit = () => {
    createExpense.mutate(
      {
        expense_date: form.expense_date,
        category: form.category,
        vendor_name: form.vendor_name || undefined,
        amount: Number(form.amount),
        notes: form.notes || undefined,
      },
      {
        onSuccess: (expense) => {
          if (pendingPhoto) uploadPhoto.mutate({ expenseId: expense.id, file: pendingPhoto });
          setDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Expenses</h1>
          <p className="text-muted-foreground">
            {expenses ? `$${total.toFixed(2)}${dateFrom || dateTo ? " in range" : " total"}` : "Operating costs"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : expenses && expenses.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.expense_date}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.vendor_name || "—"}</TableCell>
                    <TableCell className="text-right">${Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">{e.notes || "—"}</TableCell>
                    <TableCell>
                      {e.photo_path ? (
                        <a href={photoUrl(e.photo_path)} target="_blank" rel="noreferrer">
                          <ImageIcon className="h-4 w-4 text-primary" />
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <ReceiptIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {dateFrom || dateTo ? "No expenses in this range." : "No expenses recorded yet."}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                placeholder="e.g. Shell, Joe's Auto Repair" />
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Proof photo (optional)</Label>
              <p className="text-xs text-muted-foreground">
                A handwritten note, an informal receipt — anything for your own records. Not required.
              </p>
              {pendingPhoto ? (
                <div className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <span className="truncate">{pendingPhoto.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingPhoto(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" type="button" onClick={() => photoInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Attach Photo
                </Button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setPendingPhoto(e.target.files[0])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.amount || createExpense.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

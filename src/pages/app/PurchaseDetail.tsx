import { useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, AlertTriangle, Trash2, Plus, CheckCircle2, Mic, Square, Receipt as ReceiptIcon,
} from "lucide-react";
import {
  usePurchase, useUpdatePurchaseLine, useDeletePurchaseLine, useConfirmPurchase,
  useRejectPurchase, useUpdatePurchaseSummary, useVoiceFill,
  useProducts, useCreateProduct, ReceiptLine,
} from "@/hooks/useApi";

const lineTypeVariant = (t: string) =>
  t === "product" ? "outline" : t === "void" ? "destructive" : "secondary";

const EXPENSE_CATEGORIES = ["Fuel", "Vehicle Maintenance", "Equipment", "Supplies", "Tolls", "Insurance", "Other"];

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: purchase, isLoading } = usePurchase(id);

  if (isLoading || !purchase) return <p className="text-muted-foreground">Loading purchase...</p>;

  return purchase.document_type === "expense"
    ? <ExpenseReceiptReview purchase={purchase} />
    : <InventoryPurchaseReview purchase={purchase} />;
}

// ============================================================
// Expense-type receipt (fuel, repairs, equipment — no products)
// ============================================================

function ExpenseReceiptReview({ purchase }: { purchase: NonNullable<ReturnType<typeof usePurchase>["data"]> }) {
  const navigate = useNavigate();
  const updateSummary = useUpdatePurchaseSummary();
  const confirmPurchase = useConfirmPurchase();
  const rejectPurchase = useRejectPurchase();

  const readOnly = purchase.status !== "pending_review";
  const [form, setForm] = useState({
    vendor_name: purchase.vendor_name ?? "",
    expense_category: purchase.expense_category ?? "Other",
    total_amount: purchase.total_amount?.toString() ?? "",
    receipt_date: purchase.receipt_date ?? "",
  });

  const saveField = (patch: Record<string, unknown>) => {
    setForm((f) => ({ ...f, ...patch }));
    updateSummary.mutate({ receiptId: purchase.id, ...patch });
  };

  const canConfirm = !!form.total_amount && !!form.expense_category;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/app/purchases"><ArrowLeft className="h-4 w-4 mr-1" /> Purchases</Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
            {purchase.vendor_name || "Expense receipt"}
          </h1>
          <p className="text-muted-foreground">{purchase.receipt_date || "No date"} · {purchase.filename}</p>
        </div>
        <Badge variant={purchase.status === "confirmed" ? "default" : purchase.status === "rejected" ? "destructive" : "secondary"}>
          {purchase.status.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">This is an expense, not an inventory purchase</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <p className="text-sm text-muted-foreground">
            No products to match — this goes straight to Expenses once confirmed.
          </p>
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Input value={form.vendor_name} disabled={readOnly}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
              onBlur={() => saveField({ vendor_name: form.vendor_name })} />
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={form.expense_category} disabled={readOnly}
              onValueChange={(v) => saveField({ expense_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={form.receipt_date} disabled={readOnly}
              onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
              onBlur={() => saveField({ receipt_date: form.receipt_date })} />
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" step="0.01" value={form.total_amount} disabled={readOnly}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              onBlur={() => saveField({ total_amount: form.total_amount === "" ? null : Number(form.total_amount) })} />
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => rejectPurchase.mutate(purchase.id, { onSuccess: () => navigate("/app/purchases") })}>
            Reject
          </Button>
          <Button
            onClick={() => confirmPurchase.mutate(purchase.id, { onSuccess: () => navigate("/app/purchases") })}
            disabled={!canConfirm || confirmPurchase.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm — Add to Expenses
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Inventory purchase (products) — the original review screen, plus
// Shelf Label column and voice fill
// ============================================================

function InventoryPurchaseReview({ purchase }: { purchase: NonNullable<ReturnType<typeof usePurchase>["data"]> }) {
  const navigate = useNavigate();
  const { data: products } = useProducts();
  const updateLine = useUpdatePurchaseLine();
  const deleteLine = useDeletePurchaseLine();
  const confirmPurchase = useConfirmPurchase();
  const rejectPurchase = useRejectPurchase();
  const createProduct = useCreateProduct();

  const [newProductLine, setNewProductLine] = useState<ReceiptLine | null>(null);
  const [newProductForm, setNewProductForm] = useState({ name: "", category: "", cost_price: "", sell_price: "" });

  const readOnly = purchase.status !== "pending_review";
  const productLines = purchase.lines.filter((l) => l.line_type === "product");
  const hasBlockers = productLines.some((l) => !l.product_id || l.unit_cost == null);

  const productName = (pid?: string | null) => products?.find((p) => p.id === pid)?.name;

  const patch = (line: ReceiptLine, body: Record<string, unknown>) =>
    updateLine.mutate({ receiptId: purchase.id, lineId: line.id, ...body });

  const openCreateProduct = (line: ReceiptLine) => {
    setNewProductLine(line);
    setNewProductForm({
      name: line.product_raw,
      category: "Uncategorized",
      cost_price: line.unit_cost ? String(line.unit_cost / (line.units_per_case || 1)) : "",
      sell_price: "",
    });
  };

  const submitNewProduct = () => {
    if (!newProductLine) return;
    createProduct.mutate(
      {
        sku: newProductForm.name.toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 30),
        name: newProductForm.name,
        category: newProductForm.category || "Uncategorized",
        cost_price: Number(newProductForm.cost_price || 0),
        sell_price: Number(newProductForm.sell_price || 0),
        active: true,
        reorder_point: 0,
      },
      {
        onSuccess: (product) => {
          patch(newProductLine, { product_id: product.id });
          setNewProductLine(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/app/purchases"><ArrowLeft className="h-4 w-4 mr-1" /> Purchases</Link>
          </Button>
          <h1 className="text-2xl font-bold">{purchase.vendor_name || "Unknown supplier"}</h1>
          <p className="text-muted-foreground">
            {purchase.receipt_date || "No date"} {purchase.receipt_time ? `· ${purchase.receipt_time}` : ""} · {purchase.filename}
          </p>
        </div>
        <Badge variant={purchase.status === "confirmed" ? "default" : purchase.status === "rejected" ? "destructive" : "secondary"}>
          {purchase.status.replace("_", " ")}
        </Badge>
      </div>

      {purchase.missing_prices && !readOnly && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900">
              Some lines don't have a price. Enter it below, or upload a version of this receipt
              that shows prices — purchases can't be confirmed without a price on every product line.
            </p>
          </CardContent>
        </Card>
      )}

      {!readOnly && <VoiceFillBar purchaseId={purchase.id} />}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>As printed</TableHead>
                <TableHead className="min-w-[200px]">Matched Product</TableHead>
                <TableHead className="text-right w-24">Qty</TableHead>
                <TableHead className="text-right w-28">Units/Case</TableHead>
                <TableHead className="text-right w-28">Unit Price</TableHead>
                <TableHead className="w-36">Expiry</TableHead>
                <TableHead className="w-36">Shelf Location</TableHead>
                {!readOnly && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.lines.map((line) => {
                const isProduct = line.line_type === "product";
                return (
                  <TableRow key={line.id} id={`line-${line.id}`} className={line.needs_review && isProduct ? "bg-amber-50/50" : ""}>
                    <TableCell>
                      <Badge variant={lineTypeVariant(line.line_type)}>{line.line_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={line.product_raw}>
                      {line.product_raw}
                    </TableCell>
                    <TableCell>
                      {!isProduct ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : readOnly ? (
                        productName(line.product_id) || <span className="text-destructive">unmatched</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={line.product_id ?? ""}
                            onValueChange={(v) => patch(line, { product_id: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {products?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!line.product_id && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openCreateProduct(line)}>
                              New
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {readOnly ? line.quantity : (
                        <Input
                          className="h-9 text-right"
                          type="number"
                          value={line.quantity}
                          onChange={(e) => patch(line, { quantity: Number(e.target.value) })}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {readOnly ? (line.units_per_case ?? "—") : (
                        <Input
                          className="h-9 text-right"
                          type="number"
                          placeholder="?"
                          value={line.units_per_case ?? ""}
                          onChange={(e) => patch(line, { units_per_case: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {readOnly ? (
                        line.unit_cost != null ? `$${Number(line.unit_cost).toFixed(2)}` : "—"
                      ) : (
                        <Input
                          className="h-9 text-right"
                          type="number"
                          step="0.01"
                          placeholder="missing"
                          value={line.unit_cost ?? ""}
                          onChange={(e) => patch(line, { unit_cost: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {!isProduct ? "—" : readOnly ? (line.expiry_date || "—") : (
                        <Input
                          className="h-9"
                          type="date"
                          value={line.expiry_date ?? ""}
                          onChange={(e) => patch(line, { expiry_date: e.target.value || null })}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {!isProduct ? "—" : readOnly ? (line.shelf_label || "—") : (
                        <Input
                          className="h-9"
                          placeholder="e.g. Shelf A3"
                          value={line.shelf_label ?? ""}
                          onChange={(e) => patch(line, { shelf_label: e.target.value || null })}
                        />
                      )}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteLine.mutate({ receiptId: purchase.id, lineId: line.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {purchase.raw_text && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Raw extracted text (for reference)</summary>
          <pre className="whitespace-pre-wrap mt-2 p-3 bg-muted rounded-md text-xs">{purchase.raw_text}</pre>
        </details>
      )}

      {!readOnly && (
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => rejectPurchase.mutate(purchase.id, { onSuccess: () => navigate("/app/purchases") })}>
            Reject
          </Button>
          <div className="flex items-center gap-3">
            {hasBlockers && (
              <span className="text-sm text-muted-foreground">
                Match every product line and fill in every price to confirm.
              </span>
            )}
            <Button
              onClick={() => confirmPurchase.mutate(purchase.id, { onSuccess: () => navigate("/app/purchases") })}
              disabled={hasBlockers || confirmPurchase.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm & Update Inventory
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!newProductLine} onOpenChange={(v) => !v && setNewProductLine(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Product</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={newProductForm.category} onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost Price (per unit)</Label>
                <Input type="number" step="0.01" value={newProductForm.cost_price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, cost_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sell Price</Label>
                <Input type="number" step="0.01" value={newProductForm.sell_price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, sell_price: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProductLine(null)}>Cancel</Button>
            <Button onClick={submitNewProduct} disabled={!newProductForm.name || createProduct.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Create & Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Voice fill — record once, fills expiry + units/case across lines
// ============================================================

function VoiceFillBar({ purchaseId }: { purchaseId: string }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceFill = useVoiceFill();
  const updateLine = useUpdatePurchaseLine();

  const startRecording = async () => {
    setTranscript(null);
    setAppliedSummary([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        voiceFill.mutate(
          { receiptId: purchaseId, audioBlob: blob },
          {
            onSuccess: (result) => {
              setTranscript(result.transcript);
              const summary: string[] = [];
              result.actions.forEach((a) => {
                if (a.skip) {
                  summary.push(`Skipped ${a.product_raw}`);
                  return;
                }
                const patch: Record<string, unknown> = {};
                if (a.expiration_date) patch.expiry_date = a.expiration_date;
                if (a.units_per_case != null) patch.units_per_case = a.units_per_case;
                if (Object.keys(patch).length > 0) {
                  updateLine.mutate({ receiptId: purchaseId, lineId: a.line_id, ...patch });
                  summary.push(
                    `${a.product_raw}: ${a.expiration_date ? `expires ${a.expiration_date}` : ""} ${a.units_per_case != null ? `${a.units_per_case}/case` : ""}`.trim()
                  );
                }
              });
              setAppliedSummary(summary);
            },
          }
        );
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setTranscript("Couldn't access the microphone — check your browser's permission for this site.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Voice fill</p>
            <p className="text-xs text-muted-foreground">
              Say a product name, its expiration date, and units per case if it's missing. Say "next" or "skip" to move on.
            </p>
          </div>
          {recording ? (
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5 mr-1" /> Stop
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startRecording} disabled={voiceFill.isPending}>
              <Mic className="h-3.5 w-3.5 mr-1" /> {voiceFill.isPending ? "Processing..." : "Record"}
            </Button>
          )}
        </div>
        {transcript && (
          <div className="text-sm bg-muted rounded-md p-3 space-y-2">
            <p><span className="font-medium">Heard:</span> "{transcript}"</p>
            {appliedSummary.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {appliedSummary.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

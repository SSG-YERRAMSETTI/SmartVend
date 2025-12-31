import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { useMachines } from "@/hooks/useMachines";
import { useCashCollections, useCreateCashCollection } from "@/hooks/useSales";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/csvExport";
import { Banknote, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CashCollectionWorkflow() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [machineId, setMachineId] = useState("");
  const [expectedCash, setExpectedCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");

  const { data: machines } = useMachines();
  const { data: collections } = useCashCollections({ dateRange });
  const createCollection = useCreateCashCollection();

  const variance = countedCash && expectedCash 
    ? parseFloat(countedCash) - parseFloat(expectedCash)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createCollection.mutate({
      machine_id: machineId,
      expected_cash: parseFloat(expectedCash),
      counted_cash: parseFloat(countedCash),
      variance,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setMachineId("");
        setExpectedCash("");
        setCountedCash("");
        setNotes("");
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cash Collections</CardTitle>
            <div className="flex gap-2">
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Banknote className="h-4 w-4 mr-2" />
                    Record Collection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Cash Collection</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="machine">Machine</Label>
                      <Select value={machineId} onValueChange={setMachineId} required>
                        <SelectTrigger id="machine">
                          <SelectValue placeholder="Select machine" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines?.map((machine: any) => (
                            <SelectItem key={machine.id} value={machine.id}>
                              {machine.asset_tag} - {machine.locations?.name || "No location"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected">Expected Cash</Label>
                      <Input
                        id="expected"
                        type="number"
                        step="0.01"
                        value={expectedCash}
                        onChange={(e) => setExpectedCash(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="counted">Counted Cash</Label>
                      <Input
                        id="counted"
                        type="number"
                        step="0.01"
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    {expectedCash && countedCash && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Variance:</span>
                          <span className={`text-lg font-bold ${variance >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(Math.abs(variance))} {variance >= 0 ? 'over' : 'short'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any notes about this collection..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Photos</Label>
                      <Button type="button" variant="outline" className="w-full">
                        <Camera className="h-4 w-4 mr-2" />
                        Attach Photos (Coming Soon)
                      </Button>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1" disabled={createCollection.isPending}>
                        {createCollection.isPending ? "Recording..." : "Record Collection"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections?.map((collection: any) => (
                <TableRow key={collection.id}>
                  <TableCell>{format(new Date(collection.collected_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{collection.machines?.asset_tag}</TableCell>
                  <TableCell>{collection.machines?.locations?.name || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(collection.expected_cash)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(collection.counted_cash)}</TableCell>
                  <TableCell className={`text-right font-medium ${
                    collection.variance >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {formatCurrency(collection.variance)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {collection.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

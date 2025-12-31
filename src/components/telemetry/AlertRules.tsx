import { useState } from "react";
import { useAlertRules, useCreateAlertRule, useUpdateAlertRule, useDeleteAlertRule } from "@/hooks/useTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";

const RULE_TYPES = [
  { value: "door_open", label: "Door Open Too Long" },
  { value: "temperature_high", label: "Temperature High" },
  { value: "no_sales", label: "No Sales (24h)" },
  { value: "cash_box_full", label: "Cash Box Near Full" },
];

export function AlertRules() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    rule_type: "",
    enabled: true,
    threshold_value: "",
    threshold_duration_minutes: "",
  });

  const { data: rules, isLoading } = useAlertRules();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRule.mutateAsync({
      name: formData.name,
      rule_type: formData.rule_type,
      enabled: formData.enabled,
      threshold_value: formData.threshold_value ? Number(formData.threshold_value) : undefined,
      threshold_duration_minutes: formData.threshold_duration_minutes ? Number(formData.threshold_duration_minutes) : undefined,
    });
    setOpen(false);
    setFormData({
      name: "",
      rule_type: "",
      enabled: true,
      threshold_value: "",
      threshold_duration_minutes: "",
    });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateRule.mutateAsync({ id, enabled });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Alert Rules</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Door open alert"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule_type">Rule Type</Label>
                <Select
                  value={formData.rule_type}
                  onValueChange={(value) => setFormData({ ...formData, rule_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_value">Threshold Value</Label>
                <Input
                  id="threshold_value"
                  type="number"
                  value={formData.threshold_value}
                  onChange={(e) => setFormData({ ...formData, threshold_value: e.target.value })}
                  placeholder="e.g., 500 for cash box, 30 for temp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_duration_minutes">Duration (minutes)</Label>
                <Input
                  id="threshold_duration_minutes"
                  type="number"
                  value={formData.threshold_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, threshold_duration_minutes: e.target.value })}
                  placeholder="e.g., 10 for door open"
                />
              </div>
              <Button type="submit" className="w-full">Create Rule</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.name}</TableCell>
                <TableCell>
                  {RULE_TYPES.find(t => t.value === rule.rule_type)?.label || rule.rule_type}
                </TableCell>
                <TableCell>{rule.threshold_value || "—"}</TableCell>
                <TableCell>{rule.threshold_duration_minutes ? `${rule.threshold_duration_minutes} min` : "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => handleToggle(rule.id, enabled)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule.mutate(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

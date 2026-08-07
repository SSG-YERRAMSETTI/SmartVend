import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Key, Copy, Trash2, Code } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/useApiKeys";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ApiKeys() {
  const [createOpen, setCreateOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const handleCreateKey = async () => {
    if (!keyName) {
      toast.error("Please enter a key name");
      return;
    }
    const result = await createApiKey.mutateAsync({ name: keyName, scopes });
    setNewKey(result.full_key);
    setKeyName("");
    setScopes(["read"]);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  const handleDeleteKey = (id: string) => {
    if (confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      deleteApiKey.mutate(id);
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const codeExamples = {
    products: `# Get all products
curl -X GET \\
  https://api.yourdomain.com/v1/products \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Create a product
curl -X POST \\
  https://api.yourdomain.com/v1/products \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Coca-Cola 500ml",
    "sku": "COKE-500",
    "category": "Beverages",
    "cost_price": 1.20,
    "sell_price": 2.50,
    "tax_rate": 8.0
  }'`,
    machines: `# Get all machines
curl -X GET \\
  https://api.yourdomain.com/v1/machines \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Get machine details
curl -X GET \\
  https://api.yourdomain.com/v1/machines/{machine_id} \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Update machine status
curl -X PATCH \\
  https://api.yourdomain.com/v1/machines/{machine_id} \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{"status": "active"}'`,
    sales: `# Get sales records
curl -X GET \\
  https://api.yourdomain.com/v1/sales?start_date=2025-01-01&end_date=2025-01-31 \\
  -H 'Authorization: Bearer vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Create a sale (admin scope required)
curl -X POST \\
  https://api.yourdomain.com/v1/sales \\
  -H 'Authorization: Bearer vms_admin_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "machine_id": "uuid-here",
    "product_id": "uuid-here",
    "qty": 1,
    "unit_price": 2.50,
    "payment_method": "card"
  }'`,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Keys</h1>
          <p className="text-muted-foreground">Manage API access tokens</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExamplesOpen(true)}>
            <Code className="h-4 w-4 mr-2" />
            API Examples
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Key className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              {newKey ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      <p className="font-semibold mb-2">Your new API key:</p>
                      <code className="block bg-muted p-3 rounded text-sm break-all">
                        {newKey}
                      </code>
                      <p className="text-xs text-muted-foreground mt-2">
                        Make sure to copy this now. You won't be able to see it again!
                      </p>
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        handleCopyKey(newKey);
                        setNewKey(null);
                        setCreateOpen(false);
                      }}
                      className="flex-1"
                    >
                      Copy and Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="Production API Key"
                    />
                  </div>
                  <div>
                    <Label>Scopes</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={scopes.includes("read")}
                          onCheckedChange={() => toggleScope("read")}
                        />
                        <Label className="font-normal">Read - View resources</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={scopes.includes("write")}
                          onCheckedChange={() => toggleScope("write")}
                        />
                        <Label className="font-normal">Write - Create/update resources</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={scopes.includes("admin")}
                          onCheckedChange={() => toggleScope("admin")}
                        />
                        <Label className="font-normal">Admin - Full system access</Label>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleCreateKey} className="w-full">
                    Create Key
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Make sure to copy your API key now. You won't be able to see it again!
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-muted-foreground">No API keys created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {key.key_prefix}_*********************
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="outline">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Examples</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="products">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="machines">Machines</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{codeExamples.products}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(codeExamples.products);
                  toast.success("Code copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </TabsContent>
            <TabsContent value="machines" className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{codeExamples.machines}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(codeExamples.machines);
                  toast.success("Code copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </TabsContent>
            <TabsContent value="sales" className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{codeExamples.sales}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(codeExamples.sales);
                  toast.success("Code copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

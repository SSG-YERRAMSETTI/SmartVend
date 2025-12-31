import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = "https://fxkiakkmzkxrpttgqpeh.supabase.co/functions/v1/api";

export default function ApiDocs() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const endpoints = [
    {
      name: "Products",
      path: "/products",
      methods: ["GET", "POST"],
      description: "Manage product catalog",
      example: `# List products with pagination
curl -X GET \\
  "${API_BASE_URL}/products?page=1&limit=50" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Create a product (requires write scope)
curl -X POST \\
  "${API_BASE_URL}/products" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Coca-Cola 500ml",
    "sku": "COKE-500",
    "category": "Beverages",
    "cost_price": 1.20,
    "sell_price": 2.50,
    "tax_rate": 8.0
  }'`,
      response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Coca-Cola 500ml",
      "sku": "COKE-500",
      "category": "Beverages",
      "cost_price": 1.20,
      "sell_price": 2.50,
      "tax_rate": 8.0,
      "created_at": "2025-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}`,
    },
    {
      name: "Machines",
      path: "/machines",
      methods: ["GET"],
      description: "Access vending machine data",
      example: `# List all machines
curl -X GET \\
  "${API_BASE_URL}/machines?page=1&limit=50" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Filter by location
curl -X GET \\
  "${API_BASE_URL}/machines?location_id=uuid-here" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'`,
      response: `{
  "data": [
    {
      "id": "uuid",
      "asset_tag": "VM-001",
      "model": "Seaga Infinity",
      "serial": "SN12345",
      "location_id": "uuid",
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "pages": 1
  }
}`,
    },
    {
      name: "Sales",
      path: "/sales",
      methods: ["GET"],
      description: "Retrieve sales transactions",
      example: `# Get sales with date range
curl -X GET \\
  "${API_BASE_URL}/sales?start_date=2025-01-01&end_date=2025-01-31&page=1&limit=100" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'

# Filter by machine
curl -X GET \\
  "${API_BASE_URL}/sales?machine_id=uuid-here" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'`,
      response: `{
  "data": [
    {
      "id": "uuid",
      "machine_id": "uuid",
      "product_id": "uuid",
      "qty": 1,
      "unit_price": 2.50,
      "payment_method": "card",
      "occurred_at": "2025-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1250,
    "pages": 13
  }
}`,
    },
    {
      name: "Locations",
      path: "/locations",
      methods: ["GET"],
      description: "Access location and site data",
      example: `# List all locations
curl -X GET \\
  "${API_BASE_URL}/locations" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'`,
      response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Downtown Office Building",
      "address": "123 Main St",
      "commission_type": "percentage",
      "commission_value": 10.00,
      "created_at": "2025-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "pages": 1
  }
}`,
    },
    {
      name: "Routes",
      path: "/routes",
      methods: ["GET"],
      description: "Access route and stop information",
      example: `# List routes
curl -X GET \\
  "${API_BASE_URL}/routes" \\
  -H 'x-api-key: vms_prod_your_api_key_here' \\
  -H 'Content-Type: application/json'`,
      response: `{
  "data": [
    {
      "id": "uuid",
      "name": "North Route",
      "frequency": "daily",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 8,
    "pages": 1
  }
}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground">
          REST API reference for integrating with your VMS
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            All API requests require authentication using an API key. Include your API key in
            the request header:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-xs">
            <code>x-api-key: vms_prod_your_api_key_here</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            You can create and manage API keys in the{" "}
            <a href="/app/admin/api-keys" className="text-primary hover:underline">
              API Keys
            </a>{" "}
            section.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
            <code className="text-sm">{API_BASE_URL}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(API_BASE_URL)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-4 font-medium border-b pb-2">
              <div>Parameter</div>
              <div>Type</div>
              <div>Description</div>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <code>page</code>
              <span className="text-muted-foreground">integer</span>
              <span>Page number (default: 1)</span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <code>limit</code>
              <span className="text-muted-foreground">integer</span>
              <span>Items per page (default: 50, max: 100)</span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <code>start_date</code>
              <span className="text-muted-foreground">ISO 8601</span>
              <span>Filter by start date</span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <code>end_date</code>
              <span className="text-muted-foreground">ISO 8601</span>
              <span>Filter by end date</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={endpoints[0].path}>
        <TabsList className="grid w-full grid-cols-5">
          {endpoints.map((endpoint) => (
            <TabsTrigger key={endpoint.path} value={endpoint.path}>
              {endpoint.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {endpoints.map((endpoint) => (
          <TabsContent key={endpoint.path} value={endpoint.path} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{endpoint.name}</CardTitle>
                  <div className="flex gap-2">
                    {endpoint.methods.map((method) => (
                      <Badge key={method} variant="outline">
                        {method}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Request Example</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                    <code>{endpoint.example}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(endpoint.example)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Response Example</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                    <code>{endpoint.response}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(endpoint.response)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>API requests are rate limited based on your subscription plan:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>Standard: 1,000 requests per hour</li>
            <li>Professional: 5,000 requests per hour</li>
            <li>Enterprise: Custom limits</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Rate limit information is included in response headers:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-xs mt-2">
            <code>{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1611234567`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

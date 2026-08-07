import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Radio, BarChart3, ExternalLink } from "lucide-react";

export default function Integrations() {
  const integrations = [
    {
      id: "payment",
      name: "Payment Gateway",
      icon: CreditCard,
      description: "Connect Stripe or Square for cashless payments",
      status: "not_configured",
      config: [
        { key: "api_key", label: "API Key", type: "password" },
        { key: "webhook_secret", label: "Webhook Secret", type: "password" },
      ],
    },
    {
      id: "telemetry",
      name: "Telemetry Vendor",
      icon: Radio,
      description: "Integrate with IoT device provider",
      status: "not_configured",
      config: [
        { key: "vendor_url", label: "Vendor URL", type: "text" },
        { key: "api_token", label: "API Token", type: "password" },
        { key: "device_prefix", label: "Device ID Prefix", type: "text" },
      ],
    },
    {
      id: "bi",
      name: "BI Connector",
      icon: BarChart3,
      description: "Export data to Google Looker Studio or Power BI",
      status: "not_configured",
      config: [
        { key: "export_url", label: "Export Endpoint", type: "text" },
        { key: "refresh_token", label: "OAuth Refresh Token", type: "password" },
      ],
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Not Configured</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground">Connect external services and APIs</p>
      </div>

      <div className="grid gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{integration.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(integration.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {integration.config.map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          disabled
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button disabled>Save Configuration</Button>
                    <Button variant="outline" disabled>
                      Test Connection
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Documentation
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This integration is a placeholder. Contact support to enable this feature.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

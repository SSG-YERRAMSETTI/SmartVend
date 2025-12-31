import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Users, Warehouse, DollarSign, Plug, Shield, Key, Webhook, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const navigate = useNavigate();
  
  const adminSections = [
    { title: "Users & Roles", icon: Users, description: "Manage team members and permissions", path: "/app/admin/users" },
    { title: "Permissions Matrix", icon: Shield, description: "View role-based access control", path: "/app/admin/permissions" },
    { title: "Warehouses", icon: Warehouse, description: "Configure warehouse locations", path: "/app/admin/warehouses" },
    { title: "Vehicles", icon: Settings, description: "Manage fleet vehicles", path: "/app/admin/vehicles" },
    { title: "Price Lists", icon: DollarSign, description: "Set product pricing", path: "/app/admin/price-lists" },
    { title: "Integrations", icon: Plug, description: "Connect external services", path: "/app/admin/integrations" },
    { title: "API Keys", icon: Key, description: "Manage API access tokens", path: "/app/admin/api-keys" },
    { title: "Webhooks", icon: Webhook, description: "Configure event notifications", path: "/app/admin/webhooks" },
    { title: "API Docs", icon: BookOpen, description: "REST API documentation", path: "/app/admin/api-docs" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-muted-foreground">System configuration and settings</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {adminSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                </div>
                <img src="/favicon.ico" alt="SmartVend logo" className="h-8 w-8" />
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full" onClick={() => section.path !== "#" && navigate(section.path)}>
                Configure
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

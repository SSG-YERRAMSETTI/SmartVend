import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { ROLE_PERMISSIONS, type AppRole } from "@/lib/permissions";

export default function PermissionsMatrix() {
  const roles: AppRole[] = ["admin", "dispatcher", "driver", "accountant", "location_partner"];
  
  const permissionLabels: Record<string, string> = {
    view_dashboard: "View Dashboard",
    view_machines: "View Machines",
    manage_machines: "Manage Machines",
    view_inventory: "View Inventory",
    manage_inventory: "Manage Inventory",
    view_routes: "View Routes",
    manage_routes: "Manage Routes",
    view_orders: "View Orders",
    manage_orders: "Manage Orders",
    view_telemetry: "View Telemetry",
    view_sales: "View Sales",
    manage_sales: "Manage Sales",
    view_reports: "View Reports",
    view_locations: "View Locations",
    manage_locations: "Manage Locations",
    view_commissions: "View Commissions",
    manage_billing: "Manage Billing",
    view_admin: "View Admin",
    manage_users: "Manage Users",
    manage_roles: "Manage Roles",
  };

  const roleLabels: Record<AppRole, string> = {
    admin: "Owner/Admin",
    dispatcher: "Dispatcher",
    driver: "Driver/Tech",
    accountant: "Accountant",
    location_partner: "Location Partner",
  };

  const allPermissions = Object.keys(permissionLabels);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Permissions Matrix</h1>
        <p className="text-muted-foreground">Role-based access control for SmartVend</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            What each role can access in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Permission</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role} className="text-center">
                      {roleLabels[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPermissions.map((permission) => (
                  <TableRow key={permission}>
                    <TableCell className="font-medium">
                      {permissionLabels[permission]}
                    </TableCell>
                    {roles.map((role) => {
                      const hasPermission = ROLE_PERMISSIONS[role]?.includes(permission as any);
                      return (
                        <TableCell key={`${role}-${permission}`} className="text-center">
                          {hasPermission ? (
                            <Check className="h-5 w-5 text-success mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Descriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Owner/Admin</h3>
              <p className="text-sm text-muted-foreground">
                Full access to all features including billing, user management, and system configuration.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Dispatcher/Operations</h3>
              <p className="text-sm text-muted-foreground">
                Manages routes, machines, inventory, and orders. Can view reports but no billing access.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Driver/Technician</h3>
              <p className="text-sm text-muted-foreground">
                Mobile-focused role for servicing machines, viewing assigned routes, and completing checklists.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Accountant</h3>
              <p className="text-sm text-muted-foreground">
                Financial focus: sales tracking, commission calculations, reports, and billing management.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Location Partner</h3>
              <p className="text-sm text-muted-foreground">
                Read-only access to view sales and commission statements for their specific locations.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Role Assignment</h3>
              <p className="text-sm text-muted-foreground">
                Only admins can assign or modify user roles. New users are assigned the "driver" role by default.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Multiple Roles</h3>
              <p className="text-sm text-muted-foreground">
                Users can have multiple roles. Permissions are cumulative (union of all assigned roles).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Row Level Security</h3>
              <p className="text-sm text-muted-foreground">
                Database access is protected with RLS policies that enforce role-based permissions at the data layer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

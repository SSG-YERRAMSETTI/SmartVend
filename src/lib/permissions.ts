export type AppRole = "admin" | "dispatcher" | "driver" | "accountant" | "location_partner";

export type Permission = 
  | "view_dashboard"
  | "view_machines"
  | "manage_machines"
  | "view_inventory"
  | "manage_inventory"
  | "view_routes"
  | "manage_routes"
  | "view_orders"
  | "manage_orders"
  | "view_telemetry"
  | "view_sales"
  | "manage_sales"
  | "view_reports"
  | "view_locations"
  | "manage_locations"
  | "view_commissions"
  | "manage_billing"
  | "view_admin"
  | "manage_users"
  | "manage_roles"
  | "view_location_portal"
  | "view_receipts"   
  | "manage_receipts"
  |"view_smart_advisor"
  | "report_generation";  

// Permissions matrix defining what each role can do
export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    "view_dashboard",
    "view_machines",
    "manage_machines",
    "view_inventory",
    "manage_inventory",
    "view_routes",
    "manage_routes",
    "view_orders",
    "manage_orders",
    "view_telemetry",
    "view_sales",
    "manage_sales",
    "view_reports",
    "view_locations",
    "manage_locations",
    "view_commissions",
    "manage_billing",
    "view_admin",
    "manage_users",
    "manage_roles",
    "view_receipts",    
    "manage_receipts",
    "view_smart_advisor"
  ],
  dispatcher: [
    "view_dashboard",
    "view_machines",
    "manage_machines",
    "view_inventory",
    "manage_inventory",
    "view_routes",
    "manage_routes",
    "view_orders",
    "manage_orders",
    "view_telemetry",
    "view_reports",
    "view_receipts",
    "view_smart_advisor", 
  ],
  driver: [
    "view_dashboard",
    "view_machines",
    "view_inventory",
    "view_routes",
    "view_orders",
    "view_receipts",
    "view_smart_advisor",
    "view_reports" 
  ],
  accountant: [
    "view_dashboard",
    "view_sales",
    "view_reports",
    "view_commissions",
    "manage_billing",
  ],
  location_partner: [
    "view_sales",
    "view_reports",
    "view_commissions",
    "view_location_portal",
  ],
};

// Navigation items with required permissions
export interface NavItem {
  title: string;
  url: string;
  icon: string;
  permission: Permission;
}

export const NAV_ITEMS = {
  main: [
    { title: "Dashboard", url: "/app", permission: "view_dashboard" },
    { title: "Location Portal", url: "/app/location-portal", permission: "view_location_portal" },
    { title: "Machines", url: "/app/machines", permission: "view_machines" },
    { title: "Products & Inventory", url: "/app/inventory", permission: "view_inventory" },
    { title: "Receipts", url: "/app/receipts", permission: "view_receipts" },
    { title: "Smart Advisor", url: "/app/advisor", permission: "view_smart_advisor" },
    { title: "Routes & Service", url: "/app/routes", permission: "view_routes" },
    { title: "Orders & Pre-kitting", url: "/app/orders", permission: "view_orders" },
    { title: "Telemetry", url: "/app/telemetry", permission: "view_telemetry" },
    { title: "Sales & Payments", url: "/app/sales", permission: "view_sales" },
    { title: "Reports", url: "/app/reports", permission: "view_reports" },
    { title: "Locations & Commissions", url: "/app/locations", permission: "view_locations" },
  ],
  settings: [
    { title: "Admin", url: "/app/admin", permission: "view_admin" },
    { title: "Help", url: "/app/help", permission: "view_dashboard" }, // Everyone can access help
  ],
};

export function hasPermission(userRoles: AppRole[], permission: Permission): boolean {
  return userRoles.some(role => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function getAccessibleNavItems(userRoles: AppRole[]) {
  const main = NAV_ITEMS.main.filter(item => 
    hasPermission(userRoles, item.permission as Permission)
  );
  
  const settings = NAV_ITEMS.settings.filter(item => 
    hasPermission(userRoles, item.permission as Permission)
  );

  return { main, settings };
}

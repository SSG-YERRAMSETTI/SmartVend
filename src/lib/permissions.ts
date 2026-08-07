export type AppRole = "platform_admin" | "route_owner" | "driver";

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
  | "manage_organizations"
  | "manage_users"
  | "view_receipts"
  | "manage_receipts"
  | "view_smart_advisor"
  | "report_generation"
  | "view_tickets"
  | "view_mileage"
  | "view_expenses"
  | "view_calendar"
  | "manage_org_settings"
  | "view_purchases";

// Permissions matrix defining what each role can do.
// platform_admin: runs the whole platform, onboards businesses (organizations).
// route_owner: runs one business (tenant) — full control of their own machines/routes/drivers.
// driver: restricted to restocking/route execution, nothing administrative.
export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  platform_admin: [
    "view_dashboard",
    "view_admin",
    "manage_organizations",
    "manage_users",
    "view_machines",
    "view_inventory",
    "view_routes",
    "view_orders",
    "view_telemetry",
    "view_sales",
    "view_reports",
    "view_locations",
    "view_commissions",
    "manage_billing",
    "view_receipts",
    "view_smart_advisor",
  ],
  route_owner: [
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
    "manage_users",
    "view_receipts",
    "manage_receipts",
    "view_smart_advisor",
    "report_generation",
    "view_tickets",
    "view_mileage",
    "view_expenses",
    "view_calendar",
    "manage_org_settings",
    "view_purchases",
  ],
  driver: [
    "view_dashboard",
    "view_machines",
    "view_inventory",
    "view_routes",
    "view_orders",
    "view_receipts",
    "view_tickets",
    "view_mileage",
    "view_calendar",
    "view_purchases",
  ],
};

export interface NavItem {
  title: string;
  url: string;
  icon: string;
  permission: Permission;
}

export const NAV_ITEMS = {
  main: [
    { title: "Dashboard", url: "/app", permission: "view_dashboard" },
    { title: "My Trips", url: "/app/driver", permission: "view_routes" },
    { title: "Calendar", url: "/app/calendar", permission: "view_calendar" },
    { title: "Trips", url: "/app/trips", permission: "manage_routes" },
    { title: "Routes", url: "/app/routes", permission: "view_routes" },
    { title: "Machines", url: "/app/machines", permission: "view_machines" },
    { title: "Locations", url: "/app/locations", permission: "view_locations" },
    { title: "Products & Inventory", url: "/app/products", permission: "view_inventory" },
    { title: "Purchases", url: "/app/purchases", permission: "view_purchases" },
    { title: "Smart Advisor", url: "/app/advisor", permission: "view_smart_advisor" },
    { title: "Tickets", url: "/app/tickets", permission: "view_tickets" },
    { title: "Mileage Log", url: "/app/mileage", permission: "view_mileage" },
    { title: "Expenses", url: "/app/expenses", permission: "view_expenses" },
    { title: "Reports", url: "/app/reports", permission: "view_reports" },
  ],
  settings: [
    { title: "Team", url: "/app/admin/users", permission: "manage_users" },
    { title: "Configuration", url: "/app/configuration", permission: "manage_org_settings" },
    { title: "Help", url: "/app/help", permission: "view_dashboard" },
  ],
} as const;

export function hasPermission(userRoles: AppRole[], permission: Permission): boolean {
  return userRoles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function getAccessibleNavItems(userRoles: AppRole[]) {
  const main = NAV_ITEMS.main.filter((item) =>
    hasPermission(userRoles, item.permission as Permission)
  );
  const settings = NAV_ITEMS.settings.filter((item) =>
    hasPermission(userRoles, item.permission as Permission)
  );
  return { main, settings };
}

/** Where each role should land right after login. */
export function getHomeRouteForRole(role: AppRole): string {
  if (role === "driver") return "/app/driver";
  return "/app";
}

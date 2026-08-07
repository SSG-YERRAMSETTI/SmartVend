import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { user, roles } = useAuth();

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-bold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Full Name</dt>
            <dd className="mt-0.5">{user?.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Email</dt>
            <dd className="mt-0.5">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Role</dt>
            <dd className="mt-1">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="mr-1">{r.replace("_", " ")}</Badge>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Account Status</dt>
            <dd className="mt-0.5">
              <Badge variant={user?.is_active ? "default" : "destructive"}>
                {user?.is_active ? "Active" : "Deactivated"}
              </Badge>
            </dd>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        To change your name or password, contact your organization's owner or admin.
      </p>
    </div>
  );
}

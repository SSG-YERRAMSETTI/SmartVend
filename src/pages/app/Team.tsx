import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, UserX } from "lucide-react";
import { useOrgUsers, useCreateDriver, useDeactivateUser } from "@/hooks/useApi";

export default function Team() {
  const { data: users, isLoading } = useOrgUsers();
  const createDriver = useCreateDriver();
  const deactivateUser = useDeactivateUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const handleCreate = () => {
    createDriver.mutate(form, {
      onSuccess: () => {
        setDialogOpen(false);
        setForm({ full_name: "", email: "", password: "" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Team</h1>
          <p className="text-muted-foreground">
            Create driver logins. Drivers can only see trips assigned to them.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Driver
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading team...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "route_owner" ? "default" : "secondary"}>
                        {u.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "outline" : "destructive"}>
                        {u.is_active ? "Active" : "Deactivated"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.role === "driver" && u.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateUser.mutate(u.id)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
            <DialogDescription>
              The driver signs in with this email and password. Share the credentials with them
              directly — there's no public sign-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">At least 6 characters.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={
                !form.full_name || !form.email || form.password.length < 6 || createDriver.isPending
              }
            >
              Create Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

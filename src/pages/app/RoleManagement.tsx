import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "dispatcher" | "driver" | "accountant" | "location_partner";

interface UserRole {
  user_id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
}

export default function RoleManagement() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => ({
        user_id: profile.id,
        email: profile.email,
        full_name: profile.full_name || "Unknown",
        roles: userRoles
          ?.filter(ur => ur.user_id === profile.id)
          .map(ur => ur.role as AppRole) || [],
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading users",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (error) throw error;

      toast({
        title: "Role added",
        description: `Successfully added ${role} role`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding role",
        description: error.message,
      });
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "Role removed",
        description: `Successfully removed ${role} role`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error removing role",
        description: error.message,
      });
    }
  };

  if (!hasRole("admin")) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only admins can manage user roles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Role Management</h1>
        <p className="text-muted-foreground">Assign and manage user roles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Roles</CardTitle>
          <CardDescription>
            Manage role assignments for all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Roles</TableHead>
                <TableHead>Add Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeRole(user.user_id, role)}
                        >
                          {role} ×
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select onValueChange={(value) => addRole(user.user_id, value as AppRole)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Add role..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="dispatcher">Dispatcher</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="location_partner">Location Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

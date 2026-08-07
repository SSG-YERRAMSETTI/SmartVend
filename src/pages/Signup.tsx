import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth, ApiError } from "@/hooks/useAuth";
import { api, setToken } from "@/lib/apiClient";
import { getHomeRouteForRole } from "@/lib/permissions";
import { z } from "zod";

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * This page ONLY creates the single Platform Admin / Owner account, and only
 * works once — the backend refuses a second call once an admin exists.
 * There is no open self-signup: Route Owners are onboarded by the Platform
 * Admin (Admin > Organizations), and Drivers are created by their Route Owner
 * (Admin > Team). This matches the intended hierarchy:
 *   Platform Admin -> Route/Machine Owner -> Driver
 */
export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadyBootstrapped, setAlreadyBootstrapped] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(getHomeRouteForRole(user.role));
    }
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = signupSchema.safeParse({ fullName, email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    try {
      setLoading(true);
      const res = await api.post<{ access_token: string; role: string }>(
        "/auth/bootstrap-admin",
        { email, password, full_name: fullName }
      );
      setToken(res.access_token);
      toast({
        title: "Admin account created!",
        description: "Welcome to SmartVend. Redirecting...",
      });
      window.location.href = "/app"; // full reload so useAuth picks up the new token
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        setAlreadyBootstrapped(true);
      }
      toast({
        variant: "destructive",
        title: "Error creating account",
        description: error instanceof ApiError ? error.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-20 w-20 flex items-center justify-center">
              <img src="/favicon.ico" alt="SmartVend logo" className="h-20 w-20" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set up SmartVend</CardTitle>
          <CardDescription>
            Create the one platform admin/owner account. Everyone else is added
            from inside the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alreadyBootstrapped ? (
            <div className="text-center text-sm text-muted-foreground">
              An admin account already exists for this installation.{" "}
              <Link to="/login" className="text-primary hover:underline">
                Go to login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Owner"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create admin account"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                Already set up?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

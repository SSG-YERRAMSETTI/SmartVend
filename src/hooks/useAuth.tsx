import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, setToken, clearToken, ApiError } from "@/lib/apiClient";
import { AppRole, getHomeRouteForRole } from "@/lib/permissions";

interface CurrentUser {
  id: string;
  org_id: string | null;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
}

interface AuthContextType {
  user: CurrentUser | null;
  roles: AppRole[]; // kept as an array for compatibility with hasRole/hasAnyRole call sites
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadCurrentUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch (err) {
      // token invalid/expired
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{
      access_token: string;
      role: AppRole;
      org_id: string | null;
      full_name: string | null;
    }>("/auth/login", { email, password });

    setToken(res.access_token);
    await loadCurrentUser();
    navigate(getHomeRouteForRole(res.role));
  };

  const signOut = () => {
    clearToken();
    setUser(null);
    navigate("/login");
  };

  const roles: AppRole[] = user ? [user.role] : [];

  const hasRole = (role: AppRole): boolean => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]): boolean =>
    checkRoles.some((role) => roles.includes(role));

  return (
    <AuthContext.Provider
      value={{ user, roles, loading, hasRole, hasAnyRole, login, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { ApiError };

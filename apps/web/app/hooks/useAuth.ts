/**
 * `useAuth` - single source of truth for current-user state in the web app.
 *
 * The previous code duplicated a `useEffect` that called `authAPI.getUser()`
 * on every layout/route. Centralising the lookup:
 *  - avoids repeated network calls in nested layouts
 *  - lets role-aware guards live in one place
 *  - simplifies testing (a single hook can be mocked instead of dispatching
 *    fetches in every component)
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { authAPI } from "~/lib/api";
import { useUserStore } from "~/stores/userStore";
import type { Role, User } from "~/types/api";

export interface UseAuthResult {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  ensureLoaded: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isSuperAdmin: boolean;
}

/**
 * Returns the current user plus auth helpers. Safe to call anywhere; the
 * component that owns this hook still needs to navigate on session loss.
 */
export function useAuth(): UseAuthResult {
  const { user, setUser, setLoading, logout: storeLogout, isLoading, isAuthenticated } = useUserStore();
  const navigate = useNavigate();

  const ensureLoaded = useCallback(async () => {
    if (user) return;
    setLoading(true);
    try {
      const res = await authAPI.getUser();
      setUser(res.data);
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser, user]);

  useEffect(() => {
    if (!user && !isAuthenticated) {
      ensureLoaded().catch(() => {
        navigate("/", { replace: true });
      });
    }
  }, [user, isAuthenticated, ensureLoaded, navigate]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      storeLogout();
      navigate("/", { replace: true });
    }
  }, [navigate, storeLogout]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && (user.isSuperAdmin || roles.includes(user.role)),
    [user],
  );

  return {
    user,
    isLoading,
    isAuthenticated,
    ensureLoaded,
    logout,
    hasRole,
    isSuperAdmin: !!user?.isSuperAdmin,
  };
}

/**
 * Convenience guard for routes that require a specific role.
 * Returns the user when access is allowed, otherwise redirects to `/`.
 */
export function useRequireRole(...roles: Role[]): User | null {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (roles.length > 0 && !user.isSuperAdmin && !roles.includes(user.role)) {
      navigate(redirectForRole(user.role), { replace: true });
    }
  }, [user, isLoading, navigate, roles]);

  if (!user) return null;
  if (roles.length === 0) return user;
  if (user.isSuperAdmin || roles.includes(user.role)) return user;
  return null;
}

function redirectForRole(role: Role): string {
  if (role === "lecturer") return "/lecturer";
  if (role === "admin") return "/admin";
  if (role === "student") return "/student";
  return "/";
}

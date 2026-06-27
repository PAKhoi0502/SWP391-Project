import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService, authStorage } from "../services/authService";

const AuthContext = createContext(null);

function getRole(user) {
  return (
    user?.role ||
    user?.roleName ||
    user?.accountRole ||
    user?.authorities?.[0]?.authority ||
    "CUSTOMER"
  ).toUpperCase();
}

export function getRedirectPathByRole(role) {
  const normalizedRole = String(role || "CUSTOMER").toUpperCase();

  if (normalizedRole.includes("ADMIN")) return "/admin";
  if (normalizedRole.includes("STAFF")) return "/staff";
  if (normalizedRole.includes("MANAGER")) return "/manager";

  return "/";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(authStorage.getAccessToken());

  const loadCurrentUser = async () => {
    if (!authStorage.getAccessToken()) {
      setLoading(false);
      return null;
    }

    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      authStorage.setAuth({ user: currentUser });
      return currentUser;
    } catch {
      authStorage.clearAuth();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload) => {
    const authData = await authService.login(payload);

    authStorage.setAuth({
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      user: authData.user,
    });

    let loggedUser = authData.user;

    if (!loggedUser) {
      loggedUser = await authService.getCurrentUser();
      authStorage.setAuth({ user: loggedUser });
    }

    setUser(loggedUser);
    return loggedUser;
  };

  const register = async (payload) => {
    return authService.register(payload);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const setCurrentUser = (currentUser) => {
    setUser(currentUser);
    authStorage.setAuth({ user: currentUser });
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: getRole(user),
      loading,
      isAuthenticated,
      login,
      register,
      logout,
      loadCurrentUser,
      setCurrentUser,
    }),
    [user, loading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

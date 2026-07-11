import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService, authStorage } from "../services/authService";

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function buildUserFromToken(token) {
  const decoded = decodeJwt(token);

  if (!decoded) return null;

  return {
    id: decoded.sub,
    role: decoded.role,
    email: decoded.email,
    fullName: decoded.fullName || decoded.name,
  };
}
function normalizeUser(user, token) {
  const tokenUser = token ? buildUserFromToken(token) : null;

  const role =
    user?.role ||
    user?.roleName ||
    user?.accountRole ||
    user?.authorities?.[0]?.authority ||
    tokenUser?.role ||
    "";

  return {
    id: user?.id || user?.userId || user?.accountId || tokenUser?.id || null,
    fullName:
      user?.fullName ||
      user?.name ||
      tokenUser?.fullName ||
      user?.email ||
      tokenUser?.email ||
      "",
    email: user?.email || tokenUser?.email || null,
    phone: user?.phone || null,
    role: String(role).toUpperCase(),
    avatarUrl: user?.avatarUrl || null,
    avatarPublicId: user?.avatarPublicId || null,
  };
}

function getRole(user) {
  return String(
    user?.role ||
      user?.roleName ||
      user?.accountRole ||
      user?.authorities?.[0]?.authority ||
      ""
  ).toUpperCase();
}

export function getRedirectPathByRole(role) {
  const normalizedRole = String(role || "").toUpperCase();

  if (normalizedRole.includes("ADMIN")) return "/admin";
  if (normalizedRole.includes("STAFF")) return "/staff";
  if (normalizedRole.includes("MANAGER")) return "/manager";
  if (normalizedRole.includes("CUSTOMER")) return "/";

  return "/login";
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    return authStorage.getAccessToken() || null;
  });

  const [user, setUser] = useState(() => {
    return authStorage.getUser() || null;
  });

  // Start non-loading if both token + cached user exist — avoids Sign in/Sign up flash on F5
  const [loading, setLoading] = useState(() => {
    const hasToken = Boolean(authStorage.getAccessToken())
    const hasUser  = Boolean(authStorage.getUser())
    return !(hasToken && hasUser)
  });

  const isAuthenticated = Boolean(accessToken && user);

  const loadCurrentUser = useCallback(async () => {
    const token = authStorage.getAccessToken();

    if (!token) {
      setAccessToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }

    setAccessToken(token);

    try {
      const currentUser = await authService.getCurrentUser();

      // Merge API response with cached user: keep cached fullName/email if API omits them
      const cachedUser = authStorage.getUser();
      const merged = { ...cachedUser, ...currentUser };
      if (!merged.fullName) merged.fullName = cachedUser?.fullName || '';
      if (!merged.email)    merged.email    = cachedUser?.email    || null;

      const finalUser = merged ? normalizeUser(merged, token) : null;

      if (finalUser) {
        setUser(finalUser);
        authStorage.setAuth({ accessToken: token, user: finalUser });
      }

      return finalUser;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        authStorage.clearAuth();
        setAccessToken(null);
        setUser(null);
      }
      // Network errors / 500s: keep existing token and cached user
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

 const login = async (payload) => {
  const authData = await authService.login(payload);

  const token =
    authData.accessToken ||
    authData.token ||
    authData.data?.accessToken;

  const refreshToken =
    authData.refreshToken ||
    authData.data?.refreshToken ||
    null;

  const rawLoggedUser =
    authData.user ||
    authData.data?.user ||
    buildUserFromToken(token);

  let loggedUser = normalizeUser(rawLoggedUser, token);

  // QUAN TRỌNG: xóa session cũ trước khi lưu tài khoản mới
  authStorage.clearAuth();

  authStorage.setAuth({
    accessToken: token,
    refreshToken,
    user: loggedUser,
  });

  try {
    const currentUser = await authService.getCurrentUser();
    loggedUser = normalizeUser(currentUser, token);
    authStorage.setAuth({ user: loggedUser });
  } catch {
    loggedUser = normalizeUser(rawLoggedUser, token);
  }

  setAccessToken(token);
  setUser(loggedUser);

  return loggedUser;
};
  const register = async (payload) => {
    return authService.register(payload);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      authStorage.clearAuth();
      setAccessToken(null);
      setUser(null);
    }
  };

  const setCurrentUser = useCallback((currentUser) => {
    const cachedUser = authStorage.getUser();
    const merged = {
      ...currentUser,
      fullName: currentUser?.fullName || currentUser?.name || cachedUser?.fullName || '',
      email:    currentUser?.email    || cachedUser?.email    || null,
    };
    setUser(merged);
    authStorage.setAuth({ user: merged });
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

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
    [user, loading, isAuthenticated, loadCurrentUser, setCurrentUser]
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

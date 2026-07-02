import api from "./api";

const TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

export const authStorage = {
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token");
  },

  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser() {
    const rawUser = localStorage.getItem(USER_KEY);
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser);
    } catch {
      return null;
    }
  },

  setAuth({ accessToken, refreshToken, user }) {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem("token", accessToken);
    }

    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  clearAuth() {
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_KEY);
      storage.removeItem("token");
      storage.removeItem("currentUser");
      storage.removeItem("role");
    });
  },
};

function normalizeAuthResponse(data) {
  return {
    accessToken:
      data?.accessToken ||
      data?.token ||
      data?.data?.accessToken ||
      data?.data?.token,

    refreshToken:
      data?.refreshToken ||
      data?.data?.refreshToken,

    user:
      data?.user ||
      data?.data?.user ||
      data?.account ||
      null,
  };
}

export const authService = {
  async register(payload) {
    const res = await api.post("/auth/register", payload);
    return res.data;
  },

  async login(payload) {
    const res = await api.post("/auth/login", payload);
    return normalizeAuthResponse(res.data);
  },

  async refreshToken() {
    const refreshToken = authStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error("No refresh token");
    }

    const res = await api.post("/auth/refresh-token", { refreshToken });
    return normalizeAuthResponse(res.data);
  },

  async logout() {
    const refreshToken = authStorage.getRefreshToken();

    try {
      await api.post("/auth/logout", { refreshToken });
    } finally {
      authStorage.clearAuth();
    }
  },

  async getCurrentUser() {
    const res = await api.get("/auth/me");
    return res.data?.user || res.data?.data || res.data;
  },

  async forgotPassword(payload) {
    const res = await api.post("/auth/forgot-password", payload);
    return res.data;
  },

  async resetPassword(payload) {
    const res = await api.post("/auth/reset-password", payload);
    return res.data;
  },
};

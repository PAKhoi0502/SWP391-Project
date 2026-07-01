import axios from "axios";

const clearAuthStorage = () => {
  ["accessToken", "refreshToken", "token", "user", "currentUser", "role"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

// Gắn access token vào mọi request
api.interceptors.request.use(
  (config) => {
    const accessToken =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Tự refresh token nếu token hết hạn
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401;
    const alreadyRetried = originalRequest._retry;
    const isRefreshRequest = originalRequest.url?.includes("/auth/refresh-token");

    if (isUnauthorized && !alreadyRetried && !isRefreshRequest) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        clearAuthStorage();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          { refreshToken }
        );

        const newAccessToken =
          res.data?.accessToken ||
          res.data?.token ||
          res.data?.data?.accessToken ||
          res.data?.data?.token;

        if (newAccessToken) {
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("token", newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          return api(originalRequest);
        }

        return Promise.reject(error);
      } catch (refreshError) {
        clearAuthStorage();

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

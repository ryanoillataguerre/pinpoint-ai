import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach access token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("pinpoint_access_token");
    if (token) {
      config.headers["x-access-token"] = token;
    }
  }
  return config;
});

// Handle 401 by attempting token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("pinpoint_refresh_token");
        if (refreshToken) {
          const { data } = await axios.post("/api/auth/refresh", { refreshToken });
          localStorage.setItem("pinpoint_access_token", data.data.accessToken);
          localStorage.setItem("pinpoint_refresh_token", data.data.refreshToken);
          original.headers["x-access-token"] = data.data.accessToken;
          return api(original);
        }
      } catch {
        localStorage.removeItem("pinpoint_access_token");
        localStorage.removeItem("pinpoint_refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

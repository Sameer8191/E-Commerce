import axios from "axios";

const api = axios.create({
  // Keep API requests on the site's origin so Vercel's /api rewrite can route them.
  // An explicit VITE_API_URL can still point local development at a separate API.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

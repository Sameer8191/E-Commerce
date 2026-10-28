import axios from "axios";

const api = axios.create({
  // Keep API requests on the site's origin so Vercel's /api rewrite can route them.
  baseURL: "/api",
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

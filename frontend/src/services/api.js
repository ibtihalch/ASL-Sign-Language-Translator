import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api",
});

// ─── Token ajouté automatiquement ────────────────────────
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// ─── Si 401 → rediriger vers login ───────────────────────
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────────
export const register = (data) => API.post("/auth/register", data);
export const login    = (data) => API.post("/auth/login", data);

// ✅ AJOUT GOOGLE LOGIN
export const googleLogin = (credential) =>
  API.post("/auth/google", { credential });

// ─── Conversation ───────────────────────────────────────
export const saveMessage   = (data)           => API.post("/conv/message", data);
export const getHistory    = (page = 1, type = "") =>
  API.get(`/conv/history?page=${page}&per_page=20${type ? `&type=${type}` : ""}`);
export const deleteMessage = (id)             => API.delete(`/conv/message/${id}`);
export const getStats      = ()               => API.get("/conv/stats");

// ─── Profil ─────────────────────────────────────────────
export const getMe            = ()     => API.get("/auth/me");
export const updateProfile    = (data) => API.put("/auth/profile", data);
export const changePassword   = (data) => API.put("/auth/change-password", data);
import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api",
});

// ─── Token ajouté automatiquement ────────────────────────
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
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

// ─── Auth ────────────────────────────────────────────────
export const register    = (data)       => API.post("/auth/register", data);
export const login       = (data)       => API.post("/auth/login", data);
export const googleLogin = (credential) => API.post("/auth/google", { credential });

// ─── Conversation ────────────────────────────────────────
export const saveMessage   = (data)               => API.post("/conv/message", data);
export const getHistory    = (page = 1, type = "") => API.get(`/conv/history?page=${page}&per_page=20${type ? `&type=${type}` : ""}`);
export const deleteMessage = (id)                  => API.delete(`/conv/message/${id}`);
export const getStats      = ()                    => API.get("/conv/stats");

// ─── Profil ──────────────────────────────────────────────
export const getMe          = ()     => API.get("/auth/me");
export const updateProfile  = (data) => API.put("/auth/profile", data);
export const changePassword = (data) => API.put("/auth/change-password", data);

// ─── Stats / Leaderboard ─────────────────────────────────
export const getUserStats   = ()     => API.get("/stats");
export const markWatched    = (id)   => API.post("/stats/watch", { lesson_id: id });
export const submitQuiz     = (data) => API.post("/stats/quiz", data);
export const getLeaderboard = ()     => API.get("/stats/leaderboard");

// ─── Recherche utilisateurs ───────────────────────────────
export const searchUsers    = (q)  => API.get(`/users/search?q=${encodeURIComponent(q)}`);
export const getUserProfile = (id) => API.get(`/users/${id}`);
export const getUserFriends = (id) => API.get(`/users/${id}/friends`);

// ─── Système d'amis ───────────────────────────────────────
export const sendFriendRequest = (id) => API.post(`/friends/request/${id}`);
export const acceptFriend      = (id) => API.post(`/friends/accept/${id}`);
export const declineFriend     = (id) => API.post(`/friends/decline/${id}`);
export const removeFriend      = (id) => API.delete(`/friends/${id}`);
export const getFriendRequests = ()   => API.get("/friends/requests");

// ─── Chat ────────────────────────────────────────────────
export const getConversations = ()       => API.get("/chat/conversations");
export const getChatMessages  = (id)     => API.get(`/chat/messages/${id}`);
export const sendChatMessage  = (data)   => API.post("/chat/messages", data);
export const deleteChatMsg    = (id)     => API.delete(`/chat/messages/${id}`);
export const getUnreadCount   = ()       => API.get("/chat/unread");

// ─── Posts / Stories ─────────────────────────────────────
export const createPost    = (data)       => API.post("/posts", data);
export const getUserPosts  = (id, type)   => API.get(`/posts/user/${id}?type=${type}`);
export const toggleLike    = (pid)        => API.post(`/posts/${pid}/like`);
export const getComments   = (pid)        => API.get(`/posts/${pid}/comments`);
export const addComment    = (pid, text)  => API.post(`/posts/${pid}/comments`, { text });
export const deletePost    = (pid)        => API.delete(`/posts/${pid}`);

// ─── Feed global (mes posts + posts de mes amis) ─────────
// Endpoint backend : GET /api/posts/feed
// Retourne les posts de l'utilisateur connecté + ceux de ses amis, triés par date DESC
export const getFeedPosts  = (type = "post") => API.get(`/posts/feed?type=${type}`);

// ─── Posts — Vues & Réactions ─────────────────────────────
export const recordView    = (pid)            => API.post(`/posts/${pid}/view`);
export const getViews      = (pid)            => API.get(`/posts/${pid}/views`);
export const reactToPost   = (pid, reaction)  => API.post(`/posts/${pid}/react`, { reaction });
export const getReactions  = (pid)            => API.get(`/posts/${pid}/reactions`);

export default API;
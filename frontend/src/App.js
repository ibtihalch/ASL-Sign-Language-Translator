import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Conversation from "./pages/Conversation";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Dictionary from "./pages/Dictionary";

// Protection des routes
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Routes publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Routes protégées */}
        <Route path="/home" element={
          <PrivateRoute><Home /></PrivateRoute>
        } />
        <Route path="/conversation" element={
          <PrivateRoute><Conversation /></PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute><Profile /></PrivateRoute>
        } />
        <Route path="/history" element={
          <PrivateRoute><History /></PrivateRoute>
        } />
        <Route path="/dictionary" element={
          <PrivateRoute><Dictionary /></PrivateRoute>
        } />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/login" />} />

      </Routes>
    </BrowserRouter>
  );
}
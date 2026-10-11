import React, { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import api from "./api";
import { getLang } from "./i18n/index.jsx";
import Navbar from "./components/Navbar.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import NewCollab from "./pages/NewCollab.jsx";
import CollabRoom from "./pages/CollabRoom.jsx";

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("docyard_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("docyard_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("docyard_token", token);
    setUser(userData);
    // Tell the server which language this person uses, so reminder emails match.
    api.patch("/auth/language", { lang: getLang() }).catch(() => {});
  };

  const logout = () => {
    localStorage.removeItem("docyard_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <Upload />
            </RequireAuth>
          }
        />
        <Route
          path="/collab/new"
          element={
            <RequireAuth>
              <NewCollab />
            </RequireAuth>
          }
        />
        {/* Guests open an invite link - no account needed */}
        <Route path="/collab/join/:token" element={<CollabRoom mode="guest" />} />
        <Route
          path="/collab/:id"
          element={
            <RequireAuth>
              <CollabRoom mode="owner" />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

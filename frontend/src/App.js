import React from "react";
import useAuth from "./hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <h2>CropHealth AI</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Dashboard user={user} onLogout={logout} />;
}

export default App;

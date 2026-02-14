import React from "react";
import "./Navbar.css";

export default function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>CropHealth AI</h2>
      </div>
      <div className="navbar-user">
        <span className="user-email">{user?.email}</span>
        <button className="btn-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

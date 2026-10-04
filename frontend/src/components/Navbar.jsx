import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-dot" />
          DocYard
        </Link>

        <div className="nav-links">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link to="/dashboard" className="btn btn-ghost btn-sm">{t("nav.dashboard")}</Link>
              <Link to="/upload" className="btn btn-yellow btn-sm">{t("nav.upload")}</Link>
              <span className="nav-user">{user.name.split(" ")[0]}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">{t("nav.login")}</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">{t("nav.signup")}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

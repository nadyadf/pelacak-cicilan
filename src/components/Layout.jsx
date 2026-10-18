
import { Outlet, Link } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/hutang" className="brand">
          <span className="brand-icon">◈</span>
          <span>Pelacak<span className="brand-accent">Cicilan</span></span>
        </Link>

        <span className="private-label">
          <span className="status-dot" />
          Ruang pribadi
        </span>
      </header>

      <main className="page-container">
        <Outlet />
      </main>

      <footer className="footer">
        Pelacak Cicilan · Catatan pembayaran pribadi
      </footer>
    </div>
  );
}

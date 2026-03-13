import { useState } from "react";

const NAV_ITEMS = [
  {
    id: "search",
    label: "Busca",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11 4a7 7 0 0 1 5.6 11.2l3.1 3.1a1 1 0 1 1-1.4 1.4l-3.1-3.1A7 7 0 1 1 11 4Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "painel",
    label: "Painel",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5a1 1 0 0 1 1-1h6v7H4V5Zm9-1h6a1 1 0 0 1 1 1v4h-7V4ZM4 13h7v7H5a1 1 0 0 1-1-1v-6Zm9 0h7v6a1 1 0 0 1-1 1h-6v-7Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "novo-documento",
    label: "Novo Documento",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 0 1 0-2h6V5a1 1 0 0 1 1-1Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "criar-versao",
    label: "Criar Versao",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a1 1 0 0 1 1 1v3.1a5.9 5.9 0 0 1 3.9 2.2l2.2-1.3a1 1 0 1 1 1 1.7L18 11a6 6 0 0 1 0 2l2.1 1.3a1 1 0 0 1-1 1.7l-2.2-1.3A6 6 0 1 1 12 7V4a1 1 0 0 1 1-1Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-1 2h2v1h1v2h-1v1h-2v-1H10v-2h1v-1Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "solicitacoes",
    label: "Solicitacoes",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 3a4 4 0 0 1 3.9 5H13a4 4 0 1 1 0 2h-2.1A4 4 0 1 1 7 3Zm10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export default function AppShell({ children, activePage, onPageChange, session, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="layout-root">
      <aside
        className={`sidebar-card ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Navegacao principal"
      >
        <div className="sidebar-head">
          <div className="brand-mark">DF</div>
          {!collapsed && (
            <div className="brand-block">
              <p className="brand-title">DocFlow</p>
              <p className="brand-subtitle">Painel operacional</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => {
                onPageChange(item.id);
                setMobileOpen(false);
              }}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {!collapsed && <span>{collapsed ? "Expandir" : "Recolher"}</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && <button type="button" className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="content-root">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-toggle" onClick={() => setMobileOpen((prev) => !prev)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div>
              <p className="topbar-title">Plataforma de documentos</p>
              <p className="topbar-subtitle">
                Perfil: <strong>{session.role}</strong>
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="user-chip">
              <p>{session.email}</p>
            </div>
            <button type="button" className="logout-btn" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        <main className="page-root">{children}</main>
      </div>
    </div>
  );
}

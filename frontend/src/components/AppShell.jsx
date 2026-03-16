import { useState } from "react";

import {
  canAccessAdminCatalog,
  canAccessAdminUsers,
  canAccessAuditHistory,
  canAccessCentralAprovacao,
  canAccessHistoricoSolicitacoes,
  canAccessNovoDocumento,
  canAccessPainel,
  canAccessSearch,
  displayRole,
} from "../utils/roles";

const SEARCH_ITEM = {
  id: "search",
  label: "Busca",
  isVisible: canAccessSearch,
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M11 4a7 7 0 0 1 5.6 11.2l3.1 3.1a1 1 0 1 1-1.4 1.4l-3.1-3.1A7 7 0 1 1 11 4Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const APPROVAL_ITEM = {
  id: "central-aprovacao",
  label: "Central de Aprovacao",
  isVisible: canAccessCentralAprovacao,
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3a4 4 0 0 1 3.9 5H13a4 4 0 1 1 0 2h-2.1A4 4 0 1 1 7 3Zm10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const AUDIT_HISTORY_ITEM = {
  id: "historico-acoes",
  label: "Historico de Acoes",
  isVisible: canAccessAuditHistory,
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a9 9 0 1 1-6.4 2.6L4.3 4.3A1 1 0 1 1 5.7 2.9L7 4.2A9 9 0 0 1 12 3Zm0 2a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm-1 3a1 1 0 0 1 2 0v3.6l2.1 1.4a1 1 0 1 1-1.1 1.7l-2.6-1.7a1 1 0 0 1-.4-.8V8Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const MAINTENANCE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M21.3 6.3a4.8 4.8 0 0 1-6.4 6.1l-7.2 7.2a1.5 1.5 0 0 1-2.1-2.1l7.2-7.2a4.8 4.8 0 0 1 6.1-6.4l-2.8 2.8 1.4 1.4 2.8-2.8ZM8.9 6.8 7.2 8.5 5.8 7.1 7.5 5.4 6.8 4.7a1 1 0 0 1 1.4-1.4l3.5 3.5a1 1 0 0 1-1.4 1.4l-.7-.7Z"
      fill="currentColor"
    />
  </svg>
);

const NAV_GROUPS = [
  {
    id: "solicitacoes",
    label: "Solicitacoes",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 3h8a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Zm0 4h8V5H8v2Zm11 2H5v10h14V9Z"
          fill="currentColor"
        />
      </svg>
    ),
    items: [
      {
        id: "novo-documento",
        label: "Novo Documento",
        isVisible: canAccessNovoDocumento,
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
        id: "historico-solicitacoes",
        label: "Historico de Solicitacoes",
        isVisible: canAccessHistoricoSolicitacoes,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3a9 9 0 1 1-6.4 2.6L4.3 4.3A1 1 0 1 1 5.7 2.9L7 4.2A9 9 0 0 1 12 3Zm0 2a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm-1 3a1 1 0 0 1 2 0v3.6l2.1 1.4a1 1 0 1 1-1.1 1.7l-2.6-1.7a1 1 0 0 1-.4-.8V8Z"
              fill="currentColor"
            />
          </svg>
        ),
      },
      {
        id: "nova-rnc",
        label: "Nova RNC (Em breve)",
        isVisible: canAccessNovoDocumento,
        icon: MAINTENANCE_ICON,
      },
    ],
  },
  {
    id: "painel-indicadores",
    label: "Painel de Indicadores",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5a1 1 0 0 1 1-1h6v7H4V5Zm9-1h6a1 1 0 0 1 1 1v4h-7V4ZM4 13h7v7H5a1 1 0 0 1-1-1v-6Zm9 0h7v6a1 1 0 0 1-1 1h-6v-7Z"
          fill="currentColor"
        />
      </svg>
    ),
    items: [
      {
        id: "painel-documentos",
        label: "Painel de Documentos",
        isVisible: canAccessPainel,
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
        id: "painel-rnc",
        label: "Painel de RNC (Em breve)",
        isVisible: canAccessPainel,
        icon: MAINTENANCE_ICON,
      },
    ],
  },
  {
    id: "gestao-cadastros",
    label: "Gestao de Cadastros",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 20h18v-2h-1V5a1 1 0 0 0-1-1h-5v14h-2V9a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9H3v2Zm3-2v-8h4v8H6Zm10 0V6h3v12h-3Z"
          fill="currentColor"
        />
      </svg>
    ),
    items: [
      {
        id: "painel-usuarios",
        label: "Cadastro de Usuarios",
        isVisible: canAccessAdminUsers,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-7 1.6-7 4v1h14v-1c0-2.4-3.7-4-7-4Zm7-5h2v2h-2v2h-2v-2h-2V9h2V7h2v2Z"
              fill="currentColor"
            />
          </svg>
        ),
      },
      {
        id: "cadastro-setores",
        label: "Cadastro de Setores",
        isVisible: canAccessAdminCatalog,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
              fill="currentColor"
            />
          </svg>
        ),
      },
      {
        id: "cadastro-empresas",
        label: "Cadastro de Empresas",
        isVisible: canAccessAdminCatalog,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 20h18v-2h-1V5a1 1 0 0 0-1-1h-5v14h-2V9a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9H3v2Zm3-2v-8h4v8H6Zm10 0V6h3v12h-3Z"
              fill="currentColor"
            />
          </svg>
        ),
      },
      {
        id: "cadastro-tipo-documento",
        label: "Cadastro Tipo de Documento",
        isVisible: canAccessAdminCatalog,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V9h4.5L14 4.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z"
              fill="currentColor"
            />
          </svg>
        ),
      },
    ],
  },
];

export default function AppShell({ children, activePage, onPageChange, session, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    solicitacoes: false,
    "painel-indicadores": false,
    "gestao-cadastros": false,
  });
  const sessionRoles = session.roles || session.role;
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.isVisible || item.isVisible(sessionRoles)),
  })).filter((group) => group.items.length > 0);

  const handleToggleGroup = (groupId) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroups((prev) => ({
        ...prev,
        [groupId]: true,
      }));
      return;
    }
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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
          {(!SEARCH_ITEM.isVisible || SEARCH_ITEM.isVisible(sessionRoles)) && (
            <button
              key={SEARCH_ITEM.id}
              type="button"
              className={`nav-item ${activePage === SEARCH_ITEM.id ? "active" : ""}`}
              onClick={() => {
                onPageChange(SEARCH_ITEM.id);
                setMobileOpen(false);
              }}
              title={SEARCH_ITEM.label}
            >
              <span className="nav-icon">{SEARCH_ITEM.icon}</span>
              {!collapsed && <span className="nav-label">{SEARCH_ITEM.label}</span>}
            </button>
          )}

          {(!APPROVAL_ITEM.isVisible || APPROVAL_ITEM.isVisible(sessionRoles)) && (
            <button
              key={APPROVAL_ITEM.id}
              type="button"
              className={`nav-item ${activePage === APPROVAL_ITEM.id ? "active" : ""}`}
              onClick={() => {
                onPageChange(APPROVAL_ITEM.id);
                setMobileOpen(false);
              }}
              title={APPROVAL_ITEM.label}
            >
              <span className="nav-icon">{APPROVAL_ITEM.icon}</span>
              {!collapsed && <span className="nav-label">{APPROVAL_ITEM.label}</span>}
            </button>
          )}

          {visibleGroups.map((group) => {
            const hasActiveItem = group.items.some((item) => item.id === activePage);
            const isOpen = !!openGroups[group.id];

            if (collapsed) {
              return (
                <div key={`group-collapsed-${group.id}`}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item nav-subitem ${activePage === item.id ? "active" : ""}`}
                      onClick={() => {
                        onPageChange(item.id);
                        setMobileOpen(false);
                      }}
                      title={item.label}
                    >
                      <span className="nav-icon">{item.icon}</span>
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <div key={`group-${group.id}`} className="nav-group">
                <button
                  type="button"
                  className={`nav-item nav-group-button ${hasActiveItem ? "active" : ""}`}
                  onClick={() => handleToggleGroup(group.id)}
                  title={group.label}
                >
                  <span className="nav-icon">{group.icon}</span>
                  <span className="nav-label">{group.label}</span>
                  <span className={`nav-group-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-item nav-subitem ${activePage === item.id ? "active" : ""}`}
                        onClick={() => {
                          onPageChange(item.id);
                          setMobileOpen(false);
                        }}
                        title={item.label}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {(!AUDIT_HISTORY_ITEM.isVisible || AUDIT_HISTORY_ITEM.isVisible(sessionRoles)) && (
            <button
              key={AUDIT_HISTORY_ITEM.id}
              type="button"
              className={`nav-item ${activePage === AUDIT_HISTORY_ITEM.id ? "active" : ""}`}
              onClick={() => {
                onPageChange(AUDIT_HISTORY_ITEM.id);
                setMobileOpen(false);
              }}
              title={AUDIT_HISTORY_ITEM.label}
            >
              <span className="nav-icon">{AUDIT_HISTORY_ITEM.icon}</span>
              {!collapsed && <span className="nav-label">{AUDIT_HISTORY_ITEM.label}</span>}
            </button>
          )}
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
                Perfil: <strong>{displayRole(session.roles || session.role)}</strong>
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="user-chip">
              <p>{session.username || session.email}</p>
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


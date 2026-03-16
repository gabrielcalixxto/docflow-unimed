import { useState } from "react";

import { buttonVariants } from "./ui/variants";
import PasswordField from "./PasswordField";
import defaultAvatar from "../assets/avatar-default.svg";
import { changePassword } from "../services/api";
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
import { cn } from "../utils/cn";
import { useEffect } from "react";

const PASSWORD_NUMBER_PATTERN = /\d/;
const PASSWORD_SPECIAL_PATTERN = /[^A-Za-z0-9\s]/;

function isPasswordComplexEnough(value) {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    PASSWORD_NUMBER_PATTERN.test(value) &&
    PASSWORD_SPECIAL_PATTERN.test(value)
  );
}

function resolveProfileName(session) {
  const rawName = typeof session?.name === "string" ? session.name.trim() : "";
  if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0];
    }
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  const fallback = String(session?.username || session?.email || "Usuario").trim();
  const normalized = fallback.includes("@") ? fallback.split("@")[0] : fallback;
  const words = normalized
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "Usuario";
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveProfileSubtitle(session, roles) {
  if (typeof session?.jobTitle === "string" && session.jobTitle.trim()) {
    return session.jobTitle.trim();
  }
  return displayRole(roles);
}

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
  label: "Central de Aprovações",
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
  label: "Histórico de Ações",
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

const NAV_GROUPS = [
  {
    id: "solicitacoes",
    label: "Solicitações",
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
        label: "Histórico de Solicitações",
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
    ],
  },
  {
    id: "gestao-cadastros",
    label: "Gestão de Cadastros",
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

export default function AppShell({
  children,
  activePage,
  onPageChange,
  session,
  onLogout,
  forcePasswordChange = false,
  onPasswordChanged,
  themeMode = "light",
  fontScale = 1,
  fontScaleLevel,
  onToggleTheme,
  onIncreaseFont,
}) {
  const resolvedFontScaleLevel = Number.isInteger(fontScaleLevel) ? fontScaleLevel : 1;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    solicitacoes: false,
    "painel-indicadores": false,
    "gestao-cadastros": false,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordFeedback, setPasswordFeedback] = useState({ type: "", message: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const sessionRoles = session.roles || session.role;
  const profileName = resolveProfileName(session);
  const profileSubtitle = resolveProfileSubtitle(session, sessionRoles);
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.isVisible || item.isVisible(sessionRoles)),
  })).filter((group) => group.items.length > 0);

  useEffect(() => {
    if (forcePasswordChange) {
      setProfileOpen(true);
      setPasswordFeedback({
        type: "info",
        message: "Primeiro acesso detectado. Atualize sua senha para continuar.",
      });
    }
  }, [forcePasswordChange]);

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

  const closeProfileModal = () => {
    if (forcePasswordChange || savingPassword) {
      return;
    }
    setProfileOpen(false);
    setPasswordFeedback({ type: "", message: "" });
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleSavePassword = async (event) => {
    event.preventDefault();
    const oldPassword = passwordForm.oldPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!oldPassword) {
      setPasswordFeedback({ type: "error", message: "Informe a senha atual." });
      return;
    }
    if (!isPasswordComplexEnough(newPassword)) {
      setPasswordFeedback({
        type: "error",
        message: "A nova senha deve ter minimo de 8 caracteres, numero e caractere especial.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", message: "Os campos de nova senha nao conferem." });
      return;
    }

    setSavingPassword(true);
    setPasswordFeedback({ type: "", message: "" });
    try {
      const response = await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      await onPasswordChanged?.();
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordFeedback({
        type: "success",
        message: response?.message || "Senha atualizada com sucesso.",
      });
      setProfileOpen(false);
    } catch (error) {
      setPasswordFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel atualizar a senha.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="layout-root">
      <aside
        className={cn("sidebar-card", collapsed && "collapsed", mobileOpen && "mobile-open")}
        aria-label="Navegacao principal"
      >
        <div className="sidebar-head">
          <div className="brand-mark" aria-label="Logo Unimed">
            <span className="brand-mark-text">Unimed</span>
          </div>
          {!collapsed && (
            <div className="brand-block">
              <p className="brand-title">Docflow Unimed</p>
              <p className="brand-subtitle">Painel de gestão de documentos</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {(!SEARCH_ITEM.isVisible || SEARCH_ITEM.isVisible(sessionRoles)) && (
            <button
              key={SEARCH_ITEM.id}
              type="button"
              className={cn("nav-item", activePage === SEARCH_ITEM.id && "active")}
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
              className={cn("nav-item", activePage === APPROVAL_ITEM.id && "active")}
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
                      className={cn("nav-item nav-subitem", activePage === item.id && "active")}
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
                  className={cn("nav-item nav-group-button", hasActiveItem && "active")}
                  onClick={() => handleToggleGroup(group.id)}
                  title={group.label}
                >
                  <span className="nav-icon">{group.icon}</span>
                  <span className="nav-label">{group.label}</span>
                  <span className={cn("nav-group-chevron", isOpen && "open")} aria-hidden="true">
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
                        className={cn("nav-item nav-subitem", activePage === item.id && "active")}
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
              className={cn("nav-item", activePage === AUDIT_HISTORY_ITEM.id && "active")}
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
            className={cn("collapse-btn", collapsed && "is-collapsed")}
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
            <button
              type="button"
              className={cn("mobile-toggle", buttonVariants({ variant: "ghost", size: "sm" }))}
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
              title={mobileOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
            >
              {mobileOpen ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6l-12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
            <div>
              <p className="topbar-title">Plataforma de documentos</p>
              <p className="topbar-subtitle">
                Perfil: <strong>{displayRole(session.roles || session.role)}</strong>
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-accessibility">
              <button
                type="button"
                className={cn("topbar-control-btn", buttonVariants({ variant: "ghost", size: "sm" }))}
                onClick={onIncreaseFont}
                title={`Aumentar fonte (Tamanho ${resolvedFontScaleLevel})`}
                aria-label={`Aumentar fonte. Tamanho atual ${resolvedFontScaleLevel}`}
              >
                <span className="topbar-control-text">A+</span>
                <span className="topbar-control-label">{resolvedFontScaleLevel}</span>
              </button>

              <button
                type="button"
                className={cn("topbar-control-btn", buttonVariants({ variant: "ghost", size: "sm" }))}
                onClick={onToggleTheme}
                title={themeMode === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                aria-label={themeMode === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              >
                {themeMode === "dark" ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 4a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM4 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1Zm17 0a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1ZM6.2 6.2a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4Zm10.9 10.9a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM6.2 19a1 1 0 0 1 0-1.4l.7-.7a1 1 0 1 1 1.4 1.4l-.7.7a1 1 0 0 1-1.4 0Zm10.9-10.9a1 1 0 0 1 0-1.4l.7-.7a1 1 0 1 1 1.4 1.4l-.7.7a1 1 0 0 1-1.4 0Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M14.8 3.8a1 1 0 0 1 .2 1.1A8 8 0 1 0 19 15a1 1 0 0 1 1.1-.2 1 1 0 0 1 .6.9A10 10 0 1 1 14.1 3a1 1 0 0 1 .7.8Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
                <span className="topbar-control-label">{themeMode === "dark" ? "Dark" : "Light"}</span>
              </button>
            </div>
            <button
              type="button"
              className="user-profile user-profile-btn"
              onClick={() => setProfileOpen(true)}
              aria-label="Abrir perfil do usuario"
              title="Abrir perfil"
            >
              <img className="user-avatar" src={defaultAvatar} alt="Avatar padrao do usuario" />
              <div className="user-profile-meta">
                <p className="user-profile-name">{profileName}</p>
                <p className="user-profile-role">{profileSubtitle}</p>
              </div>
            </button>
            <button
              type="button"
              className="logout-icon-btn"
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M13 5H8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 12h9m-3-3 3 3-3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="page-root">{children}</main>
      </div>

      {profileOpen && (
        <div
          className="profile-modal-backdrop"
          onClick={closeProfileModal}
          role="presentation"
        >
          <div
            className="profile-modal-card panel-float"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-head">
              <div className="profile-modal-user">
                <img className="profile-modal-avatar" src={defaultAvatar} alt="Avatar do usuario" />
                <div>
                  <h3 id="profile-modal-title">{profileName}</h3>
                  <p>{session.email || "-"}</p>
                  <p>{profileSubtitle || "-"}</p>
                </div>
              </div>
              {!forcePasswordChange && (
                <button type="button" className="ghost-btn" onClick={closeProfileModal}>
                  Fechar
                </button>
              )}
            </div>

            <form className="profile-password-form" onSubmit={handleSavePassword}>
              <h4>Alterar senha</h4>
              <PasswordField
                label="Senha atual"
                required
                value={passwordForm.oldPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, oldPassword: event.target.value }))
                }
                autoComplete="current-password"
              />
              <PasswordField
                label="Nova senha"
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                autoComplete="new-password"
              />
              <PasswordField
                label="Repetir nova senha"
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                autoComplete="new-password"
              />

              {passwordFeedback.message && (
                <p className={`feedback ${passwordFeedback.type === "error" ? "error" : "success"}`}>
                  {passwordFeedback.message}
                </p>
              )}

              <button type="submit" className="compact-submit" disabled={savingPassword}>
                {savingPassword ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}




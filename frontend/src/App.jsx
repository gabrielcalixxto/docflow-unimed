import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "./components/AppShell";
import { buttonVariants, cardVariants } from "./components/ui/variants";
import AdminUsuariosPage from "./pages/AdminUsuariosPage";
import CadastroEmpresasPage from "./pages/CadastroEmpresasPage";
import CadastroSetoresPage from "./pages/CadastroSetoresPage";
import CadastroTipoDocumentoPage from "./pages/CadastroTipoDocumentoPage";
import HistoricoAcoesPage from "./pages/HistoricoAcoesPage";
import HistoricoSolicitacoesPage from "./pages/HistoricoSolicitacoesPage";
import LoginPage from "./pages/LoginPage";
import NovoDocumentoPage from "./pages/NovoDocumentoPage";
import PainelDocumentos from "./pages/PainelDocumentos";
import SearchPage from "./pages/SearchPage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import {
  clearStoredToken,
  getStoredToken,
  login,
  refreshSession,
  setGlobalErrorListener,
  setUnauthorizedListener,
  storeToken,
} from "./services/api";
import { parseJwtPayload } from "./utils/jwt";
import {
  canAccessAdminCatalog,
  canAccessAdminUsers,
  canAccessAuditHistory,
  canAccessCentralAprovacao,
  canAccessHistoricoSolicitacoes,
  canAccessNovoDocumento,
  canAccessPainel,
  canAccessSearch,
} from "./utils/roles";
import { cn } from "./utils/cn";

const FONT_SCALE_STEPS = [
  { value: 0.95, level: 1 },
  { value: 1.08, level: 2 },
  { value: 1.16, level: 3 },
  { value: 1.24, level: 4 },
];
const THEME_STORAGE_KEY = "docflow_theme_mode";
const FONT_SCALE_STORAGE_KEY = "docflow_font_scale";

const PAGE_ACCESS_RULES = {
  search: canAccessSearch,
  "novo-documento": canAccessNovoDocumento,
  "historico-solicitacoes": canAccessHistoricoSolicitacoes,
  "central-aprovacao": canAccessCentralAprovacao,
  "painel-documentos": canAccessPainel,
  "painel-usuarios": canAccessAdminUsers,
  "cadastro-setores": canAccessAdminCatalog,
  "cadastro-empresas": canAccessAdminCatalog,
  "cadastro-tipo-documento": canAccessAdminCatalog,
  "historico-acoes": canAccessAuditHistory,
};

const PAGE_FALLBACK_ORDER = [
  "search",
  "novo-documento",
  "historico-solicitacoes",
  "central-aprovacao",
  "painel-documentos",
  "painel-usuarios",
  "cadastro-setores",
  "cadastro-empresas",
  "cadastro-tipo-documento",
  "historico-acoes",
];

function resolveFallbackPage(roles) {
  return PAGE_FALLBACK_ORDER.find((pageId) => PAGE_ACCESS_RULES[pageId]?.(roles)) || "search";
}

function GlobalErrorDialog({ message, onClose }) {
  if (!message) {
    return null;
  }

  return (
    <div className="app-error-dialog-backdrop" role="presentation">
      <div
        className={cn("app-error-dialog", cardVariants({ variant: "elevated" }))}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-error-title"
      >
        <h3 id="app-error-title">Erro</h3>
        <p>{message}</p>
        <button
          type="button"
          className={cn("app-error-dialog-btn", buttonVariants({ variant: "primary", size: "sm" }))}
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}

function buildSession(token) {
  if (!token) {
    return null;
  }
  const payload = parseJwtPayload(token);
  const roles = Array.isArray(payload?.roles)
    ? payload.roles.filter((role) => typeof role === "string")
    : typeof payload?.role === "string"
      ? [payload.role]
      : [];
  if (!payload?.sub || roles.length === 0) {
    return null;
  }
  const sectorIds = Array.isArray(payload?.sector_ids)
    ? payload.sector_ids.filter((value) => Number.isInteger(value)).map(Number)
    : Number.isInteger(payload?.sector_id)
      ? [Number(payload.sector_id)]
      : [];
  const companyIds = Array.isArray(payload?.company_ids)
    ? payload.company_ids.filter((value) => Number.isInteger(value)).map(Number)
    : Number.isInteger(payload?.company_id)
      ? [Number(payload.company_id)]
      : [];
  return {
    username: payload.sub,
    email: typeof payload?.email === "string" ? payload.email : payload.sub,
    name: typeof payload?.name === "string" ? payload.name : null,
    jobTitle: typeof payload?.job_title === "string" ? payload.job_title : null,
    role: roles[0],
    roles,
    userId: payload.user_id ?? null,
    companyId: companyIds[0] ?? null,
    companyIds,
    sectorId: sectorIds[0] ?? null,
    sectorIds,
    mustChangePassword: Boolean(payload?.must_change_password),
    expiresAt: typeof payload.exp === "number" ? payload.exp : null,
  };
}

function loadStoredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

function resolveFontScaleStep(value) {
  return FONT_SCALE_STEPS.reduce((closest, step) =>
    Math.abs(step.value - value) < Math.abs(closest.value - value) ? step : closest,
  FONT_SCALE_STEPS[0]);
}

function loadStoredFontScale() {
  if (typeof window === "undefined") {
    return FONT_SCALE_STEPS[0].value;
  }
  const saved = Number(window.localStorage.getItem(FONT_SCALE_STORAGE_KEY));
  if (Number.isNaN(saved)) {
    return FONT_SCALE_STEPS[0].value;
  }
  return resolveFontScaleStep(saved).value;
}

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(() => Boolean(getStoredToken()));
  const [activePage, setActivePage] = useState("search");
  const [draftEditPrefill, setDraftEditPrefill] = useState(null);
  const [authError, setAuthError] = useState("");
  const [globalErrorMessage, setGlobalErrorMessage] = useState("");
  const [themeMode, setThemeMode] = useState(loadStoredTheme);
  const [fontScale, setFontScale] = useState(loadStoredFontScale);
  const fontScaleStep = useMemo(() => resolveFontScaleStep(fontScale), [fontScale]);

  const session = useMemo(() => buildSession(token), [token]);

  useEffect(() => {
    let cancelled = false;
    const bootstrapSession = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (!cancelled) {
          setIsBootstrappingSession(false);
        }
        return;
      }
      try {
        const data = await refreshSession();
        if (cancelled) {
          return;
        }
        if (data?.access_token) {
          storeToken(data.access_token);
          setToken(data.access_token);
        }
      } catch (_error) {
        if (cancelled) {
          return;
        }
        clearStoredToken();
        setToken(null);
        setAuthError("Sessao expirada. Faca login novamente.");
      } finally {
        if (!cancelled) {
          setIsBootstrappingSession(false);
        }
      }
    };
    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (credentials) => {
    try {
      setAuthError("");
      const data = await login(credentials);
      storeToken(data.access_token);
      setToken(data.access_token);
      const payload = parseJwtPayload(data.access_token);
      const resolvedRoles = Array.isArray(payload?.roles)
        ? payload.roles.filter((role) => typeof role === "string")
        : typeof payload?.role === "string"
          ? [payload.role]
          : [];
      setActivePage(resolveFallbackPage(resolvedRoles));
    } catch (error) {
      setAuthError(error.message || "Nao foi possivel autenticar.");
      throw error;
    }
  };

  const handleLogout = useCallback((message) => {
    clearStoredToken();
    setToken(null);
    setActivePage("search");
    if (message) {
      setAuthError(message);
    }
  }, []);

  const handleUnauthorized = useCallback(
    (status = 401) => {
      if (status === 403) {
        if (session) {
          setActivePage(resolveFallbackPage(session.roles));
        }
        setAuthError("Voce nao tem permissao para acessar esta funcionalidade.");
        return;
      }
      handleLogout("Sessao expirada. Faca login novamente.");
    },
    [handleLogout, session],
  );

  useEffect(() => {
    setUnauthorizedListener(handleUnauthorized);
    return () => {
      setUnauthorizedListener(null);
    };
  }, [handleUnauthorized]);

  const handleGlobalError = useCallback((error) => {
    const message = typeof error?.message === "string" ? error.message.trim() : "";
    setGlobalErrorMessage(message || "Nao foi possivel concluir a operacao.");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", themeMode === "dark");
    document.documentElement.style.fontSize = `${Math.round(fontScale * 100)}%`;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
  }, [themeMode, fontScale]);

  useEffect(() => {
    setGlobalErrorListener(handleGlobalError);
    return () => {
      setGlobalErrorListener(null);
    };
  }, [handleGlobalError]);

  const handleToggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const handleIncreaseFont = useCallback(() => {
    setFontScale((prev) => {
      const currentStep = resolveFontScaleStep(prev);
      const currentIndex = FONT_SCALE_STEPS.findIndex((step) => step.value === currentStep.value);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (safeIndex + 1) % FONT_SCALE_STEPS.length;
      return FONT_SCALE_STEPS[nextIndex].value;
    });
  }, []);

  const handlePasswordChanged = useCallback(async () => {
    const data = await refreshSession();
    if (data?.access_token) {
      storeToken(data.access_token);
      setToken(data.access_token);
    }
  }, []);

  const handleOpenDraftInNovoDocumento = useCallback((draftPayload) => {
    setDraftEditPrefill(draftPayload || null);
    setActivePage("novo-documento");
  }, []);

  const handleDraftPrefillConsumed = useCallback(() => {
    setDraftEditPrefill(null);
  }, []);

  if (isBootstrappingSession) {
    return (
      <>
        <div className="page-animation">Carregando sessao...</div>
        <GlobalErrorDialog message={globalErrorMessage} onClose={() => setGlobalErrorMessage("")} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <GlobalErrorDialog message={globalErrorMessage} onClose={() => setGlobalErrorMessage("")} />
      </>
    );
  }

  const canOpenActivePage = PAGE_ACCESS_RULES[activePage]?.(session.roles) ?? true;
  const resolvedPage = canOpenActivePage ? activePage : resolveFallbackPage(session.roles);

  return (
    <>
      <AppShell
        activePage={resolvedPage}
        onPageChange={setActivePage}
        session={session}
        onLogout={() => handleLogout("")}
        themeMode={themeMode}
        fontScale={fontScale}
        fontScaleLevel={fontScaleStep.level}
        onToggleTheme={handleToggleTheme}
        onIncreaseFont={handleIncreaseFont}
        forcePasswordChange={Boolean(session.mustChangePassword)}
        onPasswordChanged={handlePasswordChanged}
      >
        {resolvedPage === "search" && (
          <SearchPage onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "painel-documentos" && (
          <PainelDocumentos session={session} onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "novo-documento" && (
          <NovoDocumentoPage
            onUnauthorized={handleUnauthorized}
            prefillDraft={draftEditPrefill}
            onPrefillConsumed={handleDraftPrefillConsumed}
          />
        )}
        {resolvedPage === "central-aprovacao" && (
          <SolicitacoesPage session={session} onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "historico-solicitacoes" && (
          <HistoricoSolicitacoesPage
            session={session}
            onUnauthorized={handleUnauthorized}
            onEditDraft={handleOpenDraftInNovoDocumento}
          />
        )}
        {resolvedPage === "painel-usuarios" && (
          <AdminUsuariosPage onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "cadastro-setores" && (
          <CadastroSetoresPage onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "cadastro-empresas" && (
          <CadastroEmpresasPage onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "cadastro-tipo-documento" && (
          <CadastroTipoDocumentoPage onUnauthorized={handleUnauthorized} />
        )}
        {resolvedPage === "historico-acoes" && (
          <HistoricoAcoesPage onUnauthorized={handleUnauthorized} />
        )}
      </AppShell>
      <GlobalErrorDialog message={globalErrorMessage} onClose={() => setGlobalErrorMessage("")} />
    </>
  );
}

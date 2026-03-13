import { useMemo, useState } from "react";

import AppShell from "./components/AppShell";
import AdminUsuariosPage from "./pages/AdminUsuariosPage";
import CadastroEmpresasPage from "./pages/CadastroEmpresasPage";
import CadastroSetoresPage from "./pages/CadastroSetoresPage";
import CadastroTipoDocumentoPage from "./pages/CadastroTipoDocumentoPage";
import CriarVersaoPage from "./pages/CriarVersaoPage";
import HistoricoSolicitacoesPage from "./pages/HistoricoSolicitacoesPage";
import LoginPage from "./pages/LoginPage";
import NovoDocumentoPage from "./pages/NovoDocumentoPage";
import PainelDocumentos from "./pages/PainelDocumentos";
import PainelRncPage from "./pages/PainelRncPage";
import SearchPage from "./pages/SearchPage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import { clearStoredToken, getStoredToken, login, storeToken } from "./services/api";
import { parseJwtPayload } from "./utils/jwt";
import {
  canAccessAdminCatalog,
  canAccessAdminUsers,
  canAccessAtualizarDocumento,
  canAccessCentralAprovacao,
  canAccessHistoricoSolicitacoes,
  canAccessNovoDocumento,
  canAccessPainel,
  canAccessSearch,
} from "./utils/roles";

const PAGE_ACCESS_RULES = {
  search: canAccessSearch,
  "novo-documento": canAccessNovoDocumento,
  "atualizar-documento": canAccessAtualizarDocumento,
  "historico-solicitacoes": canAccessHistoricoSolicitacoes,
  "central-aprovacao": canAccessCentralAprovacao,
  "painel-documentos": canAccessPainel,
  "painel-rnc": canAccessPainel,
  "painel-usuarios": canAccessAdminUsers,
  "cadastro-setores": canAccessAdminCatalog,
  "cadastro-empresas": canAccessAdminCatalog,
  "cadastro-tipo-documento": canAccessAdminCatalog,
};

const PAGE_FALLBACK_ORDER = [
  "search",
  "novo-documento",
  "atualizar-documento",
  "historico-solicitacoes",
  "central-aprovacao",
  "painel-documentos",
  "painel-rnc",
  "painel-usuarios",
  "cadastro-setores",
  "cadastro-empresas",
  "cadastro-tipo-documento",
];

function resolveFallbackPage(roles) {
  return PAGE_FALLBACK_ORDER.find((pageId) => PAGE_ACCESS_RULES[pageId]?.(roles)) || "search";
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
    role: roles[0],
    roles,
    userId: payload.user_id ?? null,
    companyId: companyIds[0] ?? null,
    companyIds,
    sectorId: sectorIds[0] ?? null,
    sectorIds,
    expiresAt: typeof payload.exp === "number" ? payload.exp : null,
  };
}

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [activePage, setActivePage] = useState("search");
  const [authError, setAuthError] = useState("");

  const session = useMemo(() => buildSession(token), [token]);

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

  const handleLogout = (message) => {
    clearStoredToken();
    setToken(null);
    setActivePage("search");
    if (message) {
      setAuthError(message);
    }
  };

  if (!session) {
    return <LoginPage onLogin={handleLogin} errorMessage={authError} />;
  }

  const canOpenActivePage = PAGE_ACCESS_RULES[activePage]?.(session.roles) ?? true;
  const resolvedPage = canOpenActivePage ? activePage : resolveFallbackPage(session.roles);

  return (
    <AppShell
      activePage={resolvedPage}
      onPageChange={setActivePage}
      session={session}
      onLogout={() => handleLogout("")}
    >
      {resolvedPage === "search" && (
        <SearchPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "painel-documentos" && (
        <PainelDocumentos onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "painel-rnc" && <PainelRncPage />}
      {resolvedPage === "novo-documento" && (
        <NovoDocumentoPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "atualizar-documento" && (
        <CriarVersaoPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "central-aprovacao" && (
        <SolicitacoesPage
          session={session}
          onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")}
        />
      )}
      {resolvedPage === "historico-solicitacoes" && (
        <HistoricoSolicitacoesPage
          session={session}
          onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")}
        />
      )}
      {resolvedPage === "painel-usuarios" && (
        <AdminUsuariosPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "cadastro-setores" && (
        <CadastroSetoresPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "cadastro-empresas" && (
        <CadastroEmpresasPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {resolvedPage === "cadastro-tipo-documento" && (
        <CadastroTipoDocumentoPage
          onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")}
        />
      )}
    </AppShell>
  );
}

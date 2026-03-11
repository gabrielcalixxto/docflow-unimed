import { useMemo, useState } from "react";

import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import NovoDocumentoPage from "./pages/NovoDocumentoPage";
import PainelDocumentos from "./pages/PainelDocumentos";
import SearchPage from "./pages/SearchPage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import { clearStoredToken, getStoredToken, login, storeToken } from "./services/api";
import { parseJwtPayload } from "./utils/jwt";

function buildSession(token) {
  if (!token) {
    return null;
  }
  const payload = parseJwtPayload(token);
  if (!payload?.sub || !payload?.role) {
    return null;
  }
  return {
    email: payload.sub,
    role: payload.role,
    userId: payload.user_id ?? null,
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

  return (
    <AppShell
      activePage={activePage}
      onPageChange={setActivePage}
      session={session}
      onLogout={() => handleLogout("")}
    >
      {activePage === "search" && (
        <SearchPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {activePage === "painel" && (
        <PainelDocumentos onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {activePage === "novo-documento" && (
        <NovoDocumentoPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
      {activePage === "solicitacoes" && (
        <SolicitacoesPage onUnauthorized={() => handleLogout("Sessao expirada. Faca login novamente.")} />
      )}
    </AppShell>
  );
}

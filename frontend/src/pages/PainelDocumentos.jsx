import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import { fetchWorkflowItems, summarizeWorkflow } from "../services/workflow";

export default function PainelDocumentos({ onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    scope: "ALL",
    documentType: "",
  });

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWorkflowItems();
      setItems(data);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      setError(requestError.message || "Nao foi possivel carregar o painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const companies = useMemo(
    () =>
      [...new Set(items.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [items],
  );

  const sectors = useMemo(
    () =>
      [...new Set(items.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [items],
  );

  const statuses = useMemo(
    () =>
      [...new Set(items.map((item) => item.latestStatus).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const typeFilter = filters.documentType.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.company !== "ALL" && item.companyName !== filters.company) {
        return false;
      }
      if (filters.sector !== "ALL" && item.sectorName !== filters.sector) {
        return false;
      }
      if (filters.status !== "ALL" && item.latestStatus !== filters.status) {
        return false;
      }
      if (filters.scope !== "ALL" && item.scope !== filters.scope) {
        return false;
      }
      if (typeFilter && !String(item.document_type || "").toLowerCase().includes(typeFilter)) {
        return false;
      }
      return true;
    });
  }, [items, filters]);

  const stats = useMemo(() => summarizeWorkflow(filteredItems), [filteredItems]);

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Visao geral</p>
          <h2>Painel de documentos</h2>
          <p>Resumo do acervo com status atual da versao mais recente de cada documento.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadItems} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      <section className="panel-float painel-filters-grid">
        <label>
          Empresa
          <select
            value={filters.company}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  company: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {companies.map((companyName) => (
              <option key={companyName} value={companyName}>
                {companyName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Setor
          <select
            value={filters.sector}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  sector: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {sectors.map((sectorName) => (
              <option key={sectorName} value={sectorName}>
                {sectorName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Escopo
          <select
            value={filters.scope}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  scope: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            <option value="LOCAL">LOCAL</option>
            <option value="CORPORATIVO">CORPORATIVO</option>
          </select>
        </label>

        <label>
          Tipo documental
          <input
            type="text"
            placeholder="POP, IT, MANUAL..."
            value={filters.documentType}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  documentType: event.target.value,
                })),
              )
            }
          />
        </label>
      </section>

      {error && <p className="error-text margin-top">{error}</p>}

      <section className="workflow-summary-grid">
        <article className="panel-float workflow-stat">
          <p>Total</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Sem versao</p>
          <strong>{stats.semVersao}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Rascunho</p>
          <strong>{stats.rascunho}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Em revisao</p>
          <strong>{stats.emRevisao}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Vigente</p>
          <strong>{stats.vigente}</strong>
        </article>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Resumo geral dos documentos</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Company</th>
                <th>Setor</th>
                <th>Tipo</th>
                <th>Escopo</th>
                <th>Status atual</th>
                <th>Versao atual</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>{item.document_type}</td>
                  <td>{item.scope}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {item.latestStatus}
                    </span>
                  </td>
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8}>Nenhum documento encontrado com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

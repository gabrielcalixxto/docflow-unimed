import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import { fetchWorkflowItems, summarizeWorkflow } from "../services/workflow";
import { formatStatusLabel } from "../utils/status";

const STATUS_ORDER = [
  "VIGENTE",
  "PENDENTE_COORDENACAO",
  "RASCUNHO",
  "REVISAR_RASCUNHO",
  "REPROVADO",
  "OBSOLETO",
  "EM_REVISAO",
  "SEM_VERSAO",
];

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

  const versionRows = useMemo(
    () =>
      items.flatMap((item) => {
        const versions = Array.isArray(item.versions) ? item.versions : [];
        if (versions.length === 0) {
          return [
            {
              ...item,
              rowKey: `${item.id}-sem-versao`,
              latestStatus: "SEM_VERSAO",
              latestVersion: null,
            },
          ];
        }
        return versions.map((version) => ({
          ...item,
          rowKey: `${item.id}-${version.id}`,
          latestStatus: version.status || "SEM_VERSAO",
          latestVersion: version,
        }));
      }),
    [items],
  );

  const companies = useMemo(
    () =>
      [...new Set(versionRows.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [versionRows],
  );

  const sectors = useMemo(
    () =>
      [...new Set(versionRows.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [versionRows],
  );

  const statuses = useMemo(() => {
    const availableStatuses = new Set(versionRows.map((item) => item.latestStatus).filter(Boolean));
    const extraStatuses = [...availableStatuses]
      .filter((status) => !STATUS_ORDER.includes(status))
      .sort((a, b) => String(a).localeCompare(String(b)));
    return [...STATUS_ORDER, ...extraStatuses];
  }, [versionRows]);

  const filteredItems = useMemo(() => {
    const typeFilter = filters.documentType.trim().toLowerCase();
    return versionRows.filter((item) => {
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
  }, [versionRows, filters]);

  const stats = useMemo(() => summarizeWorkflow(filteredItems), [filteredItems]);

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Visao geral</p>
          <h2>Painel de documentos</h2>
          <p>Resumo do acervo considerando todas as versoes de cada documento.</p>
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
                {formatStatusLabel(status)}
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
          <p>Revisar rascunho</p>
          <strong>{stats.revisarRascunho}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Pendente coordenacao</p>
          <strong>{stats.pendenteCoordenacao}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Reprovado</p>
          <strong>{stats.reprovado}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Vigente</p>
          <strong>{stats.vigente}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Obsoleto</p>
          <strong>{stats.obsoleto}</strong>
        </article>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Resumo geral dos documentos e versoes</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Empresas</th>
                <th>Setor</th>
                <th>Tipo</th>
                <th>Escopo</th>
                <th>Status da versao</th>
                <th>Versao</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.rowKey}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>{item.document_type}</td>
                  <td>{item.scope}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {formatStatusLabel(item.latestStatus)}
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

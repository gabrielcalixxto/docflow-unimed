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

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("pt-BR");
}

export default function PainelDocumentos({ onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
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

  const versions = useMemo(
    () =>
      [...new Set(
        versionRows
          .map((item) =>
            item.latestVersion?.version_number != null
              ? String(item.latestVersion.version_number)
              : "SEM_VERSAO",
          )
          .filter(Boolean),
      )].sort((a, b) => {
        if (a === "SEM_VERSAO") {
          return 1;
        }
        if (b === "SEM_VERSAO") {
          return -1;
        }
        return Number(a) - Number(b);
      }),
    [versionRows],
  );

  const expirations = useMemo(
    () =>
      [...new Set(versionRows.map((item) => item.latestVersion?.expiration_date || "SEM_VENCIMENTO"))].sort(
        (a, b) => {
          if (a === "SEM_VENCIMENTO") {
            return 1;
          }
          if (b === "SEM_VENCIMENTO") {
            return -1;
          }
          return String(a).localeCompare(String(b));
        },
      ),
    [versionRows],
  );

  const filteredItems = useMemo(() => {
    const normalizedTerm = filters.term.trim().toLowerCase();
    return versionRows.filter((item) => {
      const versionValue =
        item.latestVersion?.version_number != null
          ? String(item.latestVersion.version_number)
          : "SEM_VERSAO";
      const expirationValue = item.latestVersion?.expiration_date || "SEM_VENCIMENTO";

      if (filters.company !== "ALL" && item.companyName !== filters.company) {
        return false;
      }
      if (filters.sector !== "ALL" && item.sectorName !== filters.sector) {
        return false;
      }
      if (filters.status !== "ALL" && item.latestStatus !== filters.status) {
        return false;
      }
      if (filters.version !== "ALL" && versionValue !== filters.version) {
        return false;
      }
      if (filters.expiration !== "ALL" && expirationValue !== filters.expiration) {
        return false;
      }
      if (!normalizedTerm) {
        return true;
      }

      const searchable = [
        item.code,
        item.title,
        item.companyName,
        item.sectorName,
        item.document_type,
        item.scope,
        formatStatusLabel(item.latestStatus),
        versionValue === "SEM_VERSAO" ? "sem versao" : `v${versionValue}`,
        expirationValue === "SEM_VENCIMENTO" ? "sem vencimento" : expirationValue,
        item.latestVersion?.file_path || "",
        formatDateTime(item.created_at),
        formatDateTime(item.latestVersion?.created_at),
        formatDateTime(item.latestVersion?.approved_at),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedTerm);
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

      <section className="panel-float painel-filters-grid">
        <label>
          Pesquisa
          <input
            type="text"
            placeholder="Codigo, titulo, empresa, setor, tipo..."
            value={filters.term}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  term: event.target.value,
                })),
              )
            }
          />
        </label>

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
          Versao
          <select
            value={filters.version}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  version: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {versions.map((value) => (
              <option key={value} value={value}>
                {value === "SEM_VERSAO" ? "Sem versao" : `v${value}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Vencimento
          <select
            value={filters.expiration}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  expiration: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {expirations.map((value) => (
              <option key={value} value={value}>
                {value === "SEM_VENCIMENTO" ? "Sem vencimento" : formatDate(value)}
              </option>
            ))}
          </select>
        </label>
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
                <th>Vencimento</th>
                <th>Caminho/URL</th>
                <th>Criado em</th>
                <th>Criada em</th>
                <th>Aprovada em</th>
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
                  <td>
                    {item.latestVersion?.expiration_date
                      ? formatDate(item.latestVersion.expiration_date)
                      : "-"}
                  </td>
                  <td>{item.latestVersion?.file_path || "-"}</td>
                  <td>{formatDateTime(item.created_at)}</td>
                  <td>{formatDateTime(item.latestVersion?.created_at)}</td>
                  <td>{formatDateTime(item.latestVersion?.approved_at)}</td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={13}>Nenhum documento encontrado com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

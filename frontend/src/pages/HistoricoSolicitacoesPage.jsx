import { useEffect, useMemo, useState } from "react";

import PaginationControls from "../components/PaginationControls";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import usePagination from "../hooks/usePagination";
import useViewportPreserver from "../hooks/useViewportPreserver";
import { deleteDraftDocument, resolveApiFileUrl, showGlobalError } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";
import { formatStatusLabel } from "../utils/status";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("pt-BR");
}

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

function ActionIcon({ kind }) {
  if (kind === "view") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 6c4.8 0 8.7 3.4 9.8 5.5a1 1 0 0 1 0 1C20.7 14.6 16.8 18 12 18S3.3 14.6 2.2 12.5a1 1 0 0 1 0-1C3.3 9.4 7.2 6 12 6Zm0 2c-3.7 0-6.9 2.5-7.8 4 .9 1.5 4.1 4 7.8 4s6.9-2.5 7.8-4c-.9-1.5-4.1-4-7.8-4Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l2.3 2.3V4a1 1 0 0 1 1-1ZM5 18a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function extractFileName(path) {
  if (!path) {
    return "arquivo";
  }
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || String(path);
}

function resolveFileUrl(path) {
  return resolveApiFileUrl(path);
}

function resolveFileDownloadUrl(path) {
  return resolveApiFileUrl(path, { download: true });
}

function resolvePreviewSrc(path) {
  return resolveApiFileUrl(path);
}

function buildViewerSrc(path) {
  const src = resolvePreviewSrc(path);
  if (!src) {
    return "";
  }
  return src;
}

export default function HistoricoSolicitacoesPage({ session, onUnauthorized, onEditDraft }) {
  const { preserveViewport } = useViewportPreserver();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
  });

  const showFeedback = (type, message) => {
    if (type === "error") {
      showGlobalError(message);
      setFeedback({ type: "", message: "" });
      return;
    }
    setFeedback({ type, message });
  };

  const loadItems = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const data = await fetchWorkflowItems();
      setItems(data);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Nao foi possivel carregar o historico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);
  useRealtimeEvents(loadItems, { channels: ["workflow", "catalog"] });

  const historyItems = useMemo(() => {
    if (!session?.userId) {
      return [];
    }

    const userId = Number(session.userId);
    return items
      .map((item) => {
        const createdByCurrentUser = Number(item.created_by) === userId;
        const userVersions = (item.versions || []).filter((version) => Number(version.created_by) === userId);
        const updatedByCurrentUser = userVersions.some((version) => Number(version.version_number) > 1);

        if (!createdByCurrentUser && !updatedByCurrentUser) {
          return null;
        }

        const requestKinds = [];
        if (createdByCurrentUser) {
          requestKinds.push("Criacao");
        }
        if (updatedByCurrentUser) {
          requestKinds.push("Atualizacao");
        }

        const lastUserVersionDate = userVersions.reduce((latest, version) => {
          if (!version?.created_at) {
            return latest;
          }
          if (!latest) {
            return version.created_at;
          }
          return new Date(version.created_at) > new Date(latest) ? version.created_at : latest;
        }, null);

        const candidates = [createdByCurrentUser ? item.created_at : null, lastUserVersionDate].filter(Boolean);
        const lastRequestAt = candidates.reduce((latest, value) => {
          if (!latest) {
            return value;
          }
          return new Date(value) > new Date(latest) ? value : latest;
        }, null);

        return {
          ...item,
          requestType: requestKinds.join(" + "),
          lastRequestAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a.lastRequestAt && !b.lastRequestAt) {
          return 0;
        }
        if (!a.lastRequestAt) {
          return 1;
        }
        if (!b.lastRequestAt) {
          return -1;
        }
        return new Date(b.lastRequestAt) - new Date(a.lastRequestAt);
      });
  }, [items, session?.userId]);

  const companies = useMemo(
    () =>
      [...new Set(historyItems.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [historyItems],
  );

  const sectors = useMemo(
    () =>
      [...new Set(historyItems.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [historyItems],
  );

  const statuses = useMemo(
    () =>
      [...new Set(historyItems.map((item) => item.latestStatus).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [historyItems],
  );

  const versions = useMemo(
    () =>
      [...new Set(
        historyItems
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
    [historyItems],
  );

  const expirations = useMemo(
    () =>
      [...new Set(historyItems.map((item) => item.latestVersion?.expiration_date || "SEM_VENCIMENTO"))].sort(
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
    [historyItems],
  );

  const filteredHistoryItems = useMemo(() => {
    const normalizedTerm = filters.term.trim().toLowerCase();
    return historyItems.filter((item) => {
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
          item.requestType,
          item.adjustment_comment,
          item.adjustment_reply_comment,
          formatStatusLabel(item.latestStatus),
          versionValue === "SEM_VERSAO" ? "sem versao" : `v${versionValue}`,
          expirationValue === "SEM_VENCIMENTO" ? "sem vencimento" : expirationValue,
          formatDateTime(item.lastRequestAt),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedTerm);
    });
  }, [historyItems, filters]);
  const historyItemsPagination = usePagination(filteredHistoryItems);

  const canManageDraft = (item) =>
    Number(item.created_by) === Number(session?.userId) &&
    ["RASCUNHO", "REVISAR_RASCUNHO", "RASCUNHO_REVISADO"].includes(item.latestStatus);

  const handleEditDraft = (item) => {
    onEditDraft?.({
      documentId: Number(item.id),
      title: item.title || "",
      companyId: item.company_id != null ? String(item.company_id) : "",
      sectorId: item.sector_id != null ? String(item.sector_id) : "",
      documentType: item.document_type || "",
      scope: item.scope || "LOCAL",
      filePath: item.latestVersion?.file_path || "",
      expirationDate: item.latestVersion?.expiration_date || "",
      latestStatus: item.latestStatus || "",
      adjustmentComment: item.adjustment_comment || "",
      adjustmentReplyComment: item.adjustment_reply_comment || "",
    });
  };

  const handleDeleteDraft = async (documentId) => {
    const confirmed = window.confirm("Confirma exclusao da solicitacao em rascunho?");
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await deleteDraftDocument(documentId);
      showFeedback("success", response.message || "Rascunho excluido.");
      await loadItems();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao excluir rascunho.");
    } finally {
      setSubmitting(false);
    }
  };

  const openPreview = (item) => {
    setSelectedResult(item);
    setViewerOpen(true);
  };

  const downloadFile = (filePath) => {
    const url = resolveFileDownloadUrl(filePath);
    if (!url) {
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = extractFileName(filePath);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Solicitacoes</p>
          <h2>Historico de Solicitacoes</h2>
          <p>Veja apenas as solicitacoes feitas por voce para criacao e atualizacao de documentos.</p>
        </div>
      </section>

      {feedback.type === "success" && feedback.message && (
        <p className={`feedback ${feedback.type}`}>{feedback.message}</p>
      )}

      <section className="panel-float painel-filters-grid">
        <label>
          Pesquisa
          <input
            type="text"
            placeholder="Codigo, titulo, empresa, setor..."
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
          Empresas
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
            {companies.map((value) => (
              <option key={value} value={value}>
                {value}
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
            {sectors.map((value) => (
              <option key={value} value={value}>
                {value}
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
            {statuses.map((value) => (
              <option key={value} value={value}>
                {formatStatusLabel(value)}
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Empresas</th>
                <th>Setor</th>
                <th>Tipo solicitacao</th>
                <th>Status</th>
                <th>Comentario ajuste</th>
                <th>Comentario reajuste</th>
                <th>Versao</th>
                <th>Vencimento</th>
                <th>Ultima solicitacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {historyItemsPagination.pagedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>{item.requestType}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {formatStatusLabel(item.latestStatus)}
                    </span>
                  </td>
                  <td>{item.adjustment_comment || "-"}</td>
                  <td>{item.adjustment_reply_comment || "-"}</td>
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                  <td>{item.latestVersion?.expiration_date || "-"}</td>
                  <td>{formatDateTime(item.lastRequestAt)}</td>
                  <td>
                    <div className="panel-docs-actions">
                      {canManageDraft(item) && (
                        <>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => handleEditDraft(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => handleDeleteDraft(item.id)}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="table-btn table-btn-view"
                        onClick={() => openPreview(item)}
                      >
                        <ActionIcon kind="view" />
                        <span>Ver</span>
                      </button>
                      <button
                        type="button"
                        className="table-btn table-btn-download"
                        onClick={() => downloadFile(item.latestVersion?.file_path)}
                        disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                      >
                        <ActionIcon kind="download" />
                        <span>Baixar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredHistoryItems.length === 0 && (
                <tr>
                  <td colSpan={12}>Nenhuma solicitacao no seu historico.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={historyItemsPagination.page}
          pageSize={historyItemsPagination.pageSize}
          totalItems={historyItemsPagination.totalItems}
          totalPages={historyItemsPagination.totalPages}
          pageSizeOptions={historyItemsPagination.pageSizeOptions}
          onPageChange={historyItemsPagination.setPage}
          onPageSizeChange={historyItemsPagination.setPageSize}
        />
      </section>
      <aside className={`viewer-drawer ${viewerOpen ? "open" : ""}`} aria-label="Visualizador de arquivo">
        <header className="viewer-head">
          <div>
            <p className="kicker">Visualizacao</p>
            <h3>{selectedResult ? selectedResult.title : "Documento"}</h3>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setViewerOpen(false);
              setSelectedResult(null);
            }}
          >
            Fechar
          </button>
        </header>

        {selectedResult && (
          <div className="viewer-body">
            <div className="preview-panel panel-float">
              {resolvePreviewSrc(selectedResult.latestVersion?.file_path) ? (
                <iframe
                  title="Visualizacao do arquivo"
                  src={buildViewerSrc(selectedResult.latestVersion?.file_path)}
                  className="file-frame"
                  scrolling="yes"
                />
              ) : (
                <div className="no-preview">
                  <p>Pre-visualizacao indisponivel para caminho local.</p>
                  <p className="mono">{selectedResult.latestVersion?.file_path || "-"}</p>
                </div>
              )}
            </div>

            <div className="meta-panel panel-float">
              <h4>Dados simples</h4>
              <ul>
                <li>
                  <strong>Codigo:</strong> {selectedResult.code}
                </li>
                <li>
                  <strong>Tipo solicitacao:</strong> {selectedResult.requestType || "-"}
                </li>
                <li>
                  <strong>Status:</strong> {formatStatusLabel(selectedResult.latestStatus)}
                </li>
                <li>
                  <strong>Versao:</strong>{" "}
                  {selectedResult.latestVersion?.version_number
                    ? `v${selectedResult.latestVersion.version_number}`
                    : "-"}
                </li>
                <li>
                  <strong>Empresa:</strong> {selectedResult.companyName || "-"}
                </li>
                <li>
                  <strong>Setor:</strong> {selectedResult.sectorName || "-"}
                </li>
                <li>
                  <strong>Ultima solicitacao:</strong> {formatDateTime(selectedResult.lastRequestAt)}
                </li>
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

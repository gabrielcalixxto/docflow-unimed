import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import { deleteDraftDocument, updateDraftDocument } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";
import { getCurrentLocalDateISO } from "../utils/date";
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

export default function HistoricoSolicitacoesPage({ session, onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const minExpirationDate = getCurrentLocalDateISO();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
  });
  const [editForm, setEditForm] = useState({
    documentId: null,
    title: "",
    filePath: "",
    expirationDate: "",
  });

  const showFeedback = (type, message) => setFeedback({ type, message });

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

  const canManageDraft = (item) =>
    Number(item.created_by) === Number(session?.userId) &&
    ["RASCUNHO", "REVISAR_RASCUNHO"].includes(item.latestStatus);

  const handleOpenEdit = (item) => {
    setEditForm({
      documentId: item.id,
      title: item.title || "",
      filePath: item.latestVersion?.file_path || "",
      expirationDate: item.latestVersion?.expiration_date || "",
    });
    setFeedback({ type: "", message: "" });
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editForm.documentId) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await updateDraftDocument(editForm.documentId, {
        title: editForm.title.trim(),
        file_path: editForm.filePath.trim(),
        expiration_date: editForm.expirationDate,
      });
      showFeedback("success", response.message || "Rascunho atualizado.");
      setEditForm({
        documentId: null,
        title: "",
        filePath: "",
        expirationDate: "",
      });
      await loadItems();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao atualizar rascunho.");
    } finally {
      setSubmitting(false);
    }
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
      if (editForm.documentId === documentId) {
        setEditForm({
          documentId: null,
          title: "",
          filePath: "",
          expirationDate: "",
        });
      }
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

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Solicitacoes</p>
          <h2>Historico de Solicitacoes</h2>
          <p>Veja apenas as solicitacoes feitas por voce para criacao e atualizacao de documentos.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadItems} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

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

      {editForm.documentId && (
        <section className="workflow-grid">
          <form className="panel-float workflow-card" onSubmit={handleSaveEdit}>
            <h3>Editar solicitacao em rascunho</h3>
            <div className="form-grid">
              <label>
                Titulo
                <input
                  required
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Caminho/URL do arquivo
                <input
                  required
                  value={editForm.filePath}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      filePath: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Data de vencimento
                <input
                  required
                  type="date"
                  min={minExpirationDate}
                  value={editForm.expirationDate}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      expirationDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="action-row">
              <button type="submit" className="compact-submit" disabled={submitting}>
                Salvar alteracoes
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={submitting}
                onClick={() =>
                  setEditForm({
                    documentId: null,
                    title: "",
                    filePath: "",
                    expirationDate: "",
                  })
                }
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

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
                <th>Versao</th>
                <th>Vencimento</th>
                <th>Ultima solicitacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistoryItems.map((item) => (
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
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                  <td>{item.latestVersion?.expiration_date || "-"}</td>
                  <td>{formatDateTime(item.lastRequestAt)}</td>
                  <td>
                    {canManageDraft(item) ? (
                      <>
                        <button
                          type="button"
                          className="table-btn"
                          disabled={submitting}
                          onClick={() => handleOpenEdit(item)}
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
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredHistoryItems.length === 0 && (
                <tr>
                  <td colSpan={10}>Nenhuma solicitacao no seu historico.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

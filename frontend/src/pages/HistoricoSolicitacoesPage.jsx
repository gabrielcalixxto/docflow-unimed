import { useEffect, useMemo, useState } from "react";

import { deleteDraftDocument, updateDraftDocument } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";

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

export default function HistoricoSolicitacoesPage({ session, onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
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

  const canManageDraft = (item) =>
    Number(item.created_by) === Number(session?.userId) && item.latestStatus === "RASCUNHO";

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
                <th>ID</th>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Company</th>
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
              {historyItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>{item.requestType}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {item.latestStatus}
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
              {!loading && historyItems.length === 0 && (
                <tr>
                  <td colSpan={11}>Nenhuma solicitacao no seu historico.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

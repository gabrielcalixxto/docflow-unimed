import { useEffect, useMemo, useState } from "react";

import { approveDocument, rejectDocument, submitForReview } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";
import { canAccessCentralAprovacao, isCoordinator, isReviewer } from "../utils/roles";

export default function SolicitacoesPage({ session, onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkflowItems();
      setItems(data);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Nao foi possivel carregar solicitacoes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const sessionRoles = session?.roles || session?.role;
  const reviewerRole = isReviewer(sessionRoles);
  const coordinatorRole = isCoordinator(sessionRoles);
  const canOpenSolicitacoes = canAccessCentralAprovacao(sessionRoles);

  const visibleItems = useMemo(() => {
    if (!canOpenSolicitacoes) {
      return [];
    }
    if (coordinatorRole) {
      const allowedSectorIds = Array.isArray(session?.sectorIds)
        ? session.sectorIds
        : session?.sectorId
          ? [session.sectorId]
          : [];
      if (allowedSectorIds.length === 0) {
        return [];
      }
      return items.filter((item) => allowedSectorIds.includes(Number(item.sector_id)));
    }
    return items;
  }, [items, canOpenSolicitacoes, coordinatorRole, session?.sectorId, session?.sectorIds]);

  const runAction = async (documentId, action) => {
    if (action === "review") {
      showFeedback("success", "Revisao em andamento. Ao concluir, clique em Aprovar.");
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      let response;
      if (action === "submit") {
        response = await submitForReview(documentId);
      } else if (action === "approve") {
        response = await approveDocument(documentId);
      } else {
        response = await rejectDocument(documentId, {
          reason: rejectReasons[documentId] || "",
        });
      }
      showFeedback("success", response.message || "Acao executada.");
      await loadItems();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao executar acao.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Fila operacional</p>
          <h2>Central de Aprovacao</h2>
          <p>Veja o status atual e execute as acoes de envio, aprovacao e reprovacao.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadItems} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="panel-float workflow-list">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Company</th>
                <th>Setor</th>
                <th>Status</th>
                <th>Versao</th>
                <th>Vencimento</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {item.latestStatus}
                    </span>
                  </td>
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                  <td>{item.latestVersion?.expiration_date || "-"}</td>
                  <td>
                    <div className="request-actions">
                      {item.latestStatus === "RASCUNHO" && reviewerRole && (
                        <>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => runAction(item.id, "review")}
                          >
                            Revisar
                          </button>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => runAction(item.id, "submit")}
                          >
                            Aprovar para coordenador
                          </button>
                        </>
                      )}

                      {item.latestStatus === "EM_REVISAO" && coordinatorRole && (
                        <>
                          <input
                            className="reject-reason"
                            type="text"
                            placeholder="Motivo da reprovacao (opcional)"
                            value={rejectReasons[item.id] || ""}
                            onChange={(event) =>
                              setRejectReasons((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => runAction(item.id, "approve")}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => runAction(item.id, "reject")}
                          >
                            Reprovar
                          </button>
                        </>
                      )}

                      {item.latestStatus === "SEM_VERSAO" && <span className="workflow-hint">Sem versao criada</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={8}>Nenhuma solicitacao encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

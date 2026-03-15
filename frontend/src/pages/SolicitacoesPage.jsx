import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import { approveDocument, rejectDocument, submitForReview } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";
import { canAccessCentralAprovacao, isCoordinator, isReviewer } from "../utils/roles";
import { formatStatusLabel } from "../utils/status";

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

export default function SolicitacoesPage({ session, onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
  });

  const showFeedback = (type, message) => setFeedback({ type, message });
  const reviewerStatuses = ["RASCUNHO", "REVISAR_RASCUNHO"];
  const coordinatorStatuses = ["PENDENTE_COORDENACAO", "EM_REVISAO"];

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

  const companies = useMemo(
    () =>
      [...new Set(visibleItems.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [visibleItems],
  );

  const sectors = useMemo(
    () =>
      [...new Set(visibleItems.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [visibleItems],
  );

  const statuses = useMemo(
    () =>
      [...new Set(visibleItems.map((item) => item.latestStatus).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [visibleItems],
  );

  const versions = useMemo(
    () =>
      [...new Set(
        visibleItems
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
    [visibleItems],
  );

  const expirations = useMemo(
    () =>
      [...new Set(visibleItems.map((item) => item.latestVersion?.expiration_date || "SEM_VENCIMENTO"))].sort(
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
    [visibleItems],
  );

  const filteredVisibleItems = useMemo(() => {
    const normalizedTerm = filters.term.trim().toLowerCase();
    return visibleItems.filter((item) => {
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
        formatStatusLabel(item.latestStatus),
        item.document_type,
        item.scope,
        versionValue === "SEM_VERSAO" ? "sem versao" : `v${versionValue}`,
        expirationValue === "SEM_VENCIMENTO" ? "sem vencimento" : expirationValue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedTerm);
    });
  }, [visibleItems, filters]);

  const runAction = async (documentId, action) => {
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
          <p>
            Revisor: aprova ou desaprova rascunho. Coordenacao: aprova ou reprova pendencias para
            publicar como vigente.
          </p>
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

      <section className="panel-float workflow-list">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Empresas</th>
                <th>Setor</th>
                <th>Status</th>
                <th>Versao</th>
                <th>Vencimento</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisibleItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.companyName}</td>
                  <td>{item.sectorName}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {formatStatusLabel(item.latestStatus)}
                    </span>
                  </td>
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                  <td>{item.latestVersion?.expiration_date || "-"}</td>
                  <td>
                    <div className="request-actions">
                      {reviewerStatuses.includes(item.latestStatus) && reviewerRole && (
                        <>
                          <button
                            type="button"
                            className="table-btn"
                            disabled={submitting}
                            onClick={() => runAction(item.id, "submit")}
                          >
                            Aprovar para coordenacao
                          </button>
                          <input
                            className="reject-reason"
                            type="text"
                            placeholder="Motivo da desaprovacao (opcional)"
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
                            onClick={() => runAction(item.id, "reject")}
                          >
                            Desaprovar
                          </button>
                        </>
                      )}

                      {coordinatorStatuses.includes(item.latestStatus) && coordinatorRole && (
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
              {!loading && filteredVisibleItems.length === 0 && (
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

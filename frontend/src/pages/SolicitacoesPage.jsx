import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useRealtimeEvents from "../hooks/useRealtimeEvents";
import useViewportPreserver from "../hooks/useViewportPreserver";
import { approveDocument, rejectDocument, resolveApiFileUrl, showGlobalError } from "../services/api";
import { fetchWorkflowItems } from "../services/workflow";
import { canAccessCentralAprovacao, isCoordinator, isReviewer } from "../utils/roles";
import { formatStatusLabel } from "../utils/status";

const FLOATING_BAR_TOP_OFFSET = 16;
const FLOATING_BAR_HEIGHT = 15;

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

export default function SolicitacoesPage({ session, onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const tableWrapRef = useRef(null);
  const tableAreaRef = useRef(null);
  const floatingScrollbarRef = useRef(null);
  const floatingScrollbarTrackRef = useRef(null);
  const syncingScrollRef = useRef(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [floatingBarLayout, setFloatingBarLayout] = useState({
    visible: false,
    mode: "hidden",
    left: 0,
    width: 0,
  });
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

  const showFeedback = (type, message) => {
    if (type === "error") {
      showGlobalError(message);
      setFeedback({ type: "", message: "" });
      return;
    }
    setFeedback({ type, message });
  };
  const coordinatorStatuses = ["RASCUNHO", "RASCUNHO_REVISADO", "REVISAR_RASCUNHO"];
  const qualityStatuses = ["PENDENTE_QUALIDADE", "PENDENTE_COORDENACAO", "EM_REVISAO"];

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
  useRealtimeEvents(loadItems, { channels: ["workflow", "catalog"] });

  const sessionRoles = session?.roles || session?.role;
  const qualityRole = isReviewer(sessionRoles);
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
        item.created_by_name,
        item.latestVersion?.created_by_name,
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

  const updateFloatingBarLayout = useCallback(() => {
    const tableWrap = tableWrapRef.current;
    const tableArea = tableAreaRef.current;
    const floatingTrack = floatingScrollbarTrackRef.current;
    const floatingScrollbar = floatingScrollbarRef.current;
    if (!tableWrap || !tableArea || !floatingTrack) {
      return;
    }

    const scrollWidth = Math.max(tableWrap.scrollWidth, tableWrap.clientWidth + 1);
    const hasHorizontalOverflow = tableWrap.scrollWidth > tableWrap.clientWidth + 1;
    floatingTrack.style.width = `${scrollWidth}px`;
    if (floatingScrollbar) {
      floatingScrollbar.scrollLeft = tableWrap.scrollLeft;
    }

    const areaRect = tableArea.getBoundingClientRect();
    const isVisibleInViewport = areaRect.bottom > 0 && areaRect.top < window.innerHeight;
    if (!hasHorizontalOverflow || !isVisibleInViewport) {
      setFloatingBarLayout((previous) =>
        previous.visible
          ? {
              ...previous,
              visible: false,
              mode: "hidden",
            }
          : previous,
      );
      return;
    }

    let mode = "fixed";
    if (areaRect.top >= FLOATING_BAR_TOP_OFFSET) {
      mode = "top";
    } else if (areaRect.bottom <= FLOATING_BAR_TOP_OFFSET + FLOATING_BAR_HEIGHT) {
      mode = "bottom";
    }

    const nextLayout = {
      visible: true,
      mode,
      left: areaRect.left,
      width: areaRect.width,
    };
    setFloatingBarLayout((previous) => {
      const sameVisibility = previous.visible === nextLayout.visible;
      const sameMode = previous.mode === nextLayout.mode;
      const sameLeft = Math.abs(previous.left - nextLayout.left) < 0.5;
      const sameWidth = Math.abs(previous.width - nextLayout.width) < 0.5;
      return sameVisibility && sameMode && sameLeft && sameWidth ? previous : nextLayout;
    });
  }, []);

  useEffect(() => {
    const rafId = requestAnimationFrame(updateFloatingBarLayout);
    const tableWrap = tableWrapRef.current;
    const tableArea = tableAreaRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateFloatingBarLayout())
        : null;
    if (tableWrap && resizeObserver) {
      resizeObserver.observe(tableWrap);
    }
    if (tableArea && resizeObserver) {
      resizeObserver.observe(tableArea);
    }
    window.addEventListener("resize", updateFloatingBarLayout);
    window.addEventListener("scroll", updateFloatingBarLayout, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateFloatingBarLayout);
      window.removeEventListener("scroll", updateFloatingBarLayout);
      resizeObserver?.disconnect();
    };
  }, [filteredVisibleItems.length, loading, updateFloatingBarLayout]);

  const handleTableScroll = () => {
    const tableWrap = tableWrapRef.current;
    const floatingScrollbar = floatingScrollbarRef.current;
    if (!tableWrap || !floatingScrollbar) {
      return;
    }
    if (syncingScrollRef.current) {
      return;
    }
    syncingScrollRef.current = true;
    floatingScrollbar.scrollLeft = tableWrap.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
    updateFloatingBarLayout();
  };

  const handleFloatingScrollbarScroll = () => {
    const tableWrap = tableWrapRef.current;
    const floatingScrollbar = floatingScrollbarRef.current;
    if (!tableWrap || !floatingScrollbar) {
      return;
    }
    if (syncingScrollRef.current) {
      return;
    }
    syncingScrollRef.current = true;
    tableWrap.scrollLeft = floatingScrollbar.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const runAction = async (documentId, action) => {
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response =
        action === "approve"
          ? await approveDocument(documentId)
          : await rejectDocument(documentId, {
              reason: rejectReasons[documentId] || "",
            });
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

  const openPreviewInNewTab = (filePath) => {
    const url = resolveFileUrl(filePath);
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadFile = (filePath) => {
    const url = resolveFileDownloadUrl(filePath);
    if (!url) {
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = extractFileName(filePath);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Fila operacional</p>
          <h2>Central de Aprovacao</h2>
          <p>
            Coordenador/Aprovador revisa rascunhos e envia para qualidade. Qualidade realiza
            aprovacao final para vigencia.
          </p>
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
        <div className="panel-docs-table-area" ref={tableAreaRef}>
          {floatingBarLayout.visible && (
            <div
              className={`table-scrollbar-card table-scrollbar-card--floating table-scrollbar-card--${floatingBarLayout.mode}`}
              ref={floatingScrollbarRef}
              onScroll={handleFloatingScrollbarScroll}
              aria-label="Barra horizontal flutuante da tabela"
              style={
                floatingBarLayout.mode === "fixed"
                  ? {
                      left: `${floatingBarLayout.left}px`,
                      width: `${floatingBarLayout.width}px`,
                      top: `${FLOATING_BAR_TOP_OFFSET}px`,
                    }
                  : undefined
              }
            >
              <div className="table-scrollbar-track" ref={floatingScrollbarTrackRef} />
            </div>
          )}
          <div className="table-wrap panel-docs-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            <table style={{ minWidth: "1200px" }}>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Titulo</th>
                  <th>Empresas</th>
                  <th>Setor</th>
                  <th>Status</th>
                  <th>Versao</th>
                  <th>Vencimento</th>
                  <th>Criado por</th>
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
                    <td>{item.latestVersion?.created_by_name || item.created_by_name || "-"}</td>
                    <td>
                      <div className="request-actions">
                        <button
                          type="button"
                          className="table-btn"
                          onClick={() => openPreviewInNewTab(item.latestVersion?.file_path)}
                          disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                          title="Pre-visualizar arquivo"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="table-btn"
                          onClick={() => downloadFile(item.latestVersion?.file_path)}
                          disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                          title="Baixar arquivo"
                        >
                          Download
                        </button>

                        {coordinatorStatuses.includes(item.latestStatus) && coordinatorRole && (
                          <>
                            <input
                              className="reject-reason"
                              type="text"
                              placeholder="Motivo da devolucao (opcional)"
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
                              Aprovar e enviar para qualidade
                            </button>
                            <button
                              type="button"
                              className="table-btn"
                              disabled={submitting}
                              onClick={() => runAction(item.id, "reject")}
                            >
                              Devolver para revisao
                            </button>
                          </>
                        )}

                        {qualityStatuses.includes(item.latestStatus) && qualityRole && (
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
                              Aprovar e tornar vigente
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
                    <td colSpan={9}>Nenhuma solicitacao encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useRealtimeEvents from "../hooks/useRealtimeEvents";
import useViewportPreserver from "../hooks/useViewportPreserver";
import { fetchWorkflowItems, summarizeWorkflow } from "../services/workflow";
import { formatStatusLabel } from "../utils/status";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const FLOATING_BAR_TOP_OFFSET = 16;
const FLOATING_BAR_HEIGHT = 15;

const STATUS_ORDER = [
  "VIGENTE",
  "PENDENTE_QUALIDADE",
  "PENDENTE_COORDENACAO",
  "RASCUNHO",
  "RASCUNHO_REVISADO",
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

function extractFileName(path) {
  if (!path) {
    return "arquivo";
  }
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || String(path);
}

function resolveFileUrl(path) {
  if (!path) {
    return "";
  }
  const value = String(path).trim();
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }
  return "";
}

function resolveFileDownloadUrl(path) {
  const base = resolveFileUrl(path);
  if (!base) {
    return "";
  }
  return `${base}${base.includes("?") ? "&" : "?"}download=1`;
}

function normalizeNumericIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => Number(value))
    .filter((value, index, list) => Number.isInteger(value) && list.indexOf(value) === index);
}

export default function PainelDocumentos({ session, onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const tableWrapRef = useRef(null);
  const tableAreaRef = useRef(null);
  const floatingScrollbarRef = useRef(null);
  const floatingScrollbarTrackRef = useRef(null);
  const syncingScrollRef = useRef(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [floatingBarLayout, setFloatingBarLayout] = useState({
    visible: false,
    mode: "hidden",
    left: 0,
    width: 0,
  });
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    documentType: "ALL",
    scope: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
    requestedBy: "ALL",
    approvedBy: "ALL",
    invalidatedBy: "ALL",
    invalidatedDate: "ALL",
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
  useRealtimeEvents(loadItems, { channels: ["workflow", "catalog"] });

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

  const allowedCompanyIds = useMemo(() => normalizeNumericIds(session?.companyIds), [session?.companyIds]);
  const allowedSectorIds = useMemo(() => normalizeNumericIds(session?.sectorIds), [session?.sectorIds]);

  const scopedVersionRows = useMemo(
    () =>
      versionRows.filter((item) => {
        const companyAllowed =
          allowedCompanyIds.length === 0 || allowedCompanyIds.includes(Number(item.company_id));
        const sectorAllowed =
          allowedSectorIds.length === 0 || allowedSectorIds.includes(Number(item.sector_id));
        return companyAllowed && sectorAllowed;
      }),
    [versionRows, allowedCompanyIds, allowedSectorIds],
  );

  const companies = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const sectors = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const documentTypes = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.document_type).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const scopes = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.scope).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const statuses = useMemo(() => {
    const availableStatuses = new Set(scopedVersionRows.map((item) => item.latestStatus).filter(Boolean));
    const extraStatuses = [...availableStatuses]
      .filter((status) => !STATUS_ORDER.includes(status))
      .sort((a, b) => String(a).localeCompare(String(b)));
    return [...STATUS_ORDER, ...extraStatuses];
  }, [scopedVersionRows]);

  const versions = useMemo(
    () =>
      [...new Set(
        scopedVersionRows
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
    [scopedVersionRows],
  );

  const expirations = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.latestVersion?.expiration_date || "SEM_VENCIMENTO"))].sort(
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
    [scopedVersionRows],
  );

  const approvers = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.latestVersion?.approved_by_name || "SEM_APROVADOR"))].sort(
        (a, b) => String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const requesters = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.created_by_name || "SEM_SOLICITANTE"))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const invalidators = useMemo(
    () =>
      [...new Set(scopedVersionRows.map((item) => item.latestVersion?.invalidated_by_name || "SEM_INVALIDADOR"))].sort(
        (a, b) => String(a).localeCompare(String(b)),
      ),
    [scopedVersionRows],
  );

  const invalidatedDates = useMemo(
    () =>
      [...new Set(
        scopedVersionRows.map((item) => {
          if (!item.latestVersion?.invalidated_at) {
            return "SEM_INVALIDACAO";
          }
          const parsed = new Date(item.latestVersion.invalidated_at);
          if (Number.isNaN(parsed.getTime())) {
            return String(item.latestVersion.invalidated_at);
          }
          return parsed.toISOString().slice(0, 10);
        }),
      )].sort((a, b) => {
        if (a === "SEM_INVALIDACAO") {
          return 1;
        }
        if (b === "SEM_INVALIDACAO") {
          return -1;
        }
        return String(a).localeCompare(String(b));
      }),
    [scopedVersionRows],
  );

  const filteredItems = useMemo(() => {
    const normalizedTerm = filters.term.trim().toLowerCase();
    return scopedVersionRows.filter((item) => {
      const versionValue =
        item.latestVersion?.version_number != null
          ? String(item.latestVersion.version_number)
          : "SEM_VERSAO";
      const expirationValue = item.latestVersion?.expiration_date || "SEM_VENCIMENTO";
      const approvedByValue = item.latestVersion?.approved_by_name || "SEM_APROVADOR";
      const requestedByValue = item.created_by_name || "SEM_SOLICITANTE";
      const invalidatedByValue = item.latestVersion?.invalidated_by_name || "SEM_INVALIDADOR";
      const invalidatedDateValue = item.latestVersion?.invalidated_at
        ? (() => {
            const parsed = new Date(item.latestVersion.invalidated_at);
            if (Number.isNaN(parsed.getTime())) {
              return String(item.latestVersion.invalidated_at);
            }
            return parsed.toISOString().slice(0, 10);
          })()
        : "SEM_INVALIDACAO";

      if (filters.company !== "ALL" && item.companyName !== filters.company) {
        return false;
      }
      if (filters.sector !== "ALL" && item.sectorName !== filters.sector) {
        return false;
      }
      if (filters.documentType !== "ALL" && item.document_type !== filters.documentType) {
        return false;
      }
      if (filters.scope !== "ALL" && item.scope !== filters.scope) {
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
      if (filters.requestedBy !== "ALL" && requestedByValue !== filters.requestedBy) {
        return false;
      }
      if (filters.approvedBy !== "ALL" && approvedByValue !== filters.approvedBy) {
        return false;
      }
      if (filters.invalidatedBy !== "ALL" && invalidatedByValue !== filters.invalidatedBy) {
        return false;
      }
      if (filters.invalidatedDate !== "ALL" && invalidatedDateValue !== filters.invalidatedDate) {
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
        item.created_by_name || "",
        formatStatusLabel(item.latestStatus),
        versionValue === "SEM_VERSAO" ? "sem versao" : `v${versionValue}`,
        expirationValue === "SEM_VENCIMENTO" ? "sem vencimento" : expirationValue,
        requestedByValue === "SEM_SOLICITANTE" ? "sem solicitante" : requestedByValue,
        approvedByValue === "SEM_APROVADOR" ? "sem aprovador" : approvedByValue,
        invalidatedByValue === "SEM_INVALIDADOR" ? "sem invalidador" : invalidatedByValue,
        invalidatedDateValue === "SEM_INVALIDACAO" ? "sem invalidacao" : invalidatedDateValue,
        item.latestVersion?.file_path || "",
        formatDateTime(item.created_at),
        formatDateTime(item.latestVersion?.created_at),
        formatDateTime(item.latestVersion?.approved_at),
        formatDateTime(item.latestVersion?.invalidated_at),
        item.latestVersion?.invalidated_by_name || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedTerm);
    });
  }, [scopedVersionRows, filters]);

  const stats = useMemo(() => summarizeWorkflow(filteredItems), [filteredItems]);

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
  }, [filteredItems.length, loading, updateFloatingBarLayout]);

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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Visao geral</p>
          <h2>Painel de documentos</h2>
          <p>Resumo do acervo considerando todas as versoes de cada documento.</p>
        </div>
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
          <p>Rascunho revisado</p>
          <strong>{stats.rascunhoRevisado}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Revisar rascunho</p>
          <strong>{stats.revisarRascunho}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Pendente qualidade</p>
          <strong>{stats.pendenteQualidade}</strong>
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
          Tipo documental
          <select
            value={filters.documentType}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  documentType: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {documentTypes.map((documentType) => (
              <option key={documentType} value={documentType}>
                {documentType}
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
            {scopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
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

        <label>
          Solicitado por
          <select
            value={filters.requestedBy}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  requestedBy: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {requesters.map((requester) => (
              <option key={requester} value={requester}>
                {requester === "SEM_SOLICITANTE" ? "Sem solicitante" : requester}
              </option>
            ))}
          </select>
        </label>

        <label>
          Aprovador
          <select
            value={filters.approvedBy}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  approvedBy: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {approvers.map((approver) => (
              <option key={approver} value={approver}>
                {approver === "SEM_APROVADOR" ? "Sem aprovador" : approver}
              </option>
            ))}
          </select>
        </label>

        <label>
          Invalidado por
          <select
            value={filters.invalidatedBy}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  invalidatedBy: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {invalidators.map((invalidator) => (
              <option key={invalidator} value={invalidator}>
                {invalidator === "SEM_INVALIDADOR" ? "Sem invalidador" : invalidator}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data invalidado
          <select
            value={filters.invalidatedDate}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  invalidatedDate: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {invalidatedDates.map((dateValue) => (
              <option key={dateValue} value={dateValue}>
                {dateValue === "SEM_INVALIDACAO" ? "Sem invalidacao" : formatDate(dateValue)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Resumo geral dos documentos e versoes</h3>
        </div>
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
                  <th>Acoes</th>
                  <th>Documento criado em</th>
                  <th>Versao criada em</th>
                  <th>Solicitado por</th>
                  <th>Solicitante da versao</th>
                  <th>Aprovada em</th>
                  <th>Aprovador por</th>
                  <th>Invalidado por</th>
                  <th>Data invalidado</th>
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
                    <td>
                      <button
                        type="button"
                        className="table-btn"
                        onClick={() => openPreviewInNewTab(item.latestVersion?.file_path)}
                        disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                        title="Pre-visualizar"
                      >
                        {"\u{1F441}"} Ver
                      </button>
                      <button
                        type="button"
                        className="table-btn"
                        onClick={() => downloadFile(item.latestVersion?.file_path)}
                        disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                        title="Download"
                      >
                        Download
                      </button>
                    </td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{formatDateTime(item.latestVersion?.created_at)}</td>
                    <td>{item.created_by_name || "-"}</td>
                    <td>{item.latestVersion?.created_by_name || "-"}</td>
                    <td>{formatDateTime(item.latestVersion?.approved_at)}</td>
                    <td>{item.latestVersion?.approved_by_name || "-"}</td>
                    <td>{item.latestVersion?.invalidated_by_name || "-"}</td>
                    <td>{formatDateTime(item.latestVersion?.invalidated_at)}</td>
                  </tr>
                ))}
                {!loading && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={18}>Nenhum documento encontrado com os filtros atuais.</td>
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

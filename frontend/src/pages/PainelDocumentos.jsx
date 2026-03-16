import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PaginationControls from "../components/PaginationControls";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import usePagination from "../hooks/usePagination";
import useViewportPreserver from "../hooks/useViewportPreserver";
import { resolveApiFileUrl, showGlobalError } from "../services/api";
import { fetchWorkflowItems, summarizeWorkflow } from "../services/workflow";
import { formatStatusLabel } from "../utils/status";

const FLOATING_BAR_TOP_OFFSET = 16;

const STATUS_ORDER = [
  "VIGENTE",
  "PENDENTE_COORDENACAO",
  "RASCUNHO",
  "RASCUNHO_REVISADO",
  "REVISAR_RASCUNHO",
  "REPROVADO",
  "OBSOLETO",
  "EM_REVISAO",
  "SEM_VERSAO",
];

const METRIC_DEFINITIONS = [
  { key: "total", label: "Total", tone: "total", icon: "stack" },
  { key: "semVersao", label: "Sem versao", tone: "sem_versao", icon: "file" },
  { key: "rascunho", label: "Rascunho", tone: "rascunho", icon: "draft" },
  { key: "rascunhoRevisado", label: "Rascunho revisado", tone: "rascunho_revisado", icon: "draft" },
  { key: "revisarRascunho", label: "Pendente Ajuste", tone: "revisar_rascunho", icon: "draft" },
  { key: "pendenteCoordenacao", label: "Pendente coordenacao", tone: "pendente_coordenacao", icon: "clock" },
  { key: "reprovado", label: "Reprovado", tone: "reprovado", icon: "close" },
  { key: "vigente", label: "Vigente", tone: "vigente", icon: "check" },
  { key: "obsoleto", label: "Obsoleto", tone: "obsoleto", icon: "archive" },
];

function SectionIcon({ kind }) {
  if (kind === "summary") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13h4v7H4v-7Zm6-9h4v16h-4V4Zm6 5h4v11h-4V9Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "filters") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 .8 1.6L14 13v5a1 1 0 0 1-1.4.9l-2-1A1 1 0 0 1 10 17v-4L4.2 5.6A1 1 0 0 1 4 5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm2 1v3h12V6H6Zm0 5v7h12v-7H6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MetricIcon({ kind }) {
  if (kind === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9.6 16.2 6 12.6a1 1 0 1 1 1.4-1.4l2.2 2.2 7-7a1 1 0 1 1 1.4 1.4l-7.7 7.7a1 1 0 0 1-1.4 0Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === "close") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 7a1 1 0 0 1 1.4 0L12 10.6 15.6 7a1 1 0 1 1 1.4 1.4L13.4 12l3.6 3.6a1 1 0 1 1-1.4 1.4L12 13.4 8.4 17a1 1 0 1 1-1.4-1.4L10.6 12 7 8.4A1 1 0 0 1 7 7Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a9 9 0 1 1-6.4 2.6A8.9 8.9 0 0 1 12 3Zm0 2a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm-1 2a1 1 0 0 1 2 0v4l2.5 1.5a1 1 0 0 1-1 1.7l-3-1.8a1 1 0 0 1-.5-.9V7Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === "archive") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3H4V5Zm0 5h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Zm5 3a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === "draft") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.5V9h4.5L14 4.5ZM8 13h8v2H8v-2Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === "file") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm6 1.5V9h4.5L13 4.5ZM9 13h6v2H9v-2Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" fill="currentColor" />
    </svg>
  );
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
  const [floatingBarVisible, setFloatingBarVisible] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
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
    try {
      const data = await fetchWorkflowItems();
      setItems(data);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showGlobalError(requestError.message || "Nao foi possivel carregar o painel.");
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
  const metricCards = useMemo(
    () =>
      METRIC_DEFINITIONS.map((definition) => ({
        ...definition,
        value: stats[definition.key] ?? 0,
      })),
    [stats],
  );
  const filteredItemsPagination = usePagination(filteredItems);

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
    const isVisibleInViewport = areaRect.bottom > FLOATING_BAR_TOP_OFFSET && areaRect.top < window.innerHeight;
    if (!hasHorizontalOverflow || !isVisibleInViewport) {
      setFloatingBarVisible(false);
      return;
    }
    setFloatingBarVisible(true);
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
    <div className="page-animation painel-documentos-page">
      <section className="hero-block">
        <div>
          <p className="kicker">Visao geral</p>
          <h2>Painel de documentos</h2>
          <p>Resumo do acervo considerando todas as versoes de cada documento.</p>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <span className="section-title-icon" aria-hidden="true">
            <SectionIcon kind="summary" />
          </span>
          <div>
            <h3 className="section-title">Resumo geral</h3>
            <p className="section-subtitle">Indicadores por status do ciclo documental.</p>
          </div>
        </div>
        <div className="workflow-summary-grid">
          {metricCards.map((metric) => (
            <article key={metric.key} className={`panel-float workflow-stat workflow-stat--${metric.tone}`}>
              <div className="workflow-stat-head">
                <p>{metric.label}</p>
                <span className="workflow-stat-icon" aria-hidden="true">
                  <MetricIcon kind={metric.icon} />
                </span>
              </div>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <span className="section-title-icon" aria-hidden="true">
            <SectionIcon kind="filters" />
          </span>
          <div>
            <h3 className="section-title">Filtros</h3>
            <p className="section-subtitle">Refine a visualizacao para focar no que importa agora.</p>
          </div>
        </div>
        <div className="panel-float painel-filters-grid">
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
        </div>
      </section>

      <section className="dashboard-section">
        <div className="panel-float workflow-list">
        <div className="panel-docs-table-area" ref={tableAreaRef}>
          {floatingBarVisible && (
            <div
              className="table-scrollbar-card table-scrollbar-card--floating"
              ref={floatingScrollbarRef}
              onScroll={handleFloatingScrollbarScroll}
              aria-label="Barra horizontal flutuante da tabela"
            >
              <div className="table-scrollbar-track" ref={floatingScrollbarTrackRef} />
            </div>
          )}
          <div className="table-wrap panel-docs-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            <table className="panel-docs-table">
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
                  <th>Criado por</th>
                  <th>Solicitante da versao</th>
                  <th>Aprovada em</th>
                  <th>Aprovado por</th>
                  <th>Invalidado por</th>
                  <th>Data invalidado</th>
                </tr>
              </thead>
              <tbody>
                {filteredItemsPagination.pagedItems.map((item) => (
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
                      <div className="panel-docs-actions">
                        <button
                          type="button"
                          className="table-btn table-btn-view"
                          onClick={() => openPreview(item)}
                          title="Pre-visualizar"
                        >
                          <ActionIcon kind="view" />
                          <span>Ver</span>
                        </button>
                        <button
                          type="button"
                          className="table-btn table-btn-download"
                          onClick={() => downloadFile(item.latestVersion?.file_path)}
                          disabled={!resolveFileUrl(item.latestVersion?.file_path)}
                          title="Download"
                        >
                          <ActionIcon kind="download" />
                          <span>Baixar</span>
                        </button>
                      </div>
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
        <PaginationControls
          page={filteredItemsPagination.page}
          pageSize={filteredItemsPagination.pageSize}
          totalItems={filteredItemsPagination.totalItems}
          totalPages={filteredItemsPagination.totalPages}
          pageSizeOptions={filteredItemsPagination.pageSizeOptions}
          onPageChange={filteredItemsPagination.setPage}
          onPageSizeChange={filteredItemsPagination.setPageSize}
        />
        </div>
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
                  <strong>Tipo:</strong> {selectedResult.document_type || "-"}
                </li>
                <li>
                  <strong>Escopo:</strong> {selectedResult.scope || "-"}
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
                  <strong>Solicitante:</strong>{" "}
                  {selectedResult.latestVersion?.created_by_name || selectedResult.created_by_name || "-"}
                </li>
                <li>
                  <strong>Aprovador:</strong> {selectedResult.latestVersion?.approved_by_name || "-"}
                </li>
                <li>
                  <strong>Aprovado em:</strong> {formatDateTime(selectedResult.latestVersion?.approved_at)}
                </li>
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}



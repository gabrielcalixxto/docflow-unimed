import { useEffect, useMemo, useState } from "react";

import PaginationControls from "../components/PaginationControls";
import usePagination from "../hooks/usePagination";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import useViewportPreserver from "../hooks/useViewportPreserver";
import {
  getDocumentFormOptions,
  resolveApiFileUrl,
  searchDocuments,
  showGlobalError,
} from "../services/api";

function extractFileName(path) {
  if (!path) {
    return "arquivo-sem-nome";
  }
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || path;
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

export default function SearchPage({ onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const [filters, setFilters] = useState({
    term: "",
    companyId: "ALL",
    sectorId: "ALL",
    documentType: "ALL",
    scope: "ALL",
  });
  const [searchOptions, setSearchOptions] = useState({
    companies: [],
    sectors: [],
    documentTypes: [],
    scopes: [],
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const loadResults = async () => {
    setLoading(true);
    try {
      const [searchData, formOptions] = await Promise.all([searchDocuments(), getDocumentFormOptions()]);
      setItems(searchData.items || []);
      const companies = Array.isArray(formOptions?.companies) ? formOptions.companies : [];
      const sectors = Array.isArray(formOptions?.sectors) ? formOptions.sectors : [];
      const documentTypes = Array.isArray(formOptions?.document_types) ? formOptions.document_types : [];
      const scopes = Array.isArray(formOptions?.scopes) ? formOptions.scopes : [];
      setSearchOptions({ companies, sectors, documentTypes, scopes });
      setFilters((prev) => ({
        ...prev,
        companyId:
          prev.companyId === "ALL" || companies.some((company) => String(company.id) === prev.companyId)
            ? prev.companyId
            : "ALL",
        sectorId:
          prev.sectorId === "ALL" || sectors.some((sector) => String(sector.id) === prev.sectorId)
            ? prev.sectorId
            : "ALL",
        documentType:
          prev.documentType === "ALL" || documentTypes.includes(prev.documentType) ? prev.documentType : "ALL",
        scope: prev.scope === "ALL" || scopes.includes(prev.scope) ? prev.scope : "ALL",
      }));
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showGlobalError(requestError.message || "Nao foi possivel carregar os documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);
  useRealtimeEvents(loadResults, { channels: ["workflow", "catalog"] });

  const availableSectors = useMemo(() => {
    if (filters.companyId === "ALL") {
      return searchOptions.sectors;
    }
    return searchOptions.sectors.filter((sector) => String(sector.company_id) === filters.companyId);
  }, [filters.companyId, searchOptions.sectors]);

  const companyNameById = useMemo(
    () => new Map(searchOptions.companies.map((company) => [String(company.id), company.name])),
    [searchOptions.companies],
  );
  const sectorNameById = useMemo(
    () => new Map(searchOptions.sectors.map((sector) => [String(sector.id), sector.name])),
    [searchOptions.sectors],
  );

  useEffect(() => {
    if (filters.sectorId === "ALL") {
      return;
    }
    if (!availableSectors.some((sector) => String(sector.id) === filters.sectorId)) {
      setFilters((prev) => ({ ...prev, sectorId: "ALL" }));
    }
  }, [availableSectors, filters.sectorId]);

  const filteredItems = useMemo(() => {
    const term = filters.term.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.companyId !== "ALL" && String(item.company_id) !== filters.companyId) {
        return false;
      }
      if (filters.sectorId !== "ALL" && String(item.sector_id) !== filters.sectorId) {
        return false;
      }
      if (filters.scope !== "ALL" && item.scope !== filters.scope) {
        return false;
      }
      if (filters.documentType !== "ALL" && item.document_type !== filters.documentType) {
        return false;
      }
      if (term) {
        const fileName = extractFileName(item.file_path).toLowerCase();
        const haystack = [item.code, item.title, item.document_type, item.scope, fileName].join(" ").toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [items, filters]);
  const filteredItemsPagination = usePagination(filteredItems);

  const openViewer = (item) => {
    setSelectedResult(item);
    setViewerOpen(true);
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Busca simplificada</p>
          <h2>Documentos vigentes</h2>
          <p>Use filtros combinados por empresa, setor, tipo documental, escopo e termo livre.</p>
        </div>
      </section>

      <section className="panel-float painel-filters-grid">
        <label>
          Busca por termo
          <input
            type="text"
            placeholder="Nome, codigo ou palavra-chave"
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
            value={filters.companyId}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  companyId: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {searchOptions.companies.map((company) => (
              <option key={company.id} value={String(company.id)}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Setor
          <select
            value={filters.sectorId}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  sectorId: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {availableSectors.map((sector) => (
              <option key={sector.id} value={String(sector.id)}>
                {sector.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de documento
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
            {searchOptions.documentTypes.map((documentType) => (
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
            {searchOptions.scopes.map((scopeValue) => (
              <option key={scopeValue} value={scopeValue}>
                {scopeValue}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="results-grid">
        {filteredItemsPagination.pagedItems.map((item, index) => (
          <button
            key={`${item.document_id}-${item.active_version_id}`}
            type="button"
            className={`result-card panel-float ${
              selectedResult?.document_id === item.document_id &&
              selectedResult?.active_version_id === item.active_version_id
                ? "result-card-selected"
                : ""
            }`}
            onClick={() => openViewer(item)}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="result-head">
              <span className="result-type-pill">{item.code}</span>
              <span className="result-head-title">{item.title}</span>
            </div>
            <div className="result-midline">
              <span className="result-head-meta">
                v{item.active_version_number}
                {"    "}
                {item.scope}
              </span>
            </div>
            <p className="result-code">
              {(companyNameById.get(String(item.company_id)) || "Empresa desconhecida") +
                " - " +
                (sectorNameById.get(String(item.sector_id)) || "Setor desconhecido")}
            </p>
          </button>
        ))}
      </section>

      <PaginationControls
        page={filteredItemsPagination.page}
        pageSize={filteredItemsPagination.pageSize}
        totalItems={filteredItemsPagination.totalItems}
        totalPages={filteredItemsPagination.totalPages}
        pageSizeOptions={filteredItemsPagination.pageSizeOptions}
        onPageChange={filteredItemsPagination.setPage}
        onPageSizeChange={filteredItemsPagination.setPageSize}
      />

      {!loading && filteredItems.length === 0 && (
        <section className="empty-box panel-float">
          <p>Nenhum documento encontrado com os filtros atuais.</p>
        </section>
      )}

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
              {resolvePreviewSrc(selectedResult.file_path) ? (
                <iframe
                  title="Visualizacao do arquivo"
                  src={buildViewerSrc(selectedResult.file_path)}
                  className="file-frame"
                  scrolling="yes"
                />
              ) : (
                <div className="no-preview">
                  <p>Pre-visualizacao indisponivel para caminho local.</p>
                  <p className="mono">{selectedResult.file_path}</p>
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
                  <strong>Titulo:</strong> {selectedResult.title}
                </li>
                <li>
                  <strong>Tipo:</strong> {selectedResult.document_type}
                </li>
                <li>
                  <strong>Escopo:</strong> {selectedResult.scope}
                </li>
                <li>
                  <strong>Versao ativa:</strong> {selectedResult.active_version_number}
                </li>
                <li>
                  <strong>Criado por:</strong> {selectedResult.created_by_name || "-"}
                </li>
                <li>
                  <strong>Aprovado por:</strong> {selectedResult.approved_by_name || "-"}
                </li>
                <li>
                  <strong>Aprovado em:</strong> {formatDateTime(selectedResult.approved_at)}
                </li>
                <li>
                  <strong>Empresa:</strong>{" "}
                  {companyNameById.get(String(selectedResult.company_id)) || "Empresa desconhecida"}
                </li>
                <li>
                  <strong>Setor:</strong>{" "}
                  {sectorNameById.get(String(selectedResult.sector_id)) || "Setor desconhecido"}
                </li>
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

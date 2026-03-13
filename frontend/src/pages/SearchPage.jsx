import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import { getDocument, getDocumentFormOptions, getDocumentVersions, searchDocuments } from "../services/api";

function extractFileName(path) {
  if (!path) {
    return "arquivo-sem-nome";
  }
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function isEmbeddablePath(path) {
  if (!path) {
    return false;
  }
  return /^https?:\/\//i.test(path);
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
  const [error, setError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState([]);

  const loadResults = async () => {
    setLoading(true);
    setError("");
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
      setError(requestError.message || "Nao foi possivel carregar os documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const availableSectors = useMemo(() => {
    if (filters.companyId === "ALL") {
      return searchOptions.sectors;
    }
    return searchOptions.sectors.filter((sector) => String(sector.company_id) === filters.companyId);
  }, [filters.companyId, searchOptions.sectors]);

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

  const openViewer = async (item) => {
    setSelectedResult(item);
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError("");
    setSelectedDocument(null);
    setSelectedVersions([]);
    try {
      const [documentData, versionsData] = await Promise.all([
        getDocument(item.document_id),
        getDocumentVersions(item.document_id),
      ]);
      setSelectedDocument(documentData);
      setSelectedVersions(versionsData || []);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      setViewerError(requestError.message || "Nao foi possivel abrir o documento.");
    } finally {
      setViewerLoading(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Busca simplificada</p>
          <h2>Documentos vigentes</h2>
          <p>Use filtros combinados por empresa, setor, tipo documental, escopo e termo livre.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadResults} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar lista"}
        </button>
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

      {error && <p className="error-text margin-top">{error}</p>}

      <section className="results-grid">
        {filteredItems.map((item, index) => (
          <button
            key={`${item.document_id}-${item.active_version_id}`}
            type="button"
            className="result-card panel-float"
            onClick={() => openViewer(item)}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <p className="result-title">{item.title}</p>
            <div className="result-meta">
              <span>{item.code}</span>
              <span>{item.document_type}</span>
              <span>{item.scope}</span>
              <span>v{item.active_version_number}</span>
            </div>
          </button>
        ))}
      </section>

      {!loading && filteredItems.length === 0 && (
        <section className="empty-box panel-float">
          <p>Nenhum documento encontrado com os filtros atuais.</p>
        </section>
      )}

      <aside className={`viewer-drawer ${viewerOpen ? "open" : ""}`} aria-label="Visualizador de arquivo">
        <header className="viewer-head">
          <div>
            <p className="kicker">Visualizacao</p>
            <h3>{selectedResult ? extractFileName(selectedResult.file_path) : "Documento"}</h3>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setViewerOpen(false);
              setSelectedDocument(null);
              setSelectedVersions([]);
              setViewerError("");
            }}
          >
            Fechar
          </button>
        </header>

        {viewerLoading && <p>Carregando dados do documento...</p>}
        {viewerError && <p className="error-text">{viewerError}</p>}

        {!viewerLoading && selectedResult && (
          <div className="viewer-body">
            <div className="preview-panel panel-float">
              {isEmbeddablePath(selectedResult.file_path) ? (
                <iframe title="Visualizacao do arquivo" src={selectedResult.file_path} className="file-frame" />
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
              </ul>

              {selectedDocument && (
                <>
                  <h4>Documento</h4>
                  <ul>
                    <li>
                      <strong>ID:</strong> {selectedDocument.id}
                    </li>
                    <li>
                      <strong>Setor:</strong> {selectedDocument.sector_id}
                    </li>
                    <li>
                      <strong>Empresa:</strong> {selectedDocument.company_id}
                    </li>
                  </ul>
                </>
              )}

              <h4>Historico de versoes</h4>
              <div className="versions-list">
                {selectedVersions.map((version) => (
                  <div key={version.id} className="version-item">
                    <span>v{version.version_number}</span>
                    <span>{version.status}</span>
                  </div>
                ))}
                {selectedVersions.length === 0 && <p>Sem versoes registradas.</p>}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

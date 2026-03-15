import { useEffect, useMemo, useRef, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import {
  createDocument,
  createVersion,
  getDocumentFormOptions,
  searchDocuments,
  uploadDocumentFile,
} from "../services/api";
import { getCurrentLocalDateISO, getLocalDatePlusYearsISO } from "../utils/date";
import { formatStatusLabel } from "../utils/status";

const INITIAL_DOCUMENT_FORM = {
  title: "",
  companyId: "",
  sectorId: "",
  documentType: "",
  scope: "LOCAL",
  expirationDate: "",
};

const INITIAL_VERSION_FORM = {
  documentId: "",
  expirationDate: "",
};

function buildInitialDocumentForm(initialExpirationDate) {
  return {
    ...INITIAL_DOCUMENT_FORM,
    expirationDate: initialExpirationDate,
  };
}

function buildInitialVersionForm(initialExpirationDate) {
  return {
    ...INITIAL_VERSION_FORM,
    expirationDate: initialExpirationDate,
  };
}

function extractFileName(path) {
  if (!path) {
    return "arquivo-sem-nome";
  }
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || String(path);
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

export default function NovoDocumentoPage({ onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const minExpirationDate = getCurrentLocalDateISO();
  const suggestedExpirationDate = getLocalDatePlusYearsISO(1);
  const maxExpirationDate = getLocalDatePlusYearsISO(2);
  const [documentForm, setDocumentForm] = useState(() =>
    buildInitialDocumentForm(suggestedExpirationDate),
  );
  const [versionForm, setVersionForm] = useState(() =>
    buildInitialVersionForm(suggestedExpirationDate),
  );
  const [options, setOptions] = useState({
    companies: [],
    sectors: [],
    documentTypes: [],
    scopes: ["LOCAL", "CORPORATIVO"],
  });
  const [activeDocuments, setActiveDocuments] = useState([]);
  const [filters, setFilters] = useState({
    term: "",
    company: "ALL",
    sector: "ALL",
    status: "ALL",
    version: "ALL",
    expiration: "ALL",
  });
  const [selectedActiveDocument, setSelectedActiveDocument] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [versionFile, setVersionFile] = useState(null);
  const [isCreateDropActive, setIsCreateDropActive] = useState(false);
  const [isUpdateDropActive, setIsUpdateDropActive] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const createFileInputRef = useRef(null);
  const updateFileInputRef = useRef(null);

  const showFeedback = (type, message) => setFeedback({ type, message });

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setFeedback({ type: "", message: "" });
      try {
        const [data, searchData] = await Promise.all([getDocumentFormOptions(), searchDocuments()]);
        const companies = Array.isArray(data.companies) ? data.companies : [];
        const sectors = Array.isArray(data.sectors) ? data.sectors : [];
        const rawDocumentTypeOptions = Array.isArray(data.document_type_options)
          ? data.document_type_options
          : [];
        const fallbackDocumentTypes = Array.isArray(data.document_types) ? data.document_types : [];
        const documentTypes =
          rawDocumentTypeOptions.length > 0
            ? rawDocumentTypeOptions
                .map((item) => {
                  const sigla = String(item?.sigla || "").trim().toUpperCase();
                  if (!sigla) {
                    return null;
                  }
                  const name = String(item?.name || "").trim() || sigla;
                  return { sigla, name };
                })
                .filter(Boolean)
            : fallbackDocumentTypes
                .map((siglaRaw) => {
                  const sigla = String(siglaRaw || "").trim().toUpperCase();
                  if (!sigla) {
                    return null;
                  }
                  return { sigla, name: sigla };
                })
                .filter(Boolean);
        const scopes =
          Array.isArray(data.scopes) && data.scopes.length > 0 ? data.scopes : ["LOCAL", "CORPORATIVO"];
        const companyById = new Map(companies.map((company) => [String(company.id), company.name]));
        const sectorById = new Map(sectors.map((sector) => [String(sector.id), sector.name]));
        const activeItems = Array.isArray(searchData?.items) ? searchData.items : [];
        const mappedActiveDocuments = activeItems.map((item) => ({
          ...item,
          companyName: companyById.get(String(item.company_id)) || "Empresa desconhecida",
          sectorName: sectorById.get(String(item.sector_id)) || "Setor desconhecido",
          fileName: extractFileName(item.file_path),
          latestStatus: "VIGENTE",
          latestVersionNumber:
            item.active_version_number != null ? String(item.active_version_number) : "SEM_VERSAO",
          latestExpiration: item.expiration_date || "SEM_VENCIMENTO",
        }));

        setOptions({ companies, sectors, documentTypes, scopes });
        setActiveDocuments(mappedActiveDocuments);
        setDocumentForm((prev) => {
          const fallbackCompanyId =
            prev.companyId || (companies[0] ? String(companies[0].id) : "");
          const sectorsForCompany = sectors.filter(
            (sector) => String(sector.company_id) === fallbackCompanyId,
          );
          const fallbackSectorId =
            sectorsForCompany.find((sector) => String(sector.id) === prev.sectorId)?.id ??
            sectorsForCompany[0]?.id;
          return {
            ...prev,
            companyId: fallbackCompanyId,
            sectorId: fallbackSectorId ? String(fallbackSectorId) : "",
            documentType: prev.documentType || documentTypes[0]?.sigla || "",
            scope: scopes.includes(prev.scope) ? prev.scope : scopes[0] || "LOCAL",
            expirationDate: prev.expirationDate || suggestedExpirationDate,
          };
        });
        setVersionForm((prev) => {
          const hasCurrentDocument = mappedActiveDocuments.some(
            (item) => String(item.document_id) === prev.documentId,
          );
          return {
            ...prev,
            documentId: hasCurrentDocument ? prev.documentId : "",
            expirationDate: prev.expirationDate || suggestedExpirationDate,
          };
        });
        setSelectedActiveDocument((prev) => {
          if (!prev) {
            return null;
          }
          return (
            mappedActiveDocuments.find((item) => item.document_id === prev.document_id) || null
          );
        });
      } catch (requestError) {
        if (requestError.status === 401) {
          onUnauthorized?.();
          return;
        }
        showFeedback("error", requestError.message || "Falha ao carregar opcoes do formulario.");
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [onUnauthorized, suggestedExpirationDate]);

  const companies = useMemo(
    () =>
      [...new Set(activeDocuments.map((item) => item.companyName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [activeDocuments],
  );

  const sectors = useMemo(
    () =>
      [...new Set(activeDocuments.map((item) => item.sectorName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [activeDocuments],
  );

  const statuses = useMemo(
    () =>
      [...new Set(activeDocuments.map((item) => item.latestStatus).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [activeDocuments],
  );

  const versions = useMemo(
    () =>
      [...new Set(activeDocuments.map((item) => item.latestVersionNumber).filter(Boolean))].sort((a, b) => {
        if (a === "SEM_VERSAO") {
          return 1;
        }
        if (b === "SEM_VERSAO") {
          return -1;
        }
        return Number(a) - Number(b);
      }),
    [activeDocuments],
  );

  const expirations = useMemo(
    () =>
      [...new Set(activeDocuments.map((item) => item.latestExpiration || "SEM_VENCIMENTO"))].sort((a, b) => {
        if (a === "SEM_VENCIMENTO") {
          return 1;
        }
        if (b === "SEM_VENCIMENTO") {
          return -1;
        }
        return String(a).localeCompare(String(b));
      }),
    [activeDocuments],
  );

  const availableSectors = useMemo(
    () =>
      options.sectors.filter((sector) => {
        if (!documentForm.companyId) {
          return true;
        }
        return String(sector.company_id) === documentForm.companyId;
      }),
    [options.sectors, documentForm.companyId],
  );

  const filteredActiveDocuments = useMemo(() => {
    const term = filters.term.trim().toLowerCase();
    return activeDocuments.filter((item) => {
      if (filters.company !== "ALL" && item.companyName !== filters.company) {
        return false;
      }
      if (filters.sector !== "ALL" && item.sectorName !== filters.sector) {
        return false;
      }
      if (filters.status !== "ALL" && item.latestStatus !== filters.status) {
        return false;
      }
      if (filters.version !== "ALL" && item.latestVersionNumber !== filters.version) {
        return false;
      }
      if (filters.expiration !== "ALL" && item.latestExpiration !== filters.expiration) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        item.code,
        item.title,
        item.fileName,
        item.companyName,
        item.sectorName,
        formatStatusLabel(item.latestStatus),
        item.latestVersionNumber === "SEM_VERSAO" ? "sem versao" : `v${item.latestVersionNumber}`,
        item.latestExpiration === "SEM_VENCIMENTO" ? "sem vencimento" : item.latestExpiration,
        item.scope,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [activeDocuments, filters]);

  const selectActiveDocument = (item) => {
    setSelectedActiveDocument(item);
    setVersionForm((prev) => ({
      ...prev,
      documentId: String(item.document_id),
    }));
  };

  const handleCreateFileSelected = (file) => {
    if (!file) {
      return;
    }
    setDocumentFile(file);
  };

  const handleVersionFileSelected = (file) => {
    if (!file) {
      return;
    }
    setVersionFile(file);
  };

  const handleCreateFileInputChange = (event) => {
    handleCreateFileSelected(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const handleUpdateFileInputChange = (event) => {
    handleVersionFileSelected(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const handleCreateDrop = (event) => {
    event.preventDefault();
    setIsCreateDropActive(false);
    handleCreateFileSelected(event.dataTransfer.files?.[0] || null);
  };

  const handleUpdateDrop = (event) => {
    event.preventDefault();
    setIsUpdateDropActive(false);
    handleVersionFileSelected(event.dataTransfer.files?.[0] || null);
  };

  const handleCreateDocument = async (event) => {
    event.preventDefault();
    if (!documentForm.companyId || !documentForm.sectorId || !documentForm.documentType) {
      showFeedback("error", "Selecione empresa, setor e tipo documental.");
      return;
    }
    if (!documentFile) {
      showFeedback("error", "Selecione ou arraste um arquivo no card de Novo documento.");
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const uploadResponse = await uploadDocumentFile(documentFile);
      const response = await createDocument({
        title: documentForm.title.trim(),
        company_id: Number(documentForm.companyId),
        sector_id: Number(documentForm.sectorId),
        document_type: documentForm.documentType.trim(),
        scope: documentForm.scope,
        file_path: uploadResponse?.file_path || documentFile.name,
        expiration_date: documentForm.expirationDate,
      });
      setDocumentForm((prev) => ({
        ...prev,
        title: "",
        expirationDate: suggestedExpirationDate,
      }));
      setDocumentFile(null);
      showFeedback("success", response.message || "Documento criado.");
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback(
        "error",
        requestError.message ||
          "Falha ao criar documento. Verifique company_id e sector_id validos.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVersion = async (event) => {
    event.preventDefault();
    if (!versionForm.documentId) {
      showFeedback("error", "Selecione um documento vigente na lista abaixo.");
      return;
    }
    if (!versionFile) {
      showFeedback("error", "Selecione ou arraste um arquivo no card de Criar nova versao.");
      return;
    }
    setSubmittingVersion(true);
    setFeedback({ type: "", message: "" });
    try {
      const uploadResponse = await uploadDocumentFile(versionFile);
      const response = await createVersion(Number(versionForm.documentId), {
        version_number: 1,
        status: "RASCUNHO",
        file_path: uploadResponse?.file_path || versionFile.name,
        expiration_date: versionForm.expirationDate,
      });
      setVersionForm((prev) => ({
        ...buildInitialVersionForm(suggestedExpirationDate),
        documentId: prev.documentId,
      }));
      setVersionFile(null);
      showFeedback("success", response.message || "Documento atualizado com nova versao.");
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar nova versao.");
    } finally {
      setSubmittingVersion(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Cadastro manual</p>
          <h2>Novo documento e Criar nova versao</h2>
          <p>
            Use os dois cards abaixo para criar um novo documento ou atualizar um documento ja
            existente com nova versao em rascunho.
          </p>
        </div>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid dual-workflow-grid">
        <form
          className="panel-float workflow-card"
          onSubmit={handleCreateDocument}
          onDragOver={(event) => {
            event.preventDefault();
            setIsCreateDropActive(true);
          }}
          onDragLeave={() => setIsCreateDropActive(false)}
          onDrop={handleCreateDrop}
        >
          <h3>Criar documento</h3>
          <p className="workflow-hint">O codigo e o numero da primeira versao sao definidos pelo backend.</p>
          <div className="form-grid form-grid-vertical">
            <label>
              Tipo de documento
              <select
                required
                value={documentForm.documentType}
                disabled={loadingOptions || options.documentTypes.length === 0}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, documentType: event.target.value }))
                }
              >
                <option value="" disabled>
                  {loadingOptions ? "Carregando..." : "Selecione"}
                </option>
                {options.documentTypes.map((documentType) => (
                  <option key={documentType.sigla} value={documentType.sigla}>
                    {documentType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escopo
              <select
                value={documentForm.scope}
                disabled={loadingOptions}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, scope: event.target.value }))}
              >
                {options.scopes.map((scopeOption) => (
                  <option key={scopeOption} value={scopeOption}>
                    {scopeOption}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Empresa
              <select
                required
                value={documentForm.companyId}
                disabled={loadingOptions || options.companies.length === 0}
                onChange={(event) => {
                  const companyId = event.target.value;
                  const sectorsForCompany = options.sectors.filter(
                    (sector) => String(sector.company_id) === companyId,
                  );
                  setDocumentForm((prev) => ({
                    ...prev,
                    companyId,
                    sectorId: sectorsForCompany[0] ? String(sectorsForCompany[0].id) : "",
                  }));
                }}
              >
                <option value="" disabled>
                  {loadingOptions ? "Carregando..." : "Selecione"}
                </option>
                {options.companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Setor
              <select
                required
                value={documentForm.sectorId}
                disabled={loadingOptions || availableSectors.length === 0}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, sectorId: event.target.value }))
                }
              >
                <option value="" disabled>
                  {loadingOptions ? "Carregando..." : "Selecione"}
                </option>
                {availableSectors.map((sector) => (
                  <option key={sector.id} value={String(sector.id)}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input
                required
                value={documentForm.title}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              Arquivo da solicitacao
              <div className="file-upload-row">
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => createFileInputRef.current?.click()}
                >
                  Selecionar arquivo
                </button>
                <input
                  ref={createFileInputRef}
                  type="file"
                  className="file-upload-hidden"
                  onChange={handleCreateFileInputChange}
                />
              </div>
            </label>
            <label>
              Arraste o arquivo aqui
              <div
                className={`file-drop-zone ${isCreateDropActive ? "active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsCreateDropActive(true);
                }}
                onDragLeave={() => setIsCreateDropActive(false)}
                onDrop={handleCreateDrop}
              >
                Solte o arquivo dentro do card de Novo documento
              </div>
            </label>
            <label>
              Arquivo selecionado
              <div className="selected-document-box selected-file-box">
                <span>{documentFile ? documentFile.name : "Nenhum arquivo selecionado"}</span>
                {documentFile && (
                  <button type="button" className="file-remove-btn" onClick={() => setDocumentFile(null)}>
                    X
                  </button>
                )}
              </div>
            </label>
            <label>
              Data de vencimento
              <input
                required
                type="date"
                min={minExpirationDate}
                max={maxExpirationDate}
                value={documentForm.expirationDate}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="submit" className="compact-submit" disabled={submitting}>
            Criar documento
          </button>
        </form>

        <form
          className="panel-float workflow-card"
          onSubmit={handleCreateVersion}
          onDragOver={(event) => {
            event.preventDefault();
            setIsUpdateDropActive(true);
          }}
          onDragLeave={() => setIsUpdateDropActive(false)}
          onDrop={handleUpdateDrop}
        >
          <h3>Criar nova versao</h3>
          <p className="workflow-hint">
            Selecione um documento vigente abaixo. O ID e preenchido internamente.
          </p>
          <div className="form-grid form-grid-vertical">
            <label>
              Documento selecionado
              <div className="selected-document-box">
                {selectedActiveDocument
                  ? `${selectedActiveDocument.title} (${selectedActiveDocument.code})`
                  : "Nenhum documento selecionado"}
              </div>
            </label>
            <label>
              Arquivo da nova versao
              <div className="file-upload-row">
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => updateFileInputRef.current?.click()}
                >
                  Selecionar arquivo
                </button>
                <input
                  ref={updateFileInputRef}
                  type="file"
                  className="file-upload-hidden"
                  onChange={handleUpdateFileInputChange}
                />
              </div>
            </label>
            <label>
              Arraste o arquivo aqui
              <div
                className={`file-drop-zone ${isUpdateDropActive ? "active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsUpdateDropActive(true);
                }}
                onDragLeave={() => setIsUpdateDropActive(false)}
                onDrop={handleUpdateDrop}
              >
                Solte o arquivo dentro do card de Criar nova versao
              </div>
            </label>
            <label>
              Arquivo selecionado
              <div className="selected-document-box selected-file-box">
                <span>{versionFile ? versionFile.name : "Nenhum arquivo selecionado"}</span>
                {versionFile && (
                  <button type="button" className="file-remove-btn" onClick={() => setVersionFile(null)}>
                    X
                  </button>
                )}
              </div>
            </label>
            <label>
              Data de vencimento
              <input
                required
                type="date"
                min={minExpirationDate}
                max={maxExpirationDate}
                value={versionForm.expirationDate}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="submit" className="compact-submit" disabled={submittingVersion}>
            Criar nova versao
          </button>
        </form>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <div>
            <h3>Documentos vigentes</h3>
            <p className="workflow-hint">Escolha um documento para atualizar a versao.</p>
          </div>
        </div>
        <section className="painel-filters-grid">
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Empresa</th>
                <th>Setor</th>
                <th>Arquivo</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredActiveDocuments.map((item) => {
                const isSelected = String(item.document_id) === versionForm.documentId;
                return (
                  <tr key={`${item.document_id}-${item.active_version_id}`} className={isSelected ? "row-selected" : ""}>
                    <td>{item.code}</td>
                    <td>{item.title}</td>
                    <td>{item.companyName}</td>
                    <td>{item.sectorName}</td>
                    <td>{item.fileName}</td>
                    <td>
                      <button type="button" className="table-btn" onClick={() => selectActiveDocument(item)}>
                        {isSelected ? "Selecionado" : "Selecionar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loadingOptions && filteredActiveDocuments.length === 0 && (
                <tr>
                  <td colSpan={6}>Nenhum documento vigente encontrado com o filtro atual.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

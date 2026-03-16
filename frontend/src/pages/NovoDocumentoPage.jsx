import { useEffect, useMemo, useRef, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import {
  createDocument,
  createVersion,
  getDocumentFormOptions,
  searchDocuments,
  showGlobalError,
  updateDraftDocument,
  uploadDocumentFile,
} from "../services/api";
import { getCurrentLocalDateISO, getLocalDatePlusYearsISO } from "../utils/date";
import { formatStatusLabel } from "../utils/status";

const FORM_CACHE_KEY = "docflow_novo_documento_cache_v1";

const INITIAL_DOCUMENT_FORM = {
  title: "",
  companyId: "",
  sectorId: "",
  documentType: "",
  scope: "LOCAL",
  adjustmentReplyComment: "",
  expirationDate: "",
};

const INITIAL_VERSION_FORM = {
  documentId: "",
  expirationDate: "",
};

const INITIAL_FILTERS = {
  term: "",
  company: "ALL",
  sector: "ALL",
  status: "ALL",
  version: "ALL",
  expiration: "ALL",
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

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readCachedFormState() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(FORM_CACHE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function normalizeCachedFormState(cachedValue, initialExpirationDate) {
  const documentDefaults = buildInitialDocumentForm(initialExpirationDate);
  const versionDefaults = buildInitialVersionForm(initialExpirationDate);
  const filtersDefaults = { ...INITIAL_FILTERS };

  if (!cachedValue || typeof cachedValue !== "object") {
    return {
      documentForm: documentDefaults,
      versionForm: versionDefaults,
      filters: filtersDefaults,
    };
  }

  const rawDocumentForm =
    cachedValue.documentForm && typeof cachedValue.documentForm === "object"
      ? cachedValue.documentForm
      : {};
  const rawVersionForm =
    cachedValue.versionForm && typeof cachedValue.versionForm === "object"
      ? cachedValue.versionForm
      : {};
  const rawFilters =
    cachedValue.filters && typeof cachedValue.filters === "object"
      ? cachedValue.filters
      : {};

  return {
    documentForm: {
      ...documentDefaults,
      title: asString(rawDocumentForm.title),
      companyId: asString(rawDocumentForm.companyId) === "ALL" ? "" : asString(rawDocumentForm.companyId),
      sectorId: asString(rawDocumentForm.sectorId) === "ALL" ? "" : asString(rawDocumentForm.sectorId),
      documentType: asString(rawDocumentForm.documentType),
      scope: asString(rawDocumentForm.scope, documentDefaults.scope),
      adjustmentReplyComment: asString(rawDocumentForm.adjustmentReplyComment),
      expirationDate: asString(rawDocumentForm.expirationDate, documentDefaults.expirationDate),
    },
    versionForm: {
      ...versionDefaults,
      documentId: asString(rawVersionForm.documentId),
      expirationDate: asString(rawVersionForm.expirationDate, versionDefaults.expirationDate),
    },
    filters: {
      ...filtersDefaults,
      term: asString(rawFilters.term),
      company: asString(rawFilters.company, filtersDefaults.company),
      sector: asString(rawFilters.sector, filtersDefaults.sector),
      status: asString(rawFilters.status, filtersDefaults.status),
      version: asString(rawFilters.version, filtersDefaults.version),
      expiration: asString(rawFilters.expiration, filtersDefaults.expiration),
    },
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

function resolveDefaultCompanyAndSector(companies, sectors, preferredCompanyId = "") {
  const normalizedPreferred = String(preferredCompanyId || "");
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeSectors = Array.isArray(sectors) ? sectors : [];

  if (safeSectors.length > 0) {
    const sectorFromPreferredCompany = normalizedPreferred
      ? safeSectors.find((sector) => String(sector.company_id) === normalizedPreferred) || null
      : null;
    const selectedSector = sectorFromPreferredCompany || safeSectors[0];
    if (sectorFromPreferredCompany) {
      return {
        companyId: String(selectedSector.company_id),
        sectorId: String(selectedSector.id),
      };
    }
    if (normalizedPreferred && safeCompanies.some((company) => String(company.id) === normalizedPreferred)) {
      return {
        companyId: normalizedPreferred,
        sectorId: "",
      };
    }
    return {
      companyId: String(selectedSector.company_id),
      sectorId: String(selectedSector.id),
    };
  }

  if (safeCompanies.length > 0) {
    return {
      companyId: String(safeCompanies[0].id),
      sectorId: "",
    };
  }

  return {
    companyId: "",
    sectorId: "",
  };
}

export default function NovoDocumentoPage({ onUnauthorized, prefillDraft, onPrefillConsumed }) {
  const { preserveViewport } = useViewportPreserver();
  const minExpirationDate = getCurrentLocalDateISO();
  const suggestedExpirationDate = getLocalDatePlusYearsISO(1);
  const maxExpirationDate = getLocalDatePlusYearsISO(2);
  const cachedState = useMemo(
    () => normalizeCachedFormState(readCachedFormState(), suggestedExpirationDate),
    [suggestedExpirationDate],
  );
  const [documentForm, setDocumentForm] = useState(() => cachedState.documentForm);
  const [versionForm, setVersionForm] = useState(() => cachedState.versionForm);
  const [options, setOptions] = useState({
    companies: [],
    sectors: [],
    documentTypes: [],
    scopes: ["LOCAL", "CORPORATIVO"],
  });
  const [activeDocuments, setActiveDocuments] = useState([]);
  const [filters, setFilters] = useState(() => cachedState.filters);
  const [selectedActiveDocument, setSelectedActiveDocument] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [versionFile, setVersionFile] = useState(null);
  const [draftEditContext, setDraftEditContext] = useState(null);
  const [isCreateDropActive, setIsCreateDropActive] = useState(false);
  const [isUpdateDropActive, setIsUpdateDropActive] = useState(false);
  const [isVersionSearchFocused, setIsVersionSearchFocused] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const createFileInputRef = useRef(null);
  const updateFileInputRef = useRef(null);
  const isEditingDraft = Boolean(draftEditContext?.documentId);

  const clearFormCache = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(FORM_CACHE_KEY);
  };

  const resetFormsAfterSuccessfulSubmit = () => {
    const defaultScope = options.scopes.includes("LOCAL") ? "LOCAL" : options.scopes[0] || "LOCAL";
    const defaults = resolveDefaultCompanyAndSector(options.companies, options.sectors);

    setDocumentForm({
      ...buildInitialDocumentForm(suggestedExpirationDate),
      documentType: options.documentTypes[0]?.sigla || "",
      scope: defaultScope,
      companyId: defaults.companyId,
      sectorId: defaultScope === "LOCAL" ? defaults.sectorId : "",
    });
    setVersionForm(buildInitialVersionForm(suggestedExpirationDate));
    setSelectedActiveDocument(null);
    setDocumentFile(null);
    setVersionFile(null);
    setDraftEditContext(null);
    clearFormCache();
  };

  const resetCreateCardToDefault = () => {
    const defaultScope = options.scopes.includes("LOCAL") ? "LOCAL" : options.scopes[0] || "LOCAL";
    const defaults = resolveDefaultCompanyAndSector(options.companies, options.sectors);
    setDocumentForm({
      ...buildInitialDocumentForm(suggestedExpirationDate),
      documentType: options.documentTypes[0]?.sigla || "",
      scope: defaultScope,
      companyId: defaults.companyId,
      sectorId: defaultScope === "LOCAL" ? defaults.sectorId : "",
    });
    setDocumentFile(null);
    setDraftEditContext(null);
    onPrefillConsumed?.();
  };

  const showFeedback = (type, message) => {
    if (type === "error") {
      showGlobalError(message);
      setFeedback({ type: "", message: "" });
      return;
    }
    setFeedback({ type, message });
  };

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
          const resolvedScope = scopes.includes(prev.scope) ? prev.scope : scopes[0] || "LOCAL";
          const currentCompanyId = prev.companyId || "";
          const defaults = resolveDefaultCompanyAndSector(companies, sectors, currentCompanyId);
          const selectedCompanyId =
            currentCompanyId && companies.some((company) => String(company.id) === currentCompanyId)
              ? currentCompanyId
              : defaults.companyId;
          const sectorForCompany = sectors.find(
            (sector) =>
              String(sector.id) === prev.sectorId && String(sector.company_id) === selectedCompanyId,
          );
          const fallbackForSelectedCompany = resolveDefaultCompanyAndSector(
            companies,
            sectors,
            selectedCompanyId,
          );
          const selectedSectorId = sectorForCompany
            ? String(sectorForCompany.id)
            : fallbackForSelectedCompany.sectorId;
          const documentTypeExists = documentTypes.some((item) => item.sigla === prev.documentType);
          return {
            ...prev,
            companyId: selectedCompanyId,
            sectorId: resolvedScope === "LOCAL" ? selectedSectorId : "",
            documentType: documentTypeExists ? prev.documentType : documentTypes[0]?.sigla || "",
            scope: resolvedScope,
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

  useEffect(() => {
    if (!prefillDraft?.documentId) {
      return;
    }

    const normalizedScope = prefillDraft.scope || "LOCAL";
    const latestStatus = prefillDraft.latestStatus || "";
    const requiresAdjustmentResponse = latestStatus === "REVISAR_RASCUNHO";
    setDraftEditContext({
      documentId: Number(prefillDraft.documentId),
      filePath: prefillDraft.filePath || "",
      latestStatus,
      adjustmentComment: prefillDraft.adjustmentComment || "",
      requiresAdjustmentResponse,
    });
    setDocumentForm((prev) => ({
      ...prev,
      title: prefillDraft.title || "",
      documentType: prefillDraft.documentType || prev.documentType,
      scope: normalizedScope,
      companyId: String(prefillDraft.companyId || ""),
      sectorId: normalizedScope === "LOCAL" ? String(prefillDraft.sectorId || "") : "",
      adjustmentReplyComment: prefillDraft.adjustmentReplyComment || "",
      expirationDate: prefillDraft.expirationDate || prev.expirationDate || suggestedExpirationDate,
    }));
    setDocumentFile(null);
    setFeedback({ type: "", message: "" });
    onPrefillConsumed?.();
  }, [onPrefillConsumed, prefillDraft, suggestedExpirationDate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      documentForm,
      versionForm,
      filters,
    };

    window.localStorage.setItem(FORM_CACHE_KEY, JSON.stringify(payload));
  }, [documentForm, versionForm, filters]);

  useEffect(() => {
    if (!versionForm.documentId) {
      setSelectedActiveDocument(null);
      return;
    }

    const selected =
      activeDocuments.find((item) => String(item.document_id) === versionForm.documentId) || null;
    setSelectedActiveDocument(selected);
  }, [activeDocuments, versionForm.documentId]);

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
  }, [activeDocuments, filters.term]);

  const versionSearchResults = useMemo(() => filteredActiveDocuments.slice(0, 8), [filteredActiveDocuments]);

  const selectActiveDocument = (item) => {
    setSelectedActiveDocument(item);
    setVersionForm((prev) => ({
      ...prev,
      documentId: String(item.document_id),
    }));
    setFilters((prev) => ({
      ...prev,
      term: `${item.code} - ${item.title}`,
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
    const scopeIsLocal = documentForm.scope === "LOCAL";
    const fallbackTarget = resolveDefaultCompanyAndSector(
      options.companies,
      options.sectors,
      documentForm.companyId,
    );
    const resolvedCompanyId = documentForm.companyId || fallbackTarget.companyId;
    const sectorFallbackForCompany = resolveDefaultCompanyAndSector(
      options.companies,
      options.sectors,
      resolvedCompanyId,
    );
    const resolvedSectorId = scopeIsLocal
      ? documentForm.sectorId || sectorFallbackForCompany.sectorId
      : documentForm.sectorId || null;

    if (!documentForm.documentType) {
      showFeedback("error", "Selecione o tipo documental.");
      return;
    }
    if (!resolvedCompanyId) {
      showFeedback("error", "Selecione a empresa do documento.");
      return;
    }
    if (scopeIsLocal && !resolvedSectorId) {
      showFeedback("error", "Para escopo LOCAL, selecione um setor permitido.");
      return;
    }
    if (!documentFile && !draftEditContext?.filePath) {
      showFeedback("error", "Selecione ou arraste um arquivo no card de Novo documento.");
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      let nextFilePath = draftEditContext?.filePath || "";
      if (documentFile) {
        const uploadResponse = await uploadDocumentFile(documentFile);
        nextFilePath = uploadResponse?.file_path || documentFile.name;
      }
      let response;
      if (isEditingDraft && draftEditContext?.documentId) {
        const draftPayload = {
          title: documentForm.title.trim(),
          company_id: Number(resolvedCompanyId),
          document_type: documentForm.documentType.trim(),
          scope: documentForm.scope,
          file_path: nextFilePath,
          expiration_date: documentForm.expirationDate,
        };
        if (resolvedSectorId) {
          draftPayload.sector_id = Number(resolvedSectorId);
        }
        if (draftEditContext.requiresAdjustmentResponse) {
          draftPayload.adjustment_reply_comment = documentForm.adjustmentReplyComment;
        }
        response = await updateDraftDocument(Number(draftEditContext.documentId), draftPayload);
      } else {
        const createPayload = {
          title: documentForm.title.trim(),
          company_id: Number(resolvedCompanyId),
          document_type: documentForm.documentType.trim(),
          scope: documentForm.scope,
          file_path: nextFilePath,
          expiration_date: documentForm.expirationDate,
        };
        if (resolvedSectorId) {
          createPayload.sector_id = Number(resolvedSectorId);
        }
        response = await createDocument(createPayload);
      }
      resetFormsAfterSuccessfulSubmit();
      showFeedback(
        "success",
        response.message || (isEditingDraft ? "Rascunho atualizado." : "Documento criado."),
      );
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback(
        "error",
        requestError.message ||
          (isEditingDraft
            ? "Falha ao atualizar rascunho."
            : "Falha ao criar documento. Verifique company_id e sector_id validos."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVersion = async (event) => {
    event.preventDefault();
    if (!versionForm.documentId) {
      showFeedback("error", "Selecione um documento vigente na busca.");
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
      resetFormsAfterSuccessfulSubmit();
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

      {feedback.type === "success" && feedback.message && (
        <p className={`feedback ${feedback.type}`}>{feedback.message}</p>
      )}

      <section className="workflow-grid dual-workflow-grid">
        <form
          className="panel-float workflow-card workflow-card-fixed-submit"
          onSubmit={handleCreateDocument}
          onDragOver={(event) => {
            event.preventDefault();
            setIsCreateDropActive(true);
          }}
          onDragLeave={() => setIsCreateDropActive(false)}
          onDrop={handleCreateDrop}
        >
          <h3>{isEditingDraft ? "Editar rascunho" : "Criar documento"}</h3>
          <p className="workflow-hint">
            {isEditingDraft
              ? "Edicao iniciada pelo Historico de Solicitacoes. Ao salvar, o rascunho segue para Rascunho Revisado."
              : "O codigo e o numero da primeira versao sao definidos pelo backend."}
          </p>
          {isEditingDraft && draftEditContext?.adjustmentComment && (
            <p className="workflow-hint">Comentario de ajuste do gestor: {draftEditContext.adjustmentComment}</p>
          )}
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
                onChange={(event) => {
                  const nextScope = event.target.value;
                  setDocumentForm((prev) => {
                    const defaults = resolveDefaultCompanyAndSector(
                      options.companies,
                      options.sectors,
                      prev.companyId,
                    );
                    if (nextScope === "LOCAL") {
                      return {
                        ...prev,
                        scope: nextScope,
                        companyId: prev.companyId || defaults.companyId,
                        sectorId: defaults.sectorId,
                      };
                    }
                    return {
                      ...prev,
                      scope: nextScope,
                      companyId: prev.companyId || defaults.companyId,
                      sectorId: "",
                    };
                  });
                }}
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
                  const defaults = resolveDefaultCompanyAndSector(
                    options.companies,
                    options.sectors,
                    companyId,
                  );
                  setDocumentForm((prev) => ({
                    ...prev,
                    companyId,
                    sectorId: prev.scope === "LOCAL" ? defaults.sectorId : "",
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
                required={documentForm.scope === "LOCAL"}
                value={documentForm.scope === "LOCAL" ? documentForm.sectorId : ""}
                disabled={
                  documentForm.scope !== "LOCAL" || loadingOptions || availableSectors.length === 0
                }
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, sectorId: event.target.value }))
                }
              >
                {documentForm.scope === "LOCAL" ? (
                  <>
                    <option value="" disabled>
                      {loadingOptions ? "Carregando..." : "Selecione"}
                    </option>
                    {availableSectors.map((sector) => (
                      <option key={sector.id} value={String(sector.id)}>
                        {sector.name}
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">Nao se aplica para documento corporativo</option>
                )}
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
            {isEditingDraft && draftEditContext?.requiresAdjustmentResponse && (
              <label>
                Comentario de reajuste (opcional)
                <textarea
                  rows={3}
                  value={documentForm.adjustmentReplyComment}
                  placeholder="Descreva o que foi ajustado para o gestor."
                  onChange={(event) =>
                    setDocumentForm((prev) => ({
                      ...prev,
                      adjustmentReplyComment: event.target.value,
                    }))
                  }
                />
              </label>
            )}
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
            <label>
              Arquivo da solicitacao
              <div className="file-upload-group">
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
                <div className="field-block">
                  <p>Arquivo selecionado</p>
                  <div className="selected-document-box selected-file-box">
                    <span>
                      {documentFile
                        ? documentFile.name
                        : isEditingDraft && draftEditContext?.filePath
                          ? extractFileName(draftEditContext.filePath)
                          : "Nenhum arquivo selecionado"}
                    </span>
                    {documentFile && (
                      <button type="button" className="file-remove-btn" onClick={() => setDocumentFile(null)}>
                        X
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </label>
          </div>
          <div className="workflow-card-footer">
            <button type="submit" className="compact-submit" disabled={submitting}>
              {isEditingDraft ? "Salvar rascunho" : "Criar documento"}
            </button>
            {isEditingDraft && (
              <button type="button" className="ghost-btn" disabled={submitting} onClick={resetCreateCardToDefault}>
                Cancelar edicao
              </button>
            )}
          </div>
        </form>

        <form
          className="panel-float workflow-card workflow-card-fixed-submit"
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
            Pesquise por codigo ou titulo para selecionar um documento vigente.
          </p>
          <div className="form-grid version-form-grid">
            <label>
              Buscar documento vigente
              <input
                type="text"
                placeholder="Digite codigo ou titulo"
                value={filters.term}
                onFocus={() => setIsVersionSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsVersionSearchFocused(false), 120)}
                onChange={(event) =>
                  preserveViewport(() =>
                    setFilters((prev) => ({
                      ...prev,
                      term: event.target.value,
                    })),
                  )
                }
              />
              {isVersionSearchFocused && filters.term.trim() && (
                <div className="autocomplete-list">
                  {versionSearchResults.length > 0 ? (
                    versionSearchResults.map((item) => {
                      const isSelected = String(item.document_id) === versionForm.documentId;
                      return (
                        <button
                          key={`${item.document_id}-${item.active_version_id}`}
                          type="button"
                          className={`autocomplete-option ${isSelected ? "is-selected" : ""}`}
                          onClick={() => selectActiveDocument(item)}
                        >
                          {item.code} - {item.title}
                        </button>
                      );
                    })
                  ) : (
                    <p className="autocomplete-empty">Nenhum documento vigente encontrado.</p>
                  )}
                </div>
              )}
              <div className="selected-document-box">
                {selectedActiveDocument
                  ? `${selectedActiveDocument.title} (${selectedActiveDocument.code})`
                  : "Nenhum documento selecionado"}
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
            <label>
              Arquivo da nova versao
              <div className="file-upload-group">
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
                <div className="field-block">
                  <p>Arquivo selecionado</p>
                  <div className="selected-document-box selected-file-box">
                    <span>{versionFile ? versionFile.name : "Nenhum arquivo selecionado"}</span>
                    {versionFile && (
                      <button type="button" className="file-remove-btn" onClick={() => setVersionFile(null)}>
                        X
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </label>
          </div>
          <div className="workflow-card-footer">
            <button type="submit" className="compact-submit" disabled={submittingVersion}>
              Criar nova versao
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

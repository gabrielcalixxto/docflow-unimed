import { useEffect, useMemo, useState } from "react";

import { createDocument, getDocumentFormOptions } from "../services/api";

const INITIAL_DOCUMENT_FORM = {
  title: "",
  companyId: "",
  sectorId: "",
  documentType: "",
  scope: "LOCAL",
  filePath: "",
  expirationDate: "",
};

export default function NovoDocumentoPage({ onUnauthorized }) {
  const [documentForm, setDocumentForm] = useState(INITIAL_DOCUMENT_FORM);
  const [options, setOptions] = useState({
    companies: [],
    sectors: [],
    documentTypes: [],
    scopes: ["LOCAL", "CORPORATIVO"],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setFeedback({ type: "", message: "" });
      try {
        const data = await getDocumentFormOptions();
        const companies = Array.isArray(data.companies) ? data.companies : [];
        const sectors = Array.isArray(data.sectors) ? data.sectors : [];
        const documentTypes = Array.isArray(data.document_types) ? data.document_types : [];
        const scopes =
          Array.isArray(data.scopes) && data.scopes.length > 0 ? data.scopes : ["LOCAL", "CORPORATIVO"];

        setOptions({ companies, sectors, documentTypes, scopes });
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
            documentType: prev.documentType || documentTypes[0] || "",
            scope: scopes.includes(prev.scope) ? prev.scope : scopes[0] || "LOCAL",
          };
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
  }, [onUnauthorized]);

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

  const handleCreateDocument = async (event) => {
    event.preventDefault();
    if (!documentForm.companyId || !documentForm.sectorId || !documentForm.documentType) {
      showFeedback("error", "Selecione empresa, setor e tipo documental.");
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createDocument({
        title: documentForm.title.trim(),
        company_id: Number(documentForm.companyId),
        sector_id: Number(documentForm.sectorId),
        document_type: documentForm.documentType.trim(),
        scope: documentForm.scope,
        file_path: documentForm.filePath.trim(),
        expiration_date: documentForm.expirationDate,
      });
      setDocumentForm((prev) => ({
        ...prev,
        title: "",
        filePath: "",
        expirationDate: "",
      }));
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

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Cadastro manual</p>
          <h2>Novo documento</h2>
          <p>
            O codigo e criado automaticamente no formato `TIPO-ID-SET` e a versao 1 (RASCUNHO)
            tambem e criada automaticamente.
          </p>
        </div>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreateDocument}>
          <h3>Criar documento</h3>
          <p className="workflow-hint">O codigo e o numero da primeira versao sao definidos pelo backend.</p>
          <div className="form-grid">
            <label>
              Titulo
              <input
                required
                value={documentForm.title}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              Company ID
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
                    {company.id} - {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sector ID
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
                    {sector.id} - {sector.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo documental
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
                  <option key={documentType} value={documentType}>
                    {documentType}
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
            <div className="document-file-stack span-2">
              <label>
                Caminho/URL do arquivo
                <input
                  required
                  value={documentForm.filePath}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({ ...prev, filePath: event.target.value }))
                  }
                  placeholder="https://... ou /tmp/arquivo.pdf"
                />
              </label>
              <label>
                Data de vencimento
                <input
                  required
                  type="date"
                  value={documentForm.expirationDate}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                  }
                />
              </label>
            </div>
          </div>
          <button type="submit" className="compact-submit" disabled={submitting}>
            Criar documento
          </button>
        </form>
      </section>
    </div>
  );
}

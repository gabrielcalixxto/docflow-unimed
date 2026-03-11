import { useState } from "react";

import { createDocument, createVersion } from "../services/api";

const INITIAL_DOCUMENT_FORM = {
  code: "",
  title: "",
  companyId: "1",
  sectorId: "1",
  documentType: "POP",
  scope: "LOCAL",
};

const INITIAL_VERSION_FORM = {
  documentId: "",
  versionNumber: "1",
  filePath: "",
  expirationDate: "",
};

function parseDocumentIdFromMessage(message) {
  if (!message) {
    return null;
  }
  const match = /id=(\d+)/i.exec(message);
  return match ? match[1] : null;
}

export default function NovoDocumentoPage({ onUnauthorized }) {
  const [documentForm, setDocumentForm] = useState(INITIAL_DOCUMENT_FORM);
  const [versionForm, setVersionForm] = useState(INITIAL_VERSION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  const handleCreateDocument = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createDocument({
        code: documentForm.code.trim(),
        title: documentForm.title.trim(),
        company_id: Number(documentForm.companyId),
        sector_id: Number(documentForm.sectorId),
        document_type: documentForm.documentType.trim(),
        scope: documentForm.scope,
      });
      const createdId = parseDocumentIdFromMessage(response.message);
      if (createdId) {
        setVersionForm((prev) => ({ ...prev, documentId: createdId }));
      }
      setDocumentForm(INITIAL_DOCUMENT_FORM);
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
      showFeedback("error", "Informe o ID do documento para criar a versao.");
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createVersion(Number(versionForm.documentId), {
        version_number: Number(versionForm.versionNumber),
        status: "RASCUNHO",
        file_path: versionForm.filePath.trim(),
        expiration_date: versionForm.expirationDate,
      });
      setVersionForm((prev) => ({ ...INITIAL_VERSION_FORM, documentId: prev.documentId }));
      showFeedback("success", response.message || "Versao criada.");
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar versao.");
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
          <p>Preencha os campos obrigatorios para teste e crie a primeira versao em seguida.</p>
        </div>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreateDocument}>
          <h3>1. Criar documento</h3>
          <p className="workflow-hint">
            Dica inicial: `company_id=1` e `sector_id=1` (seed padrao local).
          </p>
          <div className="form-grid">
            <label>
              Codigo
              <input
                required
                value={documentForm.code}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, code: event.target.value }))}
              />
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
              Company ID
              <input
                required
                type="number"
                min="1"
                value={documentForm.companyId}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, companyId: event.target.value }))
                }
              />
            </label>
            <label>
              Sector ID
              <input
                required
                type="number"
                min="1"
                value={documentForm.sectorId}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, sectorId: event.target.value }))
                }
              />
            </label>
            <label>
              Tipo documental
              <input
                required
                value={documentForm.documentType}
                onChange={(event) =>
                  setDocumentForm((prev) => ({ ...prev, documentType: event.target.value }))
                }
              />
            </label>
            <label>
              Escopo
              <select
                value={documentForm.scope}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, scope: event.target.value }))}
              >
                <option value="LOCAL">LOCAL</option>
                <option value="CORPORATIVO">CORPORATIVO</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={submitting}>
            Criar documento
          </button>
        </form>

        <form className="panel-float workflow-card" onSubmit={handleCreateVersion}>
          <h3>2. Criar versao</h3>
          <p className="workflow-hint">
            Informe o ID do documento e crie a versao inicial com status `RASCUNHO`.
          </p>
          <div className="form-grid">
            <label>
              Documento ID
              <input
                required
                type="number"
                min="1"
                value={versionForm.documentId}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, documentId: event.target.value }))
                }
              />
            </label>
            <label>
              Numero da versao
              <input
                required
                type="number"
                min="1"
                value={versionForm.versionNumber}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, versionNumber: event.target.value }))
                }
              />
            </label>
            <label className="span-2">
              Caminho/URL do arquivo
              <input
                required
                value={versionForm.filePath}
                onChange={(event) => setVersionForm((prev) => ({ ...prev, filePath: event.target.value }))}
                placeholder="https://... ou /tmp/arquivo.pdf"
              />
            </label>
            <label>
              Data de vencimento
              <input
                required
                type="date"
                value={versionForm.expirationDate}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                }
              />
            </label>
            <label>
              Status inicial
              <input value="RASCUNHO" disabled />
            </label>
          </div>
          <button type="submit" disabled={submitting}>
            Criar versao
          </button>
        </form>
      </section>
    </div>
  );
}

import { useState } from "react";

import { createVersion } from "../services/api";
import { getCurrentLocalDateISO } from "../utils/date";

const INITIAL_VERSION_FORM = {
  documentId: "",
  filePath: "",
  expirationDate: "",
};

export default function CriarVersaoPage({ onUnauthorized }) {
  const minExpirationDate = getCurrentLocalDateISO();
  const [versionForm, setVersionForm] = useState(INITIAL_VERSION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

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
        version_number: 1,
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
          <p className="kicker">Versionamento</p>
          <h2>Atualizar Documento</h2>
          <p>
            Use esta tela para criar novas revisoes. A versao 1 ja e criada automaticamente no
            cadastro do documento.
          </p>
        </div>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreateVersion}>
          <h3>Atualizar Documento</h3>
          <p className="workflow-hint">
            Informe o documento e os dados do arquivo em rascunho. O numero da versao e gerado
            automaticamente.
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
                min={minExpirationDate}
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
            Atualizar documento
          </button>
        </form>
      </section>
    </div>
  );
}

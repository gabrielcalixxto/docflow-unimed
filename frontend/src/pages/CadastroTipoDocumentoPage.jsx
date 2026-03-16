import { useEffect, useState } from "react";

import useRealtimeEvents from "../hooks/useRealtimeEvents";
import {
  createAdminDocumentType,
  getAdminCatalogOptions,
  showGlobalError,
  updateAdminDocumentType,
} from "../services/api";

const INITIAL_FORM = {
  sigla: "",
  name: "",
};

export default function CadastroTipoDocumentoPage({ onUnauthorized }) {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [editingDocumentTypeId, setEditingDocumentTypeId] = useState(null);
  const [editingSigla, setEditingSigla] = useState("");
  const [editingName, setEditingName] = useState("");

  const showFeedback = (type, message) => {
    if (type === "error") {
      showGlobalError(message);
      setFeedback({ type: "", message: "" });
      return;
    }
    setFeedback({ type, message });
  };

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await getAdminCatalogOptions();
      setDocumentTypes(Array.isArray(response.document_types) ? response.document_types : []);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (requestError.status === 403) {
        showFeedback("error", "Apenas ADMIN pode acessar cadastro de tipos documentais.");
        return;
      }
      showFeedback("error", requestError.message || "Falha ao carregar tipos documentais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  useRealtimeEvents(loadData, { channels: ["catalog"] });

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createAdminDocumentType({
        sigla: form.sigla.trim(),
        name: form.name.trim(),
      });
      showFeedback("success", response.message || "Tipo documental criado.");
      setForm(INITIAL_FORM);
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar tipo documental.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingDocumentType = (documentType) => {
    setEditingDocumentTypeId(Number(documentType.id));
    setEditingSigla(documentType.sigla || "");
    setEditingName(documentType.name || "");
  };

  const cancelEditingDocumentType = () => {
    setEditingDocumentTypeId(null);
    setEditingSigla("");
    setEditingName("");
  };

  const handleUpdateDocumentType = async () => {
    if (!editingDocumentTypeId) {
      return;
    }
    const normalizedSigla = editingSigla.trim().toUpperCase();
    const normalizedName = editingName.trim();
    if (!normalizedSigla || !normalizedName) {
      showFeedback("error", "Informe sigla e nome para alterar o tipo documental.");
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await updateAdminDocumentType(editingDocumentTypeId, {
        sigla: normalizedSigla,
        name: normalizedName,
      });
      showFeedback("success", response.message || "Tipo documental alterado.");
      cancelEditingDocumentType();
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao alterar tipo documental.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Gestao de acessos</p>
          <h2>Cadastro Tipo de Documento</h2>
          <p>Gerencie os tipos documentais exibidos no cadastro de novos documentos.</p>
        </div>
      </section>

      {feedback.type === "success" && feedback.message && (
        <p className={`feedback ${feedback.type}`}>{feedback.message}</p>
      )}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreate}>
          <h3>Novo tipo documental</h3>
          <div className="form-grid">
            <label>
              Sigla
              <input
                required
                minLength={2}
                maxLength={40}
                value={form.sigla}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    sigla: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="Ex: POP"
              />
            </label>
            <label className="span-2">
              Nome do documento
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex: Procedimento Operacional Padrao"
              />
            </label>
          </div>
          <button type="submit" className="compact-submit" disabled={submitting || loading}>
            Salvar tipo
          </button>
        </form>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Tipos documentais cadastrados</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sigla</th>
                <th>Tipo documental</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {documentTypes.map((documentType) => (
                <tr key={documentType.id}>
                  <td>
                    {editingDocumentTypeId === Number(documentType.id) ? (
                      <input
                        value={editingSigla}
                        disabled={submitting}
                        minLength={2}
                        maxLength={40}
                        onChange={(event) => setEditingSigla(event.target.value.toUpperCase())}
                      />
                    ) : (
                      documentType.sigla
                    )}
                  </td>
                  <td>
                    {editingDocumentTypeId === Number(documentType.id) ? (
                      <input
                        value={editingName}
                        disabled={submitting}
                        minLength={2}
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                    ) : (
                      documentType.name
                    )}
                  </td>
                  <td>
                    {editingDocumentTypeId === Number(documentType.id) ? (
                      <>
                        <button
                          type="button"
                          className="table-btn"
                          disabled={submitting}
                          onClick={handleUpdateDocumentType}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="table-btn"
                          disabled={submitting}
                          onClick={cancelEditingDocumentType}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="table-btn"
                        disabled={submitting}
                        onClick={() => startEditingDocumentType(documentType)}
                      >
                        Alterar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && documentTypes.length === 0 && (
                <tr>
                  <td colSpan={3}>Nenhum tipo documental cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

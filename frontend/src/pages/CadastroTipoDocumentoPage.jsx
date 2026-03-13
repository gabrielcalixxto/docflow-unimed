import { useEffect, useState } from "react";

import {
  createAdminDocumentType,
  deleteAdminDocumentType,
  getAdminCatalogOptions,
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

  const showFeedback = (type, message) => setFeedback({ type, message });

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

  const handleDelete = async (documentTypeId) => {
    const confirmed = window.confirm("Confirma exclusao do tipo documental?");
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await deleteAdminDocumentType(documentTypeId);
      showFeedback("success", response.message || "Tipo documental removido.");
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao excluir tipo documental.");
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
        <button type="button" className="ghost-btn" onClick={loadData} disabled={loading || submitting}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

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
                  <td>{documentType.sigla}</td>
                  <td>{documentType.name}</td>
                  <td>
                    <button
                      type="button"
                      className="table-btn"
                      disabled={submitting}
                      onClick={() => handleDelete(documentType.id)}
                    >
                      Excluir
                    </button>
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

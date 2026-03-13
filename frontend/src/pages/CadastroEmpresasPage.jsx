import { useEffect, useMemo, useState } from "react";

import {
  createAdminCompany,
  deleteAdminCompany,
  getAdminCatalogOptions,
} from "../services/api";

const INITIAL_FORM = {
  name: "",
};

export default function CadastroEmpresasPage({ onUnauthorized }) {
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  const sectorsByCompany = useMemo(() => {
    const counts = new Map();
    for (const sector of sectors) {
      const companyId = Number(sector.company_id);
      counts.set(companyId, (counts.get(companyId) || 0) + 1);
    }
    return counts;
  }, [sectors]);

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await getAdminCatalogOptions();
      setCompanies(Array.isArray(response.companies) ? response.companies : []);
      setSectors(Array.isArray(response.sectors) ? response.sectors : []);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (requestError.status === 403) {
        showFeedback("error", "Apenas ADMIN pode acessar cadastro de empresas.");
        return;
      }
      showFeedback("error", requestError.message || "Falha ao carregar empresas.");
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
      const response = await createAdminCompany({
        name: form.name.trim(),
      });
      showFeedback("success", response.message || "Empresa criada.");
      setForm(INITIAL_FORM);
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar empresa.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (companyId) => {
    const confirmed = window.confirm("Confirma exclusao da empresa?");
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await deleteAdminCompany(companyId);
      showFeedback("success", response.message || "Empresa removida.");
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao excluir empresa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Gestao de acessos</p>
          <h2>Cadastro de Empresas</h2>
          <p>Cadastre empresas e gerencie a lista ativa do sistema.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadData} disabled={loading || submitting}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreate}>
          <h3>Nova empresa</h3>
          <div className="form-grid">
            <label className="span-2">
              Nome da empresa
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm({ name: event.target.value })}
                placeholder="Ex: Unimed Campinas"
              />
            </label>
          </div>
          <button type="submit" className="compact-submit" disabled={submitting || loading}>
            Salvar empresa
          </button>
        </form>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Empresas cadastradas</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Setores vinculados</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{sectorsByCompany.get(Number(company.id)) || 0}</td>
                  <td>
                    <button
                      type="button"
                      className="table-btn"
                      disabled={submitting}
                      onClick={() => handleDelete(company.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && companies.length === 0 && (
                <tr>
                  <td colSpan={3}>Nenhuma empresa cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

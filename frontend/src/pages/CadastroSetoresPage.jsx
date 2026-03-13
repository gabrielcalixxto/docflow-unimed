import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import {
  createAdminSector,
  deleteAdminSector,
  getAdminCatalogOptions,
} from "../services/api";

const INITIAL_FORM = {
  name: "",
  companyId: "",
};

export default function CadastroSetoresPage({ onUnauthorized }) {
  const { preserveViewport, preserveViewportAsync } = useViewportPreserver();
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [filterCompanyId, setFilterCompanyId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [Number(company.id), company.name])),
    [companies],
  );

  const showFeedback = (type, message) => setFeedback({ type, message });

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await getAdminCatalogOptions();
      const nextCompanies = Array.isArray(response.companies) ? response.companies : [];
      setCompanies(nextCompanies);
      setSectors(Array.isArray(response.sectors) ? response.sectors : []);
      setForm((prev) => ({
        ...prev,
        companyId:
          prev.companyId && nextCompanies.some((company) => String(company.id) === prev.companyId)
            ? prev.companyId
            : nextCompanies[0]
              ? String(nextCompanies[0].id)
              : "",
      }));
      setFilterCompanyId((prev) => {
        if (prev === "ALL") {
          return "ALL";
        }
        return nextCompanies.some((company) => String(company.id) === prev) ? prev : "ALL";
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (requestError.status === 403) {
        showFeedback("error", "Apenas ADMIN pode acessar cadastro de setores.");
        return;
      }
      showFeedback("error", requestError.message || "Falha ao carregar setores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSectors = useMemo(
    () =>
      sectors.filter((sector) => {
        if (filterCompanyId === "ALL") {
          return true;
        }
        return String(sector.company_id) === filterCompanyId;
      }),
    [sectors, filterCompanyId],
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.companyId) {
      showFeedback("error", "Selecione a empresa.");
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createAdminSector({
        name: form.name.trim(),
        company_id: Number(form.companyId),
      });
      showFeedback("success", response.message || "Setor criado.");
      setForm((prev) => ({
        ...prev,
        name: "",
      }));
      await preserveViewportAsync(() => loadData());
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar setor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sectorId) => {
    const confirmed = window.confirm("Confirma exclusao do setor?");
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await deleteAdminSector(sectorId);
      showFeedback("success", response.message || "Setor removido.");
      await preserveViewportAsync(() => loadData());
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao excluir setor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Gestao de acessos</p>
          <h2>Cadastro de Setores</h2>
          <p>Cadastre setores por empresa e mantenha a estrutura organizacional atualizada.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadData} disabled={loading || submitting}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreate}>
          <h3>Novo setor</h3>
          <div className="form-grid">
            <label className="span-2">
              Empresa
              <select
                required
                value={form.companyId}
                disabled={loading || companies.length === 0}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    companyId: event.target.value,
                  }))
                }
              >
                {companies.length === 0 && <option value="">Nenhuma empresa</option>}
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Nome do setor
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
                placeholder="Ex: Farmacia"
              />
            </label>
          </div>
          <button
            type="submit"
            className="compact-submit"
            disabled={submitting || loading || companies.length === 0}
          >
            Salvar setor
          </button>
        </form>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Setores cadastrados</h3>
        </div>
        <div className="catalog-filter-row">
          <label className="catalog-filter">
            Filtrar por empresa
            <select
              value={filterCompanyId}
              disabled={loading || companies.length === 0}
              onChange={(event) =>
                preserveViewport(() => setFilterCompanyId(event.target.value))
              }
            >
              <option value="ALL">Todas as empresas</option>
              {companies.map((company) => (
                <option key={`filter-company-${company.id}`} value={String(company.id)}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Setor</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredSectors.map((sector) => (
                <tr key={sector.id}>
                  <td>{companyNameById.get(Number(sector.company_id)) || "-"}</td>
                  <td>{sector.name}</td>
                  <td>
                    <button
                      type="button"
                      className="table-btn"
                      disabled={submitting}
                      onClick={() => handleDelete(sector.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredSectors.length === 0 && (
                <tr>
                  <td colSpan={3}>Nenhum setor cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

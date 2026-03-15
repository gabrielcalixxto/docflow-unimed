import { useEffect, useMemo, useState } from "react";

import useViewportPreserver from "../hooks/useViewportPreserver";
import {
  createAdminSector,
  getAdminCatalogOptions,
  updateAdminSector,
} from "../services/api";

const INITIAL_FORM = {
  name: "",
  sigla: "",
  companyId: "",
};

export default function CadastroSetoresPage({ onUnauthorized }) {
  const { preserveViewport, preserveViewportAsync } = useViewportPreserver();
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [filterCompanyId, setFilterCompanyId] = useState("ALL");
  const [filterTerm, setFilterTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [editingSectorName, setEditingSectorName] = useState("");
  const [editingSectorSigla, setEditingSectorSigla] = useState("");
  const [editingSectorCompanyId, setEditingSectorCompanyId] = useState("");

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
          // Keep evaluating by search term below.
        } else if (String(sector.company_id) !== filterCompanyId) {
          return false;
        }
        const normalizedTerm = filterTerm.trim().toLowerCase();
        if (!normalizedTerm) {
          return true;
        }
        const companyName = companyNameById.get(Number(sector.company_id)) || "";
        const searchable = [
          companyName,
          sector.name || "",
          (sector.sigla || "").toUpperCase(),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedTerm);
      }),
    [sectors, filterCompanyId, filterTerm, companyNameById],
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
        sigla: form.sigla.trim().toUpperCase(),
        company_id: Number(form.companyId),
      });
      showFeedback("success", response.message || "Setor criado.");
      setForm((prev) => ({
        ...prev,
        name: "",
        sigla: "",
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

  const startEditingSector = (sector) => {
    setEditingSectorId(Number(sector.id));
    setEditingSectorName(sector.name || "");
    setEditingSectorSigla((sector.sigla || "").toUpperCase());
    setEditingSectorCompanyId(String(sector.company_id || ""));
  };

  const cancelEditingSector = () => {
    setEditingSectorId(null);
    setEditingSectorName("");
    setEditingSectorSigla("");
    setEditingSectorCompanyId("");
  };

  const handleUpdateSector = async () => {
    if (!editingSectorId) {
      return;
    }
    const normalizedName = editingSectorName.trim();
    const normalizedSigla = editingSectorSigla.trim().toUpperCase();
    if (!normalizedName) {
      showFeedback("error", "Informe o nome do setor.");
      return;
    }
    if (!normalizedSigla) {
      showFeedback("error", "Informe a sigla do setor.");
      return;
    }
    if (!editingSectorCompanyId) {
      showFeedback("error", "Selecione a empresa do setor.");
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await updateAdminSector(editingSectorId, {
        name: normalizedName,
        sigla: normalizedSigla,
        company_id: Number(editingSectorCompanyId),
      });
      showFeedback("success", response.message || "Setor alterado.");
      cancelEditingSector();
      await preserveViewportAsync(() => loadData());
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao alterar setor.");
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
            <label className="span-2">
              Sigla do setor
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
                placeholder="Ex: ENF"
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
            Pesquisa
            <input
              type="text"
              placeholder="Empresa, setor ou sigla..."
              value={filterTerm}
              onChange={(event) =>
                preserveViewport(() => setFilterTerm(event.target.value))
              }
            />
          </label>
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
                <th>Sigla</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredSectors.map((sector) => (
                <tr key={sector.id}>
                  <td>
                    {editingSectorId === Number(sector.id) ? (
                      <select
                        value={editingSectorCompanyId}
                        disabled={submitting}
                        onChange={(event) => setEditingSectorCompanyId(event.target.value)}
                      >
                        {companies.map((company) => (
                          <option key={`edit-sector-company-${company.id}`} value={String(company.id)}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      companyNameById.get(Number(sector.company_id)) || "-"
                    )}
                  </td>
                  <td>
                    {editingSectorId === Number(sector.id) ? (
                      <input
                        value={editingSectorName}
                        disabled={submitting}
                        onChange={(event) => setEditingSectorName(event.target.value)}
                      />
                    ) : (
                      sector.name
                    )}
                  </td>
                  <td>
                    {editingSectorId === Number(sector.id) ? (
                      <input
                        value={editingSectorSigla}
                        disabled={submitting}
                        minLength={2}
                        maxLength={40}
                        onChange={(event) => setEditingSectorSigla(event.target.value.toUpperCase())}
                      />
                    ) : (
                      (sector.sigla || "-").toUpperCase()
                    )}
                  </td>
                  <td>
                    {editingSectorId === Number(sector.id) ? (
                      <>
                        <button
                          type="button"
                          className="table-btn"
                          disabled={submitting}
                          onClick={handleUpdateSector}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="table-btn"
                          disabled={submitting}
                          onClick={cancelEditingSector}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="table-btn"
                        disabled={submitting}
                        onClick={() => startEditingSector(sector)}
                      >
                        Alterar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredSectors.length === 0 && (
                <tr>
                  <td colSpan={4}>Nenhum setor cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

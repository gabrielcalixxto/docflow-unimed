import { useEffect, useMemo, useState } from "react";

import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserOptions,
  getAdminUsers,
  updateAdminUser,
} from "../services/api";
import { displayRole } from "../utils/roles";

const INITIAL_CREATE_FORM = {
  name: "",
  email: "",
  roles: [],
  companyIds: [],
  sectorIds: [],
  password: "",
  passwordConfirm: "",
};

const INITIAL_EDIT_FORM = {
  userId: null,
  name: "",
  email: "",
  roles: [],
  companyIds: [],
  sectorIds: [],
  password: "",
  passwordConfirm: "",
};

function asStringIdList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => String(value));
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getFilteredSectorIds(sectorIds, sectors, companyIds) {
  if (companyIds.length === 0) {
    return [];
  }
  const allowedSectorIds = new Set(
    sectors
      .filter((sector) => companyIds.includes(String(sector.company_id)))
      .map((sector) => String(sector.id)),
  );
  return sectorIds.filter((sectorId) => allowedSectorIds.has(sectorId));
}

export default function AdminUsuariosPage({ onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ roles: [], companies: [], sectors: [] });
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [editForm, setEditForm] = useState(INITIAL_EDIT_FORM);
  const [createCompanyToAdd, setCreateCompanyToAdd] = useState("");
  const [editCompanyToAdd, setEditCompanyToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  const companyNameById = useMemo(
    () => new Map((options.companies || []).map((company) => [String(company.id), company.name])),
    [options.companies],
  );
  const sectorNameById = useMemo(
    () => new Map((options.sectors || []).map((sector) => [String(sector.id), sector.name])),
    [options.sectors],
  );

  const createVisibleSectors = useMemo(
    () =>
      options.sectors.filter((sector) =>
        createForm.companyIds.includes(String(sector.company_id)),
      ),
    [options.sectors, createForm.companyIds],
  );

  const editVisibleSectors = useMemo(
    () =>
      options.sectors.filter((sector) => editForm.companyIds.includes(String(sector.company_id))),
    [options.sectors, editForm.companyIds],
  );

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const [usersResponse, optionsResponse] = await Promise.all([getAdminUsers(), getAdminUserOptions()]);
      setUsers(Array.isArray(usersResponse) ? usersResponse : []);

      const roles = Array.isArray(optionsResponse.roles) ? optionsResponse.roles : [];
      const companies = Array.isArray(optionsResponse.companies) ? optionsResponse.companies : [];
      const sectors = Array.isArray(optionsResponse.sectors) ? optionsResponse.sectors : [];
      setOptions({ roles, companies, sectors });

      setCreateForm((prev) => ({
        ...prev,
        roles: prev.roles.length > 0 ? prev.roles.filter((role) => roles.includes(role)) : roles[0] ? [roles[0]] : [],
        companyIds: prev.companyIds.filter((companyId) =>
          companies.some((company) => String(company.id) === companyId),
        ),
      }));

      setCreateCompanyToAdd((prev) => {
        if (prev && companies.some((company) => String(company.id) === prev)) {
          return prev;
        }
        return companies[0] ? String(companies[0].id) : "";
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (requestError.status === 403) {
        showFeedback("error", "Apenas ADMIN pode acessar o painel de usuarios.");
        return;
      }
      showFeedback("error", requestError.message || "Falha ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addCompanyToCreateForm = () => {
    if (!createCompanyToAdd) {
      return;
    }
    setCreateForm((prev) => ({
      ...prev,
      companyIds: prev.companyIds.includes(createCompanyToAdd)
        ? prev.companyIds
        : [...prev.companyIds, createCompanyToAdd],
    }));
  };

  const addCompanyToEditForm = () => {
    if (!editCompanyToAdd) {
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      companyIds: prev.companyIds.includes(editCompanyToAdd)
        ? prev.companyIds
        : [...prev.companyIds, editCompanyToAdd],
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (createForm.roles.length === 0) {
      showFeedback("error", "Selecione pelo menos um papel.");
      return;
    }
    if (createForm.password !== createForm.passwordConfirm) {
      showFeedback("error", "Os campos de senha nao conferem.");
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createAdminUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        roles: createForm.roles,
        company_ids: createForm.companyIds.map((value) => Number(value)),
        sector_ids: createForm.sectorIds.map((value) => Number(value)),
        password: createForm.password,
      });
      showFeedback("success", response.message || "Usuario criado.");
      setCreateForm((prev) => ({
        ...INITIAL_CREATE_FORM,
        roles: prev.roles,
      }));
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao criar usuario.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (user) => {
    const roles = Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [];
    const companyIds = Array.isArray(user.company_ids)
      ? asStringIdList(user.company_ids)
      : user.company_id != null
        ? [String(user.company_id)]
        : [];
    const sectorIds = Array.isArray(user.sector_ids)
      ? asStringIdList(user.sector_ids)
      : user.sector_id != null
        ? [String(user.sector_id)]
        : [];

    setEditForm({
      userId: user.id,
      name: user.name || "",
      email: user.email || "",
      roles,
      companyIds,
      sectorIds: getFilteredSectorIds(sectorIds, options.sectors, companyIds),
      password: "",
      passwordConfirm: "",
    });
    setEditCompanyToAdd(options.companies[0] ? String(options.companies[0].id) : "");
    setFeedback({ type: "", message: "" });
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editForm.userId) {
      return;
    }
    if (editForm.roles.length === 0) {
      showFeedback("error", "Selecione pelo menos um papel.");
      return;
    }
    if (editForm.password && editForm.password !== editForm.passwordConfirm) {
      showFeedback("error", "Os campos de nova senha nao conferem.");
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await updateAdminUser(editForm.userId, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        roles: editForm.roles,
        company_ids: editForm.companyIds.map((value) => Number(value)),
        sector_ids: editForm.sectorIds.map((value) => Number(value)),
        password: editForm.password.trim() ? editForm.password : null,
      });
      showFeedback("success", response.message || "Usuario atualizado.");
      setEditForm(INITIAL_EDIT_FORM);
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao atualizar usuario.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Confirma exclusao do usuario?");
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await deleteAdminUser(userId);
      showFeedback("success", response.message || "Usuario removido.");
      if (editForm.userId === userId) {
        setEditForm(INITIAL_EDIT_FORM);
      }
      await loadData();
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      showFeedback("error", requestError.message || "Falha ao excluir usuario.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Administracao</p>
          <h2>Painel de usuarios</h2>
          <p>Crie, edite e remova usuarios com multiplos papeis, empresas e setores.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadData} disabled={loading || submitting}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {feedback.message && <p className={`feedback ${feedback.type}`}>{feedback.message}</p>}

      <section className="workflow-grid admin-users-grid">
        <form className="panel-float workflow-card" onSubmit={handleCreateUser}>
          <h3>Criar usuario</h3>
          <div className="form-grid">
            <label>
              Nome
              <input
                required
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>

            <div className="span-2">
              <p className="admin-field-label">Empresas</p>
              <div className="company-picker-row">
                <select value={createCompanyToAdd} onChange={(event) => setCreateCompanyToAdd(event.target.value)}>
                  <option value="">Selecione a empresa</option>
                  {options.companies.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="company-add-btn" onClick={addCompanyToCreateForm}>
                  +
                </button>
              </div>
              <div className="selected-chip-list">
                {createForm.companyIds.length === 0 && (
                  <p className="workflow-hint">Nenhuma empresa adicionada.</p>
                )}
                {createForm.companyIds.map((companyId) => (
                  <div key={`create-company-${companyId}`} className="selected-chip">
                    <span>{companyNameById.get(companyId) || `ID ${companyId}`}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm((prev) => {
                          const nextCompanyIds = prev.companyIds.filter((value) => value !== companyId);
                          return {
                            ...prev,
                            companyIds: nextCompanyIds,
                            sectorIds: getFilteredSectorIds(prev.sectorIds, options.sectors, nextCompanyIds),
                          };
                        })
                      }
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="span-2">
              <p className="admin-field-label">Papel</p>
              <div className="check-grid">
                {options.roles.map((role) => (
                  <label key={`create-role-${role}`} className="check-item">
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes(role)}
                      onChange={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          roles: toggleValue(prev.roles, role),
                        }))
                      }
                    />
                    <span>{displayRole(role)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="span-2">
              <p className="admin-field-label">Setores</p>
              {createForm.companyIds.length === 0 ? (
                <p className="workflow-hint">Selecione ao menos uma empresa para liberar os setores.</p>
              ) : (
                <div className="check-grid">
                  {createVisibleSectors.map((sector) => {
                    const sectorId = String(sector.id);
                    return (
                      <label key={`create-sector-${sector.id}`} className="check-item">
                        <input
                          type="checkbox"
                          checked={createForm.sectorIds.includes(sectorId)}
                          onChange={() =>
                            setCreateForm((prev) => ({
                              ...prev,
                              sectorIds: toggleValue(prev.sectorIds, sectorId),
                            }))
                          }
                        />
                        <span>{sector.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <label>
              Senha
              <input
                required
                type="password"
                minLength={6}
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </label>
            <label>
              Repetir senha
              <input
                required
                type="password"
                minLength={6}
                value={createForm.passwordConfirm}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))
                }
              />
            </label>
          </div>

          <button type="submit" className="compact-submit" disabled={submitting || loading}>
            Criar usuario
          </button>
        </form>

        <form className="panel-float workflow-card" onSubmit={handleUpdateUser}>
          <h3>Editar usuario</h3>
          {editForm.userId ? (
            <div className="form-grid">
              <label>
                Nome
                <input
                  required
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>

              <div className="span-2">
                <p className="admin-field-label">Empresas</p>
                <div className="company-picker-row">
                  <select value={editCompanyToAdd} onChange={(event) => setEditCompanyToAdd(event.target.value)}>
                    <option value="">Selecione a empresa</option>
                    {options.companies.map((company) => (
                      <option key={company.id} value={String(company.id)}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="company-add-btn" onClick={addCompanyToEditForm}>
                    +
                  </button>
                </div>
                <div className="selected-chip-list">
                  {editForm.companyIds.length === 0 && (
                    <p className="workflow-hint">Nenhuma empresa adicionada.</p>
                  )}
                  {editForm.companyIds.map((companyId) => (
                    <div key={`edit-company-${companyId}`} className="selected-chip">
                      <span>{companyNameById.get(companyId) || `ID ${companyId}`}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => {
                            const nextCompanyIds = prev.companyIds.filter((value) => value !== companyId);
                            return {
                              ...prev,
                              companyIds: nextCompanyIds,
                              sectorIds: getFilteredSectorIds(prev.sectorIds, options.sectors, nextCompanyIds),
                            };
                          })
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="span-2">
                <p className="admin-field-label">Papeis</p>
                <div className="check-grid">
                  {options.roles.map((role) => (
                    <label key={`edit-role-${role}`} className="check-item">
                      <input
                        type="checkbox"
                        checked={editForm.roles.includes(role)}
                        onChange={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            roles: toggleValue(prev.roles, role),
                          }))
                        }
                      />
                      <span>{displayRole(role)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="span-2">
                <p className="admin-field-label">Setores</p>
                {editForm.companyIds.length === 0 ? (
                  <p className="workflow-hint">Selecione ao menos uma empresa para liberar os setores.</p>
                ) : (
                  <div className="check-grid">
                    {editVisibleSectors.map((sector) => {
                      const sectorId = String(sector.id);
                      return (
                        <label key={`edit-sector-${sector.id}`} className="check-item">
                          <input
                            type="checkbox"
                            checked={editForm.sectorIds.includes(sectorId)}
                            onChange={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                sectorIds: toggleValue(prev.sectorIds, sectorId),
                              }))
                            }
                          />
                          <span>{sector.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label>
                Nova senha (opcional)
                <input
                  type="password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              <label>
                Repetir nova senha
                <input
                  type="password"
                  minLength={6}
                  value={editForm.passwordConfirm}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : (
            <p className="workflow-hint">Selecione um usuario na tabela para editar.</p>
          )}

          <div className="action-row">
            <button type="submit" className="compact-submit" disabled={!editForm.userId || submitting || loading}>
              Salvar alteracoes
            </button>
            {editForm.userId && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setEditForm(INITIAL_EDIT_FORM)}
                disabled={submitting}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Usuarios cadastrados</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Login</th>
                <th>Email</th>
                <th>Papeis</th>
                <th>Empresas</th>
                <th>Setores</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const roles = Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [];
                const companyIds = Array.isArray(user.company_ids)
                  ? asStringIdList(user.company_ids)
                  : user.company_id != null
                    ? [String(user.company_id)]
                    : [];
                const sectorIds = Array.isArray(user.sector_ids)
                  ? asStringIdList(user.sector_ids)
                  : user.sector_id != null
                    ? [String(user.sector_id)]
                    : [];

                const companiesLabel = companyIds
                  .map((companyId) => companyNameById.get(companyId) || `ID ${companyId}`)
                  .join(", ");
                const sectorsLabel = sectorIds
                  .map((sectorId) => sectorNameById.get(sectorId) || `ID ${sectorId}`)
                  .join(", ");

                return (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.username || "-"}</td>
                    <td>{user.email}</td>
                    <td>{displayRole(roles)}</td>
                    <td>{companiesLabel || "-"}</td>
                    <td>{sectorsLabel || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="table-btn"
                        disabled={submitting}
                        onClick={() => handleOpenEdit(user)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="table-btn"
                        disabled={submitting}
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={8}>Nenhum usuario encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

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
  password: "",
  role: "AUTOR",
  sectorId: "",
};

const INITIAL_EDIT_FORM = {
  userId: null,
  name: "",
  email: "",
  password: "",
  role: "AUTOR",
  sectorId: "",
};

export default function AdminUsuariosPage({ onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ roles: [], sectors: [] });
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [editForm, setEditForm] = useState(INITIAL_EDIT_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => setFeedback({ type, message });

  const sectorNameById = useMemo(
    () => new Map((options.sectors || []).map((sector) => [Number(sector.id), sector.name])),
    [options.sectors],
  );

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const [usersResponse, optionsResponse] = await Promise.all([getAdminUsers(), getAdminUserOptions()]);
      setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      const roles = Array.isArray(optionsResponse.roles) ? optionsResponse.roles : [];
      const sectors = Array.isArray(optionsResponse.sectors) ? optionsResponse.sectors : [];
      setOptions({ roles, sectors });
      setCreateForm((prev) => ({
        ...prev,
        role: roles.includes(prev.role) ? prev.role : roles[0] || "AUTOR",
      }));
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

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await createAdminUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        sector_id: createForm.sectorId ? Number(createForm.sectorId) : null,
      });
      showFeedback("success", response.message || "Usuario criado.");
      setCreateForm((prev) => ({
        ...INITIAL_CREATE_FORM,
        role: prev.role,
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
    setEditForm({
      userId: user.id,
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "AUTOR",
      sectorId: user.sector_id != null ? String(user.sector_id) : "",
    });
    setFeedback({ type: "", message: "" });
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editForm.userId) {
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const response = await updateAdminUser(editForm.userId, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        password: editForm.password.trim() ? editForm.password : null,
        role: editForm.role,
        sector_id: editForm.sectorId ? Number(editForm.sectorId) : null,
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
          <p>Crie, edite e remova usuarios do sistema com controle de papel e setor.</p>
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
              Papel
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                {options.roles.map((role) => (
                  <option key={role} value={role}>
                    {displayRole(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Setor
              <select
                value={createForm.sectorId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, sectorId: event.target.value }))}
              >
                <option value="">Sem setor</option>
                {options.sectors.map((sector) => (
                  <option key={sector.id} value={String(sector.id)}>
                    {sector.id} - {sector.name}
                  </option>
                ))}
              </select>
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
                Papel
                <select
                  value={editForm.role}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                >
                  {options.roles.map((role) => (
                    <option key={role} value={role}>
                      {displayRole(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Setor
                <select
                  value={editForm.sectorId}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, sectorId: event.target.value }))}
                >
                  <option value="">Sem setor</option>
                  {options.sectors.map((sector) => (
                    <option key={sector.id} value={String(sector.id)}>
                      {sector.id} - {sector.name}
                    </option>
                  ))}
                </select>
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
                <th>Email</th>
                <th>Papel</th>
                <th>Setor</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{displayRole(user.role)}</td>
                  <td>{user.sector_id ? sectorNameById.get(Number(user.sector_id)) || user.sector_id : "-"}</td>
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
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6}>Nenhum usuario encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

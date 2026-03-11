import { useEffect, useMemo, useState } from "react";

import { fetchWorkflowItems, summarizeWorkflow } from "../services/workflow";

export default function PainelDocumentos({ onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWorkflowItems();
      setItems(data);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      setError(requestError.message || "Nao foi possivel carregar o painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const stats = useMemo(() => summarizeWorkflow(items), [items]);

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Visao geral</p>
          <h2>Painel de documentos</h2>
          <p>Resumo do acervo com status atual da versao mais recente de cada documento.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadItems} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      {error && <p className="error-text margin-top">{error}</p>}

      <section className="workflow-summary-grid">
        <article className="panel-float workflow-stat">
          <p>Total</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Sem versao</p>
          <strong>{stats.semVersao}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Rascunho</p>
          <strong>{stats.rascunho}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Em revisao</p>
          <strong>{stats.emRevisao}</strong>
        </article>
        <article className="panel-float workflow-stat">
          <p>Vigente</p>
          <strong>{stats.vigente}</strong>
        </article>
      </section>

      <section className="panel-float workflow-list">
        <div className="workflow-list-head">
          <h3>Resumo geral dos documentos</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Codigo</th>
                <th>Titulo</th>
                <th>Tipo</th>
                <th>Escopo</th>
                <th>Status atual</th>
                <th>Versao atual</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.code}</td>
                  <td>{item.title}</td>
                  <td>{item.document_type}</td>
                  <td>{item.scope}</td>
                  <td>
                    <span className={`status-pill status-${item.latestStatus.toLowerCase()}`}>
                      {item.latestStatus}
                    </span>
                  </td>
                  <td>{item.latestVersion ? `v${item.latestVersion.version_number}` : "-"}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7}>Nenhum documento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

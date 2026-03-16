import { Fragment, useEffect, useMemo, useState } from "react";

import useRealtimeEvents from "../hooks/useRealtimeEvents";
import useViewportPreserver from "../hooks/useViewportPreserver";
import { getAuditEvents } from "../services/api";

const ACTION_LABELS = {
  CREATE: "Cadastro",
  UPDATE: "Alteracao",
  DELETE: "Exclusao",
  STATUS_CHANGE: "Mudanca de status",
  BULK_SYNC: "Sincronizacao automatica",
  REJECT_REASON: "Motivo de reprovacao",
};

const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  RASCUNHO_REVISADO: "Rascunho revisado",
  REVISAR_RASCUNHO: "Revisar rascunho",
  PENDENTE_COORDENACAO: "Pendente coordenacao",
  PENDENTE_QUALIDADE: "Pendente qualidade",
  EM_REVISAO: "Em revisao",
  REPROVADO: "Reprovado",
  VIGENTE: "Vigente",
  OBSOLETO: "Obsoleto",
};

const SOURCE_LABELS = {
  FRONTEND_WEB: "Frontend Web",
  API_INTERNA: "API interna",
  API_CLIENT: "API externa",
  JOB_AUTOMATICO: "Job automatizado",
  SCRIPT_ADMINISTRATIVO: "Script administrativo",
};

const FIELD_LABELS = {
  record: "Registro completo",
  code: "Codigo",
  title: "Titulo",
  name: "Nome",
  sigla: "Sigla",
  status: "Status",
  scope: "Escopo",
  file_path: "Arquivo",
  expiration_date: "Data de vencimento",
  company_id: "Empresa",
  sector_id: "Setor",
  document_type: "Tipo documental",
  moved_documents: "Documentos movidos",
  updated_codes: "Codigos atualizados",
  version_number: "Versao",
  approved_by: "Aprovado por",
  approved_at: "Aprovado em",
  invalidated_by: "Invalidado por",
  invalidated_at: "Invalidado em",
  reason: "Motivo",
  username: "Login",
  email: "E-mail",
  roles: "Papeis",
  company_ids: "Empresas",
  sector_ids: "Setores",
  content_type: "Tipo de arquivo",
  size_bytes: "Tamanho",
};

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("pt-BR");
}

function formatEntity(value) {
  const map = {
    document: "Documento",
    document_version: "Versao",
    company: "Empresa",
    sector: "Setor",
    document_type: "Tipo documental",
    user: "Usuario",
    stored_file: "Arquivo",
  };
  return map[value] || value || "-";
}

function formatAction(value) {
  return ACTION_LABELS[value] || value || "-";
}

function formatSource(value) {
  return SOURCE_LABELS[value] || value || "-";
}

function formatFieldName(value) {
  return FIELD_LABELS[value] || value || "-";
}

function getActorLabel(eventItem) {
  return (
    eventItem.user_name ||
    eventItem.actor_name_snapshot ||
    (eventItem.user_id ? `Usuario #${eventItem.user_id}` : "Sistema")
  );
}

function getActorKey(eventItem) {
  if (eventItem.user_id != null) {
    return `id:${eventItem.user_id}`;
  }
  return `name:${getActorLabel(eventItem)}`;
}

function parseAuditValue(value) {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function looksLikeDate(value) {
  if (typeof value !== "string") {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value.trim());
}

function formatValue(value, fieldName) {
  if (value == null || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item, fieldName)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${formatFieldName(key)}: ${formatValue(item, key)}`)
      .join(" | ");
  }
  if (fieldName === "status" && STATUS_LABELS[value]) {
    return STATUS_LABELS[value];
  }
  if (typeof value === "string" && looksLikeDate(value)) {
    return formatDateTime(value);
  }
  return String(value);
}

function buildEventSummary(eventItem) {
  const actor = getActorLabel(eventItem);
  const entityLabel = eventItem.entity_label || `${formatEntity(eventItem.entity_type)}${eventItem.entity_id ? ` #${eventItem.entity_id}` : ""}`;
  const firstChange = eventItem.changes?.[0] || null;

  if (eventItem.action === "CREATE") {
    return `${actor} cadastrou ${entityLabel}.`;
  }
  if (eventItem.action === "DELETE") {
    return `${actor} excluiu ${entityLabel}.`;
  }
  if (eventItem.action === "STATUS_CHANGE" && firstChange) {
    const oldValue = formatValue(parseAuditValue(firstChange.old_display_value ?? firstChange.old_value), firstChange.field_name);
    const newValue = formatValue(parseAuditValue(firstChange.new_display_value ?? firstChange.new_value), firstChange.field_name);
    return `${actor} alterou o status de ${entityLabel} de "${oldValue}" para "${newValue}".`;
  }
  if (eventItem.action === "BULK_SYNC" && firstChange?.field_name === "updated_codes") {
    const quantity = formatValue(parseAuditValue(firstChange.new_display_value ?? firstChange.new_value), firstChange.field_name);
    return `${actor} sincronizou os codigos de ${quantity} documento(s) vinculados em ${entityLabel}.`;
  }
  if (eventItem.action === "BULK_SYNC" && firstChange?.field_name === "moved_documents") {
    const quantity = formatValue(parseAuditValue(firstChange.new_display_value ?? firstChange.new_value), firstChange.field_name);
    return `${actor} sincronizou o vinculo de ${quantity} documento(s) em ${entityLabel}.`;
  }
  if (eventItem.action === "UPDATE") {
    const changedCount = Array.isArray(eventItem.changes) ? eventItem.changes.length : 0;
    if (changedCount > 0) {
      return `${actor} alterou ${changedCount} campo(s) em ${entityLabel}.`;
    }
    return `${actor} alterou ${entityLabel}.`;
  }
  return `${actor} executou ${formatAction(eventItem.action)} em ${entityLabel}.`;
}

export default function HistoricoAcoesPage({ onUnauthorized }) {
  const { preserveViewport } = useViewportPreserver();
  const [filters, setFilters] = useState({
    term: "",
    actor: "ALL",
    entityType: "ALL",
    action: "ALL",
    sourceType: "ALL",
    fieldName: "ALL",
    requestId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [events, setEvents] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAuditEvents({ page: 1, page_size: 500 });
      const items = Array.isArray(response?.items) ? response.items : [];
      setEvents(items);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized?.();
        return;
      }
      setError(requestError.message || "Nao foi possivel carregar o historico de acoes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);
  useRealtimeEvents(loadEvents, { channels: ["audit"] });

  const entityTypes = useMemo(
    () =>
      [...new Set(events.map((item) => item.entity_type).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [events],
  );

  const actions = useMemo(
    () =>
      [...new Set(events.map((item) => item.action).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [events],
  );

  const sourceTypes = useMemo(
    () =>
      [...new Set(events.map((item) => item.source_type).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [events],
  );

  const actorOptions = useMemo(() => {
    const map = new Map();
    events.forEach((item) => {
      const key = getActorKey(item);
      if (!map.has(key)) {
        map.set(key, getActorLabel(item));
      }
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const fieldNames = useMemo(
    () =>
      [
        ...new Set(
          events.flatMap((item) =>
            (Array.isArray(item.changes) ? item.changes : []).map((change) => change.field_name).filter(Boolean),
          ),
        ),
      ].sort((a, b) => String(a).localeCompare(String(b))),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const term = filters.term.trim().toLowerCase();
    const requestId = filters.requestId.trim().toLowerCase();
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;

    return events.filter((item) => {
      if (filters.actor !== "ALL" && getActorKey(item) !== filters.actor) {
        return false;
      }
      if (filters.entityType !== "ALL" && item.entity_type !== filters.entityType) {
        return false;
      }
      if (filters.action !== "ALL" && item.action !== filters.action) {
        return false;
      }
      if (filters.sourceType !== "ALL" && item.source_type !== filters.sourceType) {
        return false;
      }
      if (filters.fieldName !== "ALL") {
        const hasField = (Array.isArray(item.changes) ? item.changes : []).some(
          (change) => change.field_name === filters.fieldName,
        );
        if (!hasField) {
          return false;
        }
      }
      if (requestId && !String(item.request_id || "").toLowerCase().includes(requestId)) {
        return false;
      }

      const createdAt = new Date(item.created_at);
      if (dateFrom && !Number.isNaN(dateFrom.getTime()) && !Number.isNaN(createdAt.getTime()) && createdAt < dateFrom) {
        return false;
      }
      if (dateTo && !Number.isNaN(dateTo.getTime()) && !Number.isNaN(createdAt.getTime()) && createdAt > dateTo) {
        return false;
      }
      if (!term) {
        return true;
      }
      const changesText = (Array.isArray(item.changes) ? item.changes : [])
        .map((change) =>
          [
            change.field_name,
            change.field_label,
            change.old_value,
            change.new_value,
            change.old_display_value,
            change.new_display_value,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ");
      const searchable = [
        item.user_name,
        item.actor_name_snapshot,
        item.user_id,
        item.entity_type,
        item.entity_label,
        item.entity_id,
        item.action,
        item.ip_address,
        item.source_type,
        item.source_url,
        item.request_id,
        item.request_path,
        item.request_method,
        formatDateTime(item.created_at),
        changesText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(term);
    });
  }, [events, filters]);

  const clearFilters = () => {
    preserveViewport(() =>
      setFilters({
        term: "",
        actor: "ALL",
        entityType: "ALL",
        action: "ALL",
        sourceType: "ALL",
        fieldName: "ALL",
        requestId: "",
        dateFrom: "",
        dateTo: "",
      }),
    );
  };

  const toggleRow = (eventId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  return (
    <div className="page-animation">
      <section className="hero-block">
        <div>
          <p className="kicker">Compliance</p>
          <h2>Historico de Acoes</h2>
          <p>Cada linha representa um evento real. Clique para expandir os campos alterados.</p>
        </div>
      </section>

      {error && <p className="error-text margin-top">{error}</p>}

      <section className="panel-float painel-filters-grid">
        <label>
          Pesquisa
          <input
            type="text"
            placeholder="Usuario, entidade, campo, valor..."
            value={filters.term}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  term: event.target.value,
                })),
              )
            }
          />
        </label>

        <label>
          Usuario
          <select
            value={filters.actor}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  actor: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {actorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Entidade
          <select
            value={filters.entityType}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  entityType: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {entityTypes.map((value) => (
              <option key={value} value={value}>
                {formatEntity(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Acao
          <select
            value={filters.action}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  action: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {actions.map((value) => (
              <option key={value} value={value}>
                {formatAction(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Origem
          <select
            value={filters.sourceType}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  sourceType: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todas</option>
            {sourceTypes.map((value) => (
              <option key={value} value={value}>
                {formatSource(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Campo alterado
          <select
            value={filters.fieldName}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  fieldName: event.target.value,
                })),
              )
            }
          >
            <option value="ALL">Todos</option>
            {fieldNames.map((value) => (
              <option key={value} value={value}>
                {formatFieldName(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Request ID
          <input
            type="text"
            placeholder="Ex: a1b2c3"
            value={filters.requestId}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  requestId: event.target.value,
                })),
              )
            }
          />
        </label>

        <label>
          Data inicial
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  dateFrom: event.target.value,
                })),
              )
            }
          />
        </label>

        <label>
          Data final
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              preserveViewport(() =>
                setFilters((prev) => ({
                  ...prev,
                  dateTo: event.target.value,
                })),
              )
            }
          />
        </label>

        <label>
          Resultado
          <input type="text" readOnly value={`${filteredEvents.length} evento(s)`} />
        </label>

        <button type="button" className="ghost-btn align-end" onClick={clearFilters}>
          Limpar filtros
        </button>
      </section>

      <section className="panel-float workflow-list">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuario</th>
                <th>Acao</th>
                <th>Entidade</th>
                <th>IP</th>
                <th>Origem</th>
                <th>Request ID</th>
                <th>Resumo</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((item) => {
                const isExpanded = !!expandedRows[item.id];
                const actor = getActorLabel(item);
                const entityLabel = item.entity_label || `${formatEntity(item.entity_type)} ${item.entity_id ? `#${item.entity_id}` : ""}`;
                return (
                  <Fragment key={item.id}>
                    <tr key={item.id}>
                      <td>{formatDateTime(item.created_at)}</td>
                      <td>{actor}</td>
                      <td>{formatAction(item.action)}</td>
                      <td>{entityLabel}</td>
                      <td>{item.ip_address || "-"}</td>
                      <td>{formatSource(item.source_type)}</td>
                      <td>{item.request_id || "-"}</td>
                      <td>{buildEventSummary(item)}</td>
                      <td>
                        <button type="button" className="table-btn" onClick={() => toggleRow(item.id)}>
                          {isExpanded ? "Ocultar" : "Expandir"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.id}-details`}>
                        <td colSpan={9}>
                          <div className="panel-float" style={{ padding: "10px" }}>
                            <p>
                              <strong>Origem tecnica:</strong> {item.source_url || "-"}
                            </p>
                            <p>
                              <strong>Rota:</strong> {item.request_method || "-"} {item.request_path || "-"}
                            </p>
                            <div className="table-wrap margin-top">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Campo</th>
                                    <th>Valor anterior</th>
                                    <th>Valor novo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(Array.isArray(item.changes) ? item.changes : []).map((change) => (
                                    <tr key={change.id}>
                                      <td>{change.field_label || formatFieldName(change.field_name)}</td>
                                      <td>
                                        {formatValue(
                                          parseAuditValue(change.old_display_value ?? change.old_value),
                                          change.field_name,
                                        )}
                                      </td>
                                      <td>
                                        {formatValue(
                                          parseAuditValue(change.new_display_value ?? change.new_value),
                                          change.field_name,
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {(!item.changes || item.changes.length === 0) && (
                                    <tr>
                                      <td colSpan={3}>Sem alteracoes de campo registradas neste evento.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!loading && filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={9}>Nenhum evento encontrado com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

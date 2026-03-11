import { useEffect, useState } from "react";

import DocumentInsightsPanel from "../components/DocumentInsightsPanel";
import DocumentResultCard from "../components/DocumentResultCard";
import MetricCard from "../components/MetricCard";
import PdfViewerPanel from "../components/PdfViewerPanel";
import { dashboardMetrics, mockDocuments, workflowHighlights } from "../data/mockDocuments";

const buildFilterOptions = (items, key) => ["TODOS", ...new Set(items.map((item) => item[key]))];

const workflowStages = [
  {
    id: "RASCUNHO",
    title: "Rascunho",
    description: "Autor cria e edita antes de submeter para coordenacao.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    id: "EM_REVISAO",
    title: "Em revisao",
    description: "Coordenacao valida qualidade, risco e metadados.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    id: "VIGENTE",
    title: "Vigente",
    description: "Unica versao ativa para leitura operacional.",
    tone: "border-unimed-200 bg-unimed-50 text-unimed-800",
  },
  {
    id: "OBSOLETO",
    title: "Obsoleto",
    description: "Mantido apenas para historico e auditoria.",
    tone: "border-slate-200 bg-slate-50 text-slate-600",
  },
];

export default function HomePage() {
  const [activeView, setActiveView] = useState("viewer");
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState("TODOS");
  const [companyFilter, setCompanyFilter] = useState("TODOS");
  const [sectorFilter, setSectorFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [selectedDocumentId, setSelectedDocumentId] = useState(mockDocuments[0]?.id ?? null);
  const [activePage, setActivePage] = useState(1);

  const companies = buildFilterOptions(mockDocuments, "company");
  const sectors = buildFilterOptions(mockDocuments, "sector");
  const types = buildFilterOptions(mockDocuments, "documentType");

  const filteredDocuments = mockDocuments.filter((document) => {
    const searchable = [
      document.title,
      document.code,
      document.sector,
      document.documentType,
      document.company,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchTerm.trim() === "" || searchable.includes(searchTerm.toLowerCase().trim());

    return (
      document.status === "VIGENTE" &&
      matchesSearch &&
      (scopeFilter === "TODOS" || document.scope === scopeFilter) &&
      (companyFilter === "TODOS" || document.company === companyFilter) &&
      (sectorFilter === "TODOS" || document.sector === sectorFilter) &&
      (typeFilter === "TODOS" || document.documentType === typeFilter)
    );
  });

  useEffect(() => {
    if (!filteredDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(filteredDocuments[0]?.id ?? null);
    }
  }, [filteredDocuments, selectedDocumentId]);

  const selectedDocument =
    filteredDocuments.find((document) => document.id === selectedDocumentId) ??
    filteredDocuments[0] ??
    null;

  useEffect(() => {
    setActivePage(1);
  }, [selectedDocument?.id]);

  return (
    <div className="space-y-6">
      <section className="panel rounded-[28px] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow text-unimed-600">Central operacional</p>
            <h2 className="mt-1 text-3xl font-semibold text-ink">
              Navegue entre Workflow e Visualizacao de Documentos
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
              Separacao clara de contexto para evitar confusao: uma tela para status e fluxo, outra para abrir e ler arquivos.
            </p>
          </div>

          <div className="inline-flex rounded-2xl border border-[color:var(--panel-border)] bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView("workflow")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeView === "workflow"
                  ? "bg-unimed-600 text-white shadow-card"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Workflow
            </button>
            <button
              type="button"
              onClick={() => setActiveView("viewer")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeView === "viewer"
                  ? "bg-unimed-600 text-white shadow-card"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Visualizacao de documentos
            </button>
          </div>
        </div>

        {selectedDocument && activeView === "viewer" ? (
          <div className="mt-5 rounded-[20px] border border-unimed-200 bg-unimed-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-unimed-700">Arquivo aberto</p>
            <p className="mt-1 text-base font-semibold text-unimed-900">
              {selectedDocument.code} - {selectedDocument.title}
            </p>
          </div>
        ) : null}
      </section>

      {activeView === "workflow" ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <article className="panel rounded-[28px] p-6">
            <p className="eyebrow text-unimed-600">Ciclo de vida</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Etapas do processo documental</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {workflowStages.map((stage) => (
                <article key={stage.id} className={`rounded-[22px] border px-4 py-4 ${stage.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]">{stage.id}</p>
                  <h4 className="mt-2 text-lg font-semibold">{stage.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{stage.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {workflowHighlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[22px] border border-[color:var(--panel-border)] bg-white px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.kicker}</p>
                  <h4 className="mt-2 text-base font-semibold text-ink">{item.title}</h4>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  <span className="mt-3 inline-block rounded-full bg-unimed-50 px-3 py-1 text-xs font-semibold text-unimed-700">
                    {item.value}
                  </span>
                </article>
              ))}
            </div>
          </article>

          <article className="panel rounded-[28px] p-6">
            <p className="eyebrow text-unimed-600">Indicadores</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Visao de operacao</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {dashboardMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </article>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="panel rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-unimed-600">Busca protegida</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">Documentos vigentes</h3>
              </div>
              <span className="rounded-full bg-unimed-50 px-3 py-1 text-sm font-semibold text-unimed-700">
                {filteredDocuments.length} ativos
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-unimed-400 focus:ring-4 focus:ring-unimed-100"
                placeholder="Buscar por codigo, titulo, setor ou tipo"
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <FilterSelect
                  label="Escopo"
                  value={scopeFilter}
                  onChange={setScopeFilter}
                  options={["TODOS", "CORPORATIVO", "LOCAL"]}
                />
                <FilterSelect
                  label="Empresa"
                  value={companyFilter}
                  onChange={setCompanyFilter}
                  options={companies}
                />
                <FilterSelect
                  label="Setor"
                  value={sectorFilter}
                  onChange={setSectorFilter}
                  options={sectors}
                />
                <FilterSelect
                  label="Tipo documental"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={types}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((document) => (
                  <DocumentResultCard
                    key={document.id}
                    document={document}
                    selected={document.id === selectedDocument?.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[color:var(--panel-border)] bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum documento vigente encontrado para os filtros atuais.
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <PdfViewerPanel
              document={selectedDocument}
              activePage={activePage}
              setActivePage={setActivePage}
            />
            <DocumentInsightsPanel document={selectedDocument} />
          </div>
        </section>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-unimed-400 focus:ring-4 focus:ring-unimed-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

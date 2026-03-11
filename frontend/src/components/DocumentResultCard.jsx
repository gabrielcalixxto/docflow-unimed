function getScopeStyle(scope) {
  return scope === "CORPORATIVO"
    ? "bg-unimed-100 text-unimed-800"
    : "bg-lime-100 text-lime-900";
}

export default function DocumentResultCard({ document, onClick, selected }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[26px] border p-4 text-left transition ${
        selected
          ? "border-unimed-300 bg-white shadow-card ring-4 ring-unimed-100"
          : "border-[color:var(--panel-border)] bg-white/75 hover:border-unimed-200 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{document.code}</p>
          <h4 className="mt-2 text-base font-semibold text-ink">{document.title}</h4>
        </div>
        <span className="rounded-full bg-unimed-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
          {document.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getScopeStyle(document.scope)}`}>
          {document.scope}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {document.documentType}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Setor</dt>
          <dd className="mt-1 font-medium text-slate-700">{document.sector}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Vencimento</dt>
          <dd className="mt-1 font-medium text-slate-700">{document.expirationDateLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold uppercase tracking-[0.18em]">
        {selected ? (
          <span className="text-unimed-700">Arquivo aberto nesta visualizacao</span>
        ) : (
          <span className="text-slate-500">Clique para abrir este arquivo</span>
        )}
      </div>
    </button>
  );
}

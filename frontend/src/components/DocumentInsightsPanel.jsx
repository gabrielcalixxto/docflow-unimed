function scopeCopy(scope) {
  return scope === "CORPORATIVO"
    ? "Visivel para todas as areas com permissao de leitura."
    : "Visivel apenas para o setor responsavel e perfis autorizados.";
}

function versionTone(status) {
  if (status === "VIGENTE") {
    return "bg-unimed-100 text-unimed-800";
  }
  if (status === "EM_REVISAO") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-slate-200 text-slate-700";
}

export default function DocumentInsightsPanel({ document }) {
  if (!document) {
    return null;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <article className="panel rounded-[28px] p-5">
        <p className="eyebrow text-unimed-600">Taxonomia</p>
        <h3 className="mt-2 text-2xl font-semibold text-ink">Controle documental</h3>
        <dl className="mt-5 space-y-4 text-sm">
          <InfoRow label="Empresa" value={document.company} />
          <InfoRow label="Setor" value={document.sector} />
          <InfoRow label="Tipo documental" value={document.documentType} />
          <InfoRow label="Escopo" value={document.scope} />
          <InfoRow label="Vencimento" value={document.expirationDateLabel} />
        </dl>
        <div className="mt-5 rounded-[24px] bg-unimed-50 px-4 py-4 text-sm leading-7 text-unimed-800">
          {scopeCopy(document.scope)}
        </div>
      </article>

      <article className="panel rounded-[28px] p-5">
        <p className="eyebrow text-unimed-600">Governanca</p>
        <div className="mt-4 space-y-4">
          <GovernanceCard title="Elaborado por" value={document.createdBy} subtitle={document.createdRole} />
          <GovernanceCard title="Aprovado por" value={document.approvedBy} subtitle={document.approvalCoordination} />
        </div>
      </article>

      <article className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow text-unimed-600">Versionamento</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Historico administrativo</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            1 vigente
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {document.versions.map((version) => (
            <div key={version.label} className="rounded-[24px] border border-[color:var(--panel-border)] bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-ink">{version.label}</div>
                  <div className="mt-1 text-sm text-slate-600">{version.dateLabel}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${versionTone(version.status)}`}>
                  {version.status}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {version.owner} - {version.note}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel rounded-[28px] p-5 xl:col-span-2">
        <p className="eyebrow text-unimed-600">Auditoria</p>
        <h3 className="mt-2 text-2xl font-semibold text-ink">Eventos imutaveis</h3>
        <div className="mt-5 space-y-4">
          {document.audit.map((event) => (
            <div key={`${event.type}-${event.at}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-unimed-500" />
                <div className="mt-2 h-full w-px bg-unimed-100" />
              </div>
              <div className="pb-5">
                <div className="text-sm font-semibold text-ink">{event.label}</div>
                <div className="mt-1 text-sm text-slate-600">{event.user}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{event.at}</div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--panel-border)] bg-white px-4 py-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function GovernanceCard({ title, value, subtitle }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--panel-border)] bg-white px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-semibold text-ink">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
    </div>
  );
}

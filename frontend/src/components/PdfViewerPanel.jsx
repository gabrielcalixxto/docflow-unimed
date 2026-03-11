function getScopeLabel(scope) {
  return scope === "CORPORATIVO" ? "Distribuicao corporativa" : "Distribuicao local";
}

export default function PdfViewerPanel({ document, activePage, setActivePage }) {
  if (!document) {
    return (
      <section className="panel rounded-[28px] p-8">
        <div className="flex h-full min-h-[480px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--panel-border)] bg-white text-center">
          <div>
            <p className="eyebrow text-unimed-600">Viewer</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Nenhum documento selecionado</h3>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
              Escolha um item na coluna de busca para abrir o panorama do PDF, ver taxonomia e consultar o historico.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const currentPage = document.pages.find((page) => page.pageNumber === activePage) ?? document.pages[0];

  return (
    <section className="space-y-5">
      <article className="rounded-[22px] border border-unimed-200 bg-unimed-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-unimed-700">Arquivo em exibicao</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-unimed-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            Aberto agora
          </span>
          <h3 className="text-lg font-semibold text-unimed-900">
            {document.code} - {document.title}
          </h3>
        </div>
      </article>

      <article className="panel rounded-[28px] p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="eyebrow text-unimed-600">Visualizacao do PDF</p>
            <h3 className="mt-2 text-3xl font-semibold text-ink">{document.title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{document.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Badge label="Codigo" value={document.code} />
            <Badge label="Abrangencia" value={getScopeLabel(document.scope)} />
          </div>
        </div>
      </article>

      <article className="panel rounded-[28px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[color:var(--panel-border)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-unimed-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white">
              Preview MVP do PDF
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Pagina {currentPage.pageNumber} de {document.pages.length}
            </span>
            <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-900">
              Zoom 100%
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {["Miniaturas", "Anotacoes", "Download", "Compartilhar"].map((action) => (
              <button
                key={action}
                type="button"
                className="rounded-full border border-[color:var(--panel-border)] bg-white px-4 py-2 font-medium text-slate-600 transition hover:border-unimed-200 hover:text-unimed-700"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[104px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {document.pages.map((page) => (
              <button
                key={page.pageNumber}
                type="button"
                onClick={() => setActivePage(page.pageNumber)}
                className={`w-full rounded-[22px] border p-3 text-left transition ${
                  page.pageNumber === currentPage.pageNumber
                    ? "border-unimed-300 bg-unimed-50 shadow-card"
                    : "border-[color:var(--panel-border)] bg-white/70 hover:border-unimed-200"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Pagina {page.pageNumber}
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">{page.section}</p>
              </button>
            ))}
          </aside>

          <div className="rounded-[24px] bg-slate-50 p-4">
            <div className="mx-auto flex min-h-[720px] max-w-[760px] rounded-[24px] border border-slate-200 bg-white px-8 py-7 shadow-[0_18px_40px_rgba(8,57,35,0.10)]">
              <div className="flex w-full flex-col">
                <div className="flex items-start justify-between border-b border-slate-200 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-unimed-600">
                      {document.company}
                    </p>
                    <h4 className="mt-3 text-3xl font-semibold text-ink">{currentPage.title}</h4>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{currentPage.summary}</p>
                  </div>
                  <div className="rounded-[22px] bg-unimed-600 px-4 py-3 text-right text-sm text-white">
                    <div className="font-semibold">{document.code}</div>
                    <div className="text-xs text-emerald-100">{document.documentType}</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {currentPage.highlights.map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {highlight.label}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{highlight.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  {currentPage.sections.map((section) => (
                    <section key={section.heading} className="rounded-[26px] border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-unimed-600">
                            {section.kicker}
                          </p>
                          <h5 className="mt-2 text-lg font-semibold text-ink">{section.heading}</h5>
                        </div>
                        <span className="rounded-full bg-unimed-50 px-3 py-1 text-xs font-semibold text-unimed-700">
                          {section.badge}
                        </span>
                      </div>
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-700">
                        {section.items.map((item) => (
                          <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                <div className="mt-auto pt-8">
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                      <span>Versao atual {document.currentVersionLabel}</span>
                      <span>Vencimento {document.expirationDateLabel}</span>
                      <span>Pagina {currentPage.pageNumber}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function Badge({ label, value }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--panel-border)] bg-white px-4 py-3 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

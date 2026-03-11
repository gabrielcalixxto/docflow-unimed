export default function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--panel-border)] bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-unimed-600 text-base font-black text-white">
              U
            </div>
            <div>
              <p className="eyebrow text-unimed-600">DocFlow Unimed</p>
              <h1 className="text-xl font-semibold text-ink">Gestao documental em ambiente regulado</h1>
              <p className="mt-1 text-sm text-slate-600">Consulta de documentos vigentes com visualizacao de PDF.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-unimed-50 px-4 py-2 font-medium text-unimed-700">
              MVP de consulta
            </span>
            <span className="rounded-full border border-[color:var(--panel-border)] px-4 py-2 text-slate-600">
              Perfil: Coordenacao Qualidade
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}

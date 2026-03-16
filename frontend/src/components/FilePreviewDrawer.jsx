import { resolveApiFileUrl } from "../services/api";

function resolvePreviewSrc(path) {
  return resolveApiFileUrl(path);
}

export default function FilePreviewDrawer({
  open,
  title,
  filePath,
  metadata = [],
  onClose,
}) {
  const src = resolvePreviewSrc(filePath);

  return (
    <aside className={`viewer-drawer ${open ? "open" : ""}`} aria-label="Visualizador de arquivo">
      <header className="viewer-head">
        <div>
          <p className="kicker">Visualizacao</p>
          <h3>{title || "Documento"}</h3>
        </div>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Fechar
        </button>
      </header>

      {open && (
        <div className="viewer-body">
          <div className="preview-panel panel-float">
            {src ? (
              <iframe title="Visualizacao do arquivo" src={src} className="file-frame" scrolling="yes" />
            ) : (
              <div className="no-preview">
                <p>Pre-visualizacao indisponivel para caminho local.</p>
                <p className="mono">{filePath || "-"}</p>
              </div>
            )}
          </div>

          <div className="meta-panel panel-float">
            <h4>Dados simples</h4>
            <ul>
              <li>
                <strong>Arquivo:</strong> {extractFileName(filePath)}
              </li>
              {metadata.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}:</strong> {item.value || "-"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </aside>
  );
}

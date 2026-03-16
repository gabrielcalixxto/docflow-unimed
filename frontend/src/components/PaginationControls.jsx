import { cn } from "../utils/cn";

export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  className,
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div className={cn("pagination-controls", className)}>
      <p className="workflow-hint">
        Exibindo {start}-{end} de {totalItems}
      </p>

      <label className="pagination-size-picker">
        Linhas por pagina
        <select value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((option) => (
            <option key={`page-size-${option}`} value={String(option)}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="pagination-nav">
        <button type="button" className="table-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Anterior
        </button>
        <span className="pagination-indicator">
          Pagina {page} de {totalPages}
        </span>
        <button
          type="button"
          className="table-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Proxima
        </button>
      </div>
    </div>
  );
}

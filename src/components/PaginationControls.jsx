function PaginationControls({ page, total, limit, onPageChange, disabled = false, label = 'records' }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(Math.max(1, page), pages)
  const start = total === 0 ? 0 : (currentPage - 1) * limit + 1
  const end = Math.min(currentPage * limit, total)

  return (
    <div className="pagination-controls" aria-label={`${label} pagination`}>
      <span className="pagination-summary">
        {total === 0 ? `No ${label}` : `${start}–${end} of ${total} ${label}`}
      </span>
      <div className="pagination-actions">
        <button className="btn btn-secondary btn-small" type="button" onClick={() => onPageChange(currentPage - 1)} disabled={disabled || currentPage <= 1}>
          Previous
        </button>
        <span aria-live="polite">Page {currentPage} of {pages}</span>
        <button className="btn btn-secondary btn-small" type="button" onClick={() => onPageChange(currentPage + 1)} disabled={disabled || currentPage >= pages}>
          Next
        </button>
      </div>
    </div>
  )
}

export default PaginationControls

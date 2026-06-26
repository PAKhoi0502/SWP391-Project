import "../ui.css";

function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="ui-pagination">
      <button
        className="ui-page-btn"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Trước
      </button>

      {pages.map((item) => (
        <button
          key={item}
          className={`ui-page-btn ${item === page ? "active" : ""}`}
          onClick={() => onPageChange(item)}
        >
          {item}
        </button>
      ))}

      <button
        className="ui-page-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Sau
      </button>
    </div>
  );
}

export default Pagination;
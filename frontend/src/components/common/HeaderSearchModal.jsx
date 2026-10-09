import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { publicApi } from "../../api/publicApi";
import { useProductCategories } from "../../hooks/useSiteData";

export function HeaderSearchModal({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const categoriesQuery = useProductCategories();
  const categories = [...(categoriesQuery.data?.items || [])].sort(
    (a, b) => (b.productCount || 0) - (a.productCount || 0) || a.id.localeCompare(b.id)
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Live search debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await publicApi.getProducts({ search: query, limit: 6 });
        setResults(data.items || []);
      } catch (err) {
        console.error("Failed to fetch search results", err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/san-pham?search=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };

  return createPortal(
    <div className="header-search-modal-overlay" onClick={onClose}>
      <div
        className="header-search-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="header-search-modal-form" onSubmit={handleSubmit}>
          <div className="header-search-field">
            <span className="header-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              enterKeyHint="search"
              className="header-search-input"
              placeholder="Tìm sản phẩm, phù điêu, hoa văn..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="header-search-clear"
                onClick={() => setQuery("")}
                aria-label="Xóa từ khóa"
              >
                ×
              </button>
            )}
          </div>
          <button type="submit" className="button button--primary header-search-submit">
            Tìm kiếm
          </button>
          <button
            type="button"
            className="header-search-close"
            onClick={onClose}
            aria-label="Đóng tìm kiếm"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </form>

        {/* Live Search Results Suggestion */}
        <div className="header-search-results-panel">
          {isLoading ? (
            <div className="header-search-loading">Đang tìm kiếm sản phẩm...</div>
          ) : results.length > 0 ? (
            <div className="header-search-results-list">
              <span className="header-search-section-label">
                Gợi ý sản phẩm ({results.length})
              </span>
              {results.map((product) => (
                <Link
                  key={product.id}
                  to={`/san-pham/${product.slug}`}
                  className="header-search-item"
                  onClick={onClose}
                >
                  <img
                    src={product.thumbnail || product.images?.[0]?.url}
                    alt={product.name}
                    className="header-search-item-thumb"
                  />
                  <div className="header-search-item-info">
                    <span className="header-search-item-cat">
                      {product.category?.name || "Điêu khắc"}
                    </span>
                    <strong className="header-search-item-name">{product.name}</strong>
                    <small className="header-search-item-mat">
                      Chất liệu: {product.material || "Cao cấp"}
                    </small>
                  </div>
                  <span className="header-search-item-arrow">→</span>
                </Link>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="header-search-empty">
              Không tìm thấy sản phẩm trùng khớp với "{query}"
            </div>
          ) : (
            categories.length > 0 && (
              <div className="header-search-popular">
                <span className="header-search-section-label">Danh mục sản phẩm</span>
                <div className="header-search-tags">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      to={`/san-pham?categoryId=${category.id}`}
                      className="header-search-tag-chip"
                      onClick={onClose}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

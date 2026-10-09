import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { publicApi } from "../api/publicApi";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { Seo } from "../components/common/Seo";
import { ProductCard } from "../components/product/ProductCard";
import { useProductCategories } from "../hooks/useSiteData";

const getCategoryIcon = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.includes("cột") || lower.includes("đấu")) return "🏛️";
  if (lower.includes("phù điêu") || lower.includes("hoa văn")) return "⚜️";
  if (lower.includes("phào") || lower.includes("chỉ")) return "🪟";
  if (lower.includes("tượng")) return "🗿";
  if (lower.includes("con tiện") || lower.includes("lục bình")) return "🏺";
  if (lower.includes("trần") || lower.includes("mâm")) return "☸️";
  if (lower.includes("góc") || lower.includes("con bọ")) return "📐";
  return "🏛️";
};

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriesQuery = useProductCategories();
  const loadMoreRef = useRef(null);
  const modalCloseRef = useRef(null);
  const viewMode = "grid";

  const filters = {
    search: searchParams.get("search") || "",
    categoryId: searchParams.get("categoryId") || "",
  };

  // Local search state to prevent focus loss during rapid typing
  const [searchInput, setSearchInput] = useState(filters.search);

  // Sync internal state when URL changes externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [slotEl, setSlotEl] = useState(() =>
    typeof document !== "undefined" ? document.getElementById("floating-page-slot") : null
  );

  useEffect(() => {
    if (!slotEl && typeof document !== "undefined") {
      const el = document.getElementById("floating-page-slot");
      if (el) setSlotEl(el);
    }
  }, [slotEl]);

  // Global hotkey Ctrl+K to toggle filter & search modal
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFilterModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Focus a non-input control so opening categories does not raise the mobile keyboard.
  useEffect(() => {
    if (filterModalOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        modalCloseRef.current?.focus({ preventScroll: true });
      }, 100);
      const handleKeyDown = (e) => {
        if (e.key === "Escape") setFilterModalOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
    document.body.style.overflow = "";
  }, [filterModalOpen]);

  const updateFilters = (next) => {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  // Debounced search to avoid triggering reload / unmount on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        updateFilters({ ...filters, search: searchInput });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const productsQuery = useInfiniteQuery({
    queryKey: ["public-products", filters, "category-popularity"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      publicApi.getProducts({ ...filters, sort: "category-popularity", page: pageParam, limit: 36 }),
    placeholderData: (previousData) => previousData,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination;
      if (!pagination || pagination.currentPage >= pagination.totalPages) {
        return undefined;
      }
      return pagination.currentPage + 1;
    },
  });

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !productsQuery.hasNextPage) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !productsQuery.isFetchingNextPage) {
          productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    productsQuery.fetchNextPage,
    productsQuery.hasNextPage,
    productsQuery.isFetchingNextPage,
  ]);

  const pages = productsQuery.data?.pages || [];
  const products = pages.flatMap((page) => page.items || []);
  const categories = useMemo(() => [...(categoriesQuery.data?.items || [])].sort(
    (a, b) => (b.productCount || 0) - (a.productCount || 0) || a.id.localeCompare(b.id)
  ), [categoriesQuery.data]);
  const totalItems = pages[0]?.pagination?.totalItems || products.length;

  const activeCategory = categories.find((cat) => cat.id === filters.categoryId);
  const hasActiveFilter = Boolean(filters.categoryId || filters.search);
  const activeFilterCount = (filters.categoryId ? 1 : 0) + (filters.search ? 1 : 0);

  const displayProducts = products;

  // Group products by Category/Model when viewing all items without a search query
  const isBrowsingAll = !filters.categoryId && !filters.search;
  const groupedProducts = useMemo(() => {
    if (!isBrowsingAll) return null;
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, { category: cat, items: [] });
    }
    const unclassified = [];
    for (const prod of displayProducts) {
      const catId = prod.categoryId || prod.category?.id;
      if (catId && map.has(catId)) {
        map.get(catId).items.push(prod);
      } else {
        unclassified.push(prod);
      }
    }
    const groups = Array.from(map.values()).filter((g) => g.items.length > 0);
    if (unclassified.length > 0) {
      groups.push({
        category: { id: "other", name: "Sản phẩm khác", slug: "other" },
        items: unclassified,
      });
    }
    return groups;
  }, [isBrowsingAll, categories, displayProducts]);

  // Initial full-page loading only when there is zero data
  if (categoriesQuery.isLoading && !categoriesQuery.data) {
    return <LoadingScreen />;
  }

  if (productsQuery.isLoading && !productsQuery.data) {
    return <LoadingScreen />;
  }

  if (productsQuery.isError) {
    return <ErrorState />;
  }

  const gridClassName = "card-grid--full-width";

  return (
    <>
      <Seo
        title="Sản phẩm điêu khắc & hoa văn | Điêu Khắc Xuân Trường"
        description="Danh mục sản phẩm điêu khắc thạch cao, bê tông mỹ thuật, phù điêu, tượng và hoa văn công trình theo từng danh mục và kích thước quy cách."
      />

      <section className="section section--catalog-compact">
        <div className="container container--wide">
          {/* Active Filter Bar (Chỉ hiển thị khi đang lọc hoặc tìm kiếm) */}
          {hasActiveFilter ? (
            <div className="catalog-active-filter-bar">
              <div className="catalog-active-filter-chips">
                <span className="active-filter-label">Đang lọc:</span>
                {filters.categoryId && activeCategory ? (
                  <span className="active-chip">
                    <span>{getCategoryIcon(activeCategory.name)} {activeCategory.name}</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ ...filters, categoryId: "" })}
                      title="Bỏ lọc danh mục"
                      aria-label="Bỏ chọn danh mục"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
                {filters.search ? (
                  <span className="active-chip">
                    <span>🔍 "{filters.search}"</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        updateFilters({ ...filters, search: "" });
                      }}
                      title="Xóa từ khóa"
                      aria-label="Xóa từ khóa tìm kiếm"
                    >
                      ✕
                    </button>
                  </span>
                ) : null}
              </div>
              <div className="catalog-active-filter-actions">
                <span className="active-filter-count">
                  Hiển thị <strong>{displayProducts.length}</strong> sản phẩm
                </span>
                <button
                  type="button"
                  className="active-filter-edit-btn"
                  onClick={() => setFilterModalOpen(true)}
                >
                  ⚙️ Đổi bộ lọc
                </button>
                <button
                  type="button"
                  className="active-filter-clear-all"
                  onClick={() => {
                    setSearchInput("");
                    updateFilters({ categoryId: "", search: "" });
                  }}
                >
                  ✕ Bỏ lọc
                </button>
              </div>
            </div>
          ) : null}

          {/* Full Width Catalog Product List */}
          <div className="catalog-full-content">
            {productsQuery.isFetching && !productsQuery.isFetchingNextPage ? (
              <p className="list-status" aria-live="polite">
                Đang cập nhật danh sách sản phẩm...
              </p>
            ) : null}

            {/* Product List Render: Grouped by Category OR Filtered Grid */}
            {displayProducts.length ? (
              isBrowsingAll && groupedProducts && groupedProducts.length ? (
                /* Grouped by Category View */
                <div className="catalog-grouped-sections">
                  {groupedProducts.map((group) => (
                    <div key={group.category.id} className="catalog-category-block">
                      <div className="catalog-category-block__header">
                        <div className="catalog-category-block__title-area">
                          <h2 className="catalog-category-block__title">
                            {group.category.name}
                          </h2>
                          {group.category.id !== "other" && (
                            <button
                              type="button"
                              className="catalog-category-block__filter-link"
                              onClick={() => updateFilters({ ...filters, categoryId: group.category.id })}
                            >
                              Xem riêng {group.category.name} →
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={gridClassName}>
                        {group.items.map((product, index) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            delay={index * 0.015}
                            viewMode={viewMode === "list" ? "list" : "grid"}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Filtered or Single-Category List */
                <div className={gridClassName}>
                  {displayProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      delay={index * 0.015}
                      viewMode={viewMode === "list" ? "list" : "grid"}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="catalog-empty-block">
                <EmptyState
                  title="Không tìm thấy sản phẩm phù hợp"
                  message="Không có mẫu nào khớp với bộ lọc hoặc kích thước đã chọn. Quý khách có thể bấm nút bên dưới để xem toàn bộ sản phẩm của xưởng."
                />
                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({ categoryId: "", search: "" });
                    }}
                  >
                    ✕ Bỏ lọc để xem tất cả sản phẩm
                  </button>
                </div>
              </div>
            )}

            {products.length ? (
              <div className="catalog-more" ref={loadMoreRef}>
                {productsQuery.hasNextPage ? (
                  <>
                    <p>Cuộn tiếp để tải thêm sản phẩm.</p>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => productsQuery.fetchNextPage()}
                      disabled={productsQuery.isFetchingNextPage}
                    >
                      {productsQuery.isFetchingNextPage
                        ? "Đang tải..."
                        : "Tải thêm sản phẩm"}
                    </button>
                  </>
                ) : (
                  <p className="catalog-end">Đã hiển thị toàn bộ sản phẩm.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Floating Action Button (FAB) for Search & Filters - Grouped on the right side above Phone & Zalo */}
      {slotEl
        ? createPortal(
            <button
              type="button"
              className={`floating-btn catalog-filter-fab ${hasActiveFilter ? "is-filtered" : ""}`}
              onClick={() => setFilterModalOpen(true)}
              title="Lọc danh mục & tìm kiếm sản phẩm (Ctrl + K)"
              aria-label="Mở bộ lọc danh mục và tìm kiếm"
            >
              <span className="floating-btn__icon catalog-filter-fab__icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.5" y2="16.5" />
                </svg>
              </span>
              <span className="floating-btn__label">
                <small>TÌM KIẾM & LỌC</small>
                <strong>Bộ lọc sản phẩm</strong>
              </span>
              {hasActiveFilter ? (
                <span
                  className="catalog-filter-fab__badge"
                  aria-label={`${activeFilterCount} bộ lọc đang kích hoạt`}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>,
            slotEl
          )
        : null}

      {/* Unified Filter & Search Modal (Centered luxury modal on desktop/laptop, smooth bottom sheet on mobile) */}
      {filterModalOpen && (
        <div
          className="catalog-modal-root"
          role="dialog"
          aria-modal="true"
          aria-label="Bộ lọc và tìm kiếm sản phẩm"
        >
          <div
            className="catalog-modal__backdrop"
            onClick={() => setFilterModalOpen(false)}
          />
          <div className="catalog-modal__dialog">
            {/* Mobile drag handle */}
            <div className="catalog-modal__drag-handle" />

            {/* Header */}
            <div className="catalog-modal__header">
              <div className="catalog-modal__header-titles">
                <h3 className="catalog-modal__title">
                  🏛️ Tìm kiếm sản phẩm
                </h3>
                <p className="catalog-modal__subtitle">
                  Chọn danh mục hoặc tìm theo tên, kích thước sản phẩm
                </p>
              </div>
              <button
                type="button"
                className="catalog-modal__close-btn"
                ref={modalCloseRef}
                onClick={() => setFilterModalOpen(false)}
                aria-label="Đóng bộ lọc"
                title="Đóng (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="catalog-modal__body">
              {/* Categories come first; the list scrolls independently on small screens. */}
              <div className="catalog-modal__section">
                <div className="modal-section-head">
                  <span className="modal-section-label">🏛️ Danh mục sản phẩm</span>
                  {filters.categoryId ? (
                    <button
                      type="button"
                      className="modal-section-action-btn"
                      onClick={() => updateFilters({ ...filters, categoryId: "" })}
                    >
                      Xem tất cả danh mục
                    </button>
                  ) : (
                    <span className="modal-section-hint">Tất cả {categories.length} danh mục</span>
                  )}
                </div>

                <div className="modal-categories-grid">
                  <button
                    type="button"
                    className={`modal-category-card ${!filters.categoryId ? "active" : ""}`}
                    onClick={() => updateFilters({ ...filters, categoryId: "" })}
                  >
                    <div className="modal-category-card__left">
                      <span className="modal-category-card__icon">✨</span>
                      <div className="modal-category-card__text">
                        <span className="modal-category-card__name">Tất cả danh mục</span>
                        <span className="modal-category-card__count">Xem toàn bộ sản phẩm</span>
                      </div>
                    </div>
                    <span className="modal-category-card__check">
                      {!filters.categoryId ? "✓" : ""}
                    </span>
                  </button>

                  {categories.map((cat) => {
                    const isSelected = filters.categoryId === cat.id;
                    const count = cat.productCount || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`modal-category-card ${isSelected ? "active" : ""} ${count === 0 ? "modal-category-card--empty" : ""}`}
                        onClick={() => updateFilters({ ...filters, categoryId: isSelected ? "" : cat.id })}
                      >
                        <div className="modal-category-card__left">
                          <span className="modal-category-card__icon">{getCategoryIcon(cat.name)}</span>
                          <div className="modal-category-card__text">
                            <span className="modal-category-card__name">{cat.name}</span>
                            <span className={`modal-category-card__count ${count > 0 ? "has-items" : "no-items"}`}>
                              {count > 0 ? `${count} mẫu sẵn có` : "Đang cập nhật mẫu"}
                            </span>
                          </div>
                        </div>
                        <span className="modal-category-card__check">
                          {isSelected ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="catalog-modal__section">
                <label className="modal-section-label" htmlFor="catalog-modal-search">
                  🔍 Tìm kiếm theo tên hoặc kích thước
                </label>
                <div className="modal-search-box">
                  <span className="modal-search-box__icon">🔍</span>
                  <input
                    id="catalog-modal-search"
                    type="text"
                    className="modal-search-box__input"
                    placeholder="Vd: 60x85, D40, đầu cột, phù điêu..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      className="modal-search-box__clear"
                      onClick={() => {
                        setSearchInput("");
                        updateFilters({ ...filters, search: "" });
                      }}
                      aria-label="Xóa từ khóa"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {searchInput ? (
                  <div className="modal-live-match-indicator" aria-live="polite">
                    <span className="modal-live-match-text">
                      {productsQuery.isFetching || searchInput !== filters.search
                        ? "Đang tìm kiếm..."
                        : `Tìm thấy ${totalItems} sản phẩm phù hợp`}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer */}
            <div className="catalog-modal__footer">
              {hasActiveFilter ? (
                <button
                  type="button"
                  className="modal-footer__clear-btn"
                  onClick={() => {
                    setSearchInput("");
                    updateFilters({ categoryId: "", search: "" });
                  }}
                >
                  ✕ Bỏ tất cả lọc
                </button>
              ) : (
                <span className="modal-footer__status">
                  Đang hiển thị {displayProducts.length} sản phẩm
                </span>
              )}

              <button
                type="button"
                className="modal-footer__apply-btn"
                onClick={() => setFilterModalOpen(false)}
              >
                Xem kết quả ({totalItems} sản phẩm) →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

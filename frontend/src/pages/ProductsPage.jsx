import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { publicApi } from "../api/publicApi";
import { EmptyState } from "../components/common/EmptyState";
import { HeaderSearchModal } from "../components/common/HeaderSearchModal";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { Seo } from "../components/common/Seo";
import { CatalogCategorySelect } from "../components/product/CatalogCategorySelect";
import { ProductCard } from "../components/product/ProductCard";
import { useProductCategories } from "../hooks/useSiteData";

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriesQuery = useProductCategories();
  const loadMoreRef = useRef(null);
  const viewMode = "grid";

  const filters = {
    search: searchParams.get("search") || "",
    categoryId: searchParams.get("categoryId") || "",
  };

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

  const updateFilters = (next) => {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  // Picking a category applies it right away and shows the products, no extra confirm step.
  const selectCategory = (categoryId) => {
    updateFilters({ ...filters, categoryId });
    window.scrollTo({ top: 0 });
  };

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
  const alphabeticalCategories = useMemo(() => [...categories].sort(
    (a, b) => (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base", numeric: true })
  ), [categories]);
  const totalItems = pages[0]?.pagination?.totalItems || products.length;
  const totalCatalogProducts = categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0);

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
          {/* Compact sticky toolbar: category dropdown + active keyword, kept slim for small screens */}
          <div className="catalog-toolbar">
            <CatalogCategorySelect
              categories={alphabeticalCategories}
              activeCategoryId={filters.categoryId}
              totalProducts={totalCatalogProducts}
              onSelect={selectCategory}
            />
            {filters.search ? (
              <span className="catalog-toolbar__chip">
                <span className="catalog-toolbar__chip-text">"{filters.search}"</span>
                <button
                  type="button"
                  onClick={() => {
                    updateFilters({ ...filters, search: "" });
                  }}
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  ×
                </button>
              </span>
            ) : null}
            {hasActiveFilter ? (
              <span className="catalog-toolbar__count">
                <strong>{totalItems}</strong> sản phẩm
              </span>
            ) : null}
          </div>

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
                            {group.category.id !== "other" ? (
                              <button
                                type="button"
                                className="catalog-category-block__title-btn"
                                onClick={() => selectCategory(group.category.id)}
                                title={`Xem sản phẩm ${group.category.name}`}
                              >
                                {group.category.name}
                              </button>
                            ) : (
                              group.category.name
                            )}
                          </h2>
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

      {/* Same search popup as the header search button */}
      <HeaderSearchModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        activeCategoryId={filters.categoryId}
      />
    </>
  );
}

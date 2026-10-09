import { useEffect, useMemo, useRef, useState } from "react";

const normalize = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

// Compact dropdown to pick a product category, with a quick name filter inside.
export function CatalogCategorySelect({ categories, activeCategoryId, totalProducts, onSelect }) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const activeCategory = categories.find((cat) => cat.id === activeCategoryId);

  const visibleCategories = useMemo(() => {
    const term = normalize(keyword);
    if (!term) return categories;
    return categories.filter((cat) => normalize(cat.name).includes(term));
  }, [categories, keyword]);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      return undefined;
    }

    // Only autofocus with a mouse so the phone keyboard does not cover the list.
    if (window.matchMedia?.("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }

    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (categoryId) => {
    setOpen(false);
    onSelect(categoryId);
  };

  return (
    <div className={`catalog-cat-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="catalog-cat-select__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="catalog-cat-select__label">Danh mục</span>
        <span className="catalog-cat-select__value">
          {activeCategory ? activeCategory.name : "Tất cả sản phẩm"}
        </span>
        <svg className="catalog-cat-select__caret" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="catalog-cat-select__panel">
          <div className="catalog-cat-select__search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              placeholder="Tìm danh mục..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm danh mục"
            />
          </div>

          <ul className="catalog-cat-select__list" role="listbox">
            {!keyword ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeCategoryId}
                  className={`catalog-cat-select__option ${!activeCategoryId ? "is-active" : ""}`}
                  onClick={() => handleSelect("")}
                >
                  <span>Tất cả sản phẩm</span>
                  <small>{totalProducts}</small>
                </button>
              </li>
            ) : null}
            {visibleCategories.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`catalog-cat-select__option ${isActive ? "is-active" : ""}`}
                    onClick={() => handleSelect(cat.id)}
                  >
                    <span>{cat.name}</span>
                    <small>{cat.productCount || 0}</small>
                  </button>
                </li>
              );
            })}
            {keyword && !visibleCategories.length ? (
              <li className="catalog-cat-select__empty">Không có danh mục "{keyword}"</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

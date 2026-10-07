import { createHash } from 'node:crypto';

export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[×*]/g, 'x').replace(/(\d)\s*x\s*(?=\d)/g, '$1x')
    .replace(/\s+/g, ' ').trim();
}

export function planCategory(name, categories, mappings = {}, allowNew = false) {
  const resolved = resolveCategory(name, categories, mappings);
  if (resolved.category) return { ...resolved, action: 'REUSE' };
  const key = normalize(name);
  if (!allowNew || mappings[key] || categories.some((item) => item.type === 'PRODUCT' && normalize(item.name) === key)) return resolved;
  const cleanName = String(name || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  // Keep uncertain abbreviations/legacy-font text for human review.
  if (!/^[\p{L} ]{3,80}$/u.test(cleanName) || /[¸µ¶·¹¨©ª«¬®Ð]/.test(cleanName)
    || /\b(?:ph|b|d|r|m)\b/.test(key)) return { error: 'Tên danh mục thiếu, viết tắt hoặc lỗi chữ; cần sửa rõ trước khi tạo.' };
  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || categories.some((item) => item.slug === slug)) return { error: 'Slug danh mục đã được dùng; cần đối chiếu thủ công.' };
  return { action: 'CREATE', category: {
    _id: createHash('sha256').update(`catalogue-category:PRODUCT:${key}`).digest('hex').slice(0, 24),
    type: 'PRODUCT', name: cleanName, slug
  } };
}

export function resolveCategory(name, categories, mappings = {}) {
  const key = normalize(name);
  const explicit = mappings[key];
  const found = categories.filter((category) => category.type === 'PRODUCT'
    && (explicit ? String(category._id) === explicit : normalize(category.name) === key));
  return found.length === 1 ? { category: found[0] }
    : { error: found.length ? 'Nhiều danh mục trùng tên; cần chọn ID.' : 'Chưa đối chiếu được danh mục có sẵn.' };
}

export function validateEntry(entry) {
  const errors = [];
  if (entry.approved !== true) errors.push('Chưa duyệt ảnh, tên và kích thước.');
  if (!Number.isInteger(entry.number) || entry.number < 1) errors.push('STT không hợp lệ.');
  if (typeof entry.categoryName !== 'string' || !entry.categoryName.trim()) errors.push('Thiếu danh mục.');
  if (typeof entry.dimensions !== 'string' || !/\d/.test(entry.dimensions)) errors.push('Thiếu kích thước.');
  if (/[<>]/.test(`${entry.categoryName || ''} ${entry.dimensions || ''}`)) errors.push('Nội dung không hợp lệ.');
  if (/\d[\d\s]*[.,]\s*\d\s*\d\s*\d|₫|vn[dđ]|\bgiá\b/i.test(`${entry.categoryName || ''} ${entry.dimensions || ''}`)) errors.push('Có chuỗi giống giá tiền; phải xác nhận và loại bỏ.');
  if (!Array.isArray(entry.images) || !entry.images.length) errors.push('Thiếu ảnh.');
  for (const image of entry.images || []) {
    if (!/^[a-f0-9]{64}$/.test(image.sha256 || '') || !/^images\/[a-zA-Z0-9_-]+\.webp$/.test(image.file || '')) errors.push('Đường dẫn hoặc mã kiểm tra ảnh không hợp lệ.');
  }
  return errors;
}

export function classifyItem(entry, category, products, slug) {
  const sameCategory = (product) => String(product.categoryId) === String(category._id);
  const sameSize = (product) => normalize(product.dimensions) === normalize(entry.dimensions);
  const imported = products.find((product) => product.slug === slug);
  if (imported) return sameCategory(imported) && sameSize(imported)
    ? { action: 'SKIP_IMPORTED', productId: String(imported._id) }
    : { action: 'REVIEW_CONFLICT', reason: 'Slug nhập trước đã có nhưng danh mục hoặc kích thước thay đổi.' };
  if (entry.existingProductId) {
    const existing = products.find((product) => String(product._id) === entry.existingProductId);
    if (!existing || !sameCategory(existing)) return { action: 'REVIEW_CONFLICT', reason: 'Sản phẩm chỉ định không tồn tại hoặc khác danh mục.' };
    // Never silently replace or merge dimensions on an existing product.
    return sameSize(existing) ? { action: 'SKIP_EXISTING', productId: String(existing._id) }
      : { action: 'REVIEW_CONFLICT', reason: 'Sản phẩm có sẵn khác kích thước; không tự ghi đè.' };
  }
  const baseName = normalize(`${category.name} ${entry.dimensions}`);
  const legacyName = (product) => normalize(String(product.name || '').replace(/^\s*\d+\s*[-–—]\s*/, ''));
  const legacyNumber = (product) => Number(String(product.name || '').match(/^\s*(\d+)\s*[-–—]/)?.[1]);
  const candidates = products.filter((product) => legacyName(product) === normalize(`${entry.categoryName} ${entry.dimensions}`)
    || legacyNumber(product) === entry.number
    || (sameCategory(product)
    && (sameSize(product) || String(product.dimensions || '').split(/[\n,;|]+/).some((size) => normalize(size) === normalize(entry.dimensions))
      || normalize(product.name) === baseName)));
  if (candidates.length) return { action: 'REVIEW_DUPLICATE', candidateIds: candidates.map((product) => String(product._id)), reason: 'Có sản phẩm cùng danh mục/quy cách; cần so ảnh trước khi nhập.' };
  return { action: 'CREATE' };
}

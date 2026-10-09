import { Category, Product, ProductImage } from "../models/index.js";
import { ApiError } from "../utils/apiError.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";
import { ensureUniqueSlug } from "../utils/slug.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitize.js";
import { escapeRegex } from "../utils/query.js";

const normalizeImages = (images = []) => {
  const normalized = images.map((image, index) => ({
    url: image.url,
    key: image.key || null,
    altText: sanitizePlainText(image.altText || ""),
    sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : index,
    isPrimary: Boolean(image.isPrimary)
  }));

  if (normalized.length && !normalized.some((image) => image.isPrimary)) {
    normalized[0].isPrimary = true;
  }

  return normalized;
};

const normalizeDimensions = (dimensions) => {
  if (Array.isArray(dimensions)) {
    return dimensions
      .map((item) => sanitizePlainText(item || ""))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof dimensions !== "string") {
    return "";
  }

  return dimensions
    .split(/[\n,;|]+/)
    .map((item) => sanitizePlainText(item || ""))
    .filter(Boolean)
    .join("\n");
};

const mapById = (items = []) =>
  items.reduce((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});

const attachRelations = async (products) => {
  if (!products.length) {
    return [];
  }

  const productDocs = products.map((product) => product.toJSON());
  const productIds = products.map((product) => product._id);
  const categoryIds = [...new Set(productDocs.map((product) => product.categoryId?.toString()).filter(Boolean))];

  const [categories, images] = await Promise.all([
    Category.find({ _id: { $in: categoryIds } }),
    ProductImage.find({ productId: { $in: productIds } }).sort({ sortOrder: 1, createdAt: 1 })
  ]);

  const categoryMap = mapById(categories.map((item) => item.toJSON()));
  const imageMap = images.reduce((accumulator, image) => {
    const serialized = image.toJSON();
    const key = serialized.productId.toString();
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(serialized);
    return accumulator;
  }, {});

  return productDocs.map((product) => {
    const relatedImages = imageMap[product.id] || [];
    return {
      ...product,
      category: product.categoryId ? categoryMap[product.categoryId.toString()] || null : null,
      images: relatedImages,
      thumbnail: relatedImages.find((image) => image.isPrimary)?.url || relatedImages[0]?.url || null
    };
  });
};

const buildWhere = async (query = {}, publicOnly = false) => {
  const where = {};
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }
  if (query.search) {
    let searchPattern = escapeRegex(query.search.trim());
    // Allow flexible spacing around dimension separators like 60x85 <-> 60 x 85
    searchPattern = searchPattern.replace(/(\d+)\s*[xX*]\s*(\d+)/g, "$1\\s*[xX*]\\s*$2");
    // Allow matching across varied whitespace
    searchPattern = searchPattern.replace(/\s+/g, "\\s+");

    const searchRegex = new RegExp(searchPattern, "i");
    const matchedCategories = await Category.find({ name: searchRegex }).select("_id");
    const matchedCatIds = matchedCategories.map((c) => c._id);

    const orClauses = [
      { name: searchRegex },
      { shortDescription: searchRegex },
      { material: searchRegex },
      { dimensions: searchRegex },
      { tags: searchRegex }
    ];

    if (matchedCatIds.length) {
      orClauses.push({ categoryId: { $in: matchedCatIds } });
    }

    where.$or = orClauses;
  }
  if (query.featured === "true" || query.featured === true) {
    where.isFeatured = true;
  }
  if (publicOnly) {
    where.isVisible = true;
  }
  return where;
};

export const getProducts = async (query = {}, publicOnly = false) => {
  const { page, limit, offset } = getPagination(query.page, query.limit || 9);
  const where = await buildWhere(query, publicOnly);
  // Opt-in for the catalogue only. Rank all visible categories before pagination,
  // otherwise a popular category can remain hidden until a later page loads.
  let rowsQuery;
  if (publicOnly && query.sort === "category-popularity" && !query.categoryId && !query.search && !query.featured) {
    const rankedCategories = await Product.aggregate([
      { $match: { isVisible: true } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]);
    rowsQuery = Product.aggregate([
      { $match: where },
      { $addFields: { categoryRank: { $indexOfArray: [rankedCategories.map(item => item._id), "$categoryId"] } } },
      { $sort: { categoryRank: 1, sortOrder: 1, createdAt: -1, _id: 1 } },
      { $skip: offset },
      { $limit: limit },
      { $unset: "categoryRank" }
    ]).then(items => items.map(item => Product.hydrate(item)));
  } else {
    rowsQuery = Product.find(where)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(offset)
      .limit(limit);
  }
  const [count, rows] = await Promise.all([
    Product.countDocuments(where),
    rowsQuery
  ]);
  const items = await attachRelations(rows);

  return {
    items,
    pagination: buildPaginationMeta(count, page, limit)
  };
};

export const getProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  const [serialized] = await attachRelations([product]);
  return serialized;
};

export const getProductBySlug = async (slug) => {
  const product = await Product.findOne({ slug, isVisible: true });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const [serialized] = await attachRelations([product]);
  const relatedProducts = await Product.find({
    categoryId: product.categoryId,
    isVisible: true,
    _id: { $ne: product._id }
  })
    .sort({ isFeatured: -1, sortOrder: 1, createdAt: -1 })
    .limit(24);

  return {
    ...serialized,
    relatedProducts: await attachRelations(relatedProducts)
  };
};

export const createProduct = async (payload) => {
  const slug = await ensureUniqueSlug(Product, payload.slug || payload.name);
  const product = await Product.create({
    ...payload,
    slug,
    name: sanitizePlainText(payload.name),
    shortDescription: sanitizePlainText(payload.shortDescription),
    content: sanitizeRichText(payload.content || ""),
    material: sanitizePlainText(payload.material || ""),
    dimensions: normalizeDimensions(payload.dimensions),
    tags: payload.tags || [],
    metaTitle: sanitizePlainText(payload.metaTitle || ""),
    metaDescription: sanitizePlainText(payload.metaDescription || "")
  });

  const images = normalizeImages(payload.images);
  if (images.length) {
    await ProductImage.insertMany(
      images.map((image) => ({
        ...image,
        productId: product._id
      }))
    );
  }

  return getProductById(product.id);
};

export const updateProduct = async (id, payload) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const slug = await ensureUniqueSlug(Product, payload.slug || payload.name, id);
  product.set({
    ...payload,
    slug,
    name: sanitizePlainText(payload.name),
    shortDescription: sanitizePlainText(payload.shortDescription),
    content: sanitizeRichText(payload.content || ""),
    material: sanitizePlainText(payload.material || ""),
    dimensions: normalizeDimensions(payload.dimensions),
    tags: payload.tags || [],
    metaTitle: sanitizePlainText(payload.metaTitle || ""),
    metaDescription: sanitizePlainText(payload.metaDescription || "")
  });
  await product.save();

  await ProductImage.deleteMany({ productId: product._id });
  const images = normalizeImages(payload.images);
  if (images.length) {
    await ProductImage.insertMany(
      images.map((image) => ({
        ...image,
        productId: product._id
      }))
    );
  }

  return getProductById(product.id);
};

export const deleteProduct = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  await ProductImage.deleteMany({ productId: product._id });
  await product.deleteOne();
};

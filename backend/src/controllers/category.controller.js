import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  mergeCategory,
  updateCategory
} from "../services/category.service.js";

export const listCategories = async (req, res) => {
  const data = await getCategories(req.query);
  res.json({ success: true, data });
};

export const getCategory = async (req, res) => {
  const data = await getCategoryById(req.params.id);
  res.json({ success: true, data });
};

export const storeCategory = async (req, res) => {
  const data = await createCategory(req.validated.body);
  res.status(201).json({ success: true, message: "Category created", data });
};

export const editCategory = async (req, res) => {
  const data = await updateCategory(req.params.id, req.validated.body);
  res.json({ success: true, message: "Category updated", data });
};

export const destroyCategory = async (req, res) => {
  await deleteCategory(req.params.id);
  res.json({ success: true, message: "Category deleted" });
};

export const mergeCategoryInto = async (req, res) => {
  const data = await mergeCategory(req.params.id, req.validated.body.targetId);
  res.json({ success: true, message: "Category merged", data });
};

import { Router } from "express";
import {
  destroyCategory,
  editCategory,
  getCategory,
  listCategories,
  mergeCategoryInto,
  storeCategory
} from "../controllers/category.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middlewares/validate.middleware.js";
import { categoryCreateSchema, categoryMergeSchema, categoryUpdateSchema } from "../validations/category.validation.js";

const router = Router();

router.get("/", asyncHandler(listCategories));
router.get("/:id", asyncHandler(getCategory));
router.post("/", validate(categoryCreateSchema), asyncHandler(storeCategory));
router.put("/:id", validate(categoryUpdateSchema), asyncHandler(editCategory));
router.post("/:id/merge", validate(categoryMergeSchema), asyncHandler(mergeCategoryInto));
router.delete("/:id", asyncHandler(destroyCategory));

export default router;

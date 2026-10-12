import { z } from "zod";
import { objectIdSchema } from "./common.validation.js";

const categoryBody = z.object({
  type: z.enum(["PRODUCT", "PROJECT"]),
  name: z.string().min(2),
  slug: z.string().optional().default(""),
  description: z.string().optional().default(""),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageKey: z.string().optional().nullable(),
  sortOrder: z.coerce.number().optional().default(0),
  isFeatured: z.coerce.boolean().optional().default(false),
  isVisible: z.coerce.boolean().optional().default(true)
});

export const categoryCreateSchema = z.object({
  body: categoryBody,
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

export const categoryUpdateSchema = z.object({
  body: categoryBody,
  params: z.object({
    id: objectIdSchema
  }),
  query: z.object({}).optional()
});

export const categoryMergeSchema = z.object({
  body: z.object({
    targetId: objectIdSchema
  }),
  params: z.object({
    id: objectIdSchema
  }),
  query: z.object({}).optional()
});

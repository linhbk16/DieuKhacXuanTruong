import client from "./client";

const unwrap = (response) => response.data.data;

export const adminApi = {
  login: async (payload) => unwrap(await client.post("/auth/login", payload)),
  me: async () => unwrap(await client.get("/auth/me")),
  getDashboard: async () => unwrap(await client.get("/admin/dashboard")),
  getBanners: async (params = {}) => unwrap(await client.get("/admin/banners", { params })),
  createBanner: async (payload) => unwrap(await client.post("/admin/banners", payload)),
  updateBanner: async (id, payload) => unwrap(await client.put(`/admin/banners/${id}`, payload)),
  reorderBanners: async (items) => unwrap(await client.patch("/admin/banners/reorder", { items })),
  deleteBanner: async (id) => unwrap(await client.delete(`/admin/banners/${id}`)),
  getCategories: async (params = {}) => unwrap(await client.get("/admin/categories", { params })),
  createCategory: async (payload) => unwrap(await client.post("/admin/categories", payload)),
  updateCategory: async (id, payload) => unwrap(await client.put(`/admin/categories/${id}`, payload)),
  deleteCategory: async (id) => unwrap(await client.delete(`/admin/categories/${id}`)),
  mergeCategory: async (id, targetId) => unwrap(await client.post(`/admin/categories/${id}/merge`, { targetId })),
  getProducts: async (params = {}) => unwrap(await client.get("/admin/products", { params })),
  getProduct: async (id) => unwrap(await client.get(`/admin/products/${id}`)),
  createProduct: async (payload) => unwrap(await client.post("/admin/products", payload)),
  updateProduct: async (id, payload) => unwrap(await client.put(`/admin/products/${id}`, payload)),
  deleteProduct: async (id) => unwrap(await client.delete(`/admin/products/${id}`)),
  getProjects: async (params = {}) => unwrap(await client.get("/admin/projects", { params })),
  getProject: async (id) => unwrap(await client.get(`/admin/projects/${id}`)),
  createProject: async (payload) => unwrap(await client.post("/admin/projects", payload)),
  updateProject: async (id, payload) => unwrap(await client.put(`/admin/projects/${id}`, payload)),
  deleteProject: async (id) => unwrap(await client.delete(`/admin/projects/${id}`)),
  getPages: async () => unwrap(await client.get("/admin/pages")),
  getPage: async (slug) => unwrap(await client.get(`/admin/pages/${slug}`)),
  updatePage: async (slug, payload) => unwrap(await client.put(`/admin/pages/${slug}`, payload)),
  getContacts: async (params = {}) => unwrap(await client.get("/admin/contacts", { params })),
  getContact: async (id) => unwrap(await client.get(`/admin/contacts/${id}`)),
  updateContactStatus: async (id, payload) =>
    unwrap(await client.patch(`/admin/contacts/${id}/status`, payload)),
  deleteContact: async (id) => unwrap(await client.delete(`/admin/contacts/${id}`)),
  getMedia: async (params = {}) => unwrap(await client.get("/admin/media", { params })),
  uploadMedia: async ({ files, folder }) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("folder", folder || "media");
    return unwrap(await client.post("/admin/media/upload", formData));
  },
  deleteMedia: async (id) => unwrap(await client.delete(`/admin/media/${id}`)),
  getSettings: async () => unwrap(await client.get("/admin/settings")),
  updateSettings: async (payload) => unwrap(await client.put("/admin/settings", payload))
};

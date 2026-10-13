import client from "./client";

const unwrap = (response) => response.data.data;

export const publicApi = {
  getHome: async () => unwrap(await client.get("/public/home")),
  getAbout: async () => unwrap(await client.get("/public/about")),
  getSettings: async () => unwrap(await client.get("/public/settings")),
  getCategories: async (params = {}) => unwrap(await client.get("/public/categories", { params })),
  getProducts: async (params = {}) => unwrap(await client.get("/public/products", { params })),
  getProductDetail: async (slug) => unwrap(await client.get(`/public/products/${slug}`)),
  getProjects: async (params = {}) => unwrap(await client.get("/public/projects", { params })),
  getProjectDetail: async (slug) => unwrap(await client.get(`/public/projects/${slug}`)),
  createContact: async (payload) => unwrap(await client.post("/public/contacts", payload))
};

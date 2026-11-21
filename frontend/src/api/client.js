import axios from "axios";
import { normalizeCloudinaryImages } from "../utils/cloudinaryImages.js";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
});

client.interceptors.response.use(
  (response) => {
    response.data = normalizeCloudinaryImages(response.data);
    return response;
  },
  (error) => Promise.reject(error.response?.data || error)
);

export default client;

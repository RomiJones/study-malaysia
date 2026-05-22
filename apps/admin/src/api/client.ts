import axios from "axios";

const resolvedBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "/api";

export const http = axios.create({
  baseURL: resolvedBaseUrl
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("studymy-admin-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export async function unwrap(promise: Promise<any>): Promise<any> {
  const response = await promise;
  return response.data.data;
}
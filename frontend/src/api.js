import axios from "axios";
import { translate } from "./i18n/index.jsx";

// Local dev: "/api" is proxied to the backend by Vite.
// Deployed: set VITE_API_URL (e.g. https://docyard-api.onrender.com/api) when building the frontend.
const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("docyard_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Absolute URL to an API path - used for public share links.
export const apiUrl = (path) =>
  /^https?:\/\//.test(API_BASE) ? `${API_BASE}${path}` : `${window.location.origin}${API_BASE}${path}`;

// The server sends a `code` with every error; we show it in the user's current language.
export function getErrorMessage(err) {
  const data = err?.response?.data;
  if (data?.code) {
    const key = `err.${data.code}`;
    const msg = translate(key);
    if (msg !== key) return msg;
  }
  return data?.error || translate("err.generic");
}

// For requests made with responseType "blob" (preview/download), the error body arrives as a Blob.
export async function getErrorMessageAsync(err) {
  const data = err?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      return getErrorMessage({ response: { data: JSON.parse(await data.text()) } });
    } catch {
      /* not JSON - fall through */
    }
  }
  return getErrorMessage(err);
}

export default api;

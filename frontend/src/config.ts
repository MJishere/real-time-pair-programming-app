const apiUrl = import.meta.env.VITE_API_URL || "";
export const API_URL = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

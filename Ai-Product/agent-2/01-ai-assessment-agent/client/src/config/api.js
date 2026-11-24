// Where this product's server is. Same origin by default (the server also serves this client);
// set VITE_API_BASE (ending in /api) to point a build at another server.
export const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");

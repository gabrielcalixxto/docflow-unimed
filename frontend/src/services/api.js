import axios from "axios";

const TOKEN_STORAGE_KEY = "docflow_access_token";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  timeout: 15000,
});

function normalizeError(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : error.message || "Falha de comunicacao com o backend.";
    const normalized = new Error(message);
    normalized.status = status;
    return normalized;
  }

  return new Error("Erro inesperado.");
}

function authHeaders() {
  const token = getStoredToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function request(config, withAuth = true) {
  try {
    const response = await http.request({
      ...config,
      headers: {
        ...(config.headers || {}),
        ...(withAuth ? authHeaders() : {}),
      },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function login(credentials) {
  return request(
    {
      method: "post",
      url: "/auth/login",
      data: credentials,
    },
    false,
  );
}

export async function searchDocuments() {
  return request({
    method: "get",
    url: "/documents/search",
  });
}

export async function getDocuments() {
  return request({
    method: "get",
    url: "/documents",
  });
}

export async function getDocument(documentId) {
  return request({
    method: "get",
    url: `/documents/${documentId}`,
  });
}

export async function getDocumentVersions(documentId) {
  return request({
    method: "get",
    url: `/documents/${documentId}/versions`,
  });
}

export async function createDocument(payload) {
  return request({
    method: "post",
    url: "/documents",
    data: payload,
  });
}

export async function getDocumentFormOptions() {
  return request({
    method: "get",
    url: "/documents/form-options",
  });
}

export async function createVersion(documentId, payload) {
  return request({
    method: "post",
    url: `/documents/${documentId}/versions`,
    data: payload,
  });
}

export async function submitForReview(documentId) {
  return request({
    method: "post",
    url: `/documents/${documentId}/submit-review`,
  });
}

export async function approveDocument(documentId) {
  return request({
    method: "post",
    url: `/documents/${documentId}/approve`,
  });
}

export async function rejectDocument(documentId, payload = {}) {
  return request({
    method: "post",
    url: `/documents/${documentId}/reject`,
    data: payload,
  });
}

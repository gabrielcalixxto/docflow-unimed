import axios from "axios";

const TOKEN_STORAGE_KEY = "docflow_access_token";
const API_BASE_URL = "http://localhost:8000";

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});
let unauthorizedListener = null;
let globalErrorListener = null;
let lastGlobalErrorMessage = "";
let lastGlobalErrorAt = 0;
const GLOBAL_ERROR_DEDUP_WINDOW_MS = 700;

function notifyUnauthorized(status) {
  if (typeof unauthorizedListener === "function") {
    unauthorizedListener(status);
  }
}

function notifyGlobalError(error) {
  if (typeof globalErrorListener !== "function") {
    return;
  }
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  const now = Date.now();
  if (message && message === lastGlobalErrorMessage && now - lastGlobalErrorAt < GLOBAL_ERROR_DEDUP_WINDOW_MS) {
    return;
  }
  lastGlobalErrorMessage = message;
  lastGlobalErrorAt = now;
  if (typeof globalErrorListener === "function") {
    globalErrorListener(error);
  }
}

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
    const normalizedError = normalizeError(error);
    if (withAuth && (normalizedError.status === 401 || normalizedError.status === 403)) {
      notifyUnauthorized(normalizedError.status);
    }
    notifyGlobalError(normalizedError);
    throw normalizedError;
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

export function setUnauthorizedListener(listener) {
  unauthorizedListener = typeof listener === "function" ? listener : null;
}

export function setGlobalErrorListener(listener) {
  globalErrorListener = typeof listener === "function" ? listener : null;
}

export function showGlobalError(message) {
  const text = String(message || "").trim() || "Nao foi possivel concluir a operacao.";
  notifyGlobalError(new Error(text));
}

export function resolveApiFileUrl(path, { download = false } = {}) {
  if (!path) {
    return "";
  }
  const value = String(path).trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (download) {
      url.searchParams.set("download", "1");
    }
    return url.toString();
  }
  if (!value.startsWith("/")) {
    return "";
  }

  const url = new URL(`${API_BASE_URL}${value}`);
  if (value.startsWith("/file-storage/")) {
    const token = getStoredToken();
    if (token) {
      url.searchParams.set("token", token);
    }
  }
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
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

export async function refreshSession() {
  return request({
    method: "post",
    url: "/auth/refresh",
  });
}

export async function searchDocuments() {
  return request({
    method: "get",
    url: "/documents/search",
  });
}

export async function getWorkflowDocuments(params = {}) {
  return request({
    method: "get",
    url: "/documents/workflow",
    params,
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

export async function getDocumentEvents(documentId, params = {}) {
  return request({
    method: "get",
    url: `/documents/${documentId}/events`,
    params,
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

export async function uploadDocumentFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request({
    method: "post",
    url: "/file-storage/upload",
    data: formData,
  });
}

export async function updateDraftDocument(documentId, payload) {
  return request({
    method: "patch",
    url: `/documents/${documentId}/draft`,
    data: payload,
  });
}

export async function deleteDraftDocument(documentId) {
  return request({
    method: "delete",
    url: `/documents/${documentId}/draft`,
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

export async function getAdminUsers() {
  return request({
    method: "get",
    url: "/admin/users",
  });
}

export async function getAdminUserOptions() {
  return request({
    method: "get",
    url: "/admin/users/options",
  });
}

export async function createAdminUser(payload) {
  return request({
    method: "post",
    url: "/admin/users",
    data: payload,
  });
}

export async function updateAdminUser(userId, payload) {
  return request({
    method: "put",
    url: `/admin/users/${userId}`,
    data: payload,
  });
}

export async function deleteAdminUser(userId) {
  return request({
    method: "delete",
    url: `/admin/users/${userId}`,
  });
}

export async function getAdminCatalogOptions() {
  return request({
    method: "get",
    url: "/admin/catalog/options",
  });
}

export async function getAuditEvents(params = {}) {
  return request({
    method: "get",
    url: "/audit/events",
    params,
  });
}

export async function createAdminCompany(payload) {
  return request({
    method: "post",
    url: "/admin/catalog/companies",
    data: payload,
  });
}

export async function deleteAdminCompany(companyId) {
  return request({
    method: "delete",
    url: `/admin/catalog/companies/${companyId}`,
  });
}

export async function updateAdminCompany(companyId, payload) {
  return request({
    method: "put",
    url: `/admin/catalog/companies/${companyId}`,
    data: payload,
  });
}

export async function createAdminSector(payload) {
  return request({
    method: "post",
    url: "/admin/catalog/sectors",
    data: payload,
  });
}

export async function deleteAdminSector(sectorId) {
  return request({
    method: "delete",
    url: `/admin/catalog/sectors/${sectorId}`,
  });
}

export async function updateAdminSector(sectorId, payload) {
  return request({
    method: "put",
    url: `/admin/catalog/sectors/${sectorId}`,
    data: payload,
  });
}

export async function createAdminDocumentType(payload) {
  return request({
    method: "post",
    url: "/admin/catalog/document-types",
    data: payload,
  });
}

export async function deleteAdminDocumentType(documentTypeId) {
  return request({
    method: "delete",
    url: `/admin/catalog/document-types/${documentTypeId}`,
  });
}

export async function updateAdminDocumentType(documentTypeId, payload) {
  return request({
    method: "put",
    url: `/admin/catalog/document-types/${documentTypeId}`,
    data: payload,
  });
}

// frontend/fs/client.js

import { getAuth } from "../auth.js";
import { get } from "../core/settings-store.js";

const API_URL = String(
    get("network.apiUrl") ||
    import.meta.env.VITE_API_URL ||
    "",
)
    .trim()
    .replace(/\/+$/, "");

const API_BASE =
    API_URL || (import.meta.env.DEV ? "http://localhost:3000" : "");

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class FsError extends Error {
  constructor(code, message, cwd = "") {
    super(message || "Filesystem operation failed.");
    this.name = "FsError";
    this.code = code || "INTERNAL";
    this.cwd = normalizePath(cwd);
  }
}

export function normalizePath(path) {
  if (path === undefined || path === null || path === "") {
    return "";
  }

  return String(path)
      .replace(/\\/g, "/")
      .split("/")
      .filter((part) => part && part !== ".")
      .join("/");
}

export function basename(path) {
  const normalized = normalizePath(path);

  if (!normalized) return "";

  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function dirname(path) {
  const normalized = normalizePath(path);

  if (!normalized || !normalized.includes("/")) {
    return "";
  }

  return normalized.slice(0, normalized.lastIndexOf("/"));
}

export function joinPath(parent, child) {
  const left = normalizePath(parent);
  const right = normalizePath(child);

  if (!left) return right;
  if (!right) return left;

  return `${left}/${right}`;
}

function getToken() {
  const auth = getAuth();

  if (!auth || typeof auth.token !== "string" || !auth.token.trim()) {
    throw new FsError(
        "UNAUTHORIZED",
        "You must be logged in to access your files.",
    );
  }

  return auth.token;
}

function getProfile() {
  const auth = getAuth();

  if (
      !auth ||
      typeof auth.profile !== "string" ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(auth.profile)
  ) {
    throw new FsError(
        "UNAUTHORIZED",
        "Your filesystem profile is unavailable. Log in again.",
    );
  }

  return auth.profile;
}

function getApiEndpoint() {
  if (!API_BASE && !window.location.origin) {
    throw new FsError("INTERNAL", "The filesystem API URL is unavailable.");
  }

  return `${API_BASE}/fs`;
}

async function readResponse(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);

  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new FsError(
        "TOO_LARGE",
        "The server response exceeds the allowed size.",
    );
  }

  const text = await response.text();

  if (text.length > MAX_RESPONSE_BYTES) {
    throw new FsError(
        "TOO_LARGE",
        "The server response exceeds the allowed size.",
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new FsError(
        "BAD_RESPONSE",
        "The filesystem server returned invalid JSON.",
    );
  }

  if (!response.ok || data?.ok !== true) {
    throw new FsError(
        data?.code || "INTERNAL",
        data?.message || `Filesystem request failed (${response.status}).`,
        data?.cwd || "",
    );
  }

  if (!data.result || typeof data.result !== "object") {
    throw new FsError(
        "BAD_RESPONSE",
        "The filesystem server returned an invalid result.",
        data.cwd || "",
    );
  }

  return data;
}

export async function fs(op, options = {}) {
  if (typeof op !== "string" || !op.trim()) {
    throw new FsError("INVALID_REQUEST", "A filesystem operation is required.");
  }

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new FsError("INVALID_REQUEST", "Invalid filesystem request.");
  }

  const token = getToken();
  const profile = getProfile();

  const body = {
    ...options,
    op,
    profile,
  };

  if (body.cwd !== undefined) {
    body.cwd = normalizePath(body.cwd);
  }

  if (body.path !== undefined && body.path !== "") {
    body.path = normalizePath(body.path);
  }

  if (body.destination !== undefined) {
    body.destination = normalizePath(body.destination);
  }

  let response;

  try {
    response = await fetch(getApiEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FsError(
        "NETWORK_ERROR",
        "Could not connect to the filesystem server. Check your connection and API URL.",
    );
  }

  return readResponse(response);
}
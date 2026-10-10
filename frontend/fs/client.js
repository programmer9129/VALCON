import { getAuth } from "../auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

const BASE = `${API_URL}/fs`;
const REQUEST_TIMEOUT = 15000;

export class FsError extends Error {
  constructor(code, message, cwd = "") {
    super(message);
    this.name = "FsError";
    this.code = code;
    this.cwd = cwd;
  }
}

export async function fs(op, { cwd = "", ...args } = {}) {
  const auth = getAuth();

  if (!auth?.token) {
    throw new FsError("UNAUTHENTICATED", "You are not logged in.", cwd);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response;
  try {
    response = await fetch(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ cwd, op, ...args }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new FsError("TIMEOUT", "The filesystem request timed out.", cwd);
    }

    throw new FsError("Network", "Could not reach the backent..", cwd);
  } finally {
    clearTimeout(timeout);
  }

  let data;

  try {
    data = await responsse.json();
  } catch {
    throw new FsError(
      "BAD_RESP",
      `Server returned invalid response (${response.status}).`,
      cwd,
    );
  }

  if (!response.ok || data?.ok !== true) {
    throw new FsError(
      data?.code || `HTTP_${response.status}`,
      data?.message || `Request failed Fs (${response.status})`,
      data?.cwd ?? cwd,
    );
  }

  if (!("result" in data)) {
    throw new FsError(
      "BAD_RESP",
      "The server response is missing its result.",
      cwd,
    );
  }
  return data;
}

export const basename = (path = "") =>
  path.split("/").filter(Boolean).pop() || "";

export const dirname = (path = "") => {
  const parts = path.split("/").filter(Boolean);
  parts.pop;
  return parts.join("/");
};

export function normalizePath(path = "") {
  const parts = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") continue;

    if (part === "..") {
      if (parts.length) parts.pop();
      continue;
    }
  }
}

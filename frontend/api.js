import { get } from "./core/settings-store.js";

let token = null;

export async function loadToken() {
  try {
    const auth = await import("./auth.js");

    token = auth.getAuth() ? auth.getAuth().token : null;
  } catch {
    token = null;
  }
}

function headers() {
  const output = {};

  if (token) {
    output.Authorization = `Bearer ${token}`;
  }

  return output;
}

function getUploadUrl() {
  return (
    get("network.musicUploadUrl") || import.meta.env.VITE_MUSIC_UPLOAD_URL || ""
  );
}

function getPlayBase() {
  return (
    get("network.musicPlayUrl") || import.meta.env.VITE_MUSIC_PLAY_URL || ""
  );
}

function absolute(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const base = getPlayBase();

  return base ? `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}` : url;
}

function extractUrl(xhr) {
  const contentType = xhr.getResponseHeader("content-type") || "";

  if (/^(audio|video)\//i.test(contentType)) {
    return xhr.responseURL || null;
  }

  const text = (xhr.responseText || "").trim();

  if (!text) {
    return null;
  }

  try {
    const data = JSON.parse(text);

    const candidate =
      data.url ||
      data.play_url ||
      data.playUrl ||
      data.download_url ||
      data.signedUrl ||
      data.signed_url ||
      (data.data &&
        (data.data.url || data.data.signedUrl || data.data.signed_url));

    return candidate ? absolute(candidate) : null;
  } catch {
    return /^https?:\/\//i.test(text) ? text : null;
  }
}

export function upload(file, filename, onProgress) {
  const uploadUrl = getUploadUrl();

  if (!uploadUrl) {
    return Promise.resolve({
      ok: false,
      url: null,
      reason: "no upload url configured",
    });
  }

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      filename,
    });

    let endpoint = uploadUrl;

    if (!/[?&]filename=/.test(endpoint)) {
      endpoint += `${endpoint.includes("?") ? "&" : "?"}${params}`;
    }

    const xhr = new XMLHttpRequest();

    xhr.open("POST", endpoint);

    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    const authHeaders = headers();

    for (const key of Object.keys(authHeaders)) {
      xhr.setRequestHeader(key, authHeaders[key]);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;

      resolve({
        ok,
        url: ok ? extractUrl(xhr) : null,
        reason: ok ? null : `server returned ${xhr.status}`,
      });
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        url: null,
        reason: "network error",
      });
    };

    xhr.onabort = () => {
      resolve({
        ok: false,
        url: null,
        reason: "aborted",
      });
    };

    xhr.send(file);
  });
}

export function remoteUrlFor(filename) {
  const base = getPlayBase();

  if (!base) {
    return null;
  }

  return `${base.replace(/\/$/, "")}/${encodeURIComponent(filename)}`;
}

const UPLOAD_URL = import.meta.env.VITE_MUSIC_UPLOAD_URL || "";
const PLAY_BASE = import.meta.env.VITE_MUSIC_PLAY_URL || "";

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
  const out = {};

  if (token) {
    out.Authorization = `Bearer ${token}`;
  }

  return out;
}

function absolute(url) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return PLAY_BASE
    ? `${PLAY_BASE.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
    : url;
}

function extractUrl(xhr) {
  const contentType = xhr.getResponseHeader("content-type") || "";

  if (/^(audio|video)\//.test(contentType)) {
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
    return /^https?:\/\//.test(text) ? text : null;
  }
}

export function upload(file, filename, onProgress) {
  if (!UPLOAD_URL) {
    return Promise.resolve({
      ok: false,
      url: null,
      reason: "no upload url configured",
    });
  }

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      filename: filename,
    });

    let endpoint = UPLOAD_URL;

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

    Object.keys(authHeaders).forEach((key) => {
      xhr.setRequestHeader(key, authHeaders[key]);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;

      resolve({
        ok: ok,
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
  if (!PLAY_BASE) {
    return null;
  }

  return `${PLAY_BASE.replace(/\/$/, "")}/${encodeURIComponent(filename)}`;
}

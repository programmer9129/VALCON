import { createClient } from "@supabase/supabase-js";
import { get } from "./core/settings-store.js";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();

const SUPABASE_KEY = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "",
).trim();

const AUTH_USED_KEY = "valcon.supabase.auth.used";
const AVATAR_PREFIX = "valcon.avatar.";

const supabase =
    SUPABASE_URL && SUPABASE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
        : null;

let currentUser = null;

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = toAuth(session);
  });
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
        "Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return supabase;
}

function apiBase() {
  const configured = String(
      get("network.apiUrl") ||
      import.meta.env.VITE_API_URL ||
      "",
  ).trim();

  return (
      configured.replace(/\/+$/, "") ||
      (import.meta.env.DEV ? "http://localhost:3000" : "")
  );
}

function normalizedUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9_-]{2,64}$/.test(value);
}

function authEmailForUsername(username) {
  return `${username}@accounts.valcon.invalid`;
}

function profileSlug(value) {
  const slug = String(value || "user")
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);

  return slug || "user";
}

function toAuth(session) {
  if (!session?.access_token || !session?.user) {
    return null;
  }

  const user = session.user;
  const email = String(user.email || "");
  const localPart = email.split("@")[0] || "user";

  const username = String(
      user.user_metadata?.username || localPart,
  ).slice(0, 64);

  const profile = profileSlug(
      user.user_metadata?.fs_profile || username,
  );

  return {
    id: user.id,
    username,
    profile,
    email,
    token: session.access_token,
    expiresAt: session.expires_at
        ? session.expires_at * 1000
        : Date.now() + Number(session.expires_in || 3600) * 1000,
    user,
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

export function hasAnyUser() {
  try {
    return localStorage.getItem(AUTH_USED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function register(username, password) {
  requireSupabase();

  username = normalizedUsername(username);

  if (!validUsername(username)) {
    throw new Error(
        "Use 2–64 letters, numbers, underscores or hyphens for your username.",
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new Error(
        "Use a password with at least 8 characters.",
    );
  }

  const base = apiBase();

  if (!base) {
    throw new Error(
        "Set the Node API URL in Settings or VITE_API_URL.",
    );
  }

  const response = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    // The response is handled below.
  }

  if (!response.ok || data.ok !== true) {
    throw new Error(
        data.message ||
        data.error ||
        `Registration failed (${response.status}).`,
    );
  }

  try {
    localStorage.setItem(AUTH_USED_KEY, "1");
  } catch {
    // Authentication can still work without this preference.
  }

  return login(username, password);
}

export async function login(username, password) {
  const client = requireSupabase();

  username = normalizedUsername(username);

  if (!validUsername(username)) {
    throw new Error("Enter a valid username.");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: authEmailForUsername(username),
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message || "Login failed.");
  }

  try {
    localStorage.setItem(AUTH_USED_KEY, "1");
  } catch {
    // Authentication can still work without this preference.
  }

  currentUser = toAuth(data.session);

  return currentUser;
}

export function getAuth() {
  return currentUser;
}

export function getProfile() {
  const auth = getAuth();

  if (!auth?.user) {
    return null;
  }

  const metadata = auth.user.user_metadata || {};

  let avatar = "";

  try {
    avatar =
        localStorage.getItem(
            `${AVATAR_PREFIX}${auth.user.id}`,
        ) || "";
  } catch {
    // The avatar is optional.
  }

  return {
    displayName: String(
        metadata.display_name || auth.username,
    ),
    avatar,
    bio: String(metadata.bio || ""),
    memberSince: auth.user.created_at || Date.now(),
    updatedAt:
        metadata.profile_updated_at ||
        auth.user.updated_at ||
        auth.user.created_at ||
        Date.now(),
  };
}

export function updateProfile(patch = {}) {
  const auth = getAuth();

  if (!auth?.user) {
    throw new Error("Not logged in.");
  }

  if (
      Object.prototype.hasOwnProperty.call(patch, "avatar")
  ) {
    try {
      const key = `${AVATAR_PREFIX}${auth.user.id}`;

      if (patch.avatar) {
        localStorage.setItem(key, patch.avatar);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      throw new Error(
          "Could not save the avatar in this browser.",
      );
    }
  }

  const metadata = {};

  if (patch.displayName !== undefined) {
    metadata.display_name = String(
        patch.displayName,
    ).slice(0, 100);
  }

  if (patch.bio !== undefined) {
    metadata.bio = String(patch.bio).slice(0, 2000);
  }

  if (Object.keys(metadata).length) {
    metadata.profile_updated_at = new Date().toISOString();

    requireSupabase()
        .auth.updateUser({
      data: metadata,
    })
        .then(({ error }) => {
          if (error) {
            console.error(
                "VALCON PROFILE UPDATE ERROR:",
                error,
            );
            return;
          }

          return supabase.auth.getSession().then(({ data }) => {
            currentUser = toAuth(data?.session || null);

            window.dispatchEvent(
                new CustomEvent("profile-change", {
                  detail: getProfile(),
                }),
            );
          });
        })
        .catch((error) => {
          console.error(
              "VALCON PROFILE UPDATE ERROR:",
              error,
          );
        });
  }

  const profile = getProfile();

  window.dispatchEvent(
      new CustomEvent("profile-change", {
        detail: profile,
      }),
  );

  return profile;
}

export async function logout() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message || "Could not log out.");
    }
  }

  currentUser = null;
  location.reload();
}

export async function changePassword(oldPassword, newPassword) {
  const client = requireSupabase();
  const auth = getAuth();

  if (!auth?.email) {
    throw new Error("Not logged in.");
  }

  if (
      typeof newPassword !== "string" ||
      newPassword.length < 8
  ) {
    throw new Error(
        "Use a password with at least 8 characters.",
    );
  }

  const { error: verifyError } =
      await client.auth.signInWithPassword({
        email: auth.email,
        password: oldPassword,
      });

  if (verifyError) {
    throw new Error("Current password is incorrect.");
  }

  const { error } = await client.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(
        error.message || "Could not change the password.",
    );
  }
}

export async function deleteCurrentAccount() {
  const auth = getAuth();

  if (!auth?.token) {
    throw new Error("Not logged in.");
  }

  const base = String(
      get("network.apiUrl") ||
      import.meta.env.VITE_API_URL ||
      "",
  )
      .trim()
      .replace(/\/+$/, "");

  if (!base) {
    throw new Error(
        "Set the Node API URL before deleting the account.",
    );
  }

  const response = await fetch(`${base}/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    // The response is handled below.
  }

  if (!response.ok || data.ok !== true) {
    throw new Error(
        data.error ||
        data.message ||
        `Account deletion failed (${response.status}).`,
    );
  }

  if (supabase) {
    await supabase.auth.signOut();
  }

  currentUser = null;
  location.reload();
}

export async function resizeAvatar(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select an image.");
  }

  if (file.type === "image/svg+xml") {
    throw new Error("SVG avatars are not supported.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Avatar must be smaller than 10 MB.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    const size = Math.min(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not process this image.");
    }

    ctx.drawImage(
        bitmap,
        (bitmap.width - size) / 2,
        (bitmap.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256,
    );

    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    bitmap.close?.();
  }
}

export async function bootAuth() {
  const gate = document.getElementById("authGate");

  try {
    const client = requireSupabase();

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    currentUser = toAuth(data.session);

    if (currentUser) {
      gate?.remove();
      return currentUser;
    }
  } catch (error) {
    const message = document.getElementById("authMsg");

    if (message) {
      message.textContent =
          error.message ||
          "Supabase Auth is not configured.";
    }

    return null;
  }

  if (!gate) {
    return null;
  }

  const userInput = document.getElementById("authUser");
  const passInput = document.getElementById("authPass");
  const submit = document.getElementById("authSubmit");
  const switchButton = document.getElementById("authSwitch");
  const message = document.getElementById("authMsg");

  let mode = hasAnyUser() ? "login" : "register";

  return new Promise((resolve) => {
    function render() {
      const registering = mode === "register";

      submit.textContent = registering
          ? "Register"
          : "Log in";

      switchButton.textContent = registering
          ? "Already registered? Log in"
          : "No account? Register";

      message.textContent = "";
      passInput.value = "";

      passInput.autocomplete = registering
          ? "new-password"
          : "current-password";

      userInput.focus();
    }

    switchButton.addEventListener("click", () => {
      mode = mode === "register" ? "login" : "register";
      render();
    });

    gate.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = normalizedUsername(userInput.value);
      const password = passInput.value;

      if (!username || !password) {
        message.textContent =
            "Username and password are required.";
        return;
      }

      submit.disabled = true;

      message.textContent =
          mode === "register"
              ? "Creating account…"
              : "Signing in…";

      try {
        const auth =
            mode === "register"
                ? await register(username, password)
                : await login(username, password);

        if (!auth) {
          mode = "login";
          submit.disabled = false;
          render();

          message.textContent =
              "Registration did not create a session. Log in and try again.";

          return;
        }

        gate.remove();
        resolve(auth);
      } catch (error) {
        message.textContent =
            error.message || "Authentication failed.";

        submit.disabled = false;
      }
    });

    render();
  });
}
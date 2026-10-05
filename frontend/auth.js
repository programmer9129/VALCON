const USERS_KEY = "valcon.users";
const SESSION_KEY = "valcon.session";

let currentUser = null;

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);

  const digest = await crypto.subtle.digest("SHA-256", data);

  return toHex(digest);
}

function makeNacl() {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return toHex(bytes.buffer);
}

function makeTokenPayload(username, expiresAt) {
  return `${username}:${expiresAt}:${crypto.randomUUID()}`;
}

function getUserRecord(username) {
  const users = readUsers();

  return users[username.toLowerCase()] || null;
}

function saveSession(session) {
  currentUser = session;

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw);

    if (!session || !session.username || !session.token || !session.expiresAt) {
      return null;
    }

    if (Date.now() >= Number(session.expiresAt)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    currentUser = session;

    return session;
  } catch {
    return null;
  }
}

export function hasAnyUser() {
  return Object.keys(readUsers()).length > 0;
}

export async function register(username, password) {
  username = username.trim();

  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  if (username.length < 2) {
    throw new Error("Username must be at least 2 characters");
  }

  const users = readUsers();
  const key = username.toLowerCase();

  if (users[key]) {
    throw new Error("Your username is already taken");
  }

  const nacl = makeNacl();
  const hash = await sha256(nacl + ":" + password);

  users[key] = {
    nacl,
    hash,
    createdAt: Date.now(),
    profile: {
      displayName: username,
      avatar: "",
      bio: "",
      updatedAt: Date.now(),
    },
  };

  writeUsers(users);
}

export async function login(username, password) {
  username = username.trim();

  const users = readUsers();
  const key = username.toLowerCase();
  const user = users[key];

  if (!user) {
    throw new Error("Wrong username or password");
  }

  const hash = await sha256(user.nacl + ":" + password);

  if (hash !== user.hash) {
    throw new Error("Wrong username or password");
  }

  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

  const token = await sha256(makeTokenPayload(username, expiresAt));

  const session = {
    username: key,
    token,
    expiresAt,
  };

  saveSession(session);

  return session;
}

export function getAuth() {
  if (!currentUser) {
    restoreSession();
  }

  return currentUser;
}

export function getProfile() {
  const auth = getAuth();

  if (!auth) {
    return null;
  }

  const user = getUserRecord(auth.username);

  if (!user) {
    return null;
  }

  return {
    displayName: user.profile?.displayName || auth.username,

    avatar: user.profile?.avatar || "",

    bio: user.profile?.bio || "",

    memberSince: user.createdAt || Date.now(),

    updatedAt: user.profile?.updatedAt || user.createdAt || Date.now(),
  };
}

export function updateProfile(patch) {
  const auth = getAuth();

  if (!auth) {
    throw new Error("Not logged in");
  }

  const users = readUsers();
  const key = auth.username;
  const user = users[key];

  if (!user) {
    throw new Error("User not found");
  }

  user.profile = {
    displayName: patch.displayName ?? user.profile?.displayName ?? key,

    avatar: patch.avatar ?? user.profile?.avatar ?? "",

    bio: patch.bio ?? user.profile?.bio ?? "",

    updatedAt: Date.now(),
  };

  users[key] = user;

  writeUsers(users);

  window.dispatchEvent(
    new CustomEvent("profile-change", {
      detail: getProfile(),
    }),
  );

  return getProfile();
}

export function logout() {
  currentUser = null;

  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}

  location.reload();
}

export async function changePassword(oldPassword, newPassword) {
  const auth = getAuth();

  if (!auth) {
    throw new Error("Not logged in");
  }

  const users = readUsers();
  const user = users[auth.username];

  if (!user) {
    throw new Error("User not found");
  }

  const oldHash = await sha256(user.nacl + ":" + oldPassword);

  if (oldHash !== user.hash) {
    throw new Error("Current password is incorrect");
  }

  user.hash = await sha256(user.nacl + ":" + newPassword);

  users[auth.username] = user;

  writeUsers(users);
}

export function deleteCurrentAccount() {
  const auth = getAuth();

  if (!auth) {
    throw new Error("Not logged in");
  }

  const users = readUsers();

  delete users[auth.username];

  writeUsers(users);

  localStorage.removeItem(SESSION_KEY);

  currentUser = null;

  location.reload();
}

export async function resizeAvatar(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select an image");
  }

  if (file.type === "image/svg+xml") {
    throw new Error("SVG avatars are not supported");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Avatar must be smaller than 10 MB");
  }

  const bitmap = await createImageBitmap(file);

  const size = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");

  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");

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
}

export function bootAuth() {
  restoreSession();

  return new Promise((resolve) => {
    const existing = getAuth();

    if (existing) {
      document.getElementById("authGate")?.remove();

      resolve(existing);
      return;
    }

    const gate = document.getElementById("authGate");

    if (!gate) {
      resolve(null);
      return;
    }

    const user = document.getElementById("authUser");

    const pass = document.getElementById("authPass");

    const submit = document.getElementById("authSubmit");

    const switchBtn = document.getElementById("authSwitch");

    const msg = document.getElementById("authMsg");

    let mode = hasAnyUser() ? "login" : "register";

    function render() {
      const registering = mode === "register";

      submit.textContent = registering ? "Register" : "Log in";

      switchBtn.textContent = registering
        ? "Already registered? Log in"
        : "No account? Register";

      msg.textContent = "";

      pass.value = "";

      pass.autocomplete = registering ? "new-password" : "current-password";

      user.focus();
    }

    switchBtn.addEventListener("click", () => {
      mode = mode === "register" ? "login" : "register";

      render();
    });

    gate.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = user.value.trim();

      const password = pass.value;

      if (!username || !password) {
        msg.textContent = "Username and password are required";

        return;
      }

      submit.disabled = true;
      msg.textContent = "Working...";

      try {
        if (mode === "register") {
          await register(username, password);
        }

        const session = await login(username, password);

        gate.remove();

        resolve(session);
      } catch (error) {
        msg.textContent = error.message || "Authentication failed";

        submit.disabled = false;
      }
    });

    render();
  });
}

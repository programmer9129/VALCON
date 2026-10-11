"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { randomUUID, timingSafeEqual } = require("node:crypto");
const FS_CONTRACT = require("./fs-contract.json");

const PORT = Number(process.env.PORT || 3000);
const BUCKET_NAME = "valcon-files";
const CPP_BACKEND_URL = String(process.env.CPP_BACKEND_URL || "").replace(/\/+$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_PUBLIC_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
const VALCON_BRIDGE_KEY = process.env.VALCON_BRIDGE_KEY || "";

const FS_OPERATIONS = new Set(FS_CONTRACT.request.properties.op.enum);

const IMPLEMENTED_OPERATIONS = new Set([
    "cd",
    "ls",
    "mkdir",
    "mkfile",
    "read",
    "write",
    "append",
    "delete_file",
    "deldir",
    "rename",
    "move",
    "copy",
    "stat",
    "tree",
    "du",
    "find",
    "grep"
]);

const FS_ERROR_STATUS = {
    ...FS_CONTRACT.errors,
    INVALID_REQUEST: 400,
    INVALID_PATH: 400,
    INVALID_NAME: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ALREADY_EXISTS: 409,
    EXISTS: 409,
    NOT_DIRECTORY: 409,
    IS_DIRECTORY: 409,
    CONFLICT: 409,
    NOT_EMPTY: 409,
    CONFIRM_REQUIRED: 409,
    TOO_LARGE: 413,
    TOO_MANY_ENTRIES: 413,
    QUOTA_EXCEEDED: 413,
    UNSUPPORTED: 422,
    UNSUPPORTED_OPERATION: 400,
    INTERNAL: 500
};

const app = express();

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        const isLocalDevelopmentOrigin =
            process.env.NODE_ENV !== "production" &&
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

        if (isLocalDevelopmentOrigin) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed."));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-VALCON-BRIDGE-KEY"
    ]
}));

app.use(express.json({ limit: "2mb" }));

const adminSupabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        })
        : null;

class FsError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "FsError";
        this.code = code;
    }
}

function sendFsSuccess(res, result = {}, cwd = "") {
    return res.status(200).json({
        ok: true,
        result,
        cwd
    });
}

function sendFsError(res, error, cwd = "") {
    const requestedCode =
        typeof error?.code === "string"
            ? error.code
            : "";

    const code = Object.prototype.hasOwnProperty.call(
        FS_ERROR_STATUS,
        requestedCode
    )
        ? requestedCode
        : "INTERNAL";

    const status = FS_ERROR_STATUS[code] || 500;

    const message = code === "INTERNAL"
        ? "Internal filesystem error."
        : String(error?.message || code);

    if (code === "INTERNAL") {
        console.error("VALCON FILESYSTEM ERROR:", error);
    }

    return res.status(status).json({
        ok: false,
        code,
        message,
        cwd
    });
}

function fsRaise(code, message) {
    throw new FsError(code, message);
}

function validateFsProfile(value) {
    if (
        typeof value !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(value)
    ) {
        fsRaise("INVALID_NAME", "Invalid profile name.");
    }

    return value;
}

function fsCleanPath(value) {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value !== "string") {
        fsRaise("INVALID_PATH", "The path must be a string.");
    }

    const raw = value.replace(/\\/g, "/");

    if (
        raw.length > 1024 ||
        raw.startsWith("/") ||
        /^[A-Za-z]:/.test(raw)
    ) {
        fsRaise("INVALID_PATH", "Invalid filesystem path.");
    }

    if (/[\u0000-\u001f\u007f]/u.test(raw)) {
        fsRaise(
            "INVALID_PATH",
            "Control characters are not allowed in paths."
        );
    }

    if (raw === "") {
        return "";
    }

    const parts = raw.split("/");

    if (
        parts.some((part) =>
            !part || part === "." || part === ".."
        )
    ) {
        fsRaise(
            "INVALID_PATH",
            "The path contains an invalid component."
        );
    }

    if (parts.some((part) => part.length > 255)) {
        fsRaise("INVALID_PATH", "A path component is too long.");
    }

    return parts.join("/");
}

function fsCleanName(value) {
    if (typeof value !== "string") {
        fsRaise(
            "INVALID_NAME",
            "A file or directory name is required."
        );
    }

    const name = value.trim();

    if (
        !name ||
        name.length > 255 ||
        name === "." ||
        name === ".." ||
        /[\/\\\u0000-\u001f\u007f]/u.test(name)
    ) {
        fsRaise(
            "INVALID_NAME",
            "Invalid file or directory name."
        );
    }

    return name;
}

function pathJoin(parent, child) {
    const left = fsCleanPath(parent);
    const right = fsCleanName(child);

    return left ? `${left}/${right}` : right;
}

function parentPath(path) {
    const clean = fsCleanPath(path);
    const index = clean.lastIndexOf("/");

    return index < 0 ? "" : clean.slice(0, index);
}

function baseName(path) {
    const clean = fsCleanPath(path);

    return clean
        ? clean.slice(clean.lastIndexOf("/") + 1)
        : "";
}

function currentEtag(entry) {
    return entry?.updated_at || entry?.created_at || null;
}

function createUserSupabase(token) {
    if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
        fsRaise(
            "INTERNAL",
            "Supabase public configuration is missing."
        );
    }

    return createClient(
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        }
    );
}

async function authenticateFilesystemRequest(token) {
    if (typeof token !== "string" || !token) {
        fsRaise("UNAUTHORIZED", "Authentication required.");
    }

    const userSupabase = createUserSupabase(token);

    const { data, error } =
        await userSupabase.auth.getUser(token);

    if (error || !data?.user) {
        fsRaise(
            "UNAUTHORIZED",
            "Invalid or expired authentication token."
        );
    }

    return {
        supabase: userSupabase,
        user: data.user
    };
}

function requireValconBridgeKey(req, res, next) {
    const received = req.get("X-VALCON-BRIDGE-KEY") || "";

    if (!VALCON_BRIDGE_KEY || !received) {
        return sendFsError(
            res,
            new FsError(
                "FORBIDDEN",
                "Bridge authentication required."
            )
        );
    }

    const expectedBuffer = Buffer.from(VALCON_BRIDGE_KEY);
    const receivedBuffer = Buffer.from(received);

    if (
        expectedBuffer.length !== receivedBuffer.length ||
        !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
        return sendFsError(
            res,
            new FsError(
                "FORBIDDEN",
                "Bridge authentication required."
            )
        );
    }

    return next();
}

function bearerToken(req) {
    const match = String(
        req.get("Authorization") || ""
    ).match(/^Bearer\s+(.+)$/i);

    return match ? match[1].trim() : "";
}

function fsCheckDatabaseError(error) {
    if (error?.code === "23505") {
        fsRaise(
            "ALREADY_EXISTS",
            "An entry with that name already exists."
        );
    }

    throw error;
}

async function findOrCreateFsRoot(
    userSupabase,
    user,
    profile
) {
    const selectRoot = () =>
        userSupabase
            .from("fs_entries")
            .select("*")
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .is("parent_id", null)
            .maybeSingle();

    const existing = await selectRoot();

    if (existing.error) {
        throw existing.error;
    }

    if (existing.data) {
        return existing.data;
    }

    const inserted = await userSupabase
        .from("fs_entries")
        .insert({
            owner_id: user.id,
            profile,
            parent_id: null,
            name: profile,
            kind: "dir",
            size: 0,
            storage_key: null
        })
        .select("*")
        .single();

    if (!inserted.error) {
        return inserted.data;
    }

    if (inserted.error.code === "23505") {
        const retry = await selectRoot();

        if (!retry.error && retry.data) {
            return retry.data;
        }
    }

    throw inserted.error;
}

async function fsGetChildren(
    userSupabase,
    user,
    profile,
    parentId
) {
    const entries = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await userSupabase
            .from("fs_entries")
            .select("*")
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("parent_id", parentId)
            .order("name", { ascending: true })
            .range(offset, offset + pageSize - 1);

        if (error) {
            throw error;
        }

        entries.push(...(data || []));

        if (!data || data.length < pageSize) {
            break;
        }

        offset += pageSize;

        if (entries.length >= 5000) {
            fsRaise(
                "TOO_MANY_ENTRIES",
                "The directory contains too many entries to list at once."
            );
        }
    }

    return entries;
}

async function fsGetChild(
    userSupabase,
    user,
    profile,
    parentId,
    name
) {
    const { data, error } = await userSupabase
        .from("fs_entries")
        .select("*")
        .eq("owner_id", user.id)
        .eq("profile", profile)
        .eq("parent_id", parentId)
        .eq("name", name)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

async function fsResolveEntry(
    userSupabase,
    user,
    profile,
    root,
    relativePath
) {
    const cleanPath = fsCleanPath(relativePath);

    if (!cleanPath) {
        return root;
    }

    let current = root;

    for (const part of cleanPath.split("/")) {
        if (current.kind !== "dir") {
            fsRaise(
                "NOT_DIRECTORY",
                `"${current.name}" is not a directory.`
            );
        }

        const child = await fsGetChild(
            userSupabase,
            user,
            profile,
            current.id,
            part
        );

        if (!child) {
            fsRaise("NOT_FOUND", `Entry not found: ${part}`);
        }

        current = child;
    }

    return current;
}

async function resolveFsDirectory(
    userSupabase,
    user,
    profile,
    root,
    relativePath
) {
    const entry = await fsResolveEntry(
        userSupabase,
        user,
        profile,
        root,
        relativePath
    );

    if (entry.kind !== "dir") {
        fsRaise(
            "NOT_DIRECTORY",
            `"${entry.name}" is not a directory.`
        );
    }

    return entry;
}

async function fsInsertEntry(
    userSupabase,
    user,
    profile,
    parentId,
    name,
    kind,
    storageKey = null
) {
    const { data, error } = await userSupabase
        .from("fs_entries")
        .insert({
            owner_id: user.id,
            profile,
            parent_id: parentId,
            name,
            kind,
            size: 0,
            storage_key: storageKey
        })
        .select("*")
        .single();

    if (error) {
        fsCheckDatabaseError(error);
    }

    return data;
}

async function fsDownloadBuffer(userSupabase, entry) {
    if (entry.kind !== "file" || !entry.storage_key) {
        fsRaise(
            "IS_DIRECTORY",
            "The entry is not a readable file."
        );
    }

    const { data, error } = await userSupabase.storage
        .from(BUCKET_NAME)
        .download(entry.storage_key);

    if (error) {
        throw error;
    }

    return Buffer.from(await data.arrayBuffer());
}

async function fsCreateFile(
    userSupabase,
    user,
    profile,
    parentId,
    name,
    contentBuffer = Buffer.alloc(0)
) {
    const storageKey = `${user.id}/${randomUUID()}`;

    const entry = await fsInsertEntry(
        userSupabase,
        user,
        profile,
        parentId,
        name,
        "file",
        storageKey
    );

    const { error: uploadError } = await userSupabase.storage
        .from(BUCKET_NAME)
        .upload(storageKey, contentBuffer, {
            contentType: "text/plain; charset=utf-8",
            upsert: false
        });

    if (uploadError) {
        await userSupabase.storage
            .from(BUCKET_NAME)
            .remove([storageKey]);

        await userSupabase
            .from("fs_entries")
            .delete()
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("id", entry.id);

        throw uploadError;
    }

    const { data: updatedEntry, error: metadataError } =
        await userSupabase
            .from("fs_entries")
            .update({
                size: contentBuffer.length,
                updated_at: new Date().toISOString()
            })
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("id", entry.id)
            .select("*")
            .single();

    if (metadataError) {
        await userSupabase.storage
            .from(BUCKET_NAME)
            .remove([storageKey]);

        await userSupabase
            .from("fs_entries")
            .delete()
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("id", entry.id);

        throw metadataError;
    }

    return updatedEntry;
}

async function fsUploadBuffer(
    userSupabase,
    entry,
    buffer
) {
    if (entry.kind !== "file" || !entry.storage_key) {
        fsRaise("IS_DIRECTORY", "The entry is not a file.");
    }

    const { error: uploadError } = await userSupabase.storage
        .from(BUCKET_NAME)
        .upload(entry.storage_key, buffer, {
            contentType: "text/plain; charset=utf-8",
            upsert: true
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data, error } = await userSupabase
        .from("fs_entries")
        .update({
            size: buffer.length,
            updated_at: new Date().toISOString()
        })
        .eq("owner_id", entry.owner_id)
        .eq("profile", entry.profile)
        .eq("id", entry.id)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data;
}

async function fsCollectSubtree(
    userSupabase,
    user,
    profile,
    entry,
    relativePath,
    collected = []
) {
    if (collected.length >= 5000) {
        fsRaise(
            "TOO_MANY_ENTRIES",
            "The operation exceeds the filesystem entry limit."
        );
    }

    collected.push({
        ...entry,
        relativePath
    });

    if (entry.kind === "dir") {
        const children = await fsGetChildren(
            userSupabase,
            user,
            profile,
            entry.id
        );

        for (const child of children) {
            const childPath = relativePath
                ? `${relativePath}/${child.name}`
                : child.name;

            await fsCollectSubtree(
                userSupabase,
                user,
                profile,
                child,
                childPath,
                collected
            );
        }
    }

    return collected;
}

async function fsRemoveSubtree(
    userSupabase,
    user,
    profile,
    entry,
    relativePath
) {
    const entries = await fsCollectSubtree(
        userSupabase,
        user,
        profile,
        entry,
        relativePath
    );

    const keys = entries
        .filter((item) =>
            item.kind === "file" && item.storage_key
        )
        .map((item) => item.storage_key);

    for (let index = 0; index < keys.length; index += 100) {
        const { error } = await userSupabase.storage
            .from(BUCKET_NAME)
            .remove(keys.slice(index, index + 100));

        if (error) {
            throw error;
        }
    }

    for (const item of entries.reverse()) {
        const { error } = await userSupabase
            .from("fs_entries")
            .delete()
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("id", item.id);

        if (error) {
            throw error;
        }
    }
}

async function fsCloneEntry(
    userSupabase,
    user,
    profile,
    source,
    destinationParentId,
    newName,
    destinationPath
) {
    if (source.kind === "file") {
        const buffer = await fsDownloadBuffer(
            userSupabase,
            source
        );

        return fsCreateFile(
            userSupabase,
            user,
            profile,
            destinationParentId,
            newName,
            buffer
        );
    }

    const copy = await fsInsertEntry(
        userSupabase,
        user,
        profile,
        destinationParentId,
        newName,
        "dir",
        null
    );

    try {
        const children = await fsGetChildren(
            userSupabase,
            user,
            profile,
            source.id
        );

        for (const child of children) {
            const childPath = destinationPath
                ? `${destinationPath}/${child.name}`
                : child.name;

            await fsCloneEntry(
                userSupabase,
                user,
                profile,
                child,
                copy.id,
                child.name,
                childPath
            );
        }
    } catch (error) {
        try {
            await fsRemoveSubtree(
                userSupabase,
                user,
                profile,
                copy,
                destinationPath
            );
        } catch (cleanupError) {
            console.error(
                "VALCON COPY CLEANUP ERROR:",
                cleanupError
            );
        }

        throw error;
    }

    return copy;
}

function fsGlobToRegex(glob) {
    let result = "";

    for (let index = 0; index < glob.length; index++) {
        const char = glob[index];

        if (char === "*" && glob[index + 1] === "*") {
            if (glob[index + 2] === "/") {
                result += "(?:.*/)?";
                index += 2;
            } else {
                result += ".*";
                index++;
            }
        } else if (char === "*") {
            result += "[^/]*";
        } else if (char === "?") {
            result += "[^/]";
        } else {
            result += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
    }

    return new RegExp(`^${result}$`, "i");
}

async function fsBuildTreeMode(
    userSupabase,
    user,
    profile,
    entry,
    depth = 0
) {
    if (depth > 64) {
        fsRaise(
            "TOO_MANY_ENTRIES",
            "The maximum tree depth was exceeded."
        );
    }

    const children = entry.kind === "dir"
        ? await fsGetChildren(
            userSupabase,
            user,
            profile,
            entry.id
        )
        : [];

    const nodes = [];

    for (const child of children) {
        nodes.push(
            await fsBuildTreeMode(
                userSupabase,
                user,
                profile,
                child,
                depth + 1
            )
        );
    }

    return {
        name: entry.name,
        kind: entry.kind,
        children: nodes
    };
}

function fsRenderTreeChildren(children, prefix = "") {
    let output = "";

    children.forEach((child, index) => {
        const isLast = index === children.length - 1;

        output += prefix
            + (isLast ? "|___ " : "|--- ")
            + child.name
            + "\n";

        if (child.kind === "dir" && child.children.length > 0) {
            output += fsRenderTreeChildren(
                child.children,
                prefix + (isLast ? "    " : "|   ")
            );
        }
    });

    return output;
}

function fsRenderTree(node, rootLabel) {
    let output = `${rootLabel}\n`;

    if (node.children.length > 0) {
        output += "│\n";
        output += fsRenderTreeChildren(node.children);
    }

    return output;
}

function targetFromRequest(body, cwd) {
    if (
        typeof body.name === "string" &&
        body.name.length > 0
    ) {
        return {
            path: pathJoin(cwd, body.name),
            name: fsCleanName(body.name),
            parent: cwd
        };
    }

    if (typeof body.path === "string") {
        const path = fsCleanPath(body.path);

        if (!path) {
            fsRaise("INVALID_PATH", "A file path is required.");
        }

        return {
            path,
            name: baseName(path),
            parent: parentPath(path)
        };
    }

    fsRaise(
        "INVALID_REQUEST",
        "A file name or path is required."
    );
}

async function runFsOperation({
                                  userSupabase,
                                  user,
                                  profile,
                                  body,
                                  cwd
                              }) {
    const op = body.op;

    if (typeof op !== "string" || !FS_OPERATIONS.has(op)) {
        fsRaise(
            "UNSUPPORTED_OPERATION",
            "Unknown filesystem operation."
        );
    }

    if (!IMPLEMENTED_OPERATIONS.has(op)) {
        fsRaise(
            "UNSUPPORTED_OPERATION",
            `Operation '${op}' is not implemented.`
        );
    }

    const root = await findOrCreateFsRoot(
        userSupabase,
        user,
        profile
    );

    if (op === "cd") {
        const targetPath = fsCleanPath(body.path ?? "");

        await resolveFsDirectory(
            userSupabase,
            user,
            profile,
            root,
            targetPath
        );

        return {
            result: {
                message: "Directory changed."
            },
            cwd: targetPath
        };
    }

    const currentDirectory = await resolveFsDirectory(
        userSupabase,
        user,
        profile,
        root,
        cwd
    );

    if (op === "ls") {
        const children = await fsGetChildren(
            userSupabase,
            user,
            profile,
            currentDirectory.id
        );

        const entries = children.map((entry) => ({
            id: entry.id,
            name: entry.name,
            kind: entry.kind,
            size: Number(entry.size || 0),
            etag: currentEtag(entry),
            mtime: entry.updated_at || entry.created_at || null,
            created_at: entry.created_at || null,
            updated_at: entry.updated_at || null,
            updatedAt: entry.updated_at || entry.created_at || null
        }));

        return {
            result: {
                entries,
                message: `${entries.length} entries.`
            },
            cwd
        };
    }

    if (op === "mkdir") {
        const name = fsCleanName(body.name);

        const entry = await fsInsertEntry(
            userSupabase,
            user,
            profile,
            currentDirectory.id,
            name,
            "dir",
            null
        );

        return {
            result: {
                message: "Directory created.",
                entry
            },
            cwd
        };
    }

    if (op === "mkfile") {
        const name = fsCleanName(body.name);

        const entry = await fsCreateFile(
            userSupabase,
            user,
            profile,
            currentDirectory.id,
            name
        );

        return {
            result: {
                message: `File created: ${name}`,
                entry
            },
            cwd
        };
    }

    if (op === "write" || op === "append") {
        if (typeof body.content !== "string") {
            fsRaise(
                "INVALID_REQUEST",
                "File content must be a string."
            );
        }

        const target = targetFromRequest(body, cwd);

        const parent = await resolveFsDirectory(
            userSupabase,
            user,
            profile,
            root,
            target.parent
        );

        let entry = await fsGetChild(
            userSupabase,
            user,
            profile,
            parent.id,
            target.name
        );

        if (op === "append" && !entry) {
            fsRaise(
                "NOT_FOUND",
                `File not found: ${target.path}`
            );
        }

        if (op === "write" && body.createOnly === true && entry) {
            fsRaise(
                "CONFLICT",
                `An entry already exists at ${target.path}.`
            );
        }

        if (
            body.etag !== undefined &&
            body.etag !== null &&
            (!entry || currentEtag(entry) !== body.etag)
        ) {
            fsRaise(
                "CONFLICT",
                `The file changed on the server: ${target.path}`
            );
        }

        const supplied = Buffer.from(body.content, "utf8");

        if (!entry) {
            entry = await fsCreateFile(
                userSupabase,
                user,
                profile,
                parent.id,
                target.name,
                supplied
            );

            return {
                result: {
                    message: `File written: ${target.path}`,
                    etag: currentEtag(entry),
                    entry
                },
                cwd
            };
        }

        if (entry.kind !== "file") {
            fsRaise(
                "IS_DIRECTORY",
                `"${target.name}" is a directory, not a file.`
            );
        }

        let nextBuffer = supplied;

        if (op === "append") {
            nextBuffer = Buffer.concat([
                await fsDownloadBuffer(userSupabase, entry),
                supplied
            ]);
        }

        const updated = await fsUploadBuffer(
            userSupabase,
            entry,
            nextBuffer
        );

        return {
            result: {
                message: op === "append"
                    ? `File updated by appending: ${target.path}`
                    : `File written: ${target.path}`,
                etag: currentEtag(updated),
                entry: updated
            },
            cwd
        };
    }

    if (op === "read") {
        const path = typeof body.path === "string"
            ? fsCleanPath(body.path)
            : pathJoin(cwd, fsCleanName(body.name));

        const entry = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            path
        );

        if (entry.kind !== "file") {
            fsRaise(
                "IS_DIRECTORY",
                "The requested path is not a file."
            );
        }

        const buffer = await fsDownloadBuffer(
            userSupabase,
            entry
        );

        return {
            result: {
                content: buffer.toString("utf8"),
                name: entry.name,
                path,
                etag: currentEtag(entry),
                size: buffer.length
            },
            cwd
        };
    }

    if (op === "delete_file") {
        const path = fsCleanPath(body.path ?? "");

        if (!path) {
            fsRaise(
                "INVALID_PATH",
                "The profile root cannot be deleted as a file."
            );
        }

        const entry = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            path
        );

        if (entry.kind !== "file") {
            fsRaise(
                "IS_DIRECTORY",
                "Use deldir to delete a directory."
            );
        }

        await fsRemoveSubtree(
            userSupabase,
            user,
            profile,
            entry,
            path
        );

        return {
            result: {
                message: `File deleted: ${path}`
            },
            cwd
        };
    }

    if (op === "deldir") {
        const path = fsCleanPath(body.path ?? "");

        if (!path) {
            fsRaise(
                "INVALID_PATH",
                "The profile root cannot be deleted."
            );
        }

        const entry = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            path
        );

        if (entry.kind !== "dir") {
            fsRaise(
                "NOT_DIRECTORY",
                "The requested path is not a directory."
            );
        }

        const subtree = await fsCollectSubtree(
            userSupabase,
            user,
            profile,
            entry,
            path
        );

        if (subtree.length > 1 && body.confirm !== true) {
            fsRaise(
                "CONFIRM_REQUIRED",
                "The directory is not empty. Confirm recursive deletion."
            );
        }

        await fsRemoveSubtree(
            userSupabase,
            user,
            profile,
            entry,
            path
        );

        const nextCwd =
            cwd === path || cwd.startsWith(`${path}/`)
                ? parentPath(path)
                : cwd;

        return {
            result: {
                message: `Directory deleted: ${path}`
            },
            cwd: nextCwd
        };
    }

    if (op === "rename") {
        const path = fsCleanPath(body.path ?? "");
        const newName = fsCleanName(
            body.name ?? body.target ?? body.newName
        );

        if (!path) {
            fsRaise(
                "INVALID_PATH",
                "The profile root cannot be renamed."
            );
        }

        const entry = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            path
        );

        const { data, error } = await userSupabase
            .from("fs_entries")
            .update({
                name: newName,
                updated_at: new Date().toISOString()
            })
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("id", entry.id)
            .select("*")
            .single();

        if (error) {
            fsCheckDatabaseError(error);
        }

        const newPath = pathJoin(parentPath(path), newName);

        const nextCwd =
            cwd === path || cwd.startsWith(`${path}/`)
                ? newPath + cwd.slice(path.length)
                : cwd;

        return {
            result: {
                message: `Renamed to: ${newName}`,
                entry: data
            },
            cwd: nextCwd
        };
    }

    if (op === "move" || op === "copy") {
        const sourcePath = fsCleanPath(body.path ?? "");
        const destinationPath = fsCleanPath(
            body.destination ?? ""
        );

        if (!sourcePath) {
            fsRaise(
                "INVALID_PATH",
                "The profile root cannot be moved or copied."
            );
        }

        const source = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            sourcePath
        );

        const destinationDirectory = await resolveFsDirectory(
            userSupabase,
            user,
            profile,
            root,
            destinationPath
        );

        if (
            source.kind === "dir" &&
            (
                destinationPath === sourcePath ||
                destinationPath.startsWith(`${sourcePath}/`)
            )
        ) {
            fsRaise(
                "INVALID_PATH",
                "A directory cannot be placed inside itself or one of its descendants."
            );
        }

        if (op === "move") {
            const { data, error } = await userSupabase
                .from("fs_entries")
                .update({
                    parent_id: destinationDirectory.id,
                    updated_at: new Date().toISOString()
                })
                .eq("owner_id", user.id)
                .eq("profile", profile)
                .eq("id", source.id)
                .select("*")
                .single();

            if (error) {
                fsCheckDatabaseError(error);
            }

            const newPath = pathJoin(
                destinationPath,
                source.name
            );

            const nextCwd =
                source.kind === "dir" &&
                (
                    cwd === sourcePath ||
                    cwd.startsWith(`${sourcePath}/`)
                )
                    ? newPath + cwd.slice(sourcePath.length)
                    : cwd;

            return {
                result: {
                    message: `Moved: ${sourcePath}`,
                    entry: data
                },
                cwd: nextCwd
            };
        }

        const newPath = pathJoin(
            destinationPath,
            source.name
        );

        const entry = await fsCloneEntry(
            userSupabase,
            user,
            profile,
            source,
            destinationDirectory.id,
            source.name,
            newPath
        );

        return {
            result: {
                message: `Copied: ${sourcePath}`,
                entry
            },
            cwd
        };
    }

    if (op === "stat") {
        const path = fsCleanPath(body.path ?? cwd);

        const entry = await fsResolveEntry(
            userSupabase,
            user,
            profile,
            root,
            path
        );

        const children = entry.kind === "dir"
            ? await fsGetChildren(
                userSupabase,
                user,
                profile,
                entry.id
            )
            : [];

        const sizeBytes = entry.kind === "file"
            ? Number(entry.size || 0)
            : 0;

        const output = [
            `Name: ${entry.name}`,
            `Type: ${entry.kind}`,
            `Path: ${path || "."}`,
            `Size: ${sizeBytes} bytes`,
            `Children: ${children.length}`,
            `Created: ${entry.created_at || "unknown"}`,
            `Updated: ${entry.updated_at || "unknown"}`
        ].join("\n");

        return {
            result: {
                name: entry.name,
                kind: entry.kind,
                path,
                sizeBytes,
                childCount: children.length,
                createdAt: entry.created_at || null,
                updatedAt: entry.updated_at || null,
                output
            },
            cwd
        };
    }

    if (op === "tree") {
        const node = await fsBuildTreeMode(
            userSupabase,
            user,
            profile,
            currentDirectory
        );

        return {
            result: {
                tree: node,
                output: fsRenderTree(
                    node,
                    currentDirectory.name
                )
            },
            cwd
        };
    }

    if (op === "du") {
        const entries = await fsCollectSubtree(
            userSupabase,
            user,
            profile,
            currentDirectory,
            cwd
        );

        const bytes = entries
            .filter((entry) => entry.kind === "file")
            .reduce(
                (total, entry) => total + Number(entry.size || 0),
                0
            );

        return {
            result: {
                bytes,
                output: `Total size: ${bytes} bytes`
            },
            cwd
        };
    }

    if (op === "find") {
        const pattern = body.pattern;

        if (
            typeof pattern !== "string" ||
            !pattern ||
            pattern.length > 256
        ) {
            fsRaise(
                "INVALID_REQUEST",
                "Provide a valid find pattern."
            );
        }

        const matcher = fsGlobToRegex(pattern);

        const subtree = await fsCollectSubtree(
            userSupabase,
            user,
            profile,
            currentDirectory,
            cwd
        );

        const entries = subtree
            .filter((entry) => entry.id !== currentDirectory.id)
            .map((entry) => ({
                name: entry.name,
                kind: entry.kind,
                path: cwd
                    ? entry.relativePath.slice(cwd.length + 1)
                    : entry.relativePath
            }))
            .filter((entry) =>
                matcher.test(
                    pattern.includes("/") ? entry.path : entry.name
                )
            );

        return {
            result: {
                entries,
                output: entries.length
                    ? entries.map((entry) => entry.path).join("\n")
                    : "No matches found."
            },
            cwd
        };
    }

    if (op === "grep") {
        const pattern = body.pattern;

        if (
            typeof pattern !== "string" ||
            !pattern ||
            pattern.length > 256
        ) {
            fsRaise(
                "INVALID_REQUEST",
                "Provide a valid grep pattern."
            );
        }

        const subtree = await fsCollectSubtree(
            userSupabase,
            user,
            profile,
            currentDirectory,
            cwd
        );

        const matches = [];
        let bytesScanned = 0;

        for (const entry of subtree) {
            if (
                entry.kind !== "file" ||
                matches.length >= 1000
            ) {
                continue;
            }

            const buffer = await fsDownloadBuffer(
                userSupabase,
                entry
            );

            bytesScanned += buffer.length;

            if (bytesScanned > 50 * 1024 * 1024) {
                fsRaise(
                    "TOO_MANY_ENTRIES",
                    "The grep request exceeds the scan limit."
                );
            }

            const lines = buffer.toString("utf8").split(/\r?\n/);

            const path = cwd
                ? entry.relativePath.slice(cwd.length + 1)
                : entry.relativePath;

            for (let index = 0; index < lines.length; index++) {
                if (
                    lines[index]
                        .toLocaleLowerCase()
                        .includes(pattern.toLocaleLowerCase())
                ) {
                    matches.push({
                        path,
                        line: index + 1,
                        content: lines[index]
                    });

                    if (matches.length >= 1000) {
                        break;
                    }
                }
            }

            if (matches.length >= 1000) {
                break;
            }
        }

        return {
            result: {
                matches,
                output: matches.length
                    ? matches.map((match) =>
                        `${match.path}:${match.line}: ${match.content}`
                    ).join("\n")
                    : "No matches found."
            },
            cwd
        };
    }

    fsRaise(
        "UNSUPPORTED_OPERATION",
        "Filesystem operation is not implemented."
    );
}

async function handleFilesystemRequest(req, res, internal) {
    let cwd = "";

    try {
        const body =
            req.body && typeof req.body === "object"
                ? req.body
                : {};

        const token = internal
            ? body.token
            : bearerToken(req);

        const authenticated =
            await authenticateFilesystemRequest(token);

        const userSupabase = authenticated.supabase;
        const user = authenticated.user;

        const profile = validateFsProfile(
            body.profile ||
            user.user_metadata?.fs_profile ||
            user.email?.split("@")[0]
        );

        cwd = fsCleanPath(body.cwd ?? "");

        const outcome = await runFsOperation({
            userSupabase,
            user,
            profile,
            body,
            cwd
        });

        return sendFsSuccess(
            res,
            outcome.result,
            outcome.cwd ?? cwd
        );
    } catch (error) {
        return sendFsError(res, error, cwd);
    }
}

app.get("/", (_req, res) => {
    res.json({
        ok: true,
        service: "valcon-node-bridge"
    });
});

app.get("/server_bridge", (_req, res) => {
    res.json({
        ok: true,
        service: "node",
        message: "VALCON bridge is available."
    });
});

app.get("/server_bridge/cpp", async (_req, res) => {
    if (!CPP_BACKEND_URL) {
        return res.status(503).json({
            ok: false,
            error: "CPP_BACKEND_URL is not configured."
        });
    }

    try {
        const response = await fetch(
            `${CPP_BACKEND_URL}/server_bridge`,
            {
                signal: AbortSignal.timeout(10000)
            }
        );

        const text = await response.text();

        return res.status(response.status).json({
            ok: response.ok,
            service: "cpp",
            response: text
        });
    } catch (error) {
        return res.status(502).json({
            ok: false,
            error: "C++ backend unavailable."
        });
    }
});

app.post("/fs", (req, res) =>
    handleFilesystemRequest(req, res, false)
);

app.post(
    "/server_bridge/fs",
    requireValconBridgeKey,
    (req, res) => handleFilesystemRequest(req, res, true)
);

app.get("/json", (_req, res) => {
    res.json({
        ok: true,
        service: "node",
        message: "VALCON terminal endpoint is available."
    });
});

app.post("/json", async (req, res) => {
    try {
        const body = req.body || {};

        const token = typeof body.token === "string"
            ? body.token
            : bearerToken(req);

        if (!CPP_BACKEND_URL) {
            return res.status(503).json({
                success: false,
                error: "CPP_BACKEND_URL is not configured."
            });
        }

        if (
            typeof body.command !== "string" ||
            !body.command.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "command is required."
            });
        }

        const { user } =
            await authenticateFilesystemRequest(token);

        const profile = validateFsProfile(
            body.profile ||
            user.user_metadata?.fs_profile ||
            user.email?.split("@")[0]
        );

        const cwd = fsCleanPath(
            body.cwd ?? body.path ?? ""
        );

        const response = await fetch(
            `${CPP_BACKEND_URL}/json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    profile,
                    cwd,
                    command: body.command,
                    terminal: Number.isInteger(body.terminal)
                        ? body.terminal
                        : 0
                }),
                signal: AbortSignal.timeout(35000)
            }
        );

        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            return res.status(502).json({
                success: false,
                error: "C++ backend returned invalid JSON."
            });
        }

        return res.status(response.status).json(data);
    } catch (error) {
        const errorStatus = FS_ERROR_STATUS[error?.code];

        if (errorStatus) {
            return res.status(errorStatus).json({
                success: false,
                code: error.code,
                error: error.message || "Request failed."
            });
        }

        console.error("VALCON TERMINAL ERROR:", error);

        return res.status(502).json({
            success: false,
            error: "C++ backend unavailable."
        });
    }
});

app.post("/auth/register", async (req, res) => {
    try {
        const username = String(req.body?.username || "")
            .trim()
            .toLowerCase();

        const password = req.body?.password;

        if (!/^[a-z0-9_-]{2,64}$/.test(username)) {
            return res.status(400).json({
                ok: false,
                message: "Username must contain 2–64 letters, numbers, underscores or hyphens."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!process.env.SUPABASE_URL ||
            !process.env.SUPABASE_SECRET_KEY) {
            return res.status(500).json({
                ok: false,
                message: "Server-side Supabase configuration is missing."
            });
        }

        const email = `${username}@accounts.valcon.invalid`;

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                username,
                fs_profile: username
            }
        });

        if (error) {
            const status = /already|registered|exists/i.test(error.message)
                ? 409
                : 400;

            return res.status(status).json({
                ok: false,
                message: status === 409
                    ? "That username is already registered."
                    : error.message
            });
        }

        return res.status(201).json({
            ok: true,
            user: {
                id: data.user.id,
                username
            }
        });
    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            ok: false,
            message: "Registration failed due to a server error."
        });
    }
});

app.delete("/account", async (req, res) => {
    try {
        if (!adminSupabase) {
            return res.status(503).json({
                ok: false,
                error: "Account deletion is not configured."
            });
        }

        const { user } = await authenticateFilesystemRequest(
            bearerToken(req)
        );

        const { error } =
            await adminSupabase.auth.admin.deleteUser(user.id);

        if (error) {
            throw error;
        }

        return res.json({ ok: true });
    } catch (error) {
        if (error?.code === "UNAUTHORIZED") {
            return res.status(401).json({
                ok: false,
                error: error.message
            });
        }

        console.error("VALCON ACCOUNT DELETE ERROR:", error);

        return res.status(500).json({
            ok: false,
            error: "Account deletion failed."
        });
    }
});

app.use((error, _req, res, _next) => {
    if (error?.type === "entity.too.large") {
        return res.status(413).json({
            ok: false,
            code: "TOO_LARGE",
            message: "Request body is too large.",
            cwd: ""
        });
    }

    if (error?.message === "Origin not allowed.") {
        return res.status(403).json({
            ok: false,
            code: "FORBIDDEN",
            message: "Origin not allowed.",
            cwd: ""
        });
    }

    console.error("VALCON REQUEST ERROR:", error);

    return res.status(500).json({
        ok: false,
        code: "INTERNAL",
        message: "Internal server error.",
        cwd: ""
    });
});

app.listen(PORT, () => {
    console.log(`VALCON bridge listening on port ${PORT}`);
});
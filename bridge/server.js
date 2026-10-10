require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {createClient} = require("@supabase/supabase-js");
const BUCKET_NAME = "valcon-files";
const SUPABASE_PUBLIC_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
const { randomUUID } = require ("node:crypto");

const FS_CONTRACT = require("./fs-contract.json");
const FS_OPERATIONS = new Set(FS_CONTRACT.request.properties.op.enum);
const FS_ERROR_STATUS = FS_CONTRACT.errors;

class FsError extends Error {
    constructor(code, message) {
        super(message);

        this.name = "FsError";
        this.code = code;
    }
}


function sendFsSuccess(res, result = {}, cwd = ""){
    return res.status(200).json({
        ok: true,
        result,
        cwd
    });
}

function sendFsError(res, error, cwd = "") {
    const requestedCode =
        error && typeof error.code === "string"
            ? error.code
            : "";

    const code =
        Object.prototype.hasOwnProperty.call(
            FS_ERROR_STATUS,
            requestedCode
        )
            ? requestedCode
            : "INTERNAL";

    const status = FS_ERROR_STATUS[code];

    let message;

    if (code === "INTERNAL") {
        console.error("VALCON FILESYSTEM ERROR:", error);
        message = "Internal filesystem error.";
    } else {
        message =
            error && typeof error.message === "string"
                ? error.message
                : code;
    }

    return res.status(status).json({
        ok: false,
        code,
        message,
        cwd
    });
}

function requireValconBridgeKey(req, res, next){
    const configured = process.env.VALCON_BRIDGE_KEY;
    const recieved = req.get("X-VALCON-BRIDGE-KEY");

    if (!configured || !recieved){
        return sendFsError(
            res,
            new FsError(
                "FORBIDDEN",
                "Bridge authentication required."
            )
        );
    }

    const expectedBuffer = Buffer.from(configured);
    const recievedBuffer = Buffer.from(recieved);

    if (
        expectedBuffer.length !== recievedBuffer.length ||
        !require("crypto").timingSafeEqual(
            expectedBuffer,
            recievedBuffer
        )
    ){
        return sendFsError(res, new FsError(
            "FORBIDDEN",
            "Bridge authentication required."

        ));
    }

    next();
}

async function authenticateFilesystemRequest(token) {
    if (typeof token !== "string" || token.length === 0) {
        throw new FsError(
            "UNAUTHORIZED",
            "Authentication required."
        );
    }

    const userSupabase = createUserSupabase(token);

    const { data, error } =
        await userSupabase.auth.getUser(token);

    if (error || !data || !data.user) {
        throw new FsError(
            "UNAUTHORIZED",
            "Invalid or expired authentication token."
        );
    }

    return {
        supabase: userSupabase,
        user: data.user
    };
}

function normalizeFsPath(rawPath) {
    if (typeof rawPath !== "string") {
        throw new FsError(
            "INVALID_PATH",
            "path must be a string."
        );
    }

    if (rawPath.length > 1024) {
        throw new FsError(
            "INVALID_PATH",
            "path exceeds the maximum length"
        );
    }

    if (rawPath.startsWith("/") || rawPath.startsWith("\\") || /^[A-Za-z]:/.test(rawPath)) {
        throw new FsError(
            "INVALID_PATH",
            "path exceeds the maximum length"
        );
    }
    const normalized = rawPath.replace(/\\/g, "/");
    if (normalized === "") {
        return "";
    }

    const parts = normalized.split("/");

    for (const part of parts) {
        if (
            part === "" || part === "." || part === ".."
        ) {
            throw new FsError(
                "INVALID_PATH",
                "path contains an invalid component"
            );
        }

        if (/[\u0000-\u001F\u007F]/u.test(part)) {
            throw new FsError(
                "INVALID_PATH",
                "Control characters are not allowed in paths."
            );
        }

    }
    return parts.join("/");
}


function validateFsName(rawName) {
    if (typeof rawName !== "string") {
        throw new FsError(
            "INVALID_NAME",
            "Name must be a string."
        );
    }

    if (
        rawName.length === 0 ||
        Array.from(rawName).length > 255 ||
        rawName === "." ||
        rawName === ".." ||
        rawName.includes("/") ||
        rawName.includes("\\") ||
        /[\u0000-\u001F\u007F]/u.test(rawName)
    ) {
        throw new FsError(
            "INVALID_NAME",
            "Invalid filename or directory name."
        );
    }

    return rawName;
}


function validateFsProfile(rawProfile) {
    if (
        typeof rawProfile !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(rawProfile)
    ) {
        throw new FsError(
            "INVALID_NAME",
            "Invalid profile name."
        );
    }

    return rawProfile;
}

function createUserSupabase(token) {
    if (!process.env.SUPABASE_URL || !SUPABASE_PUBLIC_KEY){
        throw new FsError(
            "INTERNAL",
            "Supabase public configuration is missing."
        );
    }

    return createClient(
        process.env.SUPABASE_URL,
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

function fsRaise(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
}

function fsCleanPath(value){
    if (value === undefined || value === null)
    {
        return "";
    }

    if (typeof value !== "string"){
        fsRaise("INVALID PATH", "The path must be a string.");
    }

    const raw = value.trim().replace(/\\/g, "/");

    if (
        raw.startWith("/") || /^[a-zA-Z]:/.test(raw) || raw.length > 1024
    ){
        fsRaise("INVALID_PATH", "invalid file sytem path");
    }

    const parts = raw.split("/").filter(Boolean);

    if (parts.some(part => part === "." || part === ".."))
    {
        fsRaise("INVALID_PATH", "Path traversal is not allowed ");
    }

    return parts.join("/");
}

function fsCleanName(value) {
    if (typeof value !== "string"){
        fsRaise("INVALID_NAME", "a name is required");
    }

    const name = value.trim();
    if(
        !name ||
        name.length > 255 ||
        name === "." ||
        name === ".." ||
        /[\/\\\u0000-\u001f\u007f]/u.test(name)
    ){
        fsRaise("INVALID_PATH", "invalid file or directory name.");
    }
    return name;
}

function fsCheckDatabaseError(error) {
    if (error?.code === "23505")
    {
        fsRaise(
            "ALREADY_EXISTS",
            "An entry with that name already exists."
        );
    }

    throw error;
}

async function fsGetChildren(
    userSupabase,
    user,
    profile,
    parentId
){
    const entries = [];
    let offset = 0;
    const pageSize = 1000;

    while (true){
        const { data, error } = await userSupabase
            .from("fs_entries")
            .select("*")
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("parent_id", parentId)
            .order("name", {ascending: true})
            .range(offset, offset + pageSize - 1);

        if (error)
        {
            throw error;
        }

        entries.push(...(data || []));

        if(!data || data.length < pageSize){
            break;
        }

        offset += pageSize;
        if (entries.length >= 5000){
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
){
    const {}

}



async function findOrCreateFsRoot(userSupabase, user,profile){
    const selectRoot = () => {
        return userSupabase.from("fs_entries").select(
            "id, owner_id, profile, parent_id, name, kind, size, storage_key, created_at, updated_at"
        )
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .is("parent_id", null)
            .maybeSingle();
    };

    const existing = await selectRoot();

    if (existing.error)
    {
        throw existing.error;
    }

    if (existing.data)
    {
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
        .select(
            "id, owner_id, profile, parent_id, name, kind, size, storage_key, created_at, updated_at"
        )
        .single();

    if(!inserted.error)
    {
        return inserted.data;
    }

    if (inserted.error.code === "23505"){
        const retry = await selectRoot();

        if (!retry.error && retry.data){
            return retry.data;
        }
    }
    throw inserted.error;
}

async function resolveFsDirectory(
    userSupabase,
    user,
    profile,
    root,
    relativePath
){
    let current = root;
    if (relativePath === "")
    {
        return current;
    }

    const parts = relativePath.split("/");

    for (const part of parts){
        const {data, error} = await userSupabase.from("fs_entries").select(
            "id, owner_id, profile, parent_id, name, kind, size, storage_key, created_at, updated_at"
        )
            .eq("owner_id", user.id)
            .eq("profile", profile)
            .eq("parent_id", current.id)
            .eq("name", part)
            .eq("kind", "dir")
            .maybeSingle();
        if (error) {
            throw error;
        }

        if (!data)
        {
            throw new FsError(
                "NOT_FOUND",
                `directory '${relativePath}' doesn't exist.`
            );
        }

        current = data;

    }
    return current;
}


const CPP_BACKEND_URL = (process.env.CPP_BACKEND_URL || "").replace(/\/+$/, "");
const app = express();
app.use(cors());
app.use(express.json());
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY);

const PORT = process.env.PORT || 3000;//dont change this varieable

app.use(express.json());

app.post("/server_bridge/fs", requireValconBridgeKey,
    async (req,res) => {
        let cwd = "";

        try{
            const body = req.body || {};

            if (
                typeof body.token !== "string" ||
                body.token.length === 0
            ){
                throw new FsError(
                    "UNAUTHORIZED",
                    "Authentication required"
                );
            }

            const authenticated = await authenticateFilesystemRequest(body.token);
            const userSupabase = authenticated.supabase;
            const user = authenticated.user;

            const profile = validateFsProfile(body.profile);

            cwd = normalizeFsPath(body.cwd);

            if ( typeof body.op !== "string" || !FS_OPERATIONS.has(body.op))
            {
                throw new FsError(
                    "UNSUPPORTED",
                    "Unknown filesystem operation."
                );
            }

            const implementedOperations = new Set(["cd", "ls", "mkdir"]);

            if(!implementedOperations.has(body.op)) {
                throw new FsError(
                    "UNSUPPORTED",
                    `Operation '${body.op}' is not implemented yet`
                );
            }
            const root = await findOrCreateFsRoot(
              userSupabase,
              user,
              profile
            );

            if (body.op === "cd") {
                const targetPath =
                    normalizeFsPath(body.path ?? "");

                await resolveFsDirectory(
                    userSupabase,
                    user,
                    profile,
                    root,
                    targetPath
                );

                return sendFsSuccess(
                    res,
                    {
                        message: "Directory changed."
                    },
                    targetPath
                );
            }

            const currentDirectory = await resolveFsDirectory(
                userSupabase,
                user,
                profile,
                root,
                cwd
            );

            if (body.op === "ls") {
                const { data, error } = await userSupabase
                    .from("fs_entries")
                    .select(
                        "id, name, kind, size, created_at, updated_at"
                    )
                    .eq("owner_id", user.id)
                    .eq("profile", profile)
                    .eq("parent_id", currentDirectory.id)
                    .order("kind", { ascending: true })
                    .order("name", { ascending: true });

                if (error) {
                    throw error;
                }

                const entries = (data || []).map(entry => ({
                    id: entry.id,
                    name: entry.name,
                    kind: entry.kind,
                    size: entry.size,
                    mtime: entry.updated_at,
                    created_at: entry.created_at,
                    updated_at: entry.updated_at
                }));

                return sendFsSuccess(
                    res,
                    {
                        entries,
                        message: `${entries.length} entries.`
                    },
                    cwd
                );
            }

            if (body.op === "mkdir") {
                const name = validateFsName(body.name);

                const { data, error } = await userSupabase
                    .from("fs_entries")
                    .insert({
                        owner_id: user.id,
                        profile,
                        parent_id: currentDirectory.id,
                        name,
                        kind: "dir",
                        size: 0,
                        storage_key:null
                    })
                    .select(
                        "id, name, kind, size, created_at, updated_at"
                    )
                    .single();
                if (error){
                    if (error.code === "23505"){
                        throw new FsError(
                            "EXISTS",
                            `an entry named '${name}' already exists.`
                        );
                    }

                    throw error;
                }

                return sendFsSuccess(
                    res,
                    {
                        message: "DIrectory created.",
                        entry:{
                            id: data.id,
                            name: data.name,
                            kind: data.kind,
                            size: data.size,
                            created_at: data.created_at,
                            updated_at: data.updated_at
                        }
                    },
                    cwd
                );
            }

            throw new FsError(
                "UNSUPPORTRED",
                "FILESYSTEM IS NOT IMPLEMENTED."
            );
        }catch (error) {
            return sendFsError(res, error, cwd);
        }
    }
);

async function buildFolderTree(profile, currentPath = "") {

    const cleanProfile = String(profile).trim().replace(/^\/+|\/+$/g, "");

    const cleanPath = String(currentPath || "").trim().replace(/^\/+|\/+$/g, "");

    const profileRoot = `${cleanProfile}/Desktop/${cleanProfile}`;

    const startPath = cleanPath ? `${profileRoot}/${cleanPath}` : profileRoot;

    async function readDirectory(storagePath) {

        let entries = [];
        let offset = 0;
        const limit = 1000;

        while (true) {

            const { data, error } = await supabase
                .storage.from(BUCKET_NAME).list(storagePath, {
                    limit: limit,
                    offset: offset,
                    sortBy: {
                        column: "name",
                        order: "asc"
                    }
                });

            if (error) {
                throw error;
            }

            if (!data || data.length === 0) {
                break;
            }

            entries.push(...data);

            if (data.length < limit) {
                break;
            }

            offset += limit;
        }

        const children = [];

        for (const entry of entries) {

            // Internal Supabase/VALCON folder markers
            if (entry.name === ".folder" || entry.name === ".emptyFolderPlaceholder" ) {
                continue;
            }

            const isFolder = entry.id === null;

            if (isFolder) {

                const childPath = `${storagePath}/${entry.name}`;

                children.push({
                    name: entry.name,
                    type: "folder",
                    children: await readDirectory(childPath)
                });

            } else {

                children.push({
                    name: entry.name,
                    type: "file"
                });
            }
        }

        return children;
    }

    const children = await readDirectory(startPath);

    const rootName = cleanPath ? cleanPath.split("/").pop() : cleanProfile;

    function renderChildren(children, prefix = "") {

        let output = "";

        children.forEach((child, index) => {

            const isLast = index === children.length - 1;

            const connector = isLast ? "|___ " : "|--- ";

            output += prefix + connector + child.name + "\n";

            if (child.type === "folder") {

                const childPrefix = prefix + (
                    isLast ? "    ": "|   "
                );

                output += renderChildren(child.children, childPrefix);
            }
        });

        return output;
    }

    let output = rootName + "\n";

    if (children.length > 0) {
        output += "│\n";
        output += renderChildren(children);
    }

    return output;
}

app.get("/server_bridge", (req, res) => {
    res.json({
        status: "ok",
        service: "node",
        message: "BRIGE SERVICE IS AVAILABLE"
    });
})

app.get("/server_bridge/cpp", async (req, res) => {
    try {
        if (!CPP_BACKEND_URL) {
            return res.status(503).json({
                success: false,
                error: "CPP_BACKEND_URL is not configured"
            });
        }

        const response = await fetch(
            `${CPP_BACKEND_URL}/server_bridge`
        );

        const data = await response.text();

        res.json({
            success: true,
            node: "node is working",
            cpp: data
        });

    } catch (err) {
        console.error("C++ CONNECTION ERROR:", err);

        res.status(502).json({
            success: false,
            node: "node is working",
            cpp: "C++ backend unavailable",
            error: err.message
        });
    }
});
app.get("/server_bridge/supabase", async (req, res) =>{
    try {
        const {data , error} = await supabase
            .storage
            .listBuckets();

        if (error)
        {
            throw error;
        }

        res.json({
            success: true,
            service: "supabase",
            status: "ok",
            bucket: data
        })
    }
    catch(error)
    {
        console.error("SUPABASE ERROR: ", error);

        return res.status(502).json({
            sccess: false,
            service: "supabase",
            status: "error",
            error: "Supabase health check failed"
        });
    }
});
app.post("/server_bridge/files/create", async(req,res) => {
    try {
        const {filename} = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                error: "filename is required"
            });
        }
        const {data, error} = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, Buffer.from("","utf8"), {
                contentType: "text/plain",
                upsert: false
            });
        if (error) {
            throw error;
        }
        res.json({
            success: true,
            operation: "create",
            filename: filename,
            data: data
        });
    }
    catch(error){
        console.error(error);

        res.status(400).json({
            success: false,
            error:error.message //dont need that much only when testing
        });
    }
});

app.post("/server_bridge/files/write", async(req,res) => {
    try {
        const{filename, content} = req.body;

        if(!filename){
            return res.status(400).json({
                success: false,
                error: "filename is required"
            });
        }
        const fileContent = content || "";

        const {data, error} = await supabase.storage
            .from(BUCKET_NAME)
            .upload(
                filename,
                Buffer.from(fileContent,"utf-8"),{
                    contentType: "text/plain",
                    upsert: true
                }
            );
        if (error){
            throw error;
        }
        res.json({
            success: true,
            operation: "write",
            filename: filename,
            data: data
        });
    }
    catch(error){
        console.error(error);
        res.status(400).json({
            success: false,
            error: error.message//@GuruOrGoru when need to check logs
        });
    }
});

app.get("/server_bridge/files/read/:filename", async(req,res) => {
    try{
        const filename = req.params.filename;
        const{data,error} = await supabase.storage.from(BUCKET_NAME).download(filename);

        if (error)
        {
            throw error;
        }
        const text = await data.text();

        res.json({
            success: true,
            operation: "read",
            filename: filename,
            content: text
        });
    }
    catch(error){
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
app.delete("/server_bridge/files/delete/:filename", async (req,res) => {
    try{
        const filename = req.params.filename;
        const {data, error} = await supabase.storage.from(BUCKET_NAME).remove([filename]);
        if (error)
        {
            throw error;
        }
        res.json({
            success:true,
            operation:"delete",
            filename : filename,
            data:data
        });
    }
    catch(error){
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
app.get("/server_bridge/files/list", async (req, res) => {
    try {
        const { data, error } = await supabase
            .storage
            .from("valcon-files")
            .list("", {
                limit: 100,
                offset: 0
            });

        if (error) {
            return res.status(500).json({
                success: false,
                operation: "list",
                error: error.message
            });
        }

        return res.json({
            success: true,
            operation: "list",
            files: data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            operation: "list",
            error: error.message
        });
    }
});

app.post("/server_bridge/folders/list", async (req, res) => {
    try {

        const { profile, path } = req.body;

        if (!profile) {
            return res.status(400).json({
                success: false,
                error: "profile is required"
            });
        }

        const cleanProfile = String(profile)
            .trim()
            .replace(/^\/+|\/+$/g, "");

        const cleanPath = String(path || "")
            .trim()
            .replace(/^\/+|\/+$/g, "");

        if (
            cleanProfile.includes("..") ||
            cleanProfile.includes("\\") ||
            cleanPath.split("/").some(part => part === "..") ||
            cleanPath.includes("\\")
        ) {
            return res.status(400).json({
                success: false,
                error: "invalid path"
            });
        }

        const output = await buildFolderTree(
            cleanProfile,
            cleanPath
        );

        return res.json({
            success: true,
            operation: "list",
            profile: cleanProfile,
            path: cleanPath,
            output: output
        });

    } catch (error) {

        console.error("FOLDER LIST ERROR:", error);

        return res.status(500).json({
            success: false,
            operation: "list",
            error: error.message
        });
    }
});

app.post("/server_bridge/folders/mkdir", async (req, res) => {
   try {
       const { profile, path } = req.body;

       if (!profile || !path) {
           return res.status(400).json({
               success: false,
               error: "please profile and path"
           });
       }
       const cleanProfile = String(profile).trim().replace(/^\/+|\/+$/g, "");
       const cleanPath = String(path).trim().replace(/^\/+|\/+$/g, "");

       if (
           cleanProfile.includes("..") ||
           cleanProfile.includes("\\") ||
           cleanPath.includes("\\") ||
           cleanPath.split("/").some(part => part ==="..")
       ){
           return res.status(400).json({
               success: false,
               error: "invalid path"
           });
       }
       const folderPath = `${cleanProfile}/Desktop/${cleanProfile}/${cleanPath}`;

       const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(`${folderPath}/.folder`,
           Buffer.from(""),
           {
               contentType: "application/octet-stream",
               upsert: false
           }
       );

       if (error) {
           if (error.message &&
               (
                   error.message.toLowerCase().includes("already exists") ||
                   error.message.toLowerCase().includes("duplicate")
               )
           ){
               return res.status(409).json({
                   success: false,
                   error: "folder already exists"
               });
           }

           throw error;
       }

       return res.json({
           success: true,
           operation: "mkdir",
           profile: cleanProfile,
           path: cleanPath,
           data: data
       });
   } catch (error){
       console.error("FOLDER MKDIR ERROR:", error);

       return res.status(500).json({
           success: false,
           operation: "mkdir",
           error: error.message,
       });
   }
});

app.post("/server_bridge/folders/check", async(req, res) => {
    try {
        const { profile, path} = req.body;

        if (!profile || !path){
            return res.status(400).json({
                success: false,
                error: "please provide a profile and path"
            });
        }

        const cleanProfile = String(profile).trim().replace(/^\/+|\/+$/g, "");
        const cleanPath = String(path).trim().replace(/^\/+|\/+$/g, "");

        if (
            cleanProfile.includes("..") ||
            cleanProfile.includes("\\") ||
            cleanPath.includes("\\") ||
            cleanPath.split("/").some(part => part === "..")
        ){
            return res.status(400).json({
                success: false,
                error: "invalid path"
            });
        }

        const folderPath = `${cleanProfile}/Desktop/${cleanProfile}/${cleanPath}`;

        const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folderPath, {
            limit: 1,
            offset: 0
        });

        if (error) {
            throw error;
        }

        const exists = data && data.length > 0;

        return res.json({
            success: true,
            operation: "check",
            profile: cleanProfile,
            path: cleanPath,
        });
    } catch (error){
        console.error("FOLDER CHECK ERROR:", error);

        return res.status(500).json({
            success: false,
            operation: "check",
            error: error.message
        });
    }
});

app.delete("/server_bridge/folders/delete", async (req, res) => {
   try {
       const { profile, path } = req.body;

       if (!profile || !path)
       {
           return res.status(400).json({
               success: false,
               error: "profile and path are required"
           });
       }

       const cleanProfile = String(profile).trim().replace(/^\/+|\/+$/g, "");
       const cleanPath = String(path).trim().replace(/^\/+|\/+$/g, "");

       if (
           cleanProfile.includes("..") ||
           cleanProfile.includes("\\") ||
           cleanPath.includes("\\") ||
           cleanPath.split("/").some(part => part ==="..")
       ){
           return res.status(400).json({
               success: false,
               error: "invalid path"
           });
       }

       const folderPath = `${cleanProfile}/Desktop/${cleanProfile}/${cleanPath}`;

       async function collectFiles(storagePath){
           const files = [];
           const { data, error } = await supabase.storage.from(BUCKET_NAME).list(storagePath, {
               limit: 1000,
               offset: 0
           });

           if (error){
               throw error;
           }

           if (!data || data.length === 0){
               return files;
           }

           for (const entry of data){

               const entryPath = `${storagePath}/${entry.name}`;

               if (entry.id === null){
                   const nestedFiles = await collectFiles(entryPath);
                   files.push(...nestedFiles);
               }
               else
               {
                   files.push(entryPath);
               }
           }

           return files;

       }

       const filesToDelete = await collectFiles(folderPath);

       if (filesToDelete.length === 0) {
           return res.json({
               success: true,
               operation: "delete",
               profile: cleanProfile,
               path: cleanPath,
               message: "folder was empty or did not exist"
           });
       }

       // Supabase allows removing multiple files at once.
       const { data, error } = await supabase
           .storage
           .from(BUCKET_NAME)
           .remove(filesToDelete);

       if (error) {
           throw error;
       }

       return res.json({
           success: true,
           operation: "delete",
           profile: cleanProfile,
           path: cleanPath,
           data: data
       });

   } catch (error) {
       console.error("FOLDER DELETE ERROR:", error);

       return res.status(500).json({
           success: false,
           operation: "delete",
           error: error.message
       });
   }
});

app.get("/json", (req, res) => {
    res.json({
        success: true,
        service: "node",
        message: "Node /json route is not working"
    });
});

app.post("/json", async (req, res) => {
   try {
       const {
           token,
           profile,
           cwd,
           path,
           command,
           terminal
       } = req.body || {};

       if (!profile){
           return res.status(400).json({
              success: false,
              error: "profile is required"
           });
       }

       if (!command){
           return res.status(400).json({
               success: false,
               error: "command is required"
           });
       }
       if (typeof token !== "string" || token.length === 0){
           return res.status(401).json({
               success: false,
               error: "auth required"
           });
       }

       if (!CPP_BACKEND_URL){
           return res.status(503).json({
               success: false,
               error: "CPP_BACKEND_URL IS NOT CONFIG"
           });
       }

       const response = await fetch(`${CPP_BACKEND_URL}/json`,
           {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({
                   token,
                   profile,
                   cwd: typeof cwd === "string" ? cwd : (typeof path === "string" ? path : ""),
                   command,
                   terminal: terminal ?? 0
               })
           });
       const text = await response.text();
       let data;
       try {
           data = JSON.parse(text);
       } catch
       {
           data = {
               success: false,
               error: text
           };
       }

       return res.status(response.status).json(data);
   } catch(error) {
       console.error("json bridge error:", error);

       return res.status(502).json({
           success: false,
           error: "C++ backend unavailable",
           details: error.message

       });
   }

});

app.listen(PORT, () => {
   console.log('bridge is running on port' + PORT);
});

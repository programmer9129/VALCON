require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {createClient} = require("@supabase/supabase-js");
const BUCKET_NAME = "valcon-files";
const SUPABASE_PUBLIC_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

const FS_CONTRACT = require("./fs-contract.json");
const FS_OPERATIONS = new Set(FS_CONTRACT.request.properties.op.enum);
const FS_ERROR_STATUS = FS_CONTRACT.errors;

class FSError extends Error {
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


const CPP_BACKEND_URL = (process.env.CPP_BACKEND_URL || "").replace(/\/+$/, "");
const app = express();
app.use(cors());
app.use(express.json());
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY);

const PORT = process.env.PORT || 3000;//dont change this varieable

app.use(express.json());

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

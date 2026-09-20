require("dotenv").config();

const express = require("express");
const {createClient} = require("@supabase/supabase-js");
const BUCKET_NAME = "valcon-files";

const ID_BACKEND_ADRESS = "https://valcon-r5ti.onrender.com/server_bridge";
//const ID_BACKEND_ADRESS_LIVE =
const app = express();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY);

const PORT = process.env.PORT || 3000;//dont change this varieable

app.use(express.json());

app.get("/server_bridge", (req, res) => {
    res.json({
        status: "ok",
        service: "node",
        message: "BRIGE SERVICE IS AVAILABLE"
    });
})

app.get("/server_bridge/cpp", async (req ,res) =>
{
   try{
       const response = await fetch(ID_BACKEND_ADRESS);

       const data = await response.json();
       res.json({
          success: true,
          node: "node is working",
          cpp: data
       });
   }
   catch(err){
       console.log(err);
       console.log('C++ brain is unable to connect to the bridge');
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
        console.log(error);
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
            error:error.massage//@GuruOrGoru when need to check logs
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

app.listen(PORT, () =>{
   console.log('bridge is running on port' + PORT);
});

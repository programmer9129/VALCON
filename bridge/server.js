require("dotenv").config();

const express = require("express");
const {createClient} = require("@supabase/supabase-js");

const ID_BACKEND_ADRESS = "http://localhost:8080/server_bridge";
//const ID_BACKEND_ADRESS_LIVE =
const app = express();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY);


const PORT = 3000;
const BACKEND_URL_TRUE = "http://localhost:8080";

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

app.listen(PORT, () =>{
   console.log('bridge is running on port' + PORT);
});

const express = require("express");
const ID_BACKEND_ADRESS = "http://localhost:8080/server_bridge";
//const ID_BACKEND_ADRESS_LIVE =
const app = express();
const PORT = 3000;
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

app.listen(PORT, () =>{
   console.log('bridge is running on port' + PORT);
});

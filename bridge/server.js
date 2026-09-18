const ID_BACKEND_ADRESS = "http//localhost:8080/health";
//const ID_BACKEND_ADRESS_LIVE =


app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "node",
        message: "BRIGE SERVICE IS AVAILABLE"
    });
});
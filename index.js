const express = require("express");
const app = express();
const { pdfMerger } = require("./utils.mjs");

const port = 3000;
app.use(express.json());



app.post("/merge-pdf", async (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "files must be a non-empty array" });
  }

  const response = await pdfMerger(files);
  return res.status(response.status).json(response.message);
});



app.post("/captcha-resolve", (req, res) => {
  res.send("captcha resolved");
});

app.listen(port, () => {
  console.log("app is running");
});

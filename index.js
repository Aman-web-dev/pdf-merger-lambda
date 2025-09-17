const express = require("express");
const app = express();
const { pdfMerger } = require("./utils.mjs");
const {captchaResolver}=require("./utils.mjs")
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




app.post("/captcha-resolve", async (req, res) => {
    try {
        const { imageAddr } = req.body;
        
        if (!imageAddr) {
            return res.status(400).json({ 
                error: "imageAddr is required",
                success: false 
            });
        }

        try {
            new URL(imageAddr);
        } catch (error) {
            return res.status(400).json({ 
                error: "imageAddr must be a valid URL",
                success: false 
            });
        }

        const transcription = await captchaResolver(imageAddr);
        
        res.json({ 
            success: true, 
            transcription: transcription,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('CAPTCHA resolve error:', error);
        
        const statusCode = error.message.includes('required') ? 400 : 500;
        
        res.status(statusCode).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});


app.listen(port, () => {
  console.log("app is running");
});

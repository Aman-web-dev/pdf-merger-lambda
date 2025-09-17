import { pdfMerger,captchaResolver } from "./utils.mjs";

console.log("Loading function");

export async function handler(event, context) {
    console.log('Lambda event:', JSON.stringify(event, null, 2));
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }

    const path = event.path;

    if (path === "/merge-pdf") {
        const body = JSON.parse(event.body || "{}");
        const files = body.files;

        if (!Array.isArray(files) || files.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: "files must be a non-empty array" })
            };
        }

        try {
            const response = await pdfMerger(files);
            return {
                statusCode: response.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response.message)
            };
        } catch (err) {
            console.error("pdfMerger handler error:", err);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    if (path === "/captcha-resolve") {
        try {
            const body = JSON.parse(event.body || "{}");
            const imageAddr = body.imageAddr;

            if (!imageAddr) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: "imageAddr is required" })
                };
            }

            const transcription = await captchaResolver(imageAddr);
            
            return {
                statusCode: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' 
                },
                body: JSON.stringify({ 
                    success: true, 
                    transcription: transcription,
                    timestamp: new Date().toISOString()
                })
            };

        } catch (error) {
            console.error('CAPTCHA resolve error:', error);
            
            return {
                statusCode: error.message.includes('required') ? 400 : 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' 
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    }

    return {
        statusCode: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
        },
        body: JSON.stringify({ 
            message: "CAPTCHA resolver API is running",
            endpoints: [
                "POST /captcha-resolve",
                "POST /merge-pdf"
            ],
            timestamp: new Date().toISOString()
        })
    };
}
import env from "dotenv";
import { PDFDocument } from "pdf-lib";
import AWS from "aws-sdk";

env.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});


async function fetchPdfBuffer(url) {
  const res = await fetch(url);
  console.log(res.status);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export const pdfMerger = async (files) => {
  try {
    const pdfBuffers = await Promise.all(files.map(fetchPdfBuffer));

    const mergedPdf = await PDFDocument.create();
    for (const pdfBytes of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const mergedBytes = await mergedPdf.save();
    const fileName = `merged_${Date.now()}.pdf`;

    const s3Url = await uploadToS3(mergedBytes, fileName);

    return { status: 200, message: { url: s3Url } };
  } catch (err) {
    console.error("pdfMerger error:", err);
    return { status: 500, message: { error: err.message } };
  }
};

export async function uploadToS3(fileBuffer, fileName) {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: Buffer.from(fileBuffer),
    ContentType: "application/pdf",
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location;
  } catch (s3err) {
    console.error("uploadToS3 error:", s3err);
    throw new Error(`S3 upload failed: ${s3err.message}`);
  }
}

export async function captchaResolver(imageAddr) {
  console.log("CAPTCHA resolver called with image:", imageAddr);

  try {
    if (!imageAddr) {
      throw new Error("imageAddr is required");
    }

    try {
      new URL(imageAddr);
    } catch (error) {
      throw new Error("imageAddr must be a valid URL");
    }

    const refinedPrompt = `You are an expert CAPTCHA transcription specialist. Analyze the CAPTCHA image and provide the exact text transcription.

CRITICAL INSTRUCTIONS:
1. **Character Analysis**: Examine each character sequentially from left to right
2. **Case Sensitivity**: 
   - Compare character heights to determine case
   - Uppercase letters are typically taller than lowercase
   - Look for baseline alignment clues
3. **Character Recognition**:
   - Distinguish between similar characters: 0 vs O, 1 vs I vs l, 2 vs Z, 5 vs S, 8 vs B
   - Note character spacing and alignment
4. **Image Artifacts**: Ignore noise, lines, dots, or background patterns
5. **Output Format**: Return ONLY valid JSON with the transcription

CAPTCHA TYPES TO EXPECT:
- Alphanumeric (A-Z, a-z, 0-9)
- Fixed length (usually 4-6 characters)
- Mixed case
- Distorted characters with noise

RESPONSE FORMAT:
{
  "transcription": "exact transcribed text",
  "confidence": "high/medium/low"
}

DO NOT include any other text or explanations.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization:
        `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout:free",
        messages: [
          {
            role: "system",
            content:
              "You are a CAPTCHA transcription expert. Return only valid JSON responses.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: refinedPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageAddr,
                },
              },
            ],
          },
        ],
        temperature: 0.2, 
      }),
     
    });

    console.log("API Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("API Error response:", errorText);

      if (res.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else if (res.status === 401) {
        throw new Error("Authentication failed. Check API key.");
      } else if (res.status >= 500) {
        throw new Error("CAPTCHA service temporarily unavailable.");
      } else {
        throw new Error(
          `CAPTCHA service error: ${res.status} - ${errorText.substring(
            0,
            100
          )}`
        );
      }
    }

    const data = await res.json();
    console.log("API Response data:", JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from CAPTCHA service");
    }

    const responseContent = data.choices[0].message.content;

    try {
      const parsedResponse = JSON.parse(responseContent);

      if (!parsedResponse.transcription) {
        throw new Error("Transcription missing from response");
      }

      console.log(
        "Successfully transcribed CAPTCHA:",
        parsedResponse.transcription
      );
      return parsedResponse.transcription;
    } catch (parseError) {
      console.error(
        "JSON parse error:",
        parseError,
        "Raw response:",
        responseContent
      );

      const textMatch =
        responseContent.match(/"transcription"\s*:\s*"([^"]+)"/i) ||
        responseContent.match(/([A-Za-z0-9]{4,6})/);

      if (textMatch && textMatch[1]) {
        console.log("Extracted transcription from fallback:", textMatch[1]);
        return textMatch[1];
      }

      throw new Error(
        "Failed to parse CAPTCHA response. The service may be experiencing issues."
      );
    }
  } catch (error) {
    console.error("CAPTCHA resolver error:", error.message);
    throw error; 
  }
}

import env from "dotenv";
import { PDFDocument } from "pdf-lib";
import AWS from "aws-sdk";

env.config();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});





// Helper to fetch PDF as Uint8Array
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
    console.error('pdfMerger error:', err);
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
    console.error('uploadToS3 error:', s3err);
    throw new Error(`S3 upload failed: ${s3err.message}`);
  }
}

import { pdfMerger } from "./utils.mjs";

console.log("Loading function");

export async function handler(event) {
  const path = event.path;

  if (path === "/merge-pdf") {
    const body = JSON.parse(event.body || "{}");
    const files = body.files;

    if (!Array.isArray(files) || files.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "files must be a non-empty array" }),
      };
    }

    try {
      const response = await pdfMerger(files);
      return {
        statusCode: response.status,
        body: JSON.stringify(response.message),
      };
    } catch (err) {
      console.error("pdfMerger handler error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ "message" : "You are in the right Place" }),
  };
}

// middleware/apiKey.js
export function requireApiKey(req, res, next) {
  const incoming = req.header("x-app-token");
  if (!incoming || incoming !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// index.ts - jobs-cancel

export default async function handler(req: any, res: any) {
  try {
    const body = req.method === "GET" ? Object.fromEntries(new URLSearchParams(req.url.split("?")[1] || "")) : await req.json();
    const jobId = body.jobId || body.job_id || (req.query && (req.query.jobId || req.query.job_id));
    if (!jobId) return res.status(400).json({ error: "jobId required" });

    // TODO: Update DB row: status=cancelled, stage='Cancelled by user'
    // If your FFmpeg service documents a cancel endpoint later, you can add a best-effort remote cancel.

    console.log("Marking job cancelled locally:", jobId);
    return res.status(200).json({ jobId, status: "cancelled" });

  } catch (err: any) {
    console.error("jobs-cancel error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

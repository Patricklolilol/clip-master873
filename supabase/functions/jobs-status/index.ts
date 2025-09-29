// index.ts - jobs-status
import fetch from "node-fetch";

/**
 * Expected environment:
 * - FFMPEG_SERVICE_URL
 * - FFMPEG_API_KEY (optional)
 *
 * Incoming: GET or POST with jobId (your internal id)
 * Behavior:
 * - Read job row from DB (here represented by a placeholder)
 * - If job.ffmpeg_job_id exists -> POST /info { job_id }
 * - Map ffmpeg responses into DB updates and return job row
 */

const FFMPEG_URL = process.env.FFMPEG_SERVICE_URL;
const FFMPEG_KEY = process.env.FFMPEG_API_KEY;

async function callFfmpegInfo(ffmpegJobId: string) {
  const headers: any = { "Content-Type": "application/json" };
  if (FFMPEG_KEY) headers["x-api-key"] = FFMPEG_KEY;

  const resp = await fetch(`${FFMPEG_URL}/info`, {
    method: "POST",
    headers,
    body: JSON.stringify({ job_id: ffmpegJobId })
  });

  const text = await resp.text();
  try {
    return { status: resp.status, body: JSON.parse(text) };
  } catch {
    return { status: resp.status, body: text };
  }
}

export default async function handler(req: any, res: any) {
  try {
    const q = req.method === "GET" ? req.url.split("?")[1] : await req.json();
    // however your platform gets jobId; here we attempt multiple ways
    const body = req.method === "GET" ? Object.fromEntries(new URLSearchParams(req.url.split("?")[1] || "")) : await req.json();
    const jobId = body.jobId || body.job_id || (req.query && (req.query.jobId || req.query.job_id));

    if (!jobId) {
      return res.status(400).json({ error: "jobId required" });
    }

    // TODO: fetch job row from DB by id
    // Example placeholder:
    const jobRow = {
      id: jobId,
      ffmpeg_job_id: "replace-with-real",
      status: "queued",
      stage: "Queued",
      progress: 0,
      clips: null,
      created_at: Date.now()
    };

    if (!jobRow) {
      return res.status(404).json({ error: "Job not found" });
    }

    // If remote job id exists, poll ffmpeg /info
    if (jobRow.ffmpeg_job_id) {
      const ff = await callFfmpegInfo(jobRow.ffmpeg_job_id);
      console.log("FFmpeg /info returned:", ff);

      // If ffmpeg returned code===0 with data -> completed
      if (ff.status === 200 && ff.body && ff.body.code === 0 && ff.body.data) {
        const data = ff.body.data;
        const processedClips = [{
          url: data.conversion?.url,
          screenshots: data.screenshots || []
        }];

        // TODO: update DB jobRow to completed with clips
        const updated = {
          ...jobRow,
          status: "completed",
          stage: "Completed",
          progress: 100,
          clips: processedClips
        };
        return res.status(200).json(updated);
      }

      // If ffmpeg returned a queued/processing shape
      if (ff.status === 200 && ff.body && (ff.body.status === "queued" || ff.body.status === "processing")) {
        // Update DB with latest status/progress
        const updated = {
          ...jobRow,
          status: "processing",
          stage: ff.body.status === "queued" ? "Queued" : "Processing",
          progress: ff.body.progress || jobRow.progress || 0
        };
        return res.status(200).json(updated);
      }

      // Unexpected remote response: return remote body for debugging
      return res.status(502).json({ error: "Unexpected FFmpeg /info response", ff });
    }

    // No ffmpeg_job_id (maybe synchronous job): just return DB row
    return res.status(200).json(jobRow);

  } catch (err: any) {
    console.error("jobs-status error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

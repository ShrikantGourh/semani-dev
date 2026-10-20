const ALLOWED_ORIGINS = new Set([
  "https://seemani.in",
  "https://www.seemani.in",
  "https://shrikantgourh.github.io",
  "http://localhost:8788",
  "http://127.0.0.1:8788"
]);

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin) || /^https:\/\/shrikantgourh\.github\.io$/.test(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function clean(value, max = 300) {
  return String(value ?? "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max);
}

function youtubeVideoId(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch {}
  return "";
}

function validVideoId(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "seemani-gift-api" }, 200, cors);
    }

    if (url.pathname === "/api/gifts" && request.method === "POST") {
      if (!cors["access-control-allow-origin"] && request.headers.has("Origin")) {
        return json({ ok: false, error: "Origin not allowed" }, 403, cors);
      }
      let body;
      try {
        const length = Number(request.headers.get("content-length") || 0);
        if (length > 12000) return json({ ok: false, error: "Request too large" }, 413, cors);
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Send a valid JSON body" }, 400, cors);
      }

      // Honeypot field: ordinary users leave it blank; simple bots often fill it.
      if (clean(body.website, 200)) return json({ ok: false, error: "Unable to create gift" }, 400, cors);

      const recipient = clean(body.recipient, 70);
      const sender = clean(body.sender, 70);
      const message = clean(body.message, 1400);
      const songUrl = clean(body.songUrl, 500);
      const videoId = youtubeVideoId(songUrl);
      if (!recipient || !sender || !message) {
        return json({ ok: false, error: "Recipient, sender, and message are required" }, 400, cors);
      }
      if (recipient.length < 1 || sender.length < 1) {
        return json({ ok: false, error: "Please enter a name" }, 400, cors);
      }
      if (songUrl && !validVideoId(videoId)) {
        return json({ ok: false, error: "Please enter a valid YouTube video link" }, 400, cors);
      }

      const id = crypto.randomUUID().replace(/-/g, "");
      const createdAt = new Date().toISOString();
      try {
        await env.DB.prepare(
          "INSERT INTO gifts (id, recipient, sender, message, youtube_video_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(id, recipient, sender, message, videoId || null, createdAt).run();
        return json({ ok: true, id, createdAt }, 201, cors);
      } catch {
        return json({ ok: false, error: "Gift storage is not configured yet. Please try again later." }, 503, cors);
      }
    }

    const match = url.pathname.match(/^\/api\/gifts\/([a-f0-9]{32})$/i);
    if (match && request.method === "GET") {
      try {
        const row = await env.DB.prepare(
          "SELECT id, recipient, sender, message, youtube_video_id AS youtubeVideoId, created_at AS createdAt FROM gifts WHERE id = ?"
        ).bind(match[1]).first();
        if (!row) return json({ ok: false, error: "Gift not found" }, 404, cors);
        return json({ ok: true, gift: row }, 200, { ...cors, "cache-control": "public, max-age=60" });
      } catch {
        return json({ ok: false, error: "Gift storage is not configured yet" }, 503, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  }
};

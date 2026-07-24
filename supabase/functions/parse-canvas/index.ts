import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: Date | null;
  dtend: Date | null;
  description: string;
}

function unfoldIcs(raw: string): string {
  return raw
    .replace(/\r\n[ \t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function parseIcsDate(raw: string): Date | null {
  if (!raw) return null;
  const colonIdx = raw.lastIndexOf(":");
  const dateStr = colonIdx !== -1 ? raw.substring(colonIdx + 1) : raw;

  if (/^\d{8}$/.test(dateStr)) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  }
  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${z || ""}`);
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function unescapeIcs(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcs(icsText: string): IcsEvent[] {
  const lines = unfoldIcs(icsText).split("\n");
  const events: IcsEvent[] = [];
  let inEvent = false;
  let cur: Partial<IcsEvent> = {};

  for (const line of lines) {
    const t = line.trim();
    if (t === "BEGIN:VEVENT") {
      inEvent = true;
      cur = { uid: "", summary: "", dtstart: null, dtend: null, description: "" };
      continue;
    }
    if (t === "END:VEVENT") {
      inEvent = false;
      if (cur.uid && cur.summary) events.push(cur as IcsEvent);
      continue;
    }
    if (!inEvent) continue;

    const propMatch = t.match(/^([A-Z\-]+)([;:].*)$/);
    if (!propMatch) continue;
    const propName = propMatch[1];
    const rest = propMatch[2];
    const lastColon = rest.lastIndexOf(":");
    if (lastColon === -1) continue;
    const rawValue = rest.substring(lastColon + 1);

    switch (propName) {
      case "UID":
        cur.uid = rawValue;
        break;
      case "SUMMARY":
        cur.summary = unescapeIcs(rawValue);
        break;
      case "DTSTART":
        cur.dtstart = parseIcsDate(rest.substring(1));
        break;
      case "DTEND":
        cur.dtend = parseIcsDate(rest.substring(1));
        break;
      case "DESCRIPTION":
        cur.description = unescapeIcs(rawValue);
        break;
    }
  }
  return events;
}

function extractCourseCode(summary: string): string | null {
  const m = summary.match(/\b([A-Z]{2,6}\s?\d{1,4}[A-Z]?)\b/);
  return m ? m[1] : null;
}

function cleanTitle(summary: string, courseCode: string | null): string {
  if (!courseCode) return summary.trim();
  const escaped = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    summary.replace(new RegExp(`\\[?${escaped}\\]?\\s*[-:–—]?\\s*`), "").trim() || summary.trim()
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { block_id, canvas_ics_url } = await req.json();

    if (!block_id || !canvas_ics_url) {
      return jsonResponse({ error: "block_id and canvas_ics_url are required" }, 400);
    }

    let url: URL;
    try {
      url = new URL(canvas_ics_url);
    } catch {
      return jsonResponse({ error: "Invalid canvas_ics_url" }, 400);
    }
    if (url.protocol !== "https:") {
      return jsonResponse({ error: "canvas_ics_url must use HTTPS" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[parse-canvas] Fetching: ${canvas_ics_url}`);
    const icsRes = await fetch(canvas_ics_url, {
      headers: {
        "User-Agent": "Blueboard/1.0 (Canvas ICS Sync)",
        Accept: "text/calendar, text/plain, */*",
      },
    });

    if (!icsRes.ok) {
      return jsonResponse(
        {
          error: `Failed to fetch ICS: ${icsRes.status} ${icsRes.statusText}`,
        },
        502,
      );
    }

    const icsText = await icsRes.text();
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      return jsonResponse({ error: "URL did not return a valid ICS calendar" }, 422);
    }

    const events = parseIcs(icsText);
    console.log(`[parse-canvas] Parsed ${events.length} events`);

    if (events.length === 0) {
      return jsonResponse({
        success: true,
        synced: 0,
        message: "No events found in the ICS file",
      });
    }

    const rows = events.map((ev) => {
      const courseCode = extractCourseCode(ev.summary);
      return {
        block_id,
        title: cleanTitle(ev.summary, courseCode),
        course_code: courseCode,
        due_at: (ev.dtend || ev.dtstart)?.toISOString() || null,
        source: "canvas_ics" as const,
        canvas_uid: ev.uid,
        created_by: user.id,
      };
    });

    const { data: upserted, error: upsertErr } = await db
      .from("tasks")
      .upsert(rows, {
        onConflict: "block_id,canvas_uid",
        ignoreDuplicates: false,
      })
      .select("id");

    if (upsertErr) {
      console.error("[parse-canvas] Upsert error:", upsertErr);
      return jsonResponse({ error: "Failed to save tasks", details: upsertErr.message }, 500);
    }

    await db.from("blocks").update({ canvas_ics_url }).eq("id", block_id);

    const count = upserted?.length ?? rows.length;
    return jsonResponse({
      success: true,
      synced: count,
      message: `Successfully synced ${count} task${count !== 1 ? "s" : ""} from Canvas`,
    });
  } catch (err) {
    console.error("[parse-canvas] Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

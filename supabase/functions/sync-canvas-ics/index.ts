import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: Date | null;
  dtend: Date | null;
  description: string;
}

function parseIcsDate(value: string): Date | null {
  if (!value) return null;

  const colonIndex = value.lastIndexOf(":");
  const dateStr = colonIndex !== -1 ? value.substring(colonIndex + 1) : value;

  if (/^\d{8}$/.test(dateStr)) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  }

  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z || ""}`;
    return new Date(iso);
  }

  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function unfoldIcs(raw: string): string {
  return raw
    .replace(/\r\n[ \t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcs(icsText: string): IcsEvent[] {
  const unfolded = unfoldIcs(icsText);
  const lines = unfolded.split("\n");
  const events: IcsEvent[] = [];

  let inEvent = false;
  let current: Partial<IcsEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = { uid: "", summary: "", dtstart: null, dtend: null, description: "" };
      continue;
    }

    if (trimmed === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.summary) {
        events.push(current as IcsEvent);
      }
      continue;
    }

    if (!inEvent) continue;

    const propMatch = trimmed.match(/^([A-Z\-]+)([;:].*)$/);
    if (!propMatch) continue;

    const propName = propMatch[1];
    const rest = propMatch[2];

    const lastColonIdx = rest.lastIndexOf(":");
    if (lastColonIdx === -1) continue;
    const rawValue = rest.substring(lastColonIdx + 1);

    switch (propName) {
      case "UID":
        current.uid = rawValue;
        break;
      case "SUMMARY":
        current.summary = unescapeIcsText(rawValue);
        break;
      case "DTSTART":
        current.dtstart = parseIcsDate(rest.substring(1));
        break;
      case "DTEND":
        current.dtend = parseIcsDate(rest.substring(1));
        break;
      case "DESCRIPTION":
        current.description = unescapeIcsText(rawValue);
        break;
    }
  }

  return events;
}

function extractCourseCode(summary: string): string | null {
  const match = summary.match(/\b([A-Z]{2,6}\s?\d{1,4}[A-Z]?)\b/);
  return match ? match[1] : null;
}

function cleanTitle(summary: string, courseCode: string | null): string {
  if (!courseCode) return summary.trim();

  let cleaned = summary
    .replace(new RegExp(`\\[?${escapeRegex(courseCode)}\\]?\\s*[-:–—]?\\s*`), "")
    .trim();

  return cleaned || summary.trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { block_id, canvas_ics_url } = await req.json();

    if (!block_id || !canvas_ics_url) {
      return new Response(JSON.stringify({ error: "block_id and canvas_ics_url are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url: URL;
    try {
      url = new URL(canvas_ics_url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid canvas_ics_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (url.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "canvas_ics_url must use HTTPS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: membership, error: memberError } = await serviceClient
      .from("block_members")
      .select("role")
      .eq("block_id", block_id)
      .eq("profile_id", user.id)
      .single();

    if (memberError || !membership || membership.role !== "beadle") {
      return new Response(JSON.stringify({ error: "Only beadles can sync Canvas data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetching ICS from: ${canvas_ics_url}`);
    const icsResponse = await fetch(canvas_ics_url, {
      headers: {
        "User-Agent": "Blueboard/1.0 (ICS Sync)",
        Accept: "text/calendar, text/plain, */*",
      },
    });

    if (!icsResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch ICS file: ${icsResponse.status} ${icsResponse.statusText}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const icsText = await icsResponse.text();

    if (!icsText.includes("BEGIN:VCALENDAR")) {
      return new Response(
        JSON.stringify({ error: "The URL did not return a valid ICS calendar file" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const events = parseIcs(icsText);
    console.log(`Parsed ${events.length} events from ICS`);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No events found in the ICS file",
          synced: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const taskRows = events.map((event) => {
      const courseCode = extractCourseCode(event.summary);
      const title = cleanTitle(event.summary, courseCode);

      return {
        block_id,
        title,
        course_code: courseCode,
        due_at: (event.dtend || event.dtstart)?.toISOString() || null,
        source: "canvas_ics" as const,
        canvas_uid: event.uid,
        created_by: user.id,
      };
    });

    const { data: upserted, error: upsertError } = await serviceClient
      .from("tasks")
      .upsert(taskRows, {
        onConflict: "block_id,canvas_uid",
        ignoreDuplicates: false,
      })
      .select("id");

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save tasks", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await serviceClient.from("blocks").update({ canvas_ics_url }).eq("id", block_id);

    return new Response(
      JSON.stringify({
        success: true,
        synced: upserted?.length ?? taskRows.length,
        message: `Successfully synced ${upserted?.length ?? taskRows.length} tasks from Canvas`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

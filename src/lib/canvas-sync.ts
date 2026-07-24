import { supabase } from "@/lib/supabase";

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

export async function syncCanvasIcs(blockId: string, icsUrl: string, userId: string) {
  // Try Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke("parse-canvas", {
      body: {
        block_id: blockId,
        canvas_ics_url: icsUrl.trim(),
      },
    });

    if (!error && data?.success) {
      return { success: true, count: data.synced, message: data.message };
    }
  } catch (_edgeErr) {
    // Fall back to client-side parsing if Edge Function is missing/unreachable
  }

  // Client-side Fallback
  let icsText = "";
  try {
    const res = await fetch(icsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    icsText = await res.text();
  } catch (_directErr) {
    // If CORS blocks direct fetch, use a reliable CORS proxy
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (!proxyRes.ok) throw new Error(`Proxy HTTP ${proxyRes.status}`);
      icsText = await proxyRes.text();
    } catch (_proxyErr) {
      throw new Error("Could not fetch calendar URL. Check URL or CORS settings.");
    }
  }

  if (!icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("URL did not return a valid .ics calendar.");
  }

  const events = parseIcs(icsText);
  if (events.length === 0) {
    return { success: true, count: 0, message: "No events found in the .ics file." };
  }

  const rows = events.map((ev) => {
    const courseCode = extractCourseCode(ev.summary);
    return {
      block_id: blockId,
      title: cleanTitle(ev.summary, courseCode),
      course_code: courseCode,
      due_at: (ev.dtend || ev.dtstart)?.toISOString() || null,
      source: "canvas_ics" as const,
      canvas_uid: ev.uid,
      created_by: userId,
    };
  });

  const { data: upserted, error: upsertErr } = await supabase
    .from("tasks")
    .upsert(rows as any, {
      onConflict: "block_id,canvas_uid",
      ignoreDuplicates: false,
    })
    .select("id");

  if (upsertErr) {
    throw new Error(upsertErr.message);
  }

  await (supabase.from("blocks") as any).update({ canvas_ics_url: icsUrl }).eq("id", blockId);

  const count = upserted?.length ?? rows.length;
  return {
    success: true,
    count,
    message: `Successfully synced ${count} task${count !== 1 ? "s" : ""} from Canvas`,
  };
}

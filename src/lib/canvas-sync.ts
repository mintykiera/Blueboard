import { supabase } from "@/lib/supabase";
import { fetchIcsServerFn } from "@/lib/server-ics";

interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: Date | null;
  dtend: Date | null;
  description: string;
  descriptionHtml?: string;
  url?: string;
}

function unfoldIcs(raw: string): string {
  return raw
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
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

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let md = html
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gi, "**$1**")
    .replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gi, "*$1*")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return unescapeIcs(md).trim();
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
      if (!cur.uid && (cur.summary || cur.dtstart)) {
        cur.uid = `event-${events.length}-${cur.dtstart?.getTime() || Math.random()}`;
      }
      if (cur.uid && cur.summary) events.push(cur as IcsEvent);
      continue;
    }
    if (!inEvent) continue;

    const firstColon = t.indexOf(":");
    if (firstColon === -1) continue;
    const propHeader = t.substring(0, firstColon);
    const rawValue = t.substring(firstColon + 1);
    const propName = propHeader.split(";")[0].toUpperCase();

    switch (propName) {
      case "UID":
        cur.uid = rawValue.trim();
        break;
      case "SUMMARY":
        cur.summary = unescapeIcs(rawValue);
        break;
      case "URL":
        cur.url = unescapeIcs(rawValue.trim());
        break;
      case "DTSTART":
        cur.dtstart = parseIcsDate(rawValue);
        break;
      case "DTEND":
        cur.dtend = parseIcsDate(rawValue);
        break;
      case "DESCRIPTION":
        cur.description = unescapeIcs(rawValue);
        break;
      case "X-ALT-DESC":
        cur.descriptionHtml = unescapeIcs(rawValue);
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
  let title = summary.trim();
  if (courseCode) {
    const escaped = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`\\[?${escaped}\\]?\\s*[-:–—]?\\s*`, "i"), "").trim();
  }
  return title.replace(/^[\]\)\s\-:_]+|[\]\)\s\-:_]+$/g, "").trim() || summary.trim();
}

export async function syncCanvasIcs(blockId: string, icsUrl: string, userId: string) {
  const trimmedUrl = icsUrl.trim();
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    throw new Error("Invalid URL format. Please paste a valid Canvas .ics feed link.");
  }

  try {
    const { data, error } = await supabase.functions.invoke("parse-canvas", {
      body: {
        block_id: blockId,
        canvas_ics_url: trimmedUrl,
      },
    });

    if (!error && data?.success) {
      return { success: true, count: data.synced, message: data.message };
    }
  } catch (_edgeErr) {}

  let icsText = "";

  try {
    icsText = await fetchIcsServerFn({ data: trimmedUrl });
  } catch (_serverErr) {}

  if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
    try {
      const res = await fetch(trimmedUrl);
      if (res.ok) {
        icsText = await res.text();
      }
    } catch (_directErr) {}
  }

  if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
    const proxyGenerators = [
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    for (const makeProxyUrl of proxyGenerators) {
      try {
        const proxyUrl = makeProxyUrl(trimmedUrl);
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes("BEGIN:VCALENDAR")) {
            icsText = text;
            break;
          }
        }
      } catch (_proxyErr) {}
    }
  }

  if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("Could not fetch calendar URL. Check URL or CORS settings.");
  }

  const events = parseIcs(icsText);
  if (events.length === 0) {
    return { success: true, count: 0, message: "No events found in the .ics file." };
  }

  const domainMatch = icsUrl.match(/(?:https?:)?\/\/([^\/]+\.instructure\.com)/i);
  const domain = domainMatch ? domainMatch[1] : "ateneo.instructure.com";

  const rows = events.map((ev) => {
    const courseCode = extractCourseCode(ev.summary);
    let desc = "";

    if (ev.descriptionHtml && ev.descriptionHtml.includes("<")) {
      desc = htmlToMarkdown(ev.descriptionHtml);
    } else if (ev.description && ev.description.includes("<")) {
      desc = htmlToMarkdown(ev.description);
    } else {
      desc = ev.description || "";
    }

    const courseId = desc.match(/\/courses\/(\d+)/i)?.[1] || ev.url?.match(/course_(\d+)/i)?.[1];
    const assignmentId = ev.uid.match(/\d+/)?.[0] || ev.url?.match(/event_id=(\d+)/i)?.[1];

    if (courseId && assignmentId) {
      const assignmentUrl = `https://${domain}/courses/${courseId}/assignments/${assignmentId}`;
      if (!desc.includes(assignmentUrl)) {
        desc = assignmentUrl + (desc ? "\n\n" + desc : "");
      }
    } else if (ev.url && !desc.includes(ev.url)) {
      desc = ev.url + (desc ? "\n\n" + desc : "");
    }

    return {
      block_id: blockId,
      title: cleanTitle(ev.summary, courseCode),
      description: desc || null,
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

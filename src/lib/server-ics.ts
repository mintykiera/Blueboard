import { createServerFn } from "@tanstack/react-start";

export const fetchIcsServerFn = createServerFn({ method: "GET" })
  .validator((url: unknown) => {
    if (typeof url !== "string" || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      throw new Error("Invalid URL format");
    }
    return url;
  })
  .handler(async ({ data: url }) => {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/calendar, text/plain, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new Error("URL did not return a valid .ics calendar feed.");
    }

    return text;
  });

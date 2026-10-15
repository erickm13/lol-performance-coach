export function academyVideo(
  url: string,
): { id: string; start: number } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    let id: string | null = null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        parsed.hostname,
      )
    ) {
      if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
      else if (/^\/(embed|shorts)\//.test(parsed.pathname)) {
        id = parsed.pathname.split("/")[2];
      }
    } else if (parsed.hostname === "youtu.be") id = parsed.pathname.slice(1);
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const time = parsed.searchParams.get("start") ??
      parsed.searchParams.get("t") ?? "0";
    const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
    const seconds = /^\d+$/.test(time)
      ? Number(time)
      : parts
      ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 +
        Number(parts[3] ?? 0)
      : 0;
    return {
      id,
      start: Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : 0,
    };
  } catch {
    return null;
  }
}
export function videoTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  return `${hours ? `${hours}:` : ""}${
    String(Math.floor(seconds / 60) % 60).padStart(hours ? 2 : 1, "0")
  }:${String(seconds % 60).padStart(2, "0")}`;
}

export function youtubeWatchUrl(video: { id: string; start: number }) {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", video.id);
  if (video.start) url.searchParams.set("t", `${video.start}s`);
  return url.toString();
}

export function youtubeEmbedUrl(
  video: { id: string; start: number },
  privacy: boolean,
  origin: string,
) {
  const url = new URL(
    `https://${
      privacy ? "www.youtube-nocookie.com" : "www.youtube.com"
    }/embed/${video.id}`,
  );
  url.search = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    hl: "es",
    start: String(video.start),
    origin,
  }).toString();
  return url.toString();
}

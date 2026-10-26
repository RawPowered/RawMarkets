function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!isHttpUrl(url)) return false;

  if (window.rawMarkets?.openExternal) {
    const result = await window.rawMarkets.openExternal(url);
    return result.ok;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

import type { HistoryPoint } from "../types";

/** Rescale history so the curve ends at the scraped spot (requires ≥1 prior point). */
export function historyAlignedToScrapePrice(
  history: HistoryPoint[],
  anchorPrice: number,
  scrapedPrice: number
): HistoryPoint[] {
  const anchor =
    anchorPrice > 0
      ? anchorPrice
      : history.length > 0
        ? history[history.length - 1].value
        : scrapedPrice;
  const scale = anchor > 0 ? scrapedPrice / anchor : 1;

  let points: HistoryPoint[];
  if (history.length === 0) {
    return [];
  } else {
    points = history.map((p) => ({
      date: p.date,
      value: parseFloat((p.value * scale).toFixed(2)),
    }));
  }

  const today = new Date().toISOString().slice(0, 10);
  if (points.length === 0) {
    return [];
  }
  const last = points[points.length - 1];
  if (last.date === today) {
    points[points.length - 1] = { date: today, value: scrapedPrice };
  } else {
    points.push({ date: today, value: scrapedPrice });
  }
  if (points.length > 31) {
    points = points.slice(-31);
  }
  return points;
}

/** Human-readable labels for App activePage ids. */
export const PAGE_LABELS: Record<string, string> = {
  overview: "Overview Dashboard",
  terminal: "Track & Search Terminal",
  portfolio: "Portfolio Tracker",
  insights: "AI Signal Copilot",
  config: "Engine Control & Settings",
  bible: "Investors Bible",
  "gambler-bible": "Gamblers Bible",
  "wealth-bible": "Bible of Wealth",
  "investors-journal": "Investors Journal",
  "market-links": "Market Links",
  "news-bay": "News Bay",
  "statements-analyzer": "Statements Analyzer",
};

export function labelForPage(page: string): string {
  return PAGE_LABELS[page] ?? page;
}

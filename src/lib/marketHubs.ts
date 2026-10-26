export interface MarketHubItem {
  name: string;
  domain: string;
  url: string;
  category: "metals" | "stocks";
  tag: string;
  desc: string;
  features: string[];
}

export const MARKET_HUBS: MarketHubItem[] = [
  {
    name: "JM Bullion",
    domain: "jmbullion.com",
    url: "https://www.jmbullion.com",
    category: "metals",
    tag: "Physical precious metals",
    desc: "Top-rated physical dealer. Ideal for securing physical Gold (Au), Silver (Ag), Platinum (Pt) bars and sovereign minted coins directly in secured shipments.",
    features: ["Fully Insured Shipping", "Gold/Silver IRA eligible", "No commission fees"],
  },
  {
    name: "APMEX",
    domain: "apmex.com",
    url: "https://www.apmex.com",
    category: "metals",
    tag: "Precious Metals Giant",
    desc: "One of the largest physical precious metals dealers globally with extensive numismatic coins, platinum bars, and segregated vaulting programs.",
    features: ["Huge catalog range", "APMEX Club rewards", "Direct secure delivery"],
  },
  {
    name: "SD Bullion",
    domain: "sdbullion.com",
    url: "https://sdbullion.com",
    category: "metals",
    tag: "Lowest physical prices",
    desc: "Highly respected for maintaining industry-low premiums over the spot price of physical gold, silver bullion, and emergency metals.",
    features: ["Lowest price guarantee", "Bullion Depot vaulting", "Excellent BBB rating"],
  },
  {
    name: "Money Metals Exchange",
    domain: "moneymetals.com",
    url: "https://www.moneymetals.com",
    category: "metals",
    tag: "Physical Saver Programs",
    desc: "Voted physical dealer of the year. Excels in recurring physical metal saving accounts and flexible fractional gold purchasing.",
    features: ["Monthly savings plan", "Fractional bars", "Secure depository vaults"],
  },
  {
    name: "Fidelity Investments",
    domain: "fidelity.com",
    url: "https://www.fidelity.com",
    category: "stocks",
    tag: "Custodian Stock Brokerage",
    desc: "Premier broker-dealer ideal for purchasing major stocks (MSFT, JPM, SONY), physical-backed metal ETFs (GLD, SLV), and retirement wealth plans.",
    features: ["$0 commission stock trades", "Fractional equity shares", "Comprehensive core research"],
  },
  {
    name: "Charles Schwab",
    domain: "schwab.com",
    url: "https://www.schwab.com",
    category: "stocks",
    tag: "Global Asset Desk",
    desc: "High-grade financial advisory and self-directed brokerage desk featuring advanced trading software (thinkorswim), options, and physical-backed resources.",
    features: ["Commission-free equities", "Schwab Stock Slices", "Award-winning customer service"],
  },
  {
    name: "Interactive Brokers",
    domain: "interactivebrokers.com",
    url: "https://www.interactivebrokers.com",
    category: "stocks",
    tag: "Institutional Margin Desks",
    desc: "The premium choice for worldwide investors trading US Steel, Sony, or SpaceX proxies. Highly competitive low-interest margin rates.",
    features: ["Global stock markets access", "Unmatched margin rates", "Institutional grade executions"],
  },
  {
    name: "Robinhood",
    domain: "robinhood.com",
    url: "https://www.robinhood.com",
    category: "stocks",
    tag: "Mobile-First Trading",
    desc: "Clean, fast, simplified framework for instant stock buys, 24-Hour Market access, and physical-backed cryptocurrency index tracker options.",
    features: ["Immediate ACH deposits", "24/5 Trading Desk", "Highly intuitive interactive layout"],
  },
  {
    name: "Vanguard",
    domain: "vanguard.com",
    url: "https://www.vanguard.com",
    category: "stocks",
    tag: "Index Passive Funds",
    desc: "The pioneer of passive index-fund investing. Perfect for holding long-term physical metal miner baskets, physical bullion funds, and S&P indices.",
    features: ["Low-expense ratio ETFs", "Investor-owned structure", "Steady retirement horizons"],
  },
];

export function googleFaviconUrlForHub(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

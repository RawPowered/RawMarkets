export type WealthBibleRuleCategory =
  | "eight_laws"
  | "investor_pillars"
  | "gambler_pillars"
  | "flywheel"
  | "capital_stack"
  | "wealth_diagnostic"
  | "speculative_dangers";

export interface WealthBibleRule {
  id: string;
  category: WealthBibleRuleCategory;
  title: string;
  body: string;
  bullets?: string[];
  priority: number;
}

export const WEALTH_BIBLE_CATEGORY_ORDER: WealthBibleRuleCategory[] = [
  "eight_laws",
  "investor_pillars",
  "flywheel",
  "capital_stack",
  "gambler_pillars",
  "speculative_dangers",
  "wealth_diagnostic",
];

export const WEALTH_BIBLE_CATEGORY_LABELS: Record<WealthBibleRuleCategory, string> = {
  eight_laws: "The 8 Unbreakable Laws",
  investor_pillars: "Investor's Canon",
  flywheel: "Capital Flywheel",
  capital_stack: "Long-Horizon Capital Stack",
  gambler_pillars: "Gambler's Canon",
  speculative_dangers: "Speculative Market Dangers",
  wealth_diagnostic: "Wealth Architecture Diagnostic",
};

function rule(
  id: string,
  category: WealthBibleRuleCategory,
  title: string,
  body: string,
  priority: number,
  bullets?: string[]
): WealthBibleRule {
  return { id, category, title, body, priority, bullets };
}

export const WEALTH_BIBLE_RULES: WealthBibleRule[] = [
  rule("law-1", "eight_laws", "Survive first.", "Capital preservation is the first edge.", 1),
  rule("law-2", "eight_laws", "Size from edge.", "Use proven math. Cut risk in half.", 2),
  rule("law-3", "eight_laws", "Favor real utility.", "Own what lasts. Speculate what moves.", 3),
  rule("law-4", "eight_laws", "Keep a safe core.", "Build an indestructible foundation.", 4),
  rule("law-5", "eight_laws", "Harvest volatility.", "Let markets pay you to wait.", 5),
  rule("law-6", "eight_laws", "Avoid ruinous leverage.", "Leverage is a tool — not a strategy.", 6),
  rule("law-7", "eight_laws", "Master psychology.", "Control yourself before markets.", 7),
  rule(
    "law-8",
    "eight_laws",
    "Rebalance gains into permanence.",
    "Lock in compounding. Repeat forever.",
    8
  ),
  rule(
    "inv-pillar-A",
    "investor_pillars",
    "Tangible Utility & Finite Scarcity",
    "Own assets with real utility, finite supply, and non-correlated value.",
    10,
    ["Productive land", "Timber & forestry", "Fine art / collectibles", "Real assets"]
  ),
  rule(
    "inv-pillar-B",
    "investor_pillars",
    "The Barbell Strategy",
    "Hyper-safe core on one side, asymmetric upside on the other — never the mushy middle.",
    11,
    [
      "70–90% hyper-safe core (cash, T-bills, productive land, low-volatility holdings)",
      "10–30% asymmetric upside (equities, private equity, venture, selective innovation)",
    ]
  ),
  rule(
    "inv-pillar-C",
    "investor_pillars",
    "Fractional Kelly Sizing",
    "Size risk from edge, then cut it in half for survival. Formula: f* = (p·b − q) / b. Fractional Kelly = Half Kelly for safety.",
    12
  ),
  rule(
    "inv-pillar-D",
    "investor_pillars",
    "Shannon's Demon / Volatility Harvesting",
    "Rebalance two volatile assets systematically — harvest variance into a steadier upward climb.",
    13
  ),
  rule(
    "inv-pillar-E",
    "investor_pillars",
    "Defeat the Disposition Effect",
    "Losers: sell fast. Winners: hold long. Automate exits — cut losers quickly, let winners run.",
    14
  ),
  rule("flywheel-1", "flywheel", "Protect the Core", "Safe capital is protected before risk is deployed.", 20),
  rule("flywheel-2", "flywheel", "Deploy Controlled Risk", "Risk capital is sized and deployed with discipline, not emotion.", 21),
  rule("flywheel-3", "flywheel", "Harvest Volatility", "Systematic rebalancing harvests variance.", 22),
  rule("flywheel-4", "flywheel", "Capture Asymmetric Gains", "Upside is captured without abandoning the core.", 23),
  rule("flywheel-5", "flywheel", "Rebalance Back to Safety", "Gains are swept back into the safe core on schedule.", 24),
  rule(
    "stack-public-equities",
    "capital_stack",
    "Public equities allocation",
    "Target weight band for public equities in the long-horizon stack.",
    30,
    ["40–50%"]
  ),
  rule(
    "stack-private-equity",
    "capital_stack",
    "Private equity / VC allocation",
    "Target weight band for private equity and venture exposure.",
    31,
    ["10–20%"]
  ),
  rule(
    "stack-productive-land",
    "capital_stack",
    "Productive land allocation",
    "Target weight band for productive land and real assets.",
    32,
    ["10–20%"]
  ),
  rule(
    "stack-collectibles",
    "capital_stack",
    "Collectibles / real assets allocation",
    "Target weight band for collectibles and non-correlated real assets.",
    33,
    ["5–15%"]
  ),
  rule(
    "stack-liquidity",
    "capital_stack",
    "Liquidity reserve (cash / T-bills)",
    "Target weight band for cash and T-bills — preserve power through time.",
    34,
    ["10–20%"]
  ),
  rule(
    "gamb-pillar-A",
    "gambler_pillars",
    "Ergodic Survival",
    "Never risk ruin. A system that survives can keep playing.",
    40
  ),
  rule(
    "gamb-pillar-B",
    "gambler_pillars",
    "The Utility Anchor Gap",
    "Beware speculation that promises permanence without real utility.",
    41
  ),
  rule(
    "gamb-pillar-C",
    "gambler_pillars",
    "The Reveal-Driven Dopamine Loop",
    "Scarcity → hype → anticipation → reveal → buy → crash / exit liquidity. FoMO and random rewards drive irrational entries.",
    42
  ),
  rule(
    "gamb-pillar-D",
    "gambler_pillars",
    "Dark Tetrad & Trader Psychology",
    "High-risk speculation is amplified by ego, distrust, and overconfidence — narcissism, machiavellianism, psychopathy, sadism / FoMO.",
    43
  ),
  rule(
    "gamb-pillar-E",
    "gambler_pillars",
    "Rug Pull / Reflexive Feedback Loop",
    "Narratives attract capital; leverage + illiquidity amplify moves; doubt triggers cascade exits; collapse (Minsky-style).",
    44
  ),
  rule(
    "danger-leverage",
    "speculative_dangers",
    "Leverage risk",
    "Uncontrolled leverage can force ruin on a single adverse sequence.",
    50
  ),
  rule(
    "danger-correlated",
    "speculative_dangers",
    "Correlated bets",
    "Stacking correlated bets multiplies drawdown risk.",
    51
  ),
  rule(
    "danger-liquidity",
    "speculative_dangers",
    "Thin liquidity",
    "Thin liquidity traps capital when narratives reverse.",
    52
  ),
  rule(
    "danger-hype",
    "speculative_dangers",
    "Hype cycles",
    "Hype cycles separate entry price from fundamental utility.",
    53
  ),
  rule(
    "danger-emotion",
    "speculative_dangers",
    "Emotional trading",
    "Emotional trading destroys discipline and sizing rules.",
    54
  ),
  rule(
    "diag-1",
    "wealth_diagnostic",
    "Safe core protected",
    "My safe core (70%+ liquid / low-volatility) is protected before I deploy speculative capital.",
    60
  ),
  rule(
    "diag-2",
    "wealth_diagnostic",
    "Kelly sizing discipline",
    "I size risk positions with Kelly math and use fractional (half) Kelly caps.",
    61
  ),
  rule(
    "diag-3",
    "wealth_diagnostic",
    "Tangible utility preference",
    "I favor assets with tangible utility and finite scarcity for permanent wealth.",
    62
  ),
  rule(
    "diag-4",
    "wealth_diagnostic",
    "Disposition effect control",
    "I cut losers quickly and let winners run — no disposition-effect hope-holding.",
    63
  ),
  rule(
    "diag-5",
    "wealth_diagnostic",
    "Systematic volatility rebalance",
    "I rebalance volatility systematically rather than chasing every headline.",
    64
  ),
  rule(
    "diag-6",
    "wealth_diagnostic",
    "No ruinous leverage",
    "I never use leverage that could force ruin on a single adverse sequence.",
    65
  ),
  rule(
    "diag-7",
    "wealth_diagnostic",
    "Hype loop awareness",
    "I recognize hype loops, FoMO, and dopamine-driven entries before I click buy.",
    66
  ),
  rule(
    "diag-8",
    "wealth_diagnostic",
    "Sweep gains to core",
    "I sweep asymmetric gains back into the safe core on a fixed schedule.",
    67
  ),
];

export const DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS: string[] =
  WEALTH_BIBLE_RULES.map((r) => r.id);

const RULE_BY_ID = new Map(WEALTH_BIBLE_RULES.map((r) => [r.id, r]));

export function getWealthBibleRuleById(id: string): WealthBibleRule | undefined {
  return RULE_BY_ID.get(id);
}

export const WEALTH_BIBLE_RULES_BY_CATEGORY: Record<
  WealthBibleRuleCategory,
  WealthBibleRule[]
> = WEALTH_BIBLE_CATEGORY_ORDER.reduce(
  (acc, cat) => {
    acc[cat] = WEALTH_BIBLE_RULES.filter((r) => r.category === cat);
    return acc;
  },
  {} as Record<WealthBibleRuleCategory, WealthBibleRule[]>
);

/** Display shapes for BibleOfWealth (icons stay in component). */
export interface EightLawDisplay {
  ruleId: string;
  n: number;
  title: string;
  desc: string;
}

export interface PillarDisplay {
  ruleId: string;
  letter: string;
  title: string;
  desc: string;
  items?: string[];
  formula?: string;
  footnote?: string;
}

export interface FlywheelStepDisplay {
  ruleId: string;
  step: number;
  title: string;
  theme: "investor" | "gambler" | "blend";
}

export interface CapitalStackDisplay {
  ruleId: string;
  label: string;
  pct: string;
}

const FLYWHEEL_THEMES: Array<"investor" | "gambler" | "blend"> = [
  "investor",
  "gambler",
  "gambler",
  "blend",
  "investor",
];

export const EIGHT_LAWS_DISPLAY: EightLawDisplay[] = WEALTH_BIBLE_RULES_BY_CATEGORY.eight_laws.map(
  (r, i) => ({
    ruleId: r.id,
    n: i + 1,
    title: r.title,
    desc: r.body,
  })
);

export const INVESTOR_PILLARS_DISPLAY: PillarDisplay[] =
  WEALTH_BIBLE_RULES_BY_CATEGORY.investor_pillars.map((r) => {
    const letter = r.id.replace("inv-pillar-", "");
    const display: PillarDisplay = {
      ruleId: r.id,
      letter,
      title: r.title,
      desc: r.body,
      items: r.bullets,
    };
    if (r.id === "inv-pillar-C") {
      display.formula = "f* = (p·b − q) / b";
      display.footnote = "Fractional Kelly = Half Kelly for safety.";
    }
    return display;
  });

export const GAMBLER_PILLARS_DISPLAY: PillarDisplay[] =
  WEALTH_BIBLE_RULES_BY_CATEGORY.gambler_pillars.map((r) => ({
    ruleId: r.id,
    letter: r.id.replace("gamb-pillar-", ""),
    title: r.title,
    desc: r.body,
  }));

export const FLYWHEEL_STEPS_DISPLAY: FlywheelStepDisplay[] =
  WEALTH_BIBLE_RULES_BY_CATEGORY.flywheel.map((r, i) => ({
    ruleId: r.id,
    step: i + 1,
    title: r.title,
    theme: FLYWHEEL_THEMES[i] ?? "blend",
  }));

export const CAPITAL_STACK_DISPLAY: CapitalStackDisplay[] =
  WEALTH_BIBLE_RULES_BY_CATEGORY.capital_stack.map((r) => ({
    ruleId: r.id,
    label: r.title.replace(/ allocation$/, ""),
    pct: r.bullets?.[0] ?? "",
  }));

export const SPECULATIVE_DANGERS_DISPLAY = WEALTH_BIBLE_RULES_BY_CATEGORY.speculative_dangers.map(
  (r) => ({ ruleId: r.id, label: r.title })
);

export const WEALTH_DIAGNOSTIC_DISPLAY = WEALTH_BIBLE_RULES_BY_CATEGORY.wealth_diagnostic.map(
  (r, idx) => ({ ruleId: r.id, idx, text: r.body })
);

export type StatementExportType =
  | "cashapp_csv"
  | "cashapp_investing_csv"
  | "generic_csv";

export type StatementRowKind = "debit" | "credit";

export interface StatementRow {
  sourceType: StatementExportType;
  sourceLine: number;
  date: string;
  merchant: string;
  description: string;
  amountUsd: number;
  kind: StatementRowKind;
  categoryHint: string;
  symbolHint?: string;
  externalId?: string;
  /** True for Stock Buy / Bitcoin Buy rows (Cash App Investing export). */
  investmentPurchase?: boolean;
  investmentSale?: boolean;
  entryPriceUsd?: number;
  shares?: number;
  transactionType?: string;
}

export type DraftEntryStatus = "pending" | "accepted" | "rejected";

export interface PortfolioImportDraft {
  draftId: string;
  sourceLine: number;
  symbol: string;
  entry_date: string;
  entry_mode: "dollars" | "shares";
  entry_price: number;
  dollars_invested: number;
  shares?: number;
  tx_type?: "buy" | "sell";
  notes: string;
  confidence: number;
  status: DraftEntryStatus;
  valid: boolean;
  validationMessage?: string;
}

export interface ConsolidatedSymbolDraft {
  symbol: string;
  netShares: number;
  avgEntryPrice: number;
  totalCost: number;
  firstEntryDate: string;
  lotCount: number;
  lots: PortfolioImportDraft[];
  status: DraftEntryStatus;
  valid: boolean;
}

export interface ExpenseCategoryTotal {
  category: string;
  amountUsd: number;
  sharePct: number;
}

export type WealthRuleStatus = "pass" | "warn" | "fail";

export interface WealthRuleCheck {
  id: string;
  title: string;
  status: WealthRuleStatus;
  detail: string;
}

export interface ExpenseBreakdownResult {
  totalSpendUsd: number;
  categories: ExpenseCategoryTotal[];
  wealthChecks: WealthRuleCheck[];
}

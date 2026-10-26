# Data sources and limits

RawMarkets displays source and freshness states so people can review where a value came from. A quote card is not a promise that every requested symbol refreshed successfully.

## Provider map

| Data area | Current implementation | Notes |
| --- | --- | --- |
| Equities and energy | Yahoo Finance quote and chart adapters, plus optional legacy Alpha Vantage mode | Availability and history depend on the upstream source, request limits, and page or API changes. |
| Precious metals | Kitco capture with Yahoo spot or futures fallback and a local freshness cache | The application can show an unavailable or cached state when a fresh capture fails. MetalPriceAPI keys remain supported by the provider settings and key test flow; the current displayed metals panel prefers Kitco and Yahoo. |
| Market news | RSS and source-specific news adapters, including feeds shown in News Bay | Stories can be delayed, duplicated, removed, or summarized differently by their publisher. |
| Company and investor relations | Configured watchlist and IR discovery feeds | Coverage varies by issuer and source. |
| Headline sentiment | Ollama scoring when enabled and ready, with keyword scoring fallback | A sentiment label is an automated reading of headline context, not a fact check or price forecast. |
| Portfolio research | Local TypeScript rules, optional Python helpers, and user-configured model or search providers | Results depend on the stored portfolio data and active provider configuration. |

## Feed states

- **Live** means the adapter received a current response during that refresh. It does not imply exchange-grade delivery or a guaranteed delay interval.
- **Cached** means a previously received value is being shown with its stored timestamp.
- **Simulated** or **SIM** means a sample or fallback value is present. It is not a market quote.
- **Unavailable** means there is no displayable price for the requested feed or symbol.

Source pages and APIs can change their layouts, access rules, response formats, or rate limits. Scraped-feed behavior may need maintenance. The values and timestamps in the public screenshots are from May 2026 and are included to show the interface only. They are not current prices.

## Reading signals responsibly

Sentiment, portfolio discipline prompts, and research summaries are decision-support features. They can be wrong, incomplete, stale, or based on noisy input. They do not guarantee returns, validate a thesis, or replace independent research. RawMarkets does not execute brokerage orders and is not financial advice.

## Screenshot notes

- The overview and News Bay captures show application screens recorded May 25, 2026.
- The instrument catalog capture contains rows marked `SIM`; those values demonstrate the fallback presentation and are not live quotes.
- Images are historical interface evidence. Their displayed source labels and provider state describe the build at capture time and can differ from a later source configuration.

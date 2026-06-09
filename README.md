# RawMarkets

**A personal markets terminal for metals, energy, and equities — local-first, with an AI copilot.**

[![Ecosystem](https://img.shields.io/badge/Ecosystem-RAW%20ENGINE-E42527)](https://rawgraded.com)
![Status](https://img.shields.io/badge/Status-In%20Progress-d29922)
![Feeds](https://img.shields.io/badge/Live%20Data-No%20Paid%20APIs%20Required-1f6feb)

A phased bootstrap (hydrate → news → market → portfolio) pulls live quotes, metals spot prices, and RSS news into a local database, then layers analysis on top:

- **Portfolio discipline signals** — barbell drift, fractional Kelly caps, disposition checks, FOMO cooldowns, rebalance nudges, fragility alerts
- **News Bay** — watchlist-aware feed lanes with sentiment scoring and an in-app reader
- **Statements Analyzer** — import broker CSVs, classify transactions, reconcile into the portfolio
- **Local AI Copilot** — a locally-run model with retrieval context from *your* holdings, quotes, news, and research

**Architecture:** desktop terminal (web-tech UI + local API server + local database) with browser-automation-powered price feeds as the default — live data without paid market APIs. Cloud AI optional; portfolio data stays on-device.

> This repo is a public landing page. The product is closed-source; part of the [RAW ENGINE](https://rawgraded.com) suite.

**More:** [Full architecture breakdown on my profile](https://github.com/GatoGodMode)

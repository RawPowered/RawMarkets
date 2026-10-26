# Security and privacy

## Reporting a concern

Please do not publish exploit details, credentials, personal data, or database contents in a public issue. Use GitHub's private vulnerability reporting for this repository if it is enabled. Otherwise, contact the maintainer through the [RawPowered GitHub profile](https://github.com/RawPowered) and include a concise description and reproduction steps.

## Current safeguards

- The local API binds to `127.0.0.1` by default.
- State-changing requests are checked against configured origins, local access, or an administrator token. Admin routes have an additional access middleware.
- URL fetch helpers restrict requests to public HTTP(S) destinations and recheck redirect targets to reduce server-side request forgery risk.
- Production responses add content-type, frame, referrer, and content-security headers.
- Local AI chat has a per-client request interval limit.
- API keys saved through the application are stored in the local SQLite database. The database is not encrypted by the application, so protect the device and treat database exports as sensitive.

## Deployment boundary

RawMarkets is designed to run locally. Cross-origin configuration is not user authentication, and most read APIs are designed for a trusted local frontend. Do not expose the API directly to the public internet. If a hosted frontend or reverse proxy is used, bind the service deliberately, allow only the required origins, configure an administrator token, and place a real authentication and TLS layer in front of every route. Review the current code and deployment before relying on those controls.

Optional providers have separate data flows. Ollama can process requests locally when it runs on the same machine. Gemini, SerpApi, Alpha Vantage, and other configured providers are external services. Check provider terms before sending portfolio or research data.

## Scope

This document describes implementation controls. It is not a penetration-test report, security certification, encryption claim, or guarantee that third-party providers and dependencies are safe.

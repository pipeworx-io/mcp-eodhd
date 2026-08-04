# mcp-eodhd

EODHD MCP — wraps EOD Historical Data (eodhd.com)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `eodhd_fundamentals` | Get fundamentals + analyst price target & estimates for <symbol> — company profile, highlights, valuation ratios, analyst ratings/target price, and forward EPS/revenue estimates. Symbol uses EXCHANGE.SUFFIX format, e.g. "AAPL.US". Example: eodhd_fundamentals({ symbol: "AAPL.US", _apiKey: "your-api_token" }) |
| `eodhd_eod_prices` | Get historical daily prices for <symbol> — end-of-day OHLCV plus adjusted close. Symbol uses EXCHANGE.SUFFIX format, e.g. "AAPL.US". Optionally bound with from/to (YYYY-MM-DD) and period (d/w/m). Example: eodhd_eod_prices({ symbol: "AAPL.US", from: "2024-01-01", to: "2024-06-30", _apiKey: "your-api_token" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "eodhd": {
      "url": "https://gateway.pipeworx.io/eodhd/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Eodhd data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

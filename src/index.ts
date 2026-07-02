interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * EODHD MCP — wraps EOD Historical Data (eodhd.com)
 *
 * Tools:
 * - eodhd_fundamentals: company fundamentals + analyst price target & estimates
 * - eodhd_eod_prices: historical end-of-day OHLCV prices
 *
 * Auth: BYO key. Pass _apiKey — sent as the `api_token` query param.
 * Free tier is 20 calls/day; sign up at eodhd.com.
 */


const BASE_URL = 'https://eodhd.com/api';

const tools: McpToolExport['tools'] = [
  {
    name: 'eodhd_fundamentals',
    description:
      'Get fundamentals + analyst price target & estimates for <symbol> — company profile, highlights, valuation ratios, analyst ratings/target price, and forward EPS/revenue estimates. Symbol uses EXCHANGE.SUFFIX format, e.g. "AAPL.US". Example: eodhd_fundamentals({ symbol: "AAPL.US", _apiKey: "your-api_token" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Ticker with exchange suffix, e.g. "AAPL.US", "TSLA.US", "BMW.XETRA"',
        },
        _apiKey: {
          type: 'string',
          description: 'EODHD api_token (get one free at eodhd.com; free tier 20 calls/day)',
        },
      },
      required: ['symbol', '_apiKey'],
    },
  },
  {
    name: 'eodhd_eod_prices',
    description:
      'Get historical daily prices for <symbol> — end-of-day OHLCV plus adjusted close. Symbol uses EXCHANGE.SUFFIX format, e.g. "AAPL.US". Optionally bound with from/to (YYYY-MM-DD) and period (d/w/m). Example: eodhd_eod_prices({ symbol: "AAPL.US", from: "2024-01-01", to: "2024-06-30", _apiKey: "your-api_token" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Ticker with exchange suffix, e.g. "AAPL.US"',
        },
        from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional)',
        },
        to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional)',
        },
        period: {
          type: 'string',
          description: 'Sampling period: "d" daily (default), "w" weekly, "m" monthly',
        },
        _apiKey: {
          type: 'string',
          description: 'EODHD api_token (get one free at eodhd.com; free tier 20 calls/day)',
        },
      },
      required: ['symbol', '_apiKey'],
    },
  },
];

// Shared GET: appends api_token + fmt=json + caller params, maps errors.
async function eodhdGet(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  tool: string,
): Promise<unknown> {
  if (!apiKey) {
    throw new Error(
      `${tool} requires an EODHD api_token. Pass your EODHD api_token via _apiKey (sign up at eodhd.com; free tier 20 calls/day).`,
    );
  }
  const qs = new URLSearchParams({ api_token: apiKey, fmt: 'json', ...params });
  const res = await fetch(`${BASE_URL}${path}?${qs}`);
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `EODHD ${tool}: auth failed (HTTP ${res.status}). Check your EODHD api_token — it may be missing, invalid, or out of quota (free tier is 20 calls/day).`,
    );
  }
  if (!res.ok) throw new Error(`EODHD ${tool} error: HTTP ${res.status}`);
  return res.json();
}

// Safe object accessor — returns {} for anything non-object so nested reads never throw.
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function truncate(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

async function fundamentals(args: Record<string, unknown>, apiKey: string) {
  const symbol = (args.symbol as string | undefined) ?? '';
  if (!symbol) {
    throw new Error(
      'eodhd_fundamentals requires a `symbol` with exchange suffix, e.g. "AAPL.US".',
    );
  }

  const data = obj(
    await eodhdGet(`/fundamentals/${encodeURIComponent(symbol)}`, {}, apiKey, 'eodhd_fundamentals'),
  );

  const g = obj(data.General);
  const general = Object.keys(g).length
    ? {
        code: (g.Code as string) ?? null,
        name: (g.Name as string) ?? null,
        exchange: (g.Exchange as string) ?? null,
        sector: (g.Sector as string) ?? null,
        industry: (g.Industry as string) ?? null,
        description: truncate(g.Description, 400),
      }
    : null;

  const highlights = data.Highlights != null ? obj(data.Highlights) : null;
  const valuation = data.Valuation != null ? obj(data.Valuation) : null;

  const ar = obj(data.AnalystRatings);
  const analyst_ratings = Object.keys(ar).length
    ? {
        rating: (ar.Rating as number) ?? null,
        target_price: (ar.TargetPrice as number) ?? null,
        strong_buy: (ar.StrongBuy as number) ?? null,
        buy: (ar.Buy as number) ?? null,
        hold: (ar.Hold as number) ?? null,
        sell: (ar.Sell as number) ?? null,
        strong_sell: (ar.StrongSell as number) ?? null,
      }
    : null;

  // Earnings.Trend is a date-keyed dict of forward EPS/revenue estimate rows;
  // return it as-is when present.
  const earnings = obj(data.Earnings);
  const earnings_trend = earnings.Trend != null ? obj(earnings.Trend) : null;

  return { symbol, general, highlights, valuation, analyst_ratings, earnings_trend };
}

async function eodPrices(args: Record<string, unknown>, apiKey: string) {
  const symbol = (args.symbol as string | undefined) ?? '';
  if (!symbol) {
    throw new Error('eodhd_eod_prices requires a `symbol` with exchange suffix, e.g. "AAPL.US".');
  }
  const params: Record<string, string> = {};
  if (args.from) params.from = args.from as string;
  if (args.to) params.to = args.to as string;
  if (args.period) params.period = args.period as string;

  const data = await eodhdGet(
    `/eod/${encodeURIComponent(symbol)}`,
    params,
    apiKey,
    'eodhd_eod_prices',
  );
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];

  // Keep the most recent 260 rows (~1 trading year) when the series is longer.
  const recent = rows.length > 260 ? rows.slice(-260) : rows;

  return {
    symbol,
    count: recent.length,
    prices: recent.map((r) => ({
      date: (r.date as string) ?? null,
      open: (r.open as number) ?? null,
      high: (r.high as number) ?? null,
      low: (r.low as number) ?? null,
      close: (r.close as number) ?? null,
      adjusted_close: (r.adjusted_close as number) ?? null,
      volume: (r.volume as number) ?? null,
    })),
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  switch (name) {
    case 'eodhd_fundamentals':
      return fundamentals(args, apiKey);
    case 'eodhd_eod_prices':
      return eodPrices(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// BYO-key: user's own EODHD token bears the COGS; nominal access meter.
export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

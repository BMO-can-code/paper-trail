/**
 * Single source of truth for the model wiring.
 *
 * Verified 2026-10-29 against:
 * - Base URL: https://docs.tokenfactory.nebius.com/quickstart
 * - Model ID + price: https://tokenfactory.nebius.com/model-catalog.md
 *
 * Do not guess a model string: check the catalog (or GET /v1/models) and
 * override with NEBIUS_MODEL if the catalog changes.
 */
export const NEBIUS_BASE_URL =
  process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1";

export const NEBIUS_MODEL =
  process.env.NEBIUS_MODEL ?? "nvidia/nemotron-3-super-120b-a12b";

export const MODEL_CATALOG_URL = "https://tokenfactory.nebius.com/model-catalog.md";
export const BASE_URL_DOC_URL = "https://docs.tokenfactory.nebius.com/quickstart";

/** Live mode requires both keys. Anything less is an explicitly labelled mock. */
export const MOCK_MODE =
  process.env.MOCK_MODE === "1" ||
  !process.env.NEBIUS_API_KEY ||
  !process.env.TAVILY_API_KEY;

export const LIMITS = {
  maxTurns: 8,
  maxToolCalls: 10,
  maxClaims: 6,
  maxSourceReads: 5,
  maxSearches: 4,
  runTimeoutMs: 55_000,
  modelTimeoutMs: 45_000,
  toolTimeoutMs: 20_000,
  quoteMinChars: 12,
  quoteMaxChars: 600,
} as const;

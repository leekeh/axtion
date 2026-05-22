/**
 * normalize-routes.ts
 *
 * Accepts route input shapes and normalizes them to a flat RouteEntry[].
 *
 * Supported input formats:
 *
 * 1. String array (simplest):
 *    ["/", "/about", "/products?sort=asc"]
 *
 * 2. Route object array (with optional name and/or readiness override):
 *    [
 *      "/",
 *      {
 *        "path": "/dashboard",
 *        "name": "Dashboard",
 *        "readiness": { "type": "selector", "selector": "#content-loaded" }
 *      }
 *    ]
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * How to determine a page is ready for scanning after navigation.
 *
 * - networkidle / load / domcontentloaded: Playwright waitUntil options.
 *   Applied at the page.goto() call. Use these as the global default via
 *   the action's wait-strategy input.
 *
 * - selector: Wait for a CSS selector to be visible before scanning.
 *   Great for tab panels, lazy-loaded sections, or framework mount points.
 *   Example: { "type": "selector", "selector": "#tabpanel-design" }
 *
 * - js: Evaluate a JS expression in the page context and wait until it is truthy.
 *   Great for framework hydration signals (e.g. Next.js window.next detection).
 *   Example: { "type": "js", "expression": "window.next !== undefined" }
 *   After the expression turns truthy, also waits for requestIdleCallback so
 *   event listeners are attached before scanning.
 */
export type ReadinessStrategy =
  | { type: "networkidle" }
  | { type: "load" }
  | { type: "domcontentloaded" }
  | { type: "selector"; selector: string; timeout?: number }
  | { type: "js"; expression: string; timeout?: number };

export type WaitUntilStrategy = "networkidle" | "load" | "domcontentloaded";

/** Normalized representation of a single route to test. */
export type RouteEntry = {
  /** URL path, may include a query string. E.g. "/about" or "/search?q=bikes" */
  path: string;
  /** Optional human-readable test name. Defaults to a path-derived label. */
  name?: string;
  /** Per-route readiness override. Falls back to the global wait-strategy. */
  readiness?: ReadinessStrategy;
};

// ── Input shapes ───────────────────────────────────────────────────────────

type RouteObjectInput = {
  path: string;
  name?: string;
  readiness?: ReadinessStrategy;
};

type RouteInput = string | RouteObjectInput;

// ── Normalizer ────────────────────────────────────────────────────────────

export function normalizeRoutes(raw: unknown): RouteEntry[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("Routes must be a JSON array.");
  }
  return (raw as RouteInput[]).map(normalizeRouteInput);
}

function normalizeRouteInput(input: RouteInput): RouteEntry {
  if (typeof input === "string") {
    return { path: input };
  }
  const entry: RouteEntry = { path: input.path };
  if (input.name) entry.name = input.name;
  if (input.readiness) entry.readiness = input.readiness;
  return entry;
}

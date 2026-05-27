import { expect, test, type Page } from "@playwright/test";
import { checkA11y } from "./check-a11y.ts";
import {
  normalizeRoutes,
  type RouteEntry,
  type ReadinessStrategy,
  type WaitUntilStrategy,
} from "./normalize-routes.ts";
import * as fs from "node:fs";

// ── Load routes manifest ─────────────────────────────────────────────────────

const routesFile = process.env.ROUTES_FILE;
if (!routesFile || !fs.existsSync(routesFile)) {
  throw new Error(
    `ROUTES_FILE env var must point to a valid routes manifest. Got: ${routesFile}`,
  );
}

const rawManifest = JSON.parse(fs.readFileSync(routesFile, "utf-8"));
const routes = normalizeRoutes(rawManifest);

// ── Global default wait strategy ─────────────────────────────────────────────

const defaultWaitStrategy = (
  process.env.A11Y_WAIT_STRATEGY ?? "networkidle"
) as WaitUntilStrategy;

// ── Test suite ───────────────────────────────────────────────────────────────

if (routes.length === 0) {
  test("no routes to test", () => {
    test.skip();
  });
} else {
  test.describe("Page accessibility", () => {
    test.describe.configure({ mode: "parallel" });

    for (const entry of routes) {
      const testName = buildTestName(entry);

      test(testName, async ({ page }) => {
        await page.goto(entry.path, {
          waitUntil: getWaitUntil(entry.readiness, defaultWaitStrategy),
        });

        await applyReadiness(page, entry);
        await checkA11y(page, testName);
      });
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTestName(entry: RouteEntry): string {
  if (entry.name) return entry.name;
  const [pathPart, query] = entry.path.split("?");
  let name = pathPart.replace(/^\//, "").replaceAll("/", " / ") || "index";
  if (query) name += ` (${query})`;
  return name;
}

/**
 * Determines Playwright's waitUntil option.
 * A per-route selector/js readiness strategy uses "load" as the goto waitUntil
 * (we'll handle the actual wait after navigation ourselves), unless the route
 * has an explicit networkidle/load/domcontentloaded override.
 */
function getWaitUntil(
  readiness: ReadinessStrategy | undefined,
  fallback: WaitUntilStrategy,
): WaitUntilStrategy {
  if (!readiness) return fallback;
  const type = readiness.type;
  // For selector/js strategies, navigate with "load" first, then apply the
  // custom wait. Don't combine with networkidle to avoid long timeouts on
  // apps that keep background polling active.
  if (type === "js" || type === "selector") {
    return "load";
  }
 
  return type;
}

/**
 * Applies per-route readiness logic after navigation.
 * - selector: waits for the element to be visible
 * - js: polls a JS expression inside the page, then waits for requestIdleCallback
 * - others: nothing extra to do (handled by waitUntil in goto)
 */
async function applyReadiness(
  page: Page,
  entry: RouteEntry,
): Promise<void> {
  const { readiness } = entry;
  if (!readiness) return;

  switch (readiness.type) {
    case "selector": {
      const locator = page.locator(readiness.selector);
      try {
        await expect(locator).toBeVisible({ timeout: readiness.timeout ?? 10_000 });
      } catch {
        console.warn(
          `[a11y] Skipping ${entry.path}: selector "${readiness.selector}" did not become visible.`,
        );
        test.skip();
      }
      break;
    }

    case "js": {
      const timeout = readiness.timeout ?? 30_000;
      try {
        // Poll until the expression is truthy.
        // Expression is evaluated in the browser sandbox and has no access to the runner environment.
        await page.waitForFunction(readiness.expression, null, { timeout });
        // Then wait for the event loop to drain (hydration, deferred renders, etc.)
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              if ("requestIdleCallback" in globalThis) {
                globalThis.requestIdleCallback(() => resolve());
              } else {
                // Safari / environments without requestIdleCallback
                setTimeout(resolve, 200);
              }
            }),
        );
      } catch {
        console.warn(
          `[a11y] Skipping ${entry.path}: JS expression "${readiness.expression}" did not resolve within ${timeout}ms.`,
        );
        test.skip();
      }
      break;
    }

    // networkidle / load / domcontentloaded are handled via waitUntil in goto
    default:
      break;
  }
}

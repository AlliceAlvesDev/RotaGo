import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("shows bill coverage from per-bill reserves and applies free cash by due date", async () => {
  const { calculateBillProgress } = await vite.ssrLoadModule(
    "/components/rotas-dashboard.tsx",
  );
  const plan = {
    id: "plan",
    month: "2026-10",
    startDate: "2026-10-19",
    availableCents: 5000,
    dailyReserveCents: 0,
    kmPerLiter: 10,
    fuelPriceCents: 0,
    kmPerWorkday: 0,
    enabled: true,
    daysOff: [],
    items: [
      { id: "first", description: "Conta A", amountCents: 30000, reservedCents: 10000, dueDate: "2026-10-20" },
      { id: "second", description: "Conta B", amountCents: 60000, reservedCents: 5000, dueDate: "2026-10-25" },
    ],
  };

  assert.deepEqual(calculateBillProgress(plan), [
    { id: "first", coveredCents: 15000, remainingCents: 15000 },
    { id: "second", coveredCents: 5000, remainingCents: 55000 },
  ]);
});

test("credits logged net earnings once per day after operating costs and daily reserve", async () => {
  const { calculateBillProgress } = await vite.ssrLoadModule(
    "/components/rotas-dashboard.tsx",
  );
  const plan = {
    id: "plan",
    month: "2026-10",
    startDate: "2026-10-19",
    availableCents: 1000,
    dailyReserveCents: 1000,
    kmPerLiter: 10,
    fuelPriceCents: 0,
    kmPerWorkday: 0,
    enabled: true,
    daysOff: [],
    items: [
      { id: "bill", description: "Conta", amountCents: 30000, reservedCents: 2000, dueDate: "2026-10-25" },
    ],
  };
  const session = (id, earningsCents, fuelCents, date = "2026-10-19") => ({
    id,
    date,
    platform: "99",
    startTime: "08:00",
    endTime: "10:00",
    kmDriven: 20,
    kmPerLiter: 10,
    fuelPriceCents: 400,
    earningsCents,
    fuelCents,
    maintenanceCents: 0,
    investmentCents: 0,
  });

  assert.deepEqual(calculateBillProgress(
    plan,
    [session("a", 10000, 1000), session("b", 5000, 500), session("future", 50000, 0, "2026-10-21")],
    "2026-10-19",
  ), [
    { id: "bill", coveredCents: 15500, remainingCents: 14500 },
  ]);
});

test("recalculates the daily bill goal after a reserve and excludes planned days off", async () => {
  const { calculatePlan } = await vite.ssrLoadModule(
    "/components/rotas-dashboard.tsx",
  );
  const sessions = [{
    id: "session",
    date: "2026-10-19",
    platform: "99",
    startTime: "08:00",
    endTime: "10:00",
    kmDriven: 20,
    kmPerLiter: 10,
    fuelPriceCents: 400,
    earningsCents: 16000,
    fuelCents: 1000,
    maintenanceCents: 0,
    investmentCents: 0,
  }];
  const result = calculatePlan({
    id: "plan",
    month: "2026-10",
    startDate: "2026-10-19",
    availableCents: 0,
    dailyReserveCents: 1000,
    kmPerLiter: 10,
    fuelPriceCents: 400,
    kmPerWorkday: 100,
    enabled: true,
    daysOff: ["2026-10-21"],
    items: [
      { id: "bill", description: "Conta", amountCents: 60000, reservedCents: 10000, dueDate: "2026-10-23" },
    ],
  }, sessions, "2026-10-20");
  assert.equal(result.phases.length, 1);
  assert.equal(result.phases[0].workDays, 3);
  assert.equal(result.phases[0].netDailyCents, 12000);
  assert.equal(result.fuelDailyCents, 4000);
  assert.equal(result.phases[0].grossDailyCents, 17000);
});

test("a fully covered bill needs no new daily contribution", async () => {
  const { calculateBillProgress, calculatePlan } = await vite.ssrLoadModule(
    "/components/rotas-dashboard.tsx",
  );
  const result = calculatePlan({
    id: "plan",
    month: "2026-10",
    startDate: "2026-10-19",
    availableCents: 0,
    dailyReserveCents: 0,
    kmPerLiter: 10,
    fuelPriceCents: 0,
    kmPerWorkday: 0,
    enabled: true,
    daysOff: [],
    items: [
      { id: "bill", description: "Conta", amountCents: 60000, reservedCents: 60000, dueDate: "2026-10-23" },
    ],
  });

  assert.equal(result.phases.length, 0);
  assert.equal(calculateBillProgress({
    id: "plan",
    month: "2026-10",
    startDate: "2026-10-19",
    availableCents: 0,
    dailyReserveCents: 0,
    kmPerLiter: 10,
    fuelPriceCents: 0,
    kmPerWorkday: 0,
    enabled: true,
    daysOff: [],
    items: [
      { id: "bill", description: "Conta", amountCents: 60000, reservedCents: 60000, dueDate: "2026-10-23" },
    ],
  })[0].remainingCents, 0);
});

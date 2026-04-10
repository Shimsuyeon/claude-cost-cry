const electron = require("electron");
const path = require("path");
const fs = require("fs");

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } =
  electron;

let tray = null;
let overlay = null;
let watcher = null;
let totalCost = 0;
let callCount = 0;
let config = {};
let topRequests = [];
let exchangeInfo = null;
let costByProvider = {};
let _toEquivalent = null;
let _calcBreakdown = null;
let _t = null;
let _localeStrings = null;

const WIDGET_WIDTH = 280;
const WIDGET_HEIGHT = 140;
const WIDGET_HEIGHT_EXPANDED = 600;
const MARGIN = 20;

function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();

  overlay = new BrowserWindow({
    x: bounds.x + bounds.width - WIDGET_WIDTH - MARGIN,
    y: bounds.y + MARGIN,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  overlay.setAlwaysOnTop(true, "floating");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(false);

  overlay.loadFile(path.join(__dirname, "overlay.html"));

  overlay.webContents.on("did-finish-load", () => {
    overlay.webContents.send("initial-data", buildPayload());
  });

  overlay.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require("electron");
    shell.openExternal(url);
    return { action: "deny" };
  });

  overlay.on("closed", () => {
    overlay = null;
  });
}

function cleanPrompt(text) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function truncatePrompt(text, maxLen = 30) {
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function getCostBreakdown(usage, totalCost) {
  if (_calcBreakdown) return _calcBreakdown(usage);
  return { inputCost: totalCost, outputCost: 0 };
}

function recordRequest(usage, cost) {
  const totalInput =
    (usage.inputTokens || 0) +
    (usage.cacheCreationTokens || 0) +
    (usage.cacheReadTokens || 0);
  const locale = (config.language || "en") === "ko" ? "ko-KR" : "en-US";
  const time = usage.timestamp
    ? new Date(usage.timestamp).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const provider = usage.provider || "claude";
  const modelLabel = getModelLabelLocal(usage);
  const fullPrompt = cleanPrompt(usage.prompt);
  const breakdown = getCostBreakdown(usage, cost);

  topRequests.push({
    cost,
    inputCost: breakdown.inputCost,
    outputCost: breakdown.outputCost,
    provider,
    providerEmoji: PROVIDER_META[provider]?.emoji || "⚪",
    model: modelLabel,
    time,
    inputTokens: totalInput,
    outputTokens: usage.outputTokens || 0,
    prompt: truncatePrompt(fullPrompt),
    fullPrompt: fullPrompt,
  });

  topRequests.sort((a, b) => b.cost - a.cost);
  if (topRequests.length > 5) topRequests.length = 5;
}

const PROVIDER_META = {
  claude: { emoji: "🟣", displayName: "Claude" },
  openai: { emoji: "🟢", displayName: "OpenAI" },
  google: { emoji: "🔵", displayName: "Gemini" },
  cursor: { emoji: "⚡", displayName: "Cursor" },
};

function getModelLabelLocal(usage) {
  const model = usage.model || "";
  if (/opus/i.test(model)) return "Opus";
  if (/haiku/i.test(model)) return "Haiku";
  if (/sonnet/i.test(model)) return "Sonnet";
  if (/gpt-4\.1-nano/i.test(model)) return "GPT-4.1 nano";
  if (/gpt-4\.1-mini/i.test(model)) return "GPT-4.1 mini";
  if (/gpt-4\.1/i.test(model)) return "GPT-4.1";
  if (/gpt-4o-mini/i.test(model)) return "GPT-4o mini";
  if (/gpt-4o/i.test(model)) return "GPT-4o";
  if (/o4-mini/i.test(model)) return "o4-mini";
  if (/o3-mini/i.test(model)) return "o3 mini";
  if (/o3/i.test(model)) return "o3";
  if (/o1-mini/i.test(model)) return "o1 mini";
  if (/o1/i.test(model)) return "o1";
  if (/gpt-4/i.test(model)) return "GPT-4";
  if (/gpt-3/i.test(model)) return "GPT-3.5";
  if (/gemini.*2\.5.*pro/i.test(model)) return "Gemini 2.5 Pro";
  if (/gemini.*flash/i.test(model)) return "Gemini Flash";
  if (/gemini.*pro/i.test(model)) return "Gemini Pro";
  return model.split("/").pop() || "Unknown";
}

function tt(key, params) {
  if (_t) return _t(key, params);
  return key;
}

function buildPayload(deltaCost, usage) {
  const budgetStatus = config.dailyBudget
    ? getBudgetStatus(totalCost, config.dailyBudget)
    : null;

  return {
    totalCost,
    callCount,
    deltaCost: deltaCost || 0,
    model: usage?.model,
    provider: usage?.provider,
    tier: getTier(totalCost),
    equivalent: getEquivalent(totalCost),
    budget: budgetStatus,
    nudge: usage ? getNudgeInfo(usage, deltaCost) : null,
    topRequests,
    exchange: exchangeInfo,
    costByProvider,
    locale: _localeStrings,
  };
}

function getNudgeInfo(usage, cost) {
  if (!config.showNudge || !cost || cost < 0.01) return null;

  const provider = usage.provider || "claude";
  let models;
  if (provider === "claude") {
    models = {
      opus: { input: 15, output: 75 },
      sonnet: { input: 3, output: 15 },
      haiku: { input: 0.8, output: 4 },
    };
  } else if (provider === "openai") {
    models = {
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "o3-mini": { input: 1.1, output: 4.4 },
    };
  } else if (provider === "cursor") {
    models = {
      "claude-4-sonnet": { input: 3, output: 15 },
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gemini-2.0-flash": { input: 0.1, output: 0.4 },
    };
  } else {
    return null;
  }

  const totalInput =
    (usage.inputTokens || 0) +
    (usage.cacheCreationTokens || 0) +
    (usage.cacheReadTokens || 0);
  const currentLabel = getModelLabelLocal(usage).toLowerCase();

  let best = null;
  for (const [key, p] of Object.entries(models)) {
    if (key === currentLabel) continue;
    const altCost =
      (totalInput / 1e6) * p.input +
      ((usage.outputTokens || 0) / 1e6) * p.output;
    const saving = cost - altCost;
    if (saving > 0.005 && (!best || saving > best.saving)) {
      best = { model: key, saving };
    }
  }
  return best;
}

function toggleOverlay() {
  if (overlay) {
    if (overlay.isVisible()) {
      overlay.hide();
    } else {
      overlay.show();
      overlay.webContents.send("initial-data", buildPayload());
    }
  } else {
    createOverlay();
  }
}

function getTier(cost) {
  if (cost < 1) return { emoji: "🪙", level: "peace", label: tt("tier.peace") };
  if (cost < 5)
    return { emoji: "💸", level: "uneasy", label: tt("tier.uneasy") };
  if (cost < 10)
    return { emoji: "🔥", level: "worry", label: tt("tier.worry") };
  if (cost < 30)
    return { emoji: "🚨", level: "alert", label: tt("tier.alert") };
  if (cost < 100)
    return { emoji: "💀", level: "danger", label: tt("tier.danger") };
  return { emoji: "⚰️", level: "funeral", label: tt("tier.funeral") };
}

function getEquivalent(cost) {
  if (_toEquivalent) return _toEquivalent(cost, config);
  return null;
}

function getBudgetStatus(cost, budget) {
  if (!budget || budget <= 0) return null;
  const ratio = cost / budget;
  let status = "ok";
  if (ratio >= 1) status = "exceeded";
  else if (ratio >= 0.9) status = "danger";
  else if (ratio >= 0.7) status = "warning";
  return {
    ratio: Math.min(ratio, 1),
    status,
    budget,
    remaining: Math.max(0, budget - cost),
  };
}

function sendCostUpdate(usage, cost) {
  if (!overlay || !overlay.webContents) return;
  overlay.webContents.send("cost-update", buildPayload(cost, usage));
}

function formatCostForTray(cost) {
  if (!exchangeInfo || exchangeInfo.currency === "USD") {
    return cost < 1 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(2)}`;
  }
  const local = cost * exchangeInfo.rate;
  const sym = exchangeInfo.symbol;
  if (exchangeInfo.currency === "KRW" || exchangeInfo.currency === "JPY") {
    return `${sym}${Math.round(local).toLocaleString()}`;
  }
  return `${sym}${local.toFixed(2)}`;
}

function updateTrayTitle() {
  if (!tray) return;
  const costStr = formatCostForTray(totalCost);
  tray.setTitle(` ${costStr}`);
  tray.setToolTip(tt("tray.today", { cost: costStr, count: callCount }));
}

async function startCostTracking() {
  const { scanToday, startWatching } = await import("../dist/watcher.js");
  const { calculateCost, calculateCostBreakdown, toEquivalent: _toEquiv } =
    await import("../dist/calculator.js");
  const { loadConfig } = await import("../dist/config.js");
  const { getExchangeRate } = await import("../dist/exchange.js");
  const { t, setLocale, getLocaleStrings } = await import("../dist/i18n.js");

  _t = t;
  _toEquivalent = _toEquiv;
  _calcBreakdown = calculateCostBreakdown;
  config = loadConfig();
  if (config.language) setLocale(config.language);
  _localeStrings = getLocaleStrings();
  exchangeInfo = await getExchangeRate(config);

  const { usages: todayUsages, fileOffsets } = await scanToday(config);

  for (const usage of todayUsages) {
    const cost = calculateCost(usage);
    totalCost += cost;
    const p = usage.provider || "claude";
    costByProvider[p] = (costByProvider[p] || 0) + cost;
    recordRequest(usage, cost);
  }
  callCount = todayUsages.length;

  updateTrayTitle();

  watcher = startWatching(
    fileOffsets,
    (usage) => {
      const cost = calculateCost(usage);
      totalCost += cost;
      callCount++;
      const p = usage.provider || "claude";
      costByProvider[p] = (costByProvider[p] || 0) + cost;
      recordRequest(usage, cost);
      updateTrayTitle();
      sendCostUpdate(usage, cost);
    },
    config,
  );
}

function startPeriodicRescan() {
  setInterval(async () => {
    try {
      const { scanToday } = await import("../dist/watcher.js");
      const { calculateCost } = await import("../dist/calculator.js");

      const { usages } = await scanToday(config);
      let newTotal = 0;
      const newCostByProvider = {};
      const newTopRequests = [];

      for (const usage of usages) {
        const cost = calculateCost(usage);
        newTotal += cost;
        const p = usage.provider || "claude";
        newCostByProvider[p] = (newCostByProvider[p] || 0) + cost;
        recordRequestToList(newTopRequests, usage, cost);
      }

      if (
        Math.abs(newTotal - totalCost) > 0.001 ||
        usages.length !== callCount
      ) {
        totalCost = newTotal;
        callCount = usages.length;
        costByProvider = newCostByProvider;
        topRequests = newTopRequests;
        updateTrayTitle();
        sendCostUpdate(null, 0);
      }
    } catch {
      // silent fallback
    }
  }, 30_000);
}

function recordRequestToList(list, usage, cost) {
  const totalInput =
    (usage.inputTokens || 0) +
    (usage.cacheCreationTokens || 0) +
    (usage.cacheReadTokens || 0);
  const locale = (config.language || "en") === "ko" ? "ko-KR" : "en-US";
  const time = usage.timestamp
    ? new Date(usage.timestamp).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const provider = usage.provider || "claude";
  const modelLabel = getModelLabelLocal(usage);
  const fullPrompt = cleanPrompt(usage.prompt);
  const breakdown = getCostBreakdown(usage, cost);

  list.push({
    cost,
    inputCost: breakdown.inputCost,
    outputCost: breakdown.outputCost,
    provider,
    providerEmoji: PROVIDER_META[provider]?.emoji || "⚪",
    model: modelLabel,
    time,
    inputTokens: totalInput,
    outputTokens: usage.outputTokens || 0,
    prompt: truncatePrompt(fullPrompt),
    fullPrompt: fullPrompt,
  });

  list.sort((a, b) => b.cost - a.cost);
  if (list.length > 5) list.length = 5;
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, "..", "assets", "tray-icon.png");
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      if (process.platform === "darwin") img.setTemplateImage(true);
      return img;
    }
  }
  return nativeImage.createEmpty();
}

// ── Single instance lock ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (overlay) {
      overlay.show();
    } else {
      createOverlay();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === "darwin") {
      app.dock.hide();
    }

    ipcMain.on("hide-overlay", () => {
      if (overlay) overlay.hide();
    });

    ipcMain.on("start-drag", () => {
      if (overlay) overlay.setIgnoreMouseEvents(false);
    });

    ipcMain.handle("get-config", async () => {
      const { loadConfig } = await import("../dist/config.js");
      const { getAllEquivalents } = await import("../dist/calculator.js");
      const { SUPPORTED_CURRENCIES } = await import("../dist/exchange.js");
      const { getProviderNames } = await import("../dist/providers/index.js");
      const cfg = loadConfig();
      return {
        ...cfg,
        allUnits: getAllEquivalents(cfg).map((e) => ({
          key: e.key || e.name,
          name: e.name,
          emoji: e.emoji,
        })),
        supportedCurrencies: SUPPORTED_CURRENCIES,
        supportedProviders: getProviderNames(),
        currentExchange: exchangeInfo,
      };
    });

    ipcMain.handle("save-config", async (_e, updates) => {
      const { updateConfig, loadConfig } = await import("../dist/config.js");
      const { getExchangeRate } = await import("../dist/exchange.js");
      config = updateConfig(updates);

      if (updates.language !== undefined) {
        const { setLocale, getLocaleStrings } = await import("../dist/i18n.js");
        setLocale(updates.language);
        _localeStrings = getLocaleStrings();
      }

      if (
        updates.currency !== undefined ||
        updates.exchangeRate !== undefined
      ) {
        exchangeInfo = await getExchangeRate(config);
        updateTrayTitle();
      }

      if (overlay && overlay.webContents) {
        overlay.webContents.send("cost-update", buildPayload());
      }
      return config;
    });

    ipcMain.handle("get-report", async (_e, days) => {
      const d = days || 7;
      const { getCachedReportData, getReportData } =
        await import("../dist/report.js");
      const cached = getCachedReportData(d);

      if (cached) {
        getReportData(d)
          .then((fresh) => {
            overlay?.webContents?.send("report-refreshed", {
              days: d,
              data: fresh,
            });
          })
          .catch(() => {});
        return cached;
      }

      return getReportData(d);
    });

    ipcMain.handle("check-update", async () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
      );
      const current = pkg.version;
      try {
        const resp = await fetch(
          `https://registry.npmjs.org/${pkg.name}/latest`,
          { timeout: 5000 },
        );
        if (!resp.ok)
          return { current, latest: current, updateAvailable: false };
        const data = await resp.json();
        const latest = data.version || current;
        return { current, latest, updateAvailable: latest !== current };
      } catch {
        return {
          current,
          latest: current,
          updateAvailable: false,
          error: true,
        };
      }
    });

    ipcMain.handle("run-update", async () => {
      const { execSync } = require("child_process");
      try {
        execSync("npm install -g claude-cost-cry@latest", {
          encoding: "utf-8",
          timeout: 60_000,
          stdio: "pipe",
        });
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 1500);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.on("quit-app", () => {
      app.quit();
    });

    ipcMain.on("resize-widget", (_e, expanded) => {
      if (!overlay) return;
      const h = expanded ? WIDGET_HEIGHT_EXPANDED : WIDGET_HEIGHT;
      overlay.setSize(WIDGET_WIDTH, h);
    });

    await startCostTracking();
    startPeriodicRescan();

    tray = new Tray(createTrayIcon());
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: tt("tray.toggle"), click: toggleOverlay },
        { type: "separator" },
        { label: tt("tray.quit"), click: () => app.quit() },
      ]),
    );
    tray.on("click", toggleOverlay);

    updateTrayTitle();

    createOverlay();
  });

  app.on("window-all-closed", (e) => e.preventDefault());
} // end of gotTheLock

const electron = require('electron');
const path = require('path');
const fs = require('fs');

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = electron;

let tray = null;
let overlay = null;
let watcher = null;
let totalCost = 0;
let callCount = 0;
let config = {};
let topRequests = [];

const WIDGET_WIDTH = 280;
const WIDGET_HEIGHT = 140;
const WIDGET_HEIGHT_EXPANDED = 310;
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(false);

  overlay.loadFile(path.join(__dirname, 'overlay.html'));

  overlay.webContents.on('did-finish-load', () => {
    overlay.webContents.send('initial-data', buildPayload());
  });

  overlay.on('closed', () => {
    overlay = null;
  });
}

function truncatePrompt(text, maxLen = 30) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function recordRequest(usage, cost) {
  const totalInput = (usage.inputTokens || 0) + (usage.cacheCreationTokens || 0) + (usage.cacheReadTokens || 0);
  const time = usage.timestamp
    ? new Date(usage.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  topRequests.push({
    cost,
    model: getPricingByKey(getModelKey(usage.model)).label,
    time,
    inputTokens: totalInput,
    outputTokens: usage.outputTokens || 0,
    prompt: truncatePrompt(usage.prompt),
  });

  topRequests.sort((a, b) => b.cost - a.cost);
  if (topRequests.length > 3) topRequests.length = 3;
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
    tier: getTier(totalCost),
    equivalent: getEquivalent(totalCost),
    budget: budgetStatus,
    nudge: usage ? getNudgeInfo(usage, deltaCost) : null,
    topRequests,
  };
}

function getNudgeInfo(usage, cost) {
  if (!config.showNudge || !cost || cost < 0.01) return null;
  const models = ['opus', 'sonnet', 'haiku'];
  const results = {};
  for (const key of models) {
    const p = getPricingByKey(key);
    const totalInput = (usage.inputTokens || 0) + (usage.cacheCreationTokens || 0) + (usage.cacheReadTokens || 0);
    results[key] = (totalInput / 1e6) * p.input + ((usage.outputTokens || 0) / 1e6) * p.output;
  }
  const currentKey = getModelKey(usage.model);
  let best = null;
  for (const [key, altCost] of Object.entries(results)) {
    if (key === currentKey) continue;
    const saving = cost - altCost;
    if (saving > 0.005 && (!best || saving > best.saving)) {
      best = { model: getPricingByKey(key).label, saving };
    }
  }
  return best;
}

const PRICING = {
  opus: { input: 15, output: 75, label: 'Opus' },
  sonnet: { input: 3, output: 15, label: 'Sonnet' },
  haiku: { input: 0.8, output: 4, label: 'Haiku' },
};

function getPricingByKey(key) { return PRICING[key] || PRICING.sonnet; }

function getModelKey(name) {
  if (!name) return 'sonnet';
  if (/opus/i.test(name)) return 'opus';
  if (/haiku/i.test(name)) return 'haiku';
  return 'sonnet';
}

function toggleOverlay() {
  if (overlay) {
    if (overlay.isVisible()) {
      overlay.hide();
    } else {
      overlay.show();
      overlay.webContents.send('initial-data', buildPayload());
    }
  } else {
    createOverlay();
  }
}

function getTier(cost) {
  if (cost < 1) return { emoji: '🪙', level: 'peace', label: '평화' };
  if (cost < 5) return { emoji: '💸', level: 'uneasy', label: '불안' };
  if (cost < 10) return { emoji: '🔥', level: 'worry', label: '걱정' };
  if (cost < 30) return { emoji: '🚨', level: 'alert', label: '경고' };
  if (cost < 100) return { emoji: '💀', level: 'danger', label: '공포' };
  return { emoji: '⚰️', level: 'funeral', label: '장례식' };
}

function getEquivalent(cost) {
  if (cost < 0.01) return null;
  const items = [
    { name: '아이스 아메리카노', price: 4.5, emoji: '☕' },
    { name: '점심', price: 8, emoji: '🍱' },
    { name: '치킨', price: 17, emoji: '🍗' },
  ];
  for (const item of items) {
    const count = cost / item.price;
    if (count >= 0.1) {
      return { ...item, count: Math.round(count * 10) / 10 };
    }
  }
  return { ...items[0], count: Math.round((cost / items[0].price) * 10) / 10 };
}

function getBudgetStatus(cost, budget) {
  if (!budget || budget <= 0) return null;
  const ratio = cost / budget;
  let status = 'ok';
  if (ratio >= 1) status = 'exceeded';
  else if (ratio >= 0.9) status = 'danger';
  else if (ratio >= 0.7) status = 'warning';
  return { ratio: Math.min(ratio, 1), status, budget, remaining: Math.max(0, budget - cost) };
}

function sendCostUpdate(usage, cost) {
  if (!overlay || !overlay.webContents) return;
  overlay.webContents.send('cost-update', buildPayload(cost, usage));
}

function updateTrayTitle() {
  if (!tray) return;
  const costStr = totalCost < 1
    ? `$${totalCost.toFixed(3)}`
    : `$${totalCost.toFixed(2)}`;
  tray.setTitle(` ${costStr}`);
  tray.setToolTip(`claude-cost-cry: 오늘 ${costStr} (${callCount}건)`);
}

async function startCostTracking() {
  const { scanToday, startWatching } = await import('../src/watcher.js');
  const { calculateCost } = await import('../src/calculator.js');
  const { loadConfig } = await import('../src/config.js');

  config = loadConfig();

  const { usages: todayUsages, fileOffsets } = await scanToday();

  for (const usage of todayUsages) {
    const cost = calculateCost(usage);
    totalCost += cost;
    recordRequest(usage, cost);
  }
  callCount = todayUsages.length;

  updateTrayTitle();

  watcher = startWatching(fileOffsets, (usage) => {
    const cost = calculateCost(usage);
    totalCost += cost;
    callCount++;
    recordRequest(usage, cost);
    updateTrayTitle();
    sendCostUpdate(usage, cost);
  });
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      if (process.platform === 'darwin') img.setTemplateImage(true);
      return img;
    }
  }
  return nativeImage.createEmpty();
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  ipcMain.on('hide-overlay', () => {
    if (overlay) overlay.hide();
  });

  ipcMain.on('start-drag', () => {
    if (overlay) overlay.setIgnoreMouseEvents(false);
  });

  ipcMain.handle('get-config', async () => {
    const { loadConfig } = await import('../src/config.js');
    return loadConfig();
  });

  ipcMain.handle('save-config', async (_e, updates) => {
    const { updateConfig } = await import('../src/config.js');
    config = updateConfig(updates);
    if (overlay && overlay.webContents) {
      overlay.webContents.send('cost-update', buildPayload());
    }
    return config;
  });

  ipcMain.on('resize-widget', (_e, expanded) => {
    if (!overlay) return;
    const h = expanded ? WIDGET_HEIGHT_EXPANDED : WIDGET_HEIGHT;
    overlay.setSize(WIDGET_WIDTH, h);
  });

  tray = new Tray(createTrayIcon());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '위젯 열기/닫기', click: toggleOverlay },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ])
  );
  tray.on('click', toggleOverlay);

  await startCostTracking();
  updateTrayTitle();

  createOverlay();
});

app.on('window-all-closed', (e) => e.preventDefault());

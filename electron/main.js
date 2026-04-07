const electron = require('electron');
const path = require('path');
const fs = require('fs');

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = electron;

let tray = null;
let overlay = null;
let watcher = null;
let totalCost = 0;
let callCount = 0;

const WIDGET_WIDTH = 280;
const WIDGET_HEIGHT = 120;
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
    overlay.webContents.send('initial-data', {
      totalCost,
      callCount,
      tier: getTier(totalCost),
      equivalent: getEquivalent(totalCost),
    });
  });

  overlay.on('closed', () => {
    overlay = null;
  });
}

function toggleOverlay() {
  if (overlay) {
    if (overlay.isVisible()) {
      overlay.hide();
    } else {
      overlay.show();
      overlay.webContents.send('initial-data', {
        totalCost,
        callCount,
        tier: getTier(totalCost),
        equivalent: getEquivalent(totalCost),
      });
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

function sendCostUpdate(usage, cost) {
  if (!overlay || !overlay.webContents) return;

  overlay.webContents.send('cost-update', {
    totalCost,
    callCount,
    deltaCost: cost,
    model: usage.model,
    tier: getTier(totalCost),
    equivalent: getEquivalent(totalCost),
  });
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

  const { usages: todayUsages, fileOffsets } = await scanToday();

  for (const usage of todayUsages) {
    totalCost += calculateCost(usage);
  }
  callCount = todayUsages.length;

  updateTrayTitle();

  watcher = startWatching(fileOffsets, (usage) => {
    const cost = calculateCost(usage);
    totalCost += cost;
    callCount++;
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

  // IPC handlers
  ipcMain.on('hide-overlay', () => {
    if (overlay) overlay.hide();
  });

  ipcMain.on('start-drag', () => {
    if (overlay) {
      overlay.setIgnoreMouseEvents(false);
    }
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

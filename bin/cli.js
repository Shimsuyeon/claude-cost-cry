#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

const { t, setLocale } = await import('../dist/i18n.js');
const { loadConfig: _lc } = await import('../dist/config.js');
const _initCfg = _lc();
if (_initCfg.language) setLocale(_initCfg.language);

if (command === 'config') {
  const { updateConfig, loadConfig } = await import('../dist/config.js');
  const { showConfigUpdate, showInfo } = await import('../dist/display.js');

  const flags = args.slice(1);

  const { getAllEquivalents } = await import('../dist/calculator.js');

  if (flags.length === 0) {
    const config = loadConfig();
    const { getExchangeRate, SUPPORTED_CURRENCIES } = await import('../dist/exchange.js');
    const allItems = getAllEquivalents(config);
    const unitDisplay = config.equivalentUnit === 'auto'
      ? t('cli.autoUnit')
      : `${config.equivalentUnit}`;
    const exchange = await getExchangeRate(config);
    console.log();
    showInfo(t('cli.currentConfig'));
    console.log(`  ${t('cli.dailyBudget')}    ${config.dailyBudget ? `$${config.dailyBudget}` : t('cli.noLimit')}`);
    console.log(`  ${t('cli.monthlyBudget')}    ${config.monthlyBudget ? `$${config.monthlyBudget}` : t('cli.noLimit')}`);
    console.log(`  ${t('cli.currency')}         ${config.currency || 'USD'}`);
    if (exchange && exchange.currency !== 'USD') {
      const srcLabel = {
        api: t('exchange.src.api'), cache: t('exchange.src.cache'),
        'stale-cache': t('exchange.src.staleCache'), manual: t('exchange.src.manual'), base: ''
      };
      console.log(`  ${t('cli.exchangeRate')}      1 USD = ${exchange.rate.toLocaleString()} ${exchange.currency} (${srcLabel[exchange.source] || ''} ${exchange.updatedAt || ''})`);
    }
    if (config.exchangeRate) {
      console.log(`  ${t('cli.exchangeFixed')}    ${config.exchangeRate}`);
    }
    console.log(`  ${t('cli.nudge')}    ${config.showNudge ? t('cli.nudgeOn') : t('cli.nudgeOff')}`);
    console.log(`  ${t('cli.equivUnit')}    ${unitDisplay}`);
    if (config.customEquivalents?.length > 0) {
      console.log(`  ${t('cli.customUnits')}  ${config.customEquivalents.map(e => `${e.emoji} ${e.name}`).join(', ')}`);
    }
    console.log(`  ${t('cli.language')}        ${config.language || 'en'}`);
    console.log();
    if (config.logSources?.length > 0) {
      console.log(`  ${t('cli.logSources')}`);
      console.log(`     🟣 ${t('cli.claudeAuto')}`);
      for (const src of config.logSources) {
        const providerEmoji = { claude: '🟣', openai: '🟢', google: '🔵', cursor: '⚡' }[src.provider] || '⚪';
        if (src.path) {
          console.log(`     ${providerEmoji} ${src.provider}: ${src.path}`);
        } else {
          console.log(`     ${providerEmoji} ${src.provider} ${t('cli.apiPolling')}`);
        }
      }
    } else {
      console.log(`  ${t('cli.logSources')}    🟣 ${t('cli.claudeAuto')}`);
    }
    console.log();
    console.log(`  ${t('cli.availableUnits')} ${allItems.map(e => e.name).join(', ')}`);
    console.log(`  ${t('cli.supportedCurrencies')} ${SUPPORTED_CURRENCIES.join(', ')}`);
    console.log();
    showInfo(t('cli.configHint'));
    console.log();
    process.exit(0);
  }

  for (let i = 0; i < flags.length; ) {
    const key = flags[i];
    const value = flags[i + 1];

    switch (key) {
      case '--daily-budget':
      case '-d':
        updateConfig({ dailyBudget: value === 'off' ? null : parseFloat(value) });
        showConfigUpdate(t('cli.dailyBudget'), value === 'off' ? t('cli.noLimit') : `$${value}`);
        i += 2;
        break;
      case '--monthly-budget':
        updateConfig({ monthlyBudget: value === 'off' ? null : parseFloat(value) });
        showConfigUpdate(t('cli.monthlyBudget'), value === 'off' ? t('cli.noLimit') : `$${value}`);
        i += 2;
        break;
      case '--nudge':
        updateConfig({ showNudge: value !== 'off' });
        showConfigUpdate(t('cli.nudge'), value === 'off' ? t('cli.nudgeOff') : t('cli.nudgeOn'));
        i += 2;
        break;
      case '--unit':
        updateConfig({ equivalentUnit: value === 'auto' ? 'auto' : value });
        showConfigUpdate(t('cli.equivUnit'), value === 'auto' ? t('cli.autoUnit') : value);
        i += 2;
        break;
      case '--add-unit': {
        const parts = value.split(':');
        if ((parts.length !== 3 && parts.length !== 4) || isNaN(parseFloat(parts[1]))) {
          console.error(`  ${t('cli.unitFormatError')}`);
          process.exit(1);
        }
        const defaultUnit = t('display.defaultUnit') || '';
        const newItem = { name: parts[0], price: parseFloat(parts[1]), emoji: parts[2], unit: parts[3] || defaultUnit };
        const cfg = loadConfig();
        const customs = (cfg.customEquivalents || []).filter(e => e.name !== newItem.name);
        customs.push(newItem);
        updateConfig({ customEquivalents: customs });
        showConfigUpdate(t('cli.customUnits'), `${newItem.emoji} ${newItem.name} ($${newItem.price})`);
        i += 2;
        break;
      }
      case '--remove-unit': {
        const cfg2 = loadConfig();
        const filtered = (cfg2.customEquivalents || []).filter(e => e.name !== value);
        updateConfig({ customEquivalents: filtered });
        showConfigUpdate(t('cli.customUnits'), value);
        i += 2;
        break;
      }
      case '--currency': {
        const { SUPPORTED_CURRENCIES } = await import('../dist/exchange.js');
        const cur = value.toUpperCase();
        if (!SUPPORTED_CURRENCIES.includes(cur)) {
          console.error(`  ${t('cli.unknownCurrency', { currency: cur, supported: SUPPORTED_CURRENCIES.join(', ') })}`);
          process.exit(1);
        }
        updateConfig({ currency: cur });
        showConfigUpdate(t('cli.currency'), cur);
        i += 2;
        break;
      }
      case '--exchange-rate': {
        if (value === 'auto') {
          updateConfig({ exchangeRate: null });
          showConfigUpdate(t('cli.exchangeRate'), 'Auto (API)');
        } else {
          const rate = parseFloat(value);
          if (isNaN(rate) || rate <= 0) {
            console.error(`  ${t('cli.invalidRate')}`);
            process.exit(1);
          }
          updateConfig({ exchangeRate: rate });
          showConfigUpdate(t('cli.exchangeFixed'), `${rate}`);
        }
        i += 2;
        break;
      }
      case '--add-source': {
        const { getProviderNames, getProvider: gp } = await import('../dist/providers/index.js');
        const colonIdx = value.indexOf(':');

        if (colonIdx === -1) {
          const provider = gp(value);
          if (!provider) {
            console.error(`  ${t('cli.unknownProvider', { provider: value, supported: getProviderNames().join(', ') })}`);
            process.exit(1);
          }
          if (provider.isApiProvider) {
            if (!provider.isAvailable?.()) {
              console.error(`  ${t('cli.notInstalled', { provider: provider.displayName })}`);
              process.exit(1);
            }
            if (!provider.getSessionToken?.()) {
              console.error(`  ${t('cli.noToken', { provider: provider.displayName })}`);
              process.exit(1);
            }
            const cfg3 = loadConfig();
            const sources = (cfg3.logSources || []).filter(s => s.provider !== value);
            sources.push({ provider: value });
            updateConfig({ logSources: sources });
            showConfigUpdate(t('cli.logSources'), `${provider.emoji} ${provider.displayName} ${t('cli.apiPolling')}`);
          } else {
            console.error(`  ${t('cli.sourceFormatError')}`);
            console.error(`  ${t('cli.apiSourceHint')}`);
            console.error(`  ${t('cli.providerHint', { providers: getProviderNames().join(', ') })}`);
            process.exit(1);
          }
          i += 2;
          break;
        }

        const srcProvider = value.slice(0, colonIdx);
        const srcPath = value.slice(colonIdx + 1);
        if (!getProviderNames().includes(srcProvider)) {
          console.error(`  ${t('cli.unknownProvider', { provider: srcProvider, supported: getProviderNames().join(', ') })}`);
          process.exit(1);
        }
        const cfg3 = loadConfig();
        const sources = (cfg3.logSources || []).filter(s => !(s.provider === srcProvider && s.path === srcPath));
        sources.push({ provider: srcProvider, path: srcPath });
        updateConfig({ logSources: sources });
        showConfigUpdate(t('cli.logSources'), `${srcProvider}:${srcPath}`);
        i += 2;
        break;
      }
      case '--remove-source': {
        const cfg4 = loadConfig();
        const colonIdx2 = value.indexOf(':');
        let filtered2;
        if (colonIdx2 !== -1) {
          const rp = value.slice(0, colonIdx2);
          const rpath = value.slice(colonIdx2 + 1);
          filtered2 = (cfg4.logSources || []).filter(s => !(s.provider === rp && s.path === rpath));
        } else {
          filtered2 = (cfg4.logSources || []).filter(s => s.provider !== value);
        }
        updateConfig({ logSources: filtered2 });
        showConfigUpdate(t('cli.logSources'), value);
        i += 2;
        break;
      }
      case '--language': {
        const lang = value?.toLowerCase();
        if (lang !== 'en' && lang !== 'ko') {
          console.error(`  ${t('cli.unknownLang', { lang: value })}`);
          process.exit(1);
        }
        updateConfig({ language: lang });
        setLocale(lang);
        showConfigUpdate(t('cli.language'), lang);
        i += 2;
        break;
      }
      default:
        console.error(`  ${t('cli.unknownOption', { option: key })}`);
        process.exit(1);
    }
  }
} else if (command === 'report') {
  const { showWeeklyReport, showMonthlyReport } = await import('../dist/report.js');
  const { showBanner } = await import('../dist/display.js');

  showBanner();

  const isMonthly = args.includes('--monthly') || args.includes('-m');

  if (isMonthly) {
    await showMonthlyReport();
  } else {
    await showWeeklyReport();
  }
} else if (command === 'cli') {
  const { main } = await import('../dist/index.js');
  main().catch((err) => {
    console.error(`${t('cli.fatalError')} ${err.message}`);
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else {
  launchOverlay();
}

function showHelp() {
  console.log(`
  ${t('cli.title')}

  ${t('cli.usage')}
    cost-cry                            ${t('cli.cmdOverlay')}
    cost-cry cli                        ${t('cli.cmdCli')}
    cost-cry config                     ${t('cli.cmdConfig')}
    cost-cry config [options]           ${t('cli.cmdConfigEdit')}
    cost-cry report                     ${t('cli.cmdReport')}
    cost-cry report --monthly           ${t('cli.cmdReportMonthly')}

  ${t('cli.settingsTitle')}
    --daily-budget <amount>    Daily budget (USD). Off: --daily-budget off
    --monthly-budget <amount>  Monthly budget (USD). Off: --monthly-budget off
    --nudge <on|off>           Savings nudge
    --unit <name|auto>         Fixed equivalent unit. Auto: --unit auto
    --add-unit "name:price:emoji:unit"  Add custom equivalent unit
    --remove-unit <name>       Remove custom equivalent unit
    --currency <code>          Display currency (USD, KRW, JPY, EUR, GBP, CNY)
    --exchange-rate <num|auto> Fix exchange rate manually. Auto: --exchange-rate auto
    --add-source "provider:path"  Add log source (openai, google)
    --add-source cursor            Track Cursor IDE usage (API polling)
    --remove-source <provider>    Remove log source
    --language <en|ko>         Set language
  
  ${t('cli.examplesTitle')}
    cost-cry config --daily-budget 10
    cost-cry config --currency KRW
    cost-cry config --add-source cursor
    cost-cry config --language ko
  `);
}

async function launchOverlay() {
  const { spawn } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const require = createRequire(import.meta.url);

  let electronPath;
  try {
    electronPath = require('electron');
  } catch {
    console.error(t('cli.noElectron'));
    console.error(t('cli.installElectron'));
    process.exit(1);
  }

  const appPath = path.join(__dirname, '..', 'electron');

  try {
    const child = spawn(electronPath, [appPath], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    console.log(t('cli.widgetLaunched'));
    process.exit(0);
  } catch (err) {
    console.error(`${t('cli.electronFail')} ${err.message}`);
    process.exit(1);
  }
}

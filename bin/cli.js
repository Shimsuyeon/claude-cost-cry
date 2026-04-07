#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

if (command === 'config') {
  const { updateConfig, loadConfig } = await import('../src/config.js');
  const { showConfigUpdate, showInfo } = await import('../src/display.js');

  const flags = args.slice(1);

  const { getAllEquivalents } = await import('../src/calculator.js');

  if (flags.length === 0) {
    const config = loadConfig();
    const { getExchangeRate, SUPPORTED_CURRENCIES } = await import('../src/exchange.js');
    const allItems = getAllEquivalents(config);
    const unitDisplay = config.equivalentUnit === 'auto'
      ? '자동'
      : `${config.equivalentUnit}`;
    const exchange = await getExchangeRate(config);
    console.log();
    showInfo('현재 설정:');
    console.log(`  일일 예산:    ${config.dailyBudget ? `$${config.dailyBudget}` : '제한 없음'}`);
    console.log(`  월간 예산:    ${config.monthlyBudget ? `$${config.monthlyBudget}` : '제한 없음'}`);
    console.log(`  통화:         ${config.currency || 'USD'}`);
    if (exchange && exchange.currency !== 'USD') {
      const srcLabel = { api: '실시간', cache: '캐시', 'stale-cache': '오래된 캐시', manual: '수동', base: '' };
      console.log(`  💱 환율:      1 USD = ${exchange.rate.toLocaleString()} ${exchange.currency} (${srcLabel[exchange.source] || ''} ${exchange.updatedAt || ''})`);
    }
    if (config.exchangeRate) {
      console.log(`  환율 고정:    ${config.exchangeRate}`);
    }
    console.log(`  절약 넛지:    ${config.showNudge ? '켜짐' : '꺼짐'}`);
    console.log(`  환산 단위:    ${unitDisplay}`);
    if (config.customEquivalents?.length > 0) {
      console.log(`  커스텀 단위:  ${config.customEquivalents.map(e => `${e.emoji} ${e.name}`).join(', ')}`);
    }
    console.log();
    if (config.logSources?.length > 0) {
      console.log(`  로그 소스:`);
      console.log(`     🟣 Claude Code (자동 감지)`);
      for (const src of config.logSources) {
        const providerEmoji = { claude: '🟣', openai: '🟢', google: '🔵' }[src.provider] || '⚪';
        console.log(`     ${providerEmoji} ${src.provider}: ${src.path}`);
      }
    } else {
      console.log(`  로그 소스:    🟣 Claude Code (자동 감지)`);
    }
    console.log();
    console.log(`  사용 가능한 단위: ${allItems.map(e => e.name).join(', ')}`);
    console.log(`  지원 통화: ${SUPPORTED_CURRENCIES.join(', ')}`);
    console.log();
    showInfo('설정 변경: claude-cost-cry config --daily-budget 10');
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
        showConfigUpdate('일일 예산', value === 'off' ? '제한 없음' : `$${value}`);
        i += 2;
        break;
      case '--monthly-budget':
        updateConfig({ monthlyBudget: value === 'off' ? null : parseFloat(value) });
        showConfigUpdate('월간 예산', value === 'off' ? '제한 없음' : `$${value}`);
        i += 2;
        break;
      case '--nudge':
        updateConfig({ showNudge: value !== 'off' });
        showConfigUpdate('절약 넛지', value === 'off' ? '꺼짐' : '켜짐');
        i += 2;
        break;
      case '--unit':
        updateConfig({ equivalentUnit: value === 'auto' ? 'auto' : value });
        showConfigUpdate('환산 단위', value === 'auto' ? '자동' : value);
        i += 2;
        break;
      case '--add-unit': {
        // format: "이름:가격:이모지" 또는 "이름:가격:이모지:단위"
        const parts = value.split(':');
        if ((parts.length !== 3 && parts.length !== 4) || isNaN(parseFloat(parts[1]))) {
          console.error('  ❌ 형식: --add-unit "이름:가격:이모지:단위"  예: "떡볶이:3.5:🍜:그릇"');
          process.exit(1);
        }
        const newItem = { name: parts[0], price: parseFloat(parts[1]), emoji: parts[2], unit: parts[3] || '개' };
        const cfg = loadConfig();
        const customs = (cfg.customEquivalents || []).filter(e => e.name !== newItem.name);
        customs.push(newItem);
        updateConfig({ customEquivalents: customs });
        showConfigUpdate('커스텀 단위 추가', `${newItem.emoji} ${newItem.name} ($${newItem.price})`);
        i += 2;
        break;
      }
      case '--remove-unit': {
        const cfg2 = loadConfig();
        const filtered = (cfg2.customEquivalents || []).filter(e => e.name !== value);
        updateConfig({ customEquivalents: filtered });
        showConfigUpdate('커스텀 단위 삭제', value);
        i += 2;
        break;
      }
      case '--currency': {
        const { SUPPORTED_CURRENCIES } = await import('../src/exchange.js');
        const cur = value.toUpperCase();
        if (!SUPPORTED_CURRENCIES.includes(cur)) {
          console.error(`  ❌ 지원하지 않는 통화: ${cur}. 지원: ${SUPPORTED_CURRENCIES.join(', ')}`);
          process.exit(1);
        }
        updateConfig({ currency: cur });
        showConfigUpdate('통화', cur);
        i += 2;
        break;
      }
      case '--exchange-rate': {
        if (value === 'auto') {
          updateConfig({ exchangeRate: null });
          showConfigUpdate('환율', '자동 (API)');
        } else {
          const rate = parseFloat(value);
          if (isNaN(rate) || rate <= 0) {
            console.error('  ❌ 유효한 환율을 입력하세요. 예: --exchange-rate 1350');
            process.exit(1);
          }
          updateConfig({ exchangeRate: rate });
          showConfigUpdate('환율 고정', `${rate}`);
        }
        i += 2;
        break;
      }
      case '--add-source': {
        // format: "provider:path"  예: "openai:/path/to/logs"
        const { getProviderNames } = await import('../src/providers/index.js');
        const colonIdx = value.indexOf(':');
        if (colonIdx === -1) {
          console.error(`  ❌ 형식: --add-source "프로바이더:경로"  예: "openai:/path/to/logs"`);
          console.error(`     지원 프로바이더: ${getProviderNames().join(', ')}`);
          process.exit(1);
        }
        const srcProvider = value.slice(0, colonIdx);
        const srcPath = value.slice(colonIdx + 1);
        if (!getProviderNames().includes(srcProvider)) {
          console.error(`  ❌ 알 수 없는 프로바이더: ${srcProvider}. 지원: ${getProviderNames().join(', ')}`);
          process.exit(1);
        }
        const cfg3 = loadConfig();
        const sources = (cfg3.logSources || []).filter(s => !(s.provider === srcProvider && s.path === srcPath));
        sources.push({ provider: srcProvider, path: srcPath });
        updateConfig({ logSources: sources });
        showConfigUpdate('로그 소스 추가', `${srcProvider}:${srcPath}`);
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
        showConfigUpdate('로그 소스 삭제', value);
        i += 2;
        break;
      }
      default:
        console.error(`  ❌ 알 수 없는 옵션: ${key}`);
        process.exit(1);
    }
  }
} else if (command === 'report') {
  const { showWeeklyReport, showMonthlyReport } = await import('../src/report.js');
  const { showBanner } = await import('../src/display.js');

  showBanner();

  const isMonthly = args.includes('--monthly') || args.includes('-m');

  if (isMonthly) {
    await showMonthlyReport();
  } else {
    await showWeeklyReport();
  }
} else if (args.includes('--overlay') || args.includes('-o')) {
  const { execFile } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const require = createRequire(import.meta.url);

  let electronPath;
  try {
    electronPath = require('electron');
  } catch {
    console.error('❌ Electron이 설치되어 있지 않습니다.');
    console.error('   npm install electron 후 다시 시도해주세요.');
    process.exit(1);
  }

  const appPath = path.join(__dirname, '..', 'electron');
  const child = execFile(electronPath, [appPath], { stdio: 'inherit' });

  child.on('close', (code) => process.exit(code || 0));
  child.on('error', (err) => {
    console.error('❌ Electron 실행 실패:', err.message);
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  🪙 claude-cost-cry — 당신의 API 비용을 감정적으로 체감시켜주는 도구

  사용법:
    claude-cost-cry                     CLI 모드 (터미널에서 실시간 추적)
    claude-cost-cry --overlay           오버레이 모드 (화면 위 플로팅 위젯)
    claude-cost-cry config              현재 설정 보기
    claude-cost-cry config [옵션]       설정 변경
    claude-cost-cry report              주간 리포트
    claude-cost-cry report --monthly    월간 리포트

  설정 옵션:
    --daily-budget <금액>      일일 예산 설정 (USD). 해제: --daily-budget off
    --monthly-budget <금액>    월간 예산 설정 (USD). 해제: --monthly-budget off
    --nudge <on|off>           모델 절약 넛지 표시 여부
    --unit <이름|auto>         환산 단위 고정 (예: 치킨). 자동: --unit auto
    --add-unit "이름:가격:이모지:단위"  커스텀 환산 단위 추가
    --remove-unit <이름>       커스텀 환산 단위 삭제
    --currency <코드>          표시 통화 (USD, KRW, JPY, EUR, GBP, CNY)
    --exchange-rate <숫자|auto> 환율 수동 고정. 자동: --exchange-rate auto
    --add-source "프로바이더:경로"  로그 소스 추가 (openai, google)
    --remove-source <프로바이더>    로그 소스 삭제
  
  예시:
    claude-cost-cry config --daily-budget 10
    claude-cost-cry config --unit 치킨
    claude-cost-cry config --currency KRW
    claude-cost-cry config --add-source "openai:/path/to/api-logs"
  `);
} else {
  const { main } = await import('../src/index.js');
  main().catch((err) => {
    console.error('치명적 오류:', err.message);
    process.exit(1);
  });
}

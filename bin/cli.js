#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

if (command === 'config') {
  const { updateConfig, loadConfig } = await import('../src/config.js');
  const { showConfigUpdate, showInfo } = await import('../src/display.js');

  const flags = args.slice(1);

  if (flags.length === 0) {
    const config = loadConfig();
    console.log();
    showInfo('현재 설정:');
    console.log(`  일일 예산:    ${config.dailyBudget ? `$${config.dailyBudget}` : '제한 없음'}`);
    console.log(`  월간 예산:    ${config.monthlyBudget ? `$${config.monthlyBudget}` : '제한 없음'}`);
    console.log(`  절약 넛지:    ${config.showNudge ? '켜짐' : '꺼짐'}`);
    console.log();
    showInfo('설정 변경: claude-cost-cry config --daily-budget 10');
    console.log();
    process.exit(0);
  }

  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i];
    const value = flags[i + 1];

    switch (key) {
      case '--daily-budget':
      case '-d':
        updateConfig({ dailyBudget: value === 'off' ? null : parseFloat(value) });
        showConfigUpdate('일일 예산', value === 'off' ? '제한 없음' : `$${value}`);
        break;
      case '--monthly-budget':
      case '-m':
        updateConfig({ monthlyBudget: value === 'off' ? null : parseFloat(value) });
        showConfigUpdate('월간 예산', value === 'off' ? '제한 없음' : `$${value}`);
        break;
      case '--nudge':
        updateConfig({ showNudge: value !== 'off' });
        showConfigUpdate('절약 넛지', value === 'off' ? '꺼짐' : '켜짐');
        break;
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
    --daily-budget <금액>    일일 예산 설정 (USD). 해제: --daily-budget off
    --monthly-budget <금액>  월간 예산 설정 (USD). 해제: --monthly-budget off
    --nudge <on|off>         모델 절약 넛지 표시 여부
  
  예시:
    claude-cost-cry config --daily-budget 10
    claude-cost-cry config --daily-budget off
    claude-cost-cry config --nudge off
  `);
} else {
  const { main } = await import('../src/index.js');
  main().catch((err) => {
    console.error('치명적 오류:', err.message);
    process.exit(1);
  });
}

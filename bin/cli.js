#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--overlay') || args.includes('-o')) {
  // Electron 오버레이 모드
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
    claude-cost-cry              CLI 모드 (터미널에서 실시간 추적)
    claude-cost-cry --overlay    오버레이 모드 (화면 위 플로팅 위젯)
    claude-cost-cry --help       도움말 표시
  `);
} else {
  // CLI 모드 (기본)
  const { main } = await import('../src/index.js');
  main().catch((err) => {
    console.error('치명적 오류:', err.message);
    process.exit(1);
  });
}

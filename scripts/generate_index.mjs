#!/usr/bin/env node
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function getTaipeiDate() {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600000);
  return taipei.toISOString().slice(0, 10);
}

function generateIndex() {
  const docsDir = resolve('docs');
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

  const files = readdirSync(docsDir)
    .filter(f => f.startsWith('cannabis-') && f.endsWith('.html'))
    .sort()
    .reverse();

  const links = files.slice(0, 60).map(f => {
    const date = f.replace('cannabis-', '').replace('.html', '');
    let dateDisplay = date;
    let weekday = '';
    try {
      const d = new Date(date + 'T00:00:00Z');
      dateDisplay = `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
      weekday = WEEKDAYS[d.getUTCDay()];
    } catch {}
    return `    <li><a href="${f}">📅 ${dateDisplay}（週${weekday}）</a></li>`;
  }).join('\n');

  const today = getTaipeiDate();
  const total = files.length;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Cannabis Research Daily · 大麻成癮研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-section { margin-top: 48px; display: flex; flex-direction: column; gap: 10px; }
  .link-card { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; text-decoration: none; color: var(--text); transition: all 0.2s; }
  .link-card:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .link-icon { font-size: 22px; flex-shrink: 0; }
  .link-name { font-size: 14px; font-weight: 600; flex: 1; }
  .link-arrow { font-size: 16px; color: var(--accent); font-weight: 700; }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🌿</div>
  <h1>Cannabis Research Daily</h1>
  <p class="subtitle">大麻成癮研究文獻日報 · 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>
${links}
  </ul>

  <div class="links-section">
    <a href="https://www.leepsyclinic.com/" class="link-card" target="_blank" rel="noopener">
      <span class="link-icon">🏥</span>
      <span class="link-name">李政洋身心診所首頁</span>
      <span class="link-arrow">→</span>
    </a>
    <a href="https://blog.leepsyclinic.com/" class="link-card" target="_blank" rel="noopener">
      <span class="link-icon">📬</span>
      <span class="link-name">訂閱電子報</span>
      <span class="link-arrow">→</span>
    </a>
    <a href="https://buymeacoffee.com/CYlee" class="link-card" target="_blank" rel="noopener">
      <span class="link-icon">☕</span>
      <span class="link-name">Buy Me a Coffee</span>
      <span class="link-arrow">→</span>
    </a>
  </div>

  <footer>
    <p>Powered by PubMed + Zhipu AI · <a href="https://github.com/u8901006/marijuna-addiction">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

  writeFileSync(resolve('docs/index.html'), html, 'utf-8');
  console.error(`[INFO] Index page generated (${total} reports)`);
}

generateIndex();

#!/usr/bin/env node
/**
 * 从 CHANGELOG.md 取某个版本的小节作为 GitHub Release 正文。
 * **自包含**（零依赖），因为它被 vendored 到各插件仓库的 .github/ 下由 CI 执行。
 *
 * 支持三个仓库里真实存在的写法：
 *   ## 未发布           +  ## 1.3.0 — 2026-10-10      (dsh-later)
 *   ## [Unreleased]     +  ## [0.5.0] - 2026-10-10    (dsh-suggest-ghost)
 *   ## 未发布           +  ## 0.2.0-rc.2-fork1        (dsh-group-status，无日期)
 *
 * 用法：node .github/extract-notes.mjs <version> [--intro] [--strict]
 *   --intro   正文前加包描述 + 安装命令（现有 Release 都是这个形状）
 *   --strict  找不到该版本小节就以退出码 2 失败
 *             默认不失败，而是写一条可见的占位说明，避免 CI 因文档缺节变红
 */
import fs from 'node:fs';

const [rawVer, ...flags] = process.argv.slice(2);
const ver = String(rawVer || '').replace(/^v/, '');
if (!ver) {
  console.error('用法：extract-notes.mjs <version> [--intro] [--strict]');
  process.exit(2);
}

/** 节 = 一行 `## xxx` 到下一条 `## xxx`。`###` 是节内小节，不能当边界。 */
function sections(md) {
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const h = /^##[ \t]+(?!#)(.*)$/.exec(l);
    if (h) heads.push({ title: h[1], start: i + 1 });
  });
  return heads.map((hd, k) => ({
    title: hd.title,
    body: lines.slice(hd.start, k + 1 < heads.length ? heads[k + 1].start - 1 : lines.length).join('\n'),
  }));
}

/**
 * 取标题开头的版本 token，剥掉可能的外层方括号：
 *   `1.3.0 — 2026-10-10` → 1.3.0     `[0.5.0] - 2026-10-10` → 0.5.0
 *   `0.2.0-rc.2-fork1` → 原样保留（所以裸 0.2.0 不会误命中它）
 */
function versionOf(title) {
  const m = /^\s*\[?\s*([^\s\]—–]+)/.exec(title);
  return m ? m[1] : null;
}

let body = null;
let pkg = null;
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch {
  /* 没有 package.json 就不加 intro */
}

try {
  const hit = sections(fs.readFileSync('CHANGELOG.md', 'utf8')).find((s) => versionOf(s.title) === ver);
  body = hit ? hit.body.replace(/\s+$/, '') : null;
} catch {
  body = null;
}

if (body === null) {
  if (flags.includes('--strict')) {
    console.error(`CHANGELOG 里没有 ${ver} 小节 —— 发版要先跑：rel.mjs rename ${ver}`);
    process.exit(2);
  }
  body = `_(CHANGELOG 未记录 ${ver} 小节：请把「未发布」改名为本版本节后重建这条 Release)_`;
}

if (flags.includes('--intro') && pkg) {
  body =
    `${pkg.description ?? ''}\n\n` +
    `## 安装\n\n\`\`\`sh\ndsh plugin --profile web add ${pkg.name}\n# 重启 dsh web 后生效\n\`\`\`\n\n` +
    `预构建产物随包发布，npm 安装无需本地构建。\n\n` +
    `## 本版本变更\n\n${body}`;
}

process.stdout.write(body.trimEnd() + '\n');

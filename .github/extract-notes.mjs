#!/usr/bin/env node
/**
 * 生成 GitHub Release 正文，**对齐 dsh-later 的写法**。骨架不是想象出来的，是从
 * dsh-later v1.2.0 / v1.3.0 / v1.4.0 三条已发布 Release 里提出来的：
 *
 *   <package.json 的 description>
 *   ## 安装                     dsh plugin --profile web add <name> + 重启提示
 *   预构建产物随包发布，npm 安装无需本地构建或构建授权。
 *   ## 功能                     跨版本累积的全量能力清单
 *   ## 本版本变更               ### feat / ### fix / ### refactor / …
 *   ## 说明                     License / 仓库 / 完整更新日志 三条
 *
 * 三条来自实测的规则：
 *
 * 1. 「## 功能」优先取**上一条 Release 的同名小节** —— later 的清单就是这样单调累积的
 *    （1.3.0 十条 → 1.4.0 十一条，一条没删），取不到才退回 README 的特性小节。
 *    注意排除"本次这个版本自己"，否则重跑同一条 Release 会把自己的正文当历史累积。
 * 2. 「## 本版本变更」的条数是**取舍**，不由脚本替你决定。约定：在版本小节里写
 *    `### 发布摘要` 子节，脚本只用它、且不改写文字；没有该子节时全量收录并打告警。
 *    参照：later 的 Release 是 3~7 条 / 2.2~2.5k 字，而其 CHANGELOG 条目本身是带嵌套
 *    子条目的长论证 —— 说明 Release 是人工压过的。脚本按 `：` 或首句机械压缩会**压坏
 *    句子**（实测把 `声明 \`pulse: true\`` 从代码段中间切开），所以这里不做任何改写。
 * 3. 版本小节缺失时不许静默出空正文：默认打一条显式警告进正文，`--strict` 直接失败。
 *
 * 支持的 CHANGELOG 约定（三个仓库各一种）：
 *   ## 未发布           +  ## 1.3.0 — 2026-10-10      (dsh-later)
 *   ## [Unreleased]     +  ## [0.5.0] - 2026-10-10    (dsh-suggest-ghost)
 *   ## 未发布           +  ## 0.2.0-rc.2-fork1        (dsh-group-status，无日期)
 *
 * 用法：node .github/extract-notes.mjs <version> [--strict]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FEATURE_HEADINGS = ['## 功能', '## 特性一览', '## Features'];
/** 分组顺序照 later：feat / fix 在前，表外的类型排最后并按名字排序。 */
const TYPE_ORDER = ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'build', 'ci', 'style'];

const [rawVer, ...flags] = process.argv.slice(2);
const ver = String(rawVer || '').replace(/^v/, '');
if (!ver) {
  console.error('用法：extract-notes.mjs <version> [--strict]');
  process.exit(2);
}

/* ─────────── CHANGELOG 解析 ─────────── */

/** 节 = 一行 `## xxx` 到下一条 `## xxx`。`###` 是节内小节，不能当节边界。 */
function sections(md) {
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const h = /^##[ \t]+(?!#)(.*)$/.exec(l);
    if (h) heads.push({ title: h[1], start: i + 1 });
  });
  return heads.map((hd, k) => ({
    title: hd.title,
    lines: lines.slice(hd.start, k + 1 < heads.length ? heads[k + 1].start - 1 : lines.length),
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

/** 把一段行切成顶层条目（`- …` 连带其后缩进续行；`###` 与空行不切断条目）。 */
function items(lines) {
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (/^- /.test(l)) {
      if (cur) out.push(cur.join('\n'));
      cur = [l];
    } else if (cur && (/^\s+\S/.test(l) || l.trim() === '')) {
      cur.push(l);
    } else if (cur) {
      out.push(cur.join('\n'));
      cur = null;
    }
  }
  if (cur) out.push(cur.join('\n'));
  return out.map((t) => t.replace(/\s+$/, ''));
}

const typeOf = (item) => {
  const m = /^-\s+\*\*([a-zA-Z]+)\*\*/.exec(item);
  return m ? m[1].toLowerCase() : 'other';
};

/** 只去掉 `- **feat** ` 这个类型前缀，其余文字一字不改。 */
const stripType = (item) => item.replace(/^-\s+\*\*[a-zA-Z]+\*\*\s*/, '- ');

/* ─────────── 素材 ─────────── */

let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch { /* 没有 package.json 就少几行固定文案 */ }

let sectionLines = null;
try {
  const hit = sections(fs.readFileSync('CHANGELOG.md', 'utf8')).find((s) => versionOf(s.title) === ver);
  sectionLines = hit ? hit.lines : null;
} catch {
  sectionLines = null;
}

let missingSection = false;
if (sectionLines === null) {
  if (flags.includes('--strict')) {
    console.error(`CHANGELOG 里没有 ${ver} 小节 —— 发版要先跑：rel.mjs rename ${ver}`);
    process.exit(2);
  }
  // 占位文字**不能**塞进 sectionLines：下面按 `^- ` 取条目会把它过滤掉，正文就只剩
  // 「本版无条目」—— 最该喊的地方反而不喊。单独记一个标记。
  missingSection = true;
  sectionLines = [];
}

/** 上一条 Release 的「## 功能」小节（排除本次自己，避免自我吞并）。 */
function previousReleaseFeatures(currentVersion) {
  const gh = (args) =>
    execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 });
  try {
    const list = JSON.parse(gh(['release', 'list', '--limit', '10', '--json', 'tagName']));
    const prev = list.map((r) => String(r.tagName ?? '').replace(/^v/, '')).find((t) => t && t !== currentVersion);
    if (!prev) return [];
    const body = gh(['release', 'view', 'v' + prev, '--json', 'body', '--jq', '.body']);
    const lines = body.split('\n');
    const start = lines.findIndex((l) => /^##\s+功能\s*$/.test(l.trim()));
    if (start < 0) return [];
    const res = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) break;
      if (/^- /.test(lines[i])) res.push(lines[i]);
    }
    return res;
  } catch {
    return []; // 无 gh / 离线 / 无历史 Release：调用方退回 README
  }
}

/** README 的特性小节（上一条 Release 取不到时兜底）。 */
function readmeFeatures() {
  for (const f of ['README.md', 'README.en.md']) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    const start = lines.findIndex((l) => FEATURE_HEADINGS.some((h) => l.trim().startsWith(h)));
    if (start < 0) continue;
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) break;
      if (/^- /.test(lines[i])) out.push(lines[i]);
    }
    if (out.length) return out;
  }
  return [];
}

/* ─────────── 本版本变更的取材 ─────────── */

let changeItems = items(sectionLines).filter((t) => /^-\s/.test(t));

// `### 发布摘要` 子节是给人做的取舍：有就只用它，且不改写一个字。
const summaryIdx = sectionLines.findIndex((l) => /^###\s+发布摘要\s*$/.test(l));
if (summaryIdx >= 0) {
  const block = [];
  for (let i = summaryIdx + 1; i < sectionLines.length; i++) {
    if (/^#{2,4}\s/.test(sectionLines[i])) break;
    block.push(sectionLines[i]);
  }
  const picked = items(block).filter((t) => /^-\s/.test(t));
  if (picked.length) {
    changeItems = picked;
    process.stderr.write(`· 「## 本版本变更」取自「### 发布摘要」子节：${picked.length} 条（未改写文字）。\n`);
  }
} else if (changeItems.length > 10) {
  process.stderr.write(
    `⚠ 没有「### 发布摘要」子节，Release 将收录全部 ${changeItems.length} 条 CHANGELOG 条目。\n` +
      `  同组织参照：later 的 Release 是 3~7 条 / 2.2~2.5k 字。要压到那个密度，请在本版本小节\n` +
      `  里加「### 发布摘要」并写入选要的条目 —— 脚本不替你删，也不改写句子（机械压缩实测会\n` +
      '  把「声明 pulse: true」这类写法从代码段中间切开）。\n',
  );
}

const groups = new Map();
for (const it of changeItems) {
  const k = typeOf(it);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(stripType(it));
}
const orderedTypes = [
  ...TYPE_ORDER.filter((t) => groups.has(t)),
  ...[...groups.keys()].filter((t) => !TYPE_ORDER.includes(t)).sort(),
];

/* ─────────── 功能清单 ─────────── */

const fromPrev = previousReleaseFeatures(ver);
const featureLines = fromPrev.length ? fromPrev : readmeFeatures();
const featureSource = fromPrev.length ? '上一条 Release' : 'README 特性小节';
const feats = items(sectionLines).filter((t) => /^-\s+\*\*feat\*\*/.test(t));
if (feats.length) {
  process.stderr.write(
    `· 「## 功能」来源=${featureSource}，共 ${featureLines.length} 条。本版有 ${feats.length} 条 feat\n` +
      `  尚未出现在功能清单里 —— 请把**面向使用者的说法**（不是 CHANGELOG 原句）并进 README 的\n` +
      `  特性小节或上一条 Release，否则功能清单会一直落后。\n`,
  );
}

/* ─────────── 组装 ─────────── */

const repoUrl = (() => {
  const u = pkg.homepage || pkg.repository?.url || '';
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(u);
  return m ? `https://github.com/${m[1]}/${m[2]}` : u;
})();

const block = [];
if (pkg.description) block.push(pkg.description, '');
block.push(
  '## 安装',
  '',
  '```sh',
  `dsh plugin --profile web add ${pkg.name ?? '<pkg>'}`,
  '# 重启 dsh web 后生效',
  '```',
  '',
  '预构建产物随包发布，npm 安装无需本地构建或构建授权。',
  '',
  '## 功能',
  '',
  featureLines.length ? featureLines.join('\n') : '- _(README 特性小节与上一条 Release 都取不到：请补功能清单后重跑)_',
  '',
  '## 本版本变更',
  '',
);

if (missingSection) {
  block.push(
    `> ⚠️ **CHANGELOG 里没有 ${ver} 这一小节。** 正文因此不完整：把「未发布」小节改名为 ${ver}` +
      '（跑 release-infra/bin/rel.mjs rename ' + ver + '）后重跑本脚本并更新这条 Release。',
    '',
  );
}
for (const t of orderedTypes) block.push(`### ${t}`, '', ...groups.get(t), '');
if (!orderedTypes.length && !missingSection) block.push('_(本版无条目)_', '');

block.push('## 说明', '', `- License: ${pkg.license ?? '—'}`);
if (repoUrl) block.push(`- 仓库：${repoUrl}`, `- 完整更新日志：${repoUrl}/blob/main/CHANGELOG.md`);

process.stdout.write(block.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');

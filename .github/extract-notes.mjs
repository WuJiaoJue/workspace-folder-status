#!/usr/bin/env node
/**
 * 生成 GitHub Release 正文，**对齐 dsh-later 的写法**。骨架不是想象出来的，是从
 * dsh-later v1.3.0 / v1.4.0 两条已发布 Release 里提出来的：
 *
 *   <package.json 的 description>            ← 一句话
 *   ## 安装                                  ← dsh plugin --profile web add <name> + 重启提示
 *   预构建产物随包发布，npm 安装无需本地构建或构建授权。
 *   ## 功能                                  ← 累积的全量能力清单
 *   ## 本版本变更
 *   ### feat / ### fix / ### refactor / …    ← 按 CHANGELOG 条目的 `**类型**` 前缀分组
 *   ## 说明                                  ← License / 仓库 / 完整更新日志 三条
 *
 * 关于「## 功能」的取舍（重要）：later 的功能清单是**随版本累积**的 —— 1.3.0 到 1.4.0
 * 只多了 `分组状态 facet`，一条都没删；而那条的文案与其 CHANGELOG 的 feat 条目几乎同句，
 * 说明它是人从本版 feat 搬上去的。本脚本如实复刻这个动作：
 *   README 的 `## 功能 / ## 特性一览 / ## Features` 小节 + 本版 CHANGELOG 的 feat 条目。
 * 它不替你改写措辞，也不发明能力；搬进去后请把清单并回 README，下次就不必重复追加
 * （脚本会往 stderr 打一条提醒，CI 里转成 ::notice）。
 *
 * 支持三个仓库真实存在的 CHANGELOG 约定：
 *   ## 未发布           +  ## 1.3.0 — 2026-10-10      (dsh-later)
 *   ## [Unreleased]     +  ## [0.5.0] - 2026-10-10    (dsh-suggest-ghost)
 *   ## 未发布           +  ## 0.2.0-rc.2-fork1        (dsh-group-status，无日期)
 *
 * 用法：node .github/extract-notes.mjs <version> [--strict]
 *   --strict  找不到该版本小节就以退出码 2 失败（默认降级为可见占位，不让 CI 变红）
 */
import fs from 'node:fs';
import { execFileSync as $childExec } from 'node:child_process';
const require$child = () => ({ execFileSync: $childExec });

const UNRELEASED_RE = /^##[ \t]+\[?(未发布|Unreleased|unreleased)\]?[ \t]*$/;
const FEATURE_HEADINGS = ['## 功能', '## 特性一览', '## Features'];
/** 分组顺序照 later：feat / fix 在前，其余按此表补，表外的类型排最后并按名字排序。 */
const TYPE_ORDER = ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'build', 'ci', 'style'];

const [rawVer, ...flags] = process.argv.slice(2);
const ver = String(rawVer || '').replace(/^v/, '');
if (!ver) {
  console.error('用法：extract-notes.mjs <version> [--strict]');
  process.exit(2);
}

/* ─────────── CHANGELOG 解析 ─────────── */

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

/** 把一节切成顶层条目（`- **type** 正文`，连带其后的缩进续行）。 */
function items(sectionLines) {
  const out = [];
  let cur = null;
  for (const l of sectionLines) {
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

/** 去掉 `- **feat** ` 前缀，其余文字一字不改。 */
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
  // 占位文字**不能**塞进 sectionLines：下面按 `^- ` 取条目会把它过滤掉，
  // 于是正文只剩「本版无条目」，最该喊的地方反而不喊了。单独记一个标记。
  missingSection = true;
  sectionLines = [];
}

/**
 * 「## 功能」的第一来源：**上一条 Release 正文里的同一小节**。
 * later 的清单就是这样累积的（1.3.0 的 10 条 → 1.4.0 加 1 条 = 11 条），照抄才能保持
 * 单调增长而不是每次退回 README 的那几条。取不到（首次发布 / 无 gh / 离线）就用 README。
 */
function previousReleaseFeatures(currentVersion) {
  try {
    const { execFileSync } = require$child();
    // 必须显式挑「不是本次这个版本」的那条：`gh release view` 不带参数取的是 latest，
    // 而重新生成同一条 Release 时 latest 就是它自己 —— 不排掉就会把自己的正文当历史累积。
    const list = execFileSync('gh', ['release', 'list', '--limit', '10', '--json', 'tagName'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const prev = JSON.parse(list)
      .map((r) => String(r.tagName ?? '').replace(/^v/, ''))
      .find((t) => t && t !== currentVersion);
    if (!prev) return [];
    const out = execFileSync('gh', ['release', 'view', 'v' + prev, '--json', 'body', '--jq', '.body'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = out.split('\n');
    const start = lines.findIndex((l) => /^## 功能\s*$/.test(l.trim()));
    if (start < 0) return [];
    const res = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) break;
      if (/^- /.test(lines[i])) res.push(lines[i]);
    }
    return res;
  } catch {
    return [];
  }
}

/** README 的特性小节，返回条目原文（上一条 Release 取不到时的兜底）。 */
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

/* ─────────── 组装 ─────────── */

const changeItems = items(sectionLines).filter((t) => /^-\s/.test(t));
const feats = changeItems.filter((t) => typeOf(t) === 'feat');

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

const repoUrl = (() => {
  const u = pkg.homepage || pkg.repository?.url || '';
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(u);
  return m ? `https://github.com/${m[1]}/${m[2]}` : u;
})();

// 「## 功能」= 上一条 Release 的同一小节（保持 later 那种单调累积），取不到则退回 README。
// **不自动追加本版 feat**：CHANGELOG 的 feat 条目是历史录制，措辞会随后续提交过时
// （实测：本版 feat 里写着「恒胜过渡适配器」，而那个适配器已在同一次发布前被删除）。
// 把能力并进 README 的特性小节是人的动作，脚本只负责把该做的事打出来。
const fromPrev = previousReleaseFeatures(ver);
const featureLines = fromPrev.length ? fromPrev : readmeFeatures();
const featureSource = fromPrev.length ? '上一条 Release' : 'README 特性小节';
if (feats.length) {
  const pending = feats.map((f) => `      ${stripType(f).slice(0, 90)}`).join('\n');
  process.stderr.write(
    `· 「## 功能」来源=${featureSource}，共 ${featureLines.length} 条。\n` +
      `· 本版有 ${feats.length} 条 feat 尚未出现在功能清单里 —— 请把**面向使用者的说法**（不是\n` +
      `  CHANGELOG 的原句）并进 README 的特性小节或上一条 Release，否则功能清单会一直落后：\n${pending}\n`,
  );
}

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
  featureLines.length ? featureLines.join('\n') : '- _(README 特性小节与上一条 Release 都取不到：请把功能清单补进 README 后重跑)_',
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

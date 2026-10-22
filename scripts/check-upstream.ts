#!/usr/bin/env tsx
/**
 * 宿主契约漂移检查：宿主（`@deepseek-ai/dsh-client-ui-workspace`）换代之后，我们依赖的
 * 那几个**契约点**还对不对？
 *
 * ## 这个脚本之前长什么样，以及它为什么坏掉了
 *
 * 老版本比的是"vendored 上游源码目录"与"npm 上最新发布版"的哈希。它坏在两处，而且
 * **两处都让它从来没有真正工作过**：
 *
 * 1. 本地那份 pristine 副本在 `src/vendor/`，而**那个目录早就不存在了** —— vendored 的
 *    上游源码直接摊在 `src/` 下（`src/client/tree.ts`、`src/client/rows/*` 就是 fork 本体，
 *    见 `docs/upgrading.md`「基线从哪来」）。于是 `hashDirectory('src/vendor/src')` 直接
 *    `ENOENT` 崩掉，脚本**一跑就抛异常**，退出码 2。
 * 2. 上游发布包里**根本没有 `src/`**（只有 `lib/` 与 `lib/types/`），所以就算本地目录
 *    还在，比的也是空目录。
 *
 * 而 `docs/upgrading.md` 还让人照着它 rebase —— 一条指着一个不存在目录的命令，比没有
 * 更糟：它让人以为"没红就是没漂移"。
 *
 * ## 所以这个脚本改成比什么
 *
 * 比**契约点**，不比文件哈希。我们 fork 的是宿主 workspace 投影（为了在分组聚合里加
 * facet 贡献），而那份 fork 里**真正会静默坏掉**的地方只有一处：`pendingInteraction.kind`。
 *
 * - 它是**开放集合**：`SessionPendingInteractionMap` 靠声明合并扩展，任何宿主包都能贡献
 *   自己的 kind。宿主当前的 `visiblePendingKind` 认三个（`approval` / `plan-review` /
 *   `question`），并把没认出来的 kind **悄悄丢掉**。
 * - 宿主新增一种 kind 时，**宿主侧栏和我们的徽标会一起不显示它**（两边口径一致，所以不是
 *   我们的错），但我们要**知道**这件事，好跟上：跟上了，两边一起显示；没跟上，两边一起
 *   不显示——而用户只会觉得"这俩对不上"。
 * - 反过来**不要自己多认**：那会让徽标与宿主侧栏变成两套事实。
 *
 * 另外两个契约点（`completionUnread` → 「已完成」绿点、`pendingInteraction` → 「待审批」
 * 黄点）若被宿主改名，我们的 fork 会**静默地**再也不画那一类状态，同样不报错。
 *
 * 离线那道同样的检查已经进了 `npm test`（`tests/host-pending-kinds.node.test.mjs`），
 * 所以 CI 会拦；这个脚本是给人看的版本，额外多一条能力：**查 npm 上最新的已发布版**，
 * 用来在升级宿主之前先知道"下一代会不会动契约"。
 *
 * ## 用法
 *
 * ```bash
 * pnpm check-upstream            # 比对锁定版本（离线，读 node_modules）
 * pnpm check-upstream --latest   # 比对 npm 上最新的已发布版（需要网络）
 * pnpm check-upstream --json     # 机器可读
 * ```
 *
 * ## 退出码
 *
 * - `0` — 契约一致
 * - `1` — 契约漂移（宿主认的 kind 与我们不一致，或它把我们要读的事实改名了）
 * - `2` — 出错（网络、npm、文件缺失）
 *
 * @module
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PENDING_INTERACTION_KINDS } from '../src/client/tree.ts'
import { compareHostContract, readHostContract, type HostContract } from '../src/host-contract.ts'

const HOST_PACKAGE = '@deepseek-ai/dsh-client-ui-workspace'

/** 读一份宿主 bundle，抽出契约点。 */
function readContract(bundle: string, source: string): HostContract {
  return readHostContract(readFileSync(bundle, 'utf8'))
}

/** 锁定版本（devDependency，与仓库其它宿主包同版本）的契约。 */
function lockedContract(): { contract: HostContract; source: string } {
  const require = createRequire(import.meta.url)
  return {
    contract: readContract(require.resolve(`${HOST_PACKAGE}/client`)),
    source: `${HOST_PACKAGE}（锁定版本，node_modules）`,
  }
}

/**
 * npm 上**已发布**的最高版本（不限于 `latest` 标签）。
 *
 * ⚠️ 这个包的 `latest` 标签是**旧的**（还指着 0.0.1-rc.1，而最新是 0.2.1-rc.2，标签叫
 * `next`）。`npm view <pkg> version` 返回的就是 `latest` 标签 —— 拿它去比，等于拿 2024
 * 年的版本比，结论必错。所以这里取 `versions` 数组里**最高**的那一个（含预发布）。
 */
function highestPublishedVersion(): string {
  const raw = execFileSync('npm', ['view', HOST_PACKAGE, 'versions', '--json'], { encoding: 'utf8' })
  const versions: string[] = JSON.parse(raw)
  if (!Array.isArray(versions) || versions.length === 0) throw new Error('npm 上查不到该包的版本列表')
  return versions.reduce((best, candidate) => (compareVersions(candidate, best) > 0 ? candidate : best))
}

/** 语义化版本比较（含预发布）。够用即可，不引入依赖。 */
function compareVersions(a: string, b: string): number {
  const split = (v: string): { core: number[], pre: string } => {
    const [core, pre = ''] = v.split('-')
    return { core: core.split('.').map(Number), pre }
  }
  const left = split(a)
  const right = split(b)
  for (let i = 0; i < Math.max(left.core.length, right.core.length); i++) {
    const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0)
    if (diff !== 0) return diff
  }
  // 无预发布 > 有预发布
  if (left.pre === right.pre) return 0
  if (left.pre === '') return 1
  if (right.pre === '') return -1
  return left.pre < right.pre ? -1 : 1
}

/** npm 上最新的已发布版的契约（需要网络）。 */
function latestContract(): { contract: HostContract; source: string } {
  const version = highestPublishedVersion()
  const dir = mkdtempSync(join(tmpdir(), 'dsh-upstream-'))
  try {
    execFileSync('npm', ['pack', `${HOST_PACKAGE}@${version}`], { cwd: dir, stdio: 'pipe' })
    const tarball = execFileSync('sh', ['-c', 'ls *.tgz'], { cwd: dir, encoding: 'utf8' }).trim().split('\n')[0]
    execFileSync('tar', ['-xzf', tarball, '--strip-components=1'], { cwd: dir, stdio: 'pipe' })
    return {
      contract: readContract(join(dir, 'lib', 'client.js')),
      source: `${HOST_PACKAGE}@${version}（npm 已发布最高版）`,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const jsonOutput = args.includes('--json')
  const useLatest = args.includes('--latest')

  let host: HostContract
  try {
    host = useLatest ? latestContract() : lockedContract()
  } catch (error) {
    console.error(`读宿主契约失败：${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }

  const ours = [...PENDING_INTERACTION_KINDS]
  const drifts = compareHostContract(ours, host.contract)
  const result = {
    hostSource: host.source,
    hostKinds: host.contract.kinds,
    ourKinds: ours,
    drifted: drifts.length > 0,
    drifts,
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`宿主契约来源：${host.source}`)
    console.log(`宿主认的 kind：${host.contract.kinds.join(', ') || '（无）'}`)
    console.log(`我们认的 kind：${ours.join(', ')}`)
    if (drifts.length === 0) {
      console.log('\n✓ 契约一致。')
    } else {
      console.log(`\n✗ 契约漂移（${drifts.length} 处）：`)
      for (const drift of drifts) console.log(`  - ${drift.detail}`)
      console.log('\n该做什么：')
      console.log('  1. 把宿主新增的 kind 加进 src/client/tree.ts 的 PENDING_INTERACTION_KINDS；')
      console.log('     Rows.tsx 的 switch 有 assertNever，漏改行内表现会直接编译不过。')
      console.log('  2. 同步徽标「待审批」的聚合与文案（src/client/badge-labels.ts 的 pending 分支）。')
      console.log('  3. 跑 npm test —— tests/host-pending-kinds.node.test.mjs 会检查这一致性。')
      console.log('  4. 全量重建并提交 lib/（见 docs/upgrading.md）。')
    }
  }

  process.exit(drifts.length === 0 ? 0 : 1)
}

main()

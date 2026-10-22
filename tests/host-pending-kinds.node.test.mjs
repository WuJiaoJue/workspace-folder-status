/**
 * 守卫：本插件认的**待处理 kind 集合**，必须与锁定版本的宿主实现**完全一致**。
 *
 * ## 为什么需要这道守卫
 *
 * 官方的会话状态不是一个固定枚举，而是三个正交事实（`SessionStatus`）：
 * `running` / `pendingInteraction` / `completionUnread`。宿主自己的 workspace 投影把
 * 它们映成 `running` / `pendingInteraction` / `completed` 三个字段，而本仓库的
 * `src/client/tree.ts` 是那份投影的 **fork**（为了在分组聚合里加 facet 贡献）。
 *
 * `pendingInteraction.kind` 是**开放集合**：`SessionPendingInteractionMap` 靠声明合并
 * 扩展，任何宿主包都能贡献自己的 kind。宿主当前的 `visiblePendingKind` 认三个
 * （`approval` / `plan-review` / `question`），**并且同样把没认出来的 kind 悄悄丢掉**。
 *
 * 于是"宿主新增一种 kind"这件事有两面：
 *
 * - **我们不该自己多认几种**：宿主侧栏不画的，我们画了，徽标与宿主侧栏就成了两套事实。
 *   口径必须跟随宿主。
 * - **我们必须知道宿主改了**：否则宿主的侧栏多画了一个我们没画的点，而我们的徽标少算
 *   一个 —— 两边**都不报错**，只有用户会觉得"这俩对不上"。而这个仓库里
 *   `scripts/check-upstream.ts`（本该守这条）**已经坏了**：它比对的 `src/vendor/src`
 *   目录早就不存在了（vendored 的宿主源码直接摊在 `src/` 下，pristine 副本已删），
 *   宿主包发布版里也没有 `src/`（只有 `lib/`），所以那个脚本一跑就
 *   `ENOENT: scandir 'src/vendor/src'`。文档却还让人照着它 rebase。
 *
 * 这条用例把那条守卫生效：直接读**锁定版本**（`devDependencies` 里与其它宿主包同版本的
 * `@deepseek-ai/dsh-client-ui-workspace`）的**实现**，把它的 kind 集合与我们的比。
 * 宿主加 kind → 我们这边变红 → 照着提示改 `PENDING_INTERACTION_KINDS`。
 *
 * 另外两条断言守的是"我们从宿主读的那两个事实"还在不在：宿主若把
 * `completionUnread` / `pendingInteraction` 改名，我们的 fork 会**静默**地再也不画
 * 「已完成」绿点、再也不认任何待处理 —— 同样不报错，只能靠这道守卫发现。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)

const { PENDING_INTERACTION_KINDS } = await import('../lib/types/client/tree.js')
const { compareHostContract, readHostContract } = await import('../lib/types/host-contract.js')

/** 宿主包（devDependency，版本与仓库其它宿主包一致）的 client bundle。 */
const hostBundle = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-workspace/client'), 'utf8')

test('我们认的待处理 kind 与锁定版宿主完全一致', () => {
  const host = readHostContract(hostBundle)
  const ours = [...PENDING_INTERACTION_KINDS]

  assert.deepEqual(
    [...ours].sort(),
    [...host.kinds].sort(),
    `宿主认的 kind 集合是 [${host.kinds.join(', ')}]，我们认的是 [${ours.join(', ')}]。\n`
    + '宿主新增/删除 kind 时：把新的加进 src/client/tree.ts 的 PENDING_INTERACTION_KINDS，'
    + '并同步徽标的「待审批」聚合（badge-labels.ts 的 pending 分支）。\n'
    + '⚠️ 只在**宿主也认**的前提下才加：我们多认会让徽标与宿主侧栏变成两套事实。',
  )
})

test('我们从宿主读的那两个事实还在（改名会让 fork 静默失效）', () => {
  // completionUnread → 「已完成」绿点；pendingInteraction → 「待审批」黄点。
  for (const fact of ['completionUnread', 'pendingInteraction']) {
    assert.ok(
      hostBundle.includes(fact),
      `宿主 client.js 里找不到 \`${fact}\` —— 上游改了状态事实的名字或形状，`
      + 'src/client/tree.ts 这份 fork 要跟着改，否则徽标会静默少画一类状态。',
    )
  }
})

test('守卫不是摆设：宿主多一种 kind 时，这个比较必须失配', () => {
  // 拿真实 bundle 的一份"改造过的副本"当反例：宿主若真的加了 kind，比较必须红。
  // 没有这一条，上面那条断言可能因为解析写错而**永远绿**（空集合也会"相等"的假象）。
  const doctored = hostBundle.replace('case "approval":', 'case "approval":\n\t\t\t\tcase "brand-new-kind":')
  assert.notEqual(doctored, hostBundle, '这份反例没改成 —— 宿主的 bundle 形状变了，先改守卫')

  const host = readHostContract(doctored)
  assert.ok(host.kinds.includes('brand-new-kind'), '解析器应当把新 kind 读出来')

  const drifts = compareHostContract([...PENDING_INTERACTION_KINDS], host)
  assert.ok(
    drifts.some(drift => drift.kind === 'kind-set'),
    '宿主多了一种 kind，我们却没认 —— 上面那条断言应该红，这条是它的反例',
  )
})

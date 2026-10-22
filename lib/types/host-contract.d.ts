/**
 * 宿主契约的**解析与比对** —— 一份实现，两个调用方：
 *
 * - `scripts/check-upstream.ts`（tsx，跑给人看的那道闸，联网时还能查 npm 最新发布版）；
 * - `tests/host-pending-kinds.node.test.mjs`（`npm test` 里的离线那道闸，CI 会跑）。
 *
 * ## 我们到底依赖宿主的什么
 *
 * 本仓库的 `src/client/tree.ts` 是宿主 `@deepseek-ai/dsh-client-ui-workspace` 投影的
 * **fork**（为了在分组聚合里加 facet 贡献）。那份 fork 里真正会**静默坏掉**的地方只有
 * 一处：`pendingInteraction.kind`。
 *
 * - 它是**开放集合**：`SessionPendingInteractionMap` 靠声明合并扩展，任何宿主包都能贡献
 *   自己的 kind。宿主当前的 `visiblePendingKind` 认三个（`approval` / `plan-review` /
 *   `question`），并把没认出来的 kind **悄悄丢掉**。
 * - 宿主新增一种 kind 时，**宿主侧栏与我们的徽标会一起不显示它**（两边口径一致，不是我们
 *   的错），但我们要**知道**这件事好跟上；没跟上，两边一起不显示，用户只会觉得"这俩对不上"。
 * - 反过来**不要自己多认**：宿主不画的我们画了，徽标与宿主侧栏就成了两套事实。
 *
 * 另有两个状态事实：宿主若把 `completionUnread`（「已完成」绿点）或 `pendingInteraction`
 * （「待审批」黄点）改名，我们的 fork 会**静默地**再也不画那一类状态 —— 同样不报错。
 *
 * @module dsh-group-status/host-contract
 */
/** 我们从宿主读的两个状态事实：它们改名了，这份 fork 就会静默失效。 */
export declare const HOST_STATUS_FACTS: readonly ["completionUnread", "pendingInteraction"];
/** 一处契约漂移。 */
export interface ContractDrift {
    readonly kind: 'kind-set' | 'fact-missing';
    readonly detail: string;
}
/** 从宿主实现里读出来的契约。 */
export interface HostContract {
    /** 宿主认的待处理 kind 集合。 */
    readonly kinds: readonly string[];
    /** 宿主 bundle 里是否还找得到那两个状态事实。 */
    readonly facts: Readonly<Record<(typeof HOST_STATUS_FACTS)[number], boolean>>;
}
/**
 * 从宿主实现（发布产物 `lib/client.js` 的文本）里抠出 `visiblePendingKind` 认的 kind。
 *
 * 抠不出来 = 上游改了实现形状 → 抛错，不静默放过：空集合会让"集合相等"变成永远成立。
 * @param source - 宿主 bundle 文本。
 */
export declare function parseHostPendingKinds(source: string): string[];
/**
 * 读一份宿主 bundle，抽出契约点。
 * @param source - 宿主 bundle 文本。
 */
export declare function readHostContract(source: string): HostContract;
/**
 * 比对我们认的 kind 与宿主认的 kind，以及宿主是否还带着我们要读的事实。
 * @param ours - 本插件认的 kind。
 * @param host - 宿主契约。
 */
export declare function compareHostContract(ours: readonly string[], host: HostContract): ContractDrift[];
//# sourceMappingURL=host-contract.d.ts.map
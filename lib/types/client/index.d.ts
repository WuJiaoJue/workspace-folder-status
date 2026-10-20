import type { Context } from '@deepseek-ai/cordis';
import type { RemoteEndpoint } from '@deepseek-ai/dsh-api-remote-access/client';
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import { type ResolvedBadgeSettings } from './badge-settings.ts';
import { type WorkspaceKey } from './locales.ts';
export type { StartSessionOptions, UiWorkspace } from './navigation.ts';
export type { DirectoryFlowOwnerProps, DirectoryFlowSlotName, DirectoryPickingHooks, DirectoryPickingInjected, MenuOpenState, RowToast, RowToastActions, SessionIdInjected, SessionRenameTarget, SessionRowOwnerProps, UseMenuOpenState, WorkspaceBrowserInjected, SessionRowScheduleOwnerProps, WorkspaceBrowserProps, WorkspacePickerInjected, WorkspacePickerProps, } from './contract/slots.ts';
export type { WorkspaceKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface GlobalStandardProps {
        /** Selector hook over the pure Workspace Controller snapshot. */
        useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>;
        /** Whether the current Peer may call `action` on one Workspace resource. */
        useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean;
        /** Selector hook over this plugin's own settings face (badge preferences). */
        useBadgeSettings: SnapshotSelectorHook<ResolvedBadgeSettings>;
    }
    interface LocaleNamespaceMap {
        /** The workspace browsing region and pick/create flow copy. */
        workspace: WorkspaceKey;
    }
}
declare module '@deepseek-ai/dsh-api-session-controller/client' {
    interface SessionReferenceSourceMap {
        workspaceOperation: unknown;
    }
}
/**
 * Required services (cordis fiber inject). The target slots are declared by
 * the ui-sidebar / ui-conversation applies, whose activation order relative
 * to this one is NOT constrained: dsh.client.inject edges are informational
 * (loading/prefetch metadata, never apply sequencing) and neither owner
 * provides a waitable service. apply therefore depends on each slot
 * declaration through `slots.inject()` instead of assuming order.
 */
/**
 * ── 跨插件公共 API：分组状态 facet 协议 ─────────────────────────────
 *
 * 任何插件想让自己的状态进**折叠分组**的徽标，就 `require('dsh-group-status/client')`
 * 拿这三个符号注册一个 facet；本插件不认识它，也不为它改代码：
 *
 * ```ts
 * const gs = require('dsh-group-status/client')
 * const unregister = gs?.registerGroupStatusFacet?.({
 *   protocol: gs.GROUP_STATUS_FACET_PROTOCOL_VERSION,
 *   id: 'my-plugin.review',                  // '<包名>.<状态名>'，全局唯一
 *   subscribe: store.subscribe,               // 外部存储面，不要求 React hook
 *   getSnapshot: store.getSnapshot,
 *   fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
 *   merge: (a, b) => ({ ... }),              // 多层文件夹怎么合并你的折果
 *   label: (fold, { now }) => '等待评审（剩 3分钟） · #15',
 *   renderIcon: (fold) => h('svg', …),        // 图标归你，本插件只负责摆放
 * })
 * ctx.effect(() => () => unregister?.(), 'my-plugin: group-status facet')
 * ```
 *
 * 完整契约、版本规则与为什么是这个方向见 `docs/facet-protocol.md`。
 */
export { GROUP_STATUS_FACET_PROTOCOL_VERSION, FACET_TONE_RANK, registerGroupStatusFacet, registry as groupStatusFacetRegistry, } from './facets.ts';
export type { AnyFacet, AnyFacetFold, FacetFold, FacetOrigin, FacetRenderContext, FacetRegistration, FacetRejection, FacetTone, GroupStatusFacet, Unregister, } from './facets.ts';
export declare const inject: string[];
/**
 * Register the browser and picker once their slot declarations are on the
 * ledger. Inject factories return plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map
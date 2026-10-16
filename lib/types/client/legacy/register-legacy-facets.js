/**
 * 过渡期：把内置适配器登记进 facet 注册面，并交出它们各自的图标。
 *
 * ⚠️ 本文件与整个 `legacy/` 目录都是**临时代管**：状态所有者（dsh-later、
 * dsh-gitea-dispatch）按 `../facets.ts` 的协议自己注册之后，这里连同两个适配器一起
 * 删除。图标之所以留在这一层而不是放回 `rows/GroupBadge.tsx`：「这个状态长什么样」
 * 是状态所有者的知识，本插件只管把它放进徽标的排格里。
 *
 * @module dsh-group-status/client/legacy/register-legacy-facets
 */
import { createElement } from 'react';
import { IconClockOutlineRegular, IconListPenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { registerGroupStatusFacet } from "../facets.js";
import { registry as defaultRegistry } from "../facets.js";
import { createScheduleFacet, SCHEDULE_FACET_ID } from "./schedule.js";
import { createWaitingReviewFacet, WAITING_REVIEW_FACET_ID, } from "./waiting-review.js";
/** 语义色档 → 宿主色令牌（与改造前的取色逐档一致）。 */
const TONE_COLOR = {
    info: '#8b5cf6',
    warn: 'var(--dsw-alias-state-warn-secondary)',
    error: 'var(--dsw-alias-state-error-primary)',
};
/** 带色的一小段 inline-flex，尺寸与其余徽标图标一致。 */
function glyph(color, icon) {
    return createElement('span', { style: { color, display: 'inline-flex', alignItems: 'center' } }, icon);
}
/**
 * 登记本插件目前**代管**的状态源。
 *
 * 两个 facet 都显式声明 `origin: 'legacy'`，所以状态所有者一旦自己注册同名 facet，
 * 适配器就让位（{@link FACET_ORIGIN_RANK}），不会重复计数。
 *
 * @returns 一次性注销函数（挂到 `ctx.effect` 的清理上）。
 */
export function registerLegacyFacets(sources, target = defaultRegistry) {
    const disposers = [];
    if (sources.schedule !== undefined) {
        const facet = {
            ...createScheduleFacet(sources.schedule),
            // 紫色与 dsh-later 自己的定时徽标同源（浅深底对比均 >=3:1）；
            // urgent / overdue 走宿主 warn / error 语义令牌。
            renderIcon: (fold) => glyph(fold.tone === 'error' ? TONE_COLOR.error : fold.tone === 'warn' ? TONE_COLOR.warn : TONE_COLOR.info, createElement(IconClockOutlineRegular, { size: 14 })),
        };
        disposers.push(target === defaultRegistry
            ? registerGroupStatusFacet(facet)
            : registerInto(target, facet));
    }
    if (sources.waiting !== undefined) {
        const facet = {
            ...createWaitingReviewFacet(sources.waiting),
            // 与定时任务**用不同图标**：两者同属"在等"的语义，只靠颜色区分对色盲用户不可用。
            renderIcon: (fold) => glyph(fold.tone === 'error' ? TONE_COLOR.error : TONE_COLOR.warn, createElement(IconListPenOutlineRegular, { size: 14 })),
        };
        disposers.push(target === defaultRegistry
            ? registerGroupStatusFacet(facet)
            : registerInto(target, facet));
    }
    return () => {
        for (const dispose of disposers)
            dispose();
    };
}
/** 对给定登记面注册一个 facet（与单例路径同一套校验/拒绝语义）。 */
function registerInto(target, facet) {
    const result = target.register(facet);
    return result.ok ? () => {
        target.remove(result.id, facet);
    } : () => undefined;
}
/** 本插件目前代管了哪些状态源（诊断与测试用）。 */
export const LEGACY_FACET_IDS = [SCHEDULE_FACET_ID, WAITING_REVIEW_FACET_ID];
//# sourceMappingURL=register-legacy-facets.js.map
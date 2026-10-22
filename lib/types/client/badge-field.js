/**
 * 卡片字段名（与 `src/index.ts` 的 `Config` 同名同义）。
 *
 * ⚠️ 只有本插件自己的语义。曾有 `showScheduledInBadge` / `showWaitingReviewInBadge`
 * 两个字段替 dsh-later / dsh-gitea-dispatch 写死名字与图标形状，现已删除：外部来源的
 * 显隐归来源自己（不注册就是不显示）。
 */
export const BADGE_FIELDS = {
    showCompletedInBadge: 'showCompletedInBadge',
    showRunningInBadge: 'showRunningInBadge',
    showPendingInBadge: 'showPendingInBadge',
    showHoverDetails: 'showHoverDetails',
    countThreshold: 'countThreshold',
};
/** 存储值解析成开关状态：只有显式 false 才是「关闭」。 */
export function isFieldEnabled(value) {
    return value !== false;
}
/**
 * 草稿文本解析成开关状态：与 {@link isFieldEnabled} 不同，这里比较的是模型给的
 * **文本**，别把字符串喂给上面那个函数（`'false' !== false` 恒真）。
 */
export function isDraftEnabled(text) {
    return text !== 'false';
}
/**
 * 构造一个布尔字段的字段转换规格。
 *
 * `parse` 只接受 `'true'` / `'false'`：空串、任意其它文本都返回 `undefined`，
 * 让模型把字段判为 invalid 并拒绝保存（官方模型的既定行为）。
 *
 * @param field - 字段名（与 Config 同名）。
 * @param defaultValue - 缺失值时的默认（true = 默认显示，false = 默认隐藏）。
 */
function makeBooleanField(field, defaultValue) {
    return {
        field,
        format: value => {
            const enabled = value === undefined || value === null || typeof value !== 'boolean'
                ? defaultValue
                : value;
            return enabled ? 'true' : 'false';
        },
        parse: text => text === 'true' ? { kind: 'set', value: true }
            : text === 'false' ? { kind: 'set', value: false }
                : undefined,
    };
}
/** 各字段的字段转换规格。 */
export const showCompletedField = makeBooleanField(BADGE_FIELDS.showCompletedInBadge, true);
export const showRunningField = makeBooleanField(BADGE_FIELDS.showRunningInBadge, true);
export const showPendingField = makeBooleanField(BADGE_FIELDS.showPendingInBadge, true);
export const showHoverDetailsField = makeBooleanField(BADGE_FIELDS.showHoverDetails, true);
export const countThresholdField = {
    field: BADGE_FIELDS.countThreshold,
    format: value => {
        const n = value === undefined || value === null || typeof value !== 'number' || !Number.isFinite(value)
            ? 2
            : Math.floor(value);
        return String(n < 0 ? 0 : n);
    },
    parse: text => {
        const n = Number(text);
        if (!Number.isFinite(n) || n < 0 || n !== Math.floor(n))
            return undefined;
        return { kind: 'set', value: n };
    },
};
/**
 * 所有字段规格。
 *
 * ⚠️ 顺序**必须**与徽标画点的顺序一致（`rows/GroupBadge.tsx`：待审批 → 进行中 → 已完成；
 * 外部来源排在已完成之前，但它们不在本插件的卡片上）。用户操作场景就是"我看到徽标第 N
 * 个图标，想关掉它"，卡片顺序错位会让人怀疑两处是两套事实 —— 同一族毛病 #25① 已经在
 * 点行与明细之间修过一次。回归用例：`tests/badge-settings-card.client.spec.tsx`。
 */
export const ALL_BADGE_FIELDS = [
    showPendingField,
    showRunningField,
    showCompletedField,
    showHoverDetailsField,
    countThresholdField,
];
//# sourceMappingURL=badge-field.js.map
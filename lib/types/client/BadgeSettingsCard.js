import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 折叠徽标的设置卡片：插件 → dsh-group-status（bundle 详情页的配置表单）。
 *
 * 为什么需要这张卡片：0.2.0 起宿主把插件 `Config`（`src/index.ts`，根节点
 * `.volatile()`）投影到客户端 `configForms` 服务上，但**不会**自动把表单画进
 * 「插件」页——插件页只在客户端往 `plugins.bundle.config` 注册了卡片时才渲染
 * （见 dsh-later / dsh-gitea-dispatch 的同款做法）。没有它，README「设置项」一节
 * 描述的配置表单在 GUI 里根本不存在。
 *
 * 视觉与交互**不自造**，全部交给官方组件（`@deepseek-ai/dsh-client-ui-primitives`）：
 *  - `SettingsForm`：表单框架——只读提示、不可用提示、保存按钮、失败行、间距；
 *  - `SettingsFormModel`：分步草稿与保存（revision 围栏、宿主拒绝时不丢草稿）；
 *  - `Switch`：开关本体。
 * 官方设置页（设置 → 内置插件 → 子智能体 / 网页搜索）用的就是这三件，本卡片的
 * 类名与取值也逐条对齐它们的 CSS（见 `BadgeSettingsCard.module.css` 头部）。
 *
 * 字段定义在 `badge-field.ts`（纯逻辑，可单测）；这里只管把它们接到模型与槽位上。
 */
import { useEffect, useId, useMemo, useSyncExternalStore } from 'react';
import { SettingsForm, SettingsFormModel, Switch, } from '@deepseek-ai/dsh-client-ui-primitives';
import { ALL_BADGE_FIELDS, BADGE_FIELDS, isDraftEnabled } from "./badge-field.js";
import css from './BadgeSettingsCard.module.css';
/**
 * 渲染折叠徽标的设置表单。
 *
 * 模型与投影都按 `scope` 记忆：宿主换一份表单（条目重新服务）时整体重建，旧模型
 * 在 effect 清理里 `dispose()`，不会留下悬挂订阅。
 * @param props - 宿主设置表单与文案取值器。
 * @returns 官方表单框架包着本插件的开关字段。
 */
export function BadgeSettingsCard({ scope, t }) {
    const model = useMemo(() => new SettingsFormModel(scope, ALL_BADGE_FIELDS), [scope]);
    useEffect(() => () => { model.dispose(); }, [model]);
    // 投影：框架状态 + 所有字段的草稿。模型的 publish 会在宿主折叠或草稿变化时重算。
    const store = useMemo(() => model.bind(() => ({
        ...model.shell(),
        fields: ALL_BADGE_FIELDS.map(spec => ({ field: spec.field, text: model.field(spec.field).text })),
    })), [model]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const actions = useMemo(() => model.actions(), [model]);
    const badgeSectionId = useId();
    const hoverSectionId = useId();
    const countSectionId = useId();
    const labels = {
        unavailable: t('settings.unavailable'),
        readOnly: t('settings.readOnly'),
        saveFailed: t('settings.saveFailed'),
        save: t('settings.save'),
        saving: t('settings.saving'),
    };
    // 按字段名查草稿文本。
    const fieldText = (field) => {
        const found = state.fields.find(f => f.field === field);
        return found?.text ?? 'true';
    };
    return (_jsxs(SettingsForm, { labels: labels, state: state, onSave: () => { actions.save(); }, onDiscard: () => { actions.discard(); }, children: [_jsxs("section", { className: css.section, "aria-labelledby": badgeSectionId, children: [_jsx("h3", { className: css.heading, id: badgeSectionId, children: t('settings.badge.section') }), _jsx(ToggleRow, { field: BADGE_FIELDS.showPendingInBadge, text: fieldText(BADGE_FIELDS.showPendingInBadge), label: t('settings.badge.showPending'), hint: t('settings.badge.showPendingHint'), state: state, actions: actions }), _jsx(ToggleRow, { field: BADGE_FIELDS.showRunningInBadge, text: fieldText(BADGE_FIELDS.showRunningInBadge), label: t('settings.badge.showRunning'), hint: t('settings.badge.showRunningHint'), state: state, actions: actions }), _jsx(ToggleRow, { field: BADGE_FIELDS.showCompletedInBadge, text: fieldText(BADGE_FIELDS.showCompletedInBadge), label: t('settings.badge.showCompleted'), hint: t('settings.badge.showCompletedHint'), state: state, actions: actions })] }), _jsxs("section", { className: css.section, "aria-labelledby": hoverSectionId, children: [_jsx("h3", { className: css.heading, id: hoverSectionId, children: t('settings.hover.section') }), _jsx(ToggleRow, { field: BADGE_FIELDS.showHoverDetails, text: fieldText(BADGE_FIELDS.showHoverDetails), label: t('settings.hover.showDetails'), hint: t('settings.hover.showDetailsHint'), state: state, actions: actions })] }), _jsxs("section", { className: css.section, "aria-labelledby": countSectionId, children: [_jsx("h3", { className: css.heading, id: countSectionId, children: t('settings.count.section') }), _jsx(NumberRow, { field: BADGE_FIELDS.countThreshold, text: fieldText(BADGE_FIELDS.countThreshold), label: t('settings.count.threshold'), hint: t('settings.count.thresholdHint'), state: state, actions: actions })] })] }));
}
/** 单行开关：label + Switch + hint。 */
function ToggleRow({ field, text, label, hint, state, actions }) {
    return (_jsxs("div", { className: css.badgeField, children: [_jsxs("div", { className: css.badgeToggleRow, children: [_jsx("span", { className: css.badgeToggleLabel, children: label }), _jsx(Switch, { checked: isDraftEnabled(text), label: label, disabled: !state.writable || state.saving, onChange: next => { actions.edit(field, next ? 'true' : 'false'); } })] }), _jsx("p", { className: css.hint, children: hint })] }));
}
/** 单行数字输入：label + 带加减按钮的数字输入 + hint。 */
function NumberRow({ field, text, label, hint, state, actions }) {
    const disabled = !state.writable || state.saving;
    const currentValue = Number(text) || 0;
    const decrement = () => { if (!disabled && currentValue > 0)
        actions.edit(field, String(currentValue - 1)); };
    const increment = () => { if (!disabled)
        actions.edit(field, String(currentValue + 1)); };
    return (_jsxs("div", { className: css.badgeField, children: [_jsxs("div", { className: css.badgeToggleRow, children: [_jsx("span", { className: css.badgeToggleLabel, children: label }), _jsxs("div", { className: css.badgeNumberControl, children: [_jsx("button", { type: "button", className: css.badgeNumberButton, disabled: disabled || currentValue <= 0, onClick: decrement, "aria-label": "\u51CF\u5C11", children: "\u2212" }), _jsx("span", { className: css.badgeNumberValue, children: text }), _jsx("button", { type: "button", className: css.badgeNumberButton, disabled: disabled, onClick: increment, "aria-label": "\u589E\u52A0", children: "+" })] })] }), _jsx("p", { className: css.hint, children: hint })] }));
}
//# sourceMappingURL=BadgeSettingsCard.js.map
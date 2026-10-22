/**
 * 折叠徽标设置项的字段定义（纯逻辑，不碰 React / 宿主组件）。
 *
 * 官方设置卡片的模型（`SettingsFormModel`）把每个字段都当**草稿文本**处理：控件读
 * `format(存储值)` 得到文本，用户编辑后 `parse(文本)` 决定这次保存写什么。布尔字段
 * 没有现成的官方 spec（官方只提供 `settingsTextField` / `settingsNumberField`），所以
 * 这里按同一契约写一份：文本就是 schema 的布尔字面量。
 *
 * 单独成文件是为了可测：`parse` 必须对非法草稿返回 `undefined`（模型据此把该字段标为
 * invalid 并挡住保存，而不是把畸形值写下去），`format` 必须把缺失值读成默认 `true`
 * ——与 `Config` 各字段的 schema 默认、`badge-settings.ts` 的解析同源。
 *
 * 类型从 primitives **type-only** 引入：编译期接住官方契约，运行时不留依赖，
 * 测试里也就不必把那个包（及其整棵依赖闭包）拉进来。
 */
import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * 卡片字段名（与 `src/index.ts` 的 `Config` 同名同义）。
 *
 * ⚠️ 只有本插件自己的语义。曾有 `showScheduledInBadge` / `showWaitingReviewInBadge`
 * 两个字段替 dsh-later / dsh-gitea-dispatch 写死名字与图标形状，现已删除：外部来源的
 * 显隐归来源自己（不注册就是不显示）。
 */
export declare const BADGE_FIELDS: {
    readonly showCompletedInBadge: "showCompletedInBadge";
    readonly showRunningInBadge: "showRunningInBadge";
    readonly showPendingInBadge: "showPendingInBadge";
    readonly showHoverDetails: "showHoverDetails";
    readonly countThreshold: "countThreshold";
};
/** 存储值解析成开关状态：只有显式 false 才是「关闭」。 */
export declare function isFieldEnabled(value: unknown): boolean;
/**
 * 草稿文本解析成开关状态：与 {@link isFieldEnabled} 不同，这里比较的是模型给的
 * **文本**，别把字符串喂给上面那个函数（`'false' !== false` 恒真）。
 */
export declare function isDraftEnabled(text: string): boolean;
/** 各字段的字段转换规格。 */
export declare const showCompletedField: SettingsFieldSpec;
export declare const showRunningField: SettingsFieldSpec;
export declare const showPendingField: SettingsFieldSpec;
export declare const showHoverDetailsField: SettingsFieldSpec;
export declare const countThresholdField: SettingsFieldSpec;
/**
 * 所有字段规格。
 *
 * ⚠️ 顺序**必须**与徽标画点的顺序一致（`rows/GroupBadge.tsx`：待审批 → 进行中 → 已完成；
 * 外部来源排在已完成之前，但它们不在本插件的卡片上）。用户操作场景就是"我看到徽标第 N
 * 个图标，想关掉它"，卡片顺序错位会让人怀疑两处是两套事实 —— 同一族毛病 #25① 已经在
 * 点行与明细之间修过一次。回归用例：`tests/badge-settings-card.client.spec.tsx`。
 */
export declare const ALL_BADGE_FIELDS: SettingsFieldSpec[];
//# sourceMappingURL=badge-field.d.ts.map
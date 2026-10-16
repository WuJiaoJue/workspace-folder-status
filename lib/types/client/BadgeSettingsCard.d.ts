import type { JSX } from 'react';
import { type SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives';
import type { WorkspaceKey } from './locales.ts';
/**
 * 卡片 props：宿主设置表单 + 本命名空间文案取值器。
 *
 * `scope` 直接用官方 `SettingsFormScope`（= `configForms.get(条目 id)` 的运行时形状：
 * `getSnapshot` / `subscribe` / `mutate`），因此不需要本地复刻契约，也就不会与宿主漂移。
 * `locale: NS` 由框架按声明注入 `t`。
 */
export interface BadgeSettingsCardProps {
    readonly scope: SettingsFormScope<Record<string, unknown>>;
    readonly t: (key: WorkspaceKey) => string;
}
/**
 * 渲染折叠徽标的设置表单。
 *
 * 模型与投影都按 `scope` 记忆：宿主换一份表单（条目重新服务）时整体重建，旧模型
 * 在 effect 清理里 `dispose()`，不会留下悬挂订阅。
 * @param props - 宿主设置表单与文案取值器。
 * @returns 官方表单框架包着本插件的开关字段。
 */
export declare function BadgeSettingsCard({ scope, t }: BadgeSettingsCardProps): JSX.Element;
//# sourceMappingURL=BadgeSettingsCard.d.ts.map
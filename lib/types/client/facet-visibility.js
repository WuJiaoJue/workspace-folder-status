/**
 * 按用户设置筛掉不参与折叠的状态来源。
 *
 * 单独成文是因为它属于**徽标自身**的可见性规则，而不是某个来源的适配：来源只在
 * `facet.settingKey` 上声明"我受哪个开关管"，开关的语义与过滤时机归本插件。
 *
 * 过滤发生在**折叠之前**而不是渲染阶段：徽标数字、图标、`aria-label`、悬停明细与
 * "要不要画徽标"因此天然同源。放到渲染阶段会出现"label 里有、计数里没有"，而那正是
 * 徽标最容易被怀疑撒谎的地方。
 *
 * @module dsh-group-status/client/facet-visibility
 */
import { facetVisibleBySettings } from "./badge-settings.js";
/** 筛出设置允许显示的登记项；顺序保持登记面的顺序（已按 `order` 排好）。 */
export function visibleFacets(entries, settings) {
    return entries.filter(entry => facetVisibleBySettings(settings, entry.facet.settingKey));
}
//# sourceMappingURL=facet-visibility.js.map
/** 本协议文件的协议版本。provider 必须原样填这个常量。 */
export const GROUP_STATUS_FACET_PROTOCOL_VERSION = 1;
/** tone 之间的优先级（越大越紧急），用于多层合并时取更高档。 */
export const FACET_TONE_RANK = Object.freeze({
    info: 0, warn: 1, error: 2,
});
/**
 * 同 id 冲突时**由来源决胜，与注册顺序无关**。
 *
 * 宿主不保证插件 apply 的先后。过渡期内"本插件代 provider 写的适配器"与"provider
 * 自己注册的 facet"会撞同一个 id：若靠顺序决胜，同一份部署今天显示、明天不显示。
 * `provider` 恒胜 `legacy`：所有者一接入，代管方立刻让位，且不重复计数。迁移因此
 * 不需要协商发布顺序。
 */
export const FACET_ORIGIN_RANK = Object.freeze({
    legacy: 0, provider: 1,
});
/** 一个 facet 的来源；缺省按 `provider`（最保守的假设：别人主动注册就是所有者）。 */
export function facetOrigin(facet) {
    return facet.origin === 'legacy' ? 'legacy' : 'provider';
}
// #25③：此处原有 `const TONE_ORDER = ['info','warn','error']`，与对外导出的
// `FACET_TONE_RANK` 是同一个事实的两份实现，且只有 `defaultMergeFold` 一个使用者。
// 现已统一到 `FACET_TONE_RANK`（见该函数），私有那份删除。
/**
 * 检查一个 facet 是否符合协议 v1。
 * @returns 拒绝原因；`undefined` 表示可用。
 */
export function facetRejection(facet) {
    if (typeof facet !== 'object' || facet === null)
        return 'not-an-object';
    const candidate = facet;
    if (candidate.protocol !== GROUP_STATUS_FACET_PROTOCOL_VERSION)
        return 'protocol-mismatch';
    if (typeof candidate.id !== 'string' || candidate.id === '')
        return 'missing-id';
    if (typeof candidate.subscribe !== 'function'
        || typeof candidate.getSnapshot !== 'function'
        || typeof candidate.fold !== 'function')
        return 'missing-methods';
    return undefined;
}
/**
 * 缺省折果合并：数量相加、色档取更紧急的一档、脉冲取或。
 *
 * ⚠️ 它**不**合并 `data`（本插件不知道 `data` 是什么）。需要合并原始事实的 facet
 * 必须自己实现 {@link GroupStatusFacet.merge}。
 */
export function defaultMergeFold(a, b) {
    // #25③：读对外导出的 `FACET_TONE_RANK`，不再另持一份私有 `TONE_ORDER`。两份表的顺序
    // 逐项相同（`{info:0,warn:1,error:2}` 与 `['info','warn','error']` 的下标一致），所以对
    // 合法色档这是**零行为变更**；收口的是「同一个事实两份实现」本身。
    //
    // ⚠️ `?? -1` **不是防御性冗余，是负载性的，别顺手删**。`facetRejection` 只校验
    // protocol / id / 三个方法，**不校验 `fold()` 返回的 `tone`** —— 那是跨插件边界，坏
    // provider 交回一个非法档位是真能到达这里的。旧的 `TONE_ORDER.indexOf(非法值)` 得到
    // `-1`，于是另一侧的合法档位必胜（`2 > -1`）；而 `FACET_TONE_RANK[非法值]` 得到
    // `undefined`，任何比较都是 `false`，非法档位就会被**传播出去**。少了这个 `?? -1`，
    // 本次重构会在坏输入下静默改变结果。
    const toneA = FACET_TONE_RANK[a.tone] ?? -1;
    const toneB = FACET_TONE_RANK[b.tone] ?? -1;
    return {
        count: a.count + b.count,
        tone: toneB > toneA ? b.tone : a.tone,
        pulse: a.pulse || b.pulse,
    };
}
/** 创建一张登记表面（测试用；生产走模块级单例 {@link registry}）。 */
export function createFacetRegistry() {
    const entries = new Map();
    const listeners = new Set();
    let sequence = 0;
    let sorted = [];
    const resort = () => {
        sorted = [...entries.values()].sort((x, y) => {
            // 排序键 = (有没有声明 order, order, 注册序号)。
            // 没声明 order 的来源一律排在**所有声明过的之后**，彼此按注册先后：陌生新来者
            // 不该插到既有状态前面抢视觉位置，而两两之间又没有可比的新排序键。
            const declaredX = x.facet.order !== undefined;
            const declaredY = y.facet.order !== undefined;
            if (declaredX !== declaredY)
                return declaredX ? -1 : 1;
            if (declaredX && declaredY)
                return x.facet.order - y.facet.order;
            return x.sequence - y.sequence;
        });
    };
    let notifying = false;
    let pending = false;
    /**
     * 通知订阅者，并把**重入合并成一轮补跑**。
     *
     * 订阅者在自己的回调里登记/注销 facet 是完全合法的（消费方常在收到变更后立即
     * 补登记一个派生来源）。直接递归会有两个问题：嵌套深度由订阅者数量决定（两个互相
     * 触发的订阅者就是无界递归），而且中间那轮通知看到的登记面是**改到一半**的。
     * 所以内层调用只置脏标志，外层跑完一轮后再补一轮，直到没有新的改动 —— 每个订阅者
     * 都看得到最终状态，递归深度恒为 1。
     */
    const notify = () => {
        if (notifying) {
            pending = true;
            return;
        }
        notifying = true;
        try {
            do {
                pending = false;
                // 复制一份再遍历：订阅者可能在回调里退订自己。
                for (const listener of [...listeners]) {
                    try {
                        listener();
                    }
                    catch {
                        /* 单个订阅者异常不影响其余订阅者 */
                    }
                }
            } while (pending);
        }
        finally {
            notifying = false;
            pending = false;
        }
    };
    return {
        register: (facet) => {
            const reason = facetRejection(facet);
            const id = typeof facet?.id === 'string' ? facet.id : '';
            if (reason !== undefined)
                return { ok: false, id, reason };
            const existing = entries.get(id);
            const nextRank = FACET_ORIGIN_RANK[facetOrigin(facet)];
            if (existing !== undefined && FACET_ORIGIN_RANK[facetOrigin(existing.facet)] > nextRank) {
                // 同 id 上站着更高来源的登记（状态所有者已经自己接入），低的一边让位。
                return { ok: false, id, reason: 'superseded' };
            }
            sequence += 1;
            // 同来源重复登记直接覆盖：provider 热替换实现不必先注销再登记。
            entries.set(id, { facet, sequence });
            resort();
            notify();
            return { ok: true, id };
        },
        remove: (id, facet) => {
            const current = entries.get(id);
            if (current === undefined)
                return false;
            if (facet !== undefined && current.facet !== facet)
                return false;
            entries.delete(id);
            resort();
            notify();
            return true;
        },
        list: () => sorted,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
/**
 * 生产用的模块级单例登记表面。
 *
 * 与 {@link createFacetRegistry} 分开，是为了让测试能对着一张干净的表断言协议行为，
 * 而不会被别的用例或别的插件登记的 facet 污染。
 */
export const registry = createFacetRegistry();
/**
 * 本插件 client 入口对外的登记函数（provider 侧唯一需要认识的符号）。
 *
 * @param facet - 待登记的 facet。
 * @returns 注销函数；**注册失败时返回一个空操作**，同时把原因写进 console——
 *   返回值形状保持稳定，provider 的 dispose 路径不必区分成败。
 */
export function registerGroupStatusFacet(facet) {
    const result = registry.register(facet);
    if (!result.ok) {
        // 过渡期适配器被状态所有者顶掉是**预期结果**，不是错误：报一条 warn 会让人以为
        // 徽标坏了。除此之外的每一次失败都必须可见，否则"注册了却没显示"无从诊断。
        if (!(result.reason === 'superseded' && facetOrigin(facet) === 'legacy'))
            reportRejection(result);
        return () => undefined;
    }
    // 只摘"还是自己"的那一份：同 id 已被后来的实现替换时，旧 dispose 不该动新登记。
    return () => {
        registry.remove(result.id, facet);
    };
}
/**
 * 把注册失败写成一条可诊断的日志。
 *
 * 刻意不抛错：状态显示是增强功能，一个插件协议填错不该把宿主界面渲染打断；
 * 但也不静默——"注册了却没显示"必须能查出原因。
 */
function reportRejection(rejection) {
    const detail = rejection.reason === 'protocol-mismatch'
        ? `本插件只接受 protocol: ${GROUP_STATUS_FACET_PROTOCOL_VERSION}`
        : rejection.reason === 'missing-methods'
            ? 'subscribe / getSnapshot / fold 三个方法必须齐备'
            : rejection.reason === 'missing-id'
                ? "id 必须是非空字符串，建议 '<包名>.<状态名>'"
                : rejection.reason === 'superseded'
                    ? '同 id 上已有更高来源的登记；两个不同插件用了同一个 id，请各自换名'
                    : 'facet 必须是一个对象';
    console.warn(`dsh-group-status: 拒绝登记状态 facet "${rejection.id}"（${rejection.reason}）：${detail}`);
}
//# sourceMappingURL=facets.js.map
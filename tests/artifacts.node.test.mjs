/**
 * Fork-owned coverage for **构建产物与源码的一致性**。
 *
 * 为什么需要这一份：`lib/` 随仓库提交（见 `docs/upgrading.md`），而安装方直接吃它。
 * 2026-10-16 发现入库的 `lib/types/index.js`（tsdown 的打包入口）比 `src/index.ts`
 * 少 6 个配置项，导致发布出去的 `lib/index.js` 里 `Config` 只有 1 个字段——
 * 设置界面因此只画得出 1 个开关。根因是 `lib/tsconfig.tsbuildinfo` 是**增量**状态：
 * `tsc` 认为源文件没变就跳过输出，产物于是停在旧版本，而 `tsc` 退出码仍是 0，
 * 没有任何一步会报错。全量重建（删掉 tsbuildinfo + lib/types）即可修复。
 *
 * 所以这里锁两件事：
 *   1. 产物的**存在性**——每个实现源文件都该有对应的 `lib/types` 产物；
 *   2. 产物的**内容新鲜度**——`Config` 的字段集合必须与 `src/index.ts` 逐一对齐。
 *
 * 第 2 条是这次真出事的地方，也是唯一能抓住「少字段」的门禁。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

/** 仓库根：本文件在 `tests/` 下。 */
const root = new URL('../', import.meta.url)

const read = (p) => readFileSync(new URL(p, root), 'utf8')

/** 从源码里取 `Config` 的字段名——只认 schema 定义行，不认注释与类型声明。 */
const configFieldsInSource = () => {
  const src = read('src/index.ts')
  const start = src.indexOf('export const Config')
  assert.ok(start >= 0, 'src/index.ts 里应当有 `export const Config`')
  // 截到该声明结束（下一个顶层 `export` 或文件尾），避免把别处的同名字段算进来。
  const rest = src.slice(start)
  const next = rest.indexOf('\nexport ', 1)
  const body = next >= 0 ? rest.slice(0, next) : rest
  const names = [...body.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1])
  return [...new Set(names)].sort()
}

test('Config：产物的字段集合与 src/index.ts 逐一对齐', () => {
  const fromSource = configFieldsInSource()
  assert.ok(fromSource.length > 1, `源码 Config 应当不止 1 个字段，实际 ${fromSource.length}`)

  const artifact = read('lib/types/index.js')
  const start = artifact.indexOf('const Config = Schema.object(')
  assert.ok(start >= 0, 'lib/types/index.js 里应当有 `const Config = Schema.object(`')
  const rest = artifact.slice(start)
  const end = rest.indexOf('}).volatile()')
  const body = end >= 0 ? rest.slice(0, end) : rest
  const fromArtifact = [...new Set([...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]))].sort()

  assert.deepEqual(
    fromArtifact,
    fromSource,
    'lib/types/index.js 的 Config 字段与 src/index.ts 不一致——产物陈旧，跑 `pnpm build` 并提交 lib/',
  )
})

test('发布产物 lib/index.js 里的 Config 带着全部字段', () => {
  // 这是安装方真正加载的文件；它与 lib/types/index.js 之间隔着一个 tsdown。
  for (const field of configFieldsInSource()) {
    assert.match(
      read('lib/index.js'),
      new RegExp(`\\b${field}\\s*:`),
      `lib/index.js 的 Config 缺字段 \`${field}\`——设置界面会少一个开关`,
    )
  }
})

test('每个实现源文件都有对应的 lib/types 产物', () => {
  /** 递归收集 `src/` 下的实现文件（`.ts`/`.tsx`）。手写 `.d.ts` 不产 `.js`，跳过。 */
  const walk = (dir) => {
    const out = []
    for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const p = `${dir}${e.name}`
      if (e.isDirectory()) out.push(...walk(`${p}/`))
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
    }
    return out
  }

  const missing = []
  for (const src of walk('src/')) {
    const base = src.replace(/^src\//, '').replace(/\.tsx?$/, '')
    for (const ext of ['.js', '.d.ts']) {
      const artifact = `lib/types/${base}${ext}`
      if (!existsSync(new URL(artifact, root))) missing.push(artifact)
    }
  }

  assert.deepEqual(
    missing,
    [],
    '以下产物缺失——`tsc` 的增量缓存会静默跳过输出，跑全量构建：rm -rf lib/types lib/tsconfig.tsbuildinfo && pnpm build',
  )
})

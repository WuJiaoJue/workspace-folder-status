/**
 * zh / en 键集对齐。
 *
 * `en` 的 `satisfies Record<WorkspaceKey, string>` 只在**类型检查**时生效，而 `vitest`
 * 本身不做类型检查——只往一侧词典加文案，测试仍会全绿，缺失的那条文案要等到界面上读出
 * 键名才会被发现。这里在运行期把两个方向都钉住：任何一侧多键或少键，这条用例直接红。
 */
import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'

describe('workspace 词典键集', () => {
  it('zh 与 en 的键完全相同', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })
})

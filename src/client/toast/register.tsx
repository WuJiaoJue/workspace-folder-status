/** Business-owned mappings into the keyed Workspace Toast slot. */
import type { Context } from '@deepseek-ai/cordis'
import type {
  InjectFace, PropsLocale, PropsRenderFactories, PropsRuntime, PropsStore, SlotComponent,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { RowToastActions, WorkspaceViewStoreHandle } from '../contract/slots.ts'
import type { ArchiveToastInjected, ToastDisplay, ToastKind, ToastNotice } from '../contract/toast.ts'
import { ArchiveToastEntry, ToastEntry, WorkspaceToast } from './Toast.tsx'

type Translate = PropsLocale<'workspace'>['t']

/** 归档两条之外的普通通知键；归档另有适配器，因为它们要读观看 store。 */
type PlainToastKind = Exclude<ToastKind, 'archived' | 'stoppedAndArchived'>
/** 归档通知键。 */
type ArchiveToastKind = Extract<ToastKind, 'archived' | 'stoppedAndArchived'>

/**
 * 共享适配器取用的注入面：唯一的业务数据是 display。
 *
 * 「一个实现接受所有键的负载」在函数类型上只有 `notice: never` 写得出来（`never` 是
 * 每个具体负载的公共子类型）；具体负载由 `Toast.tsx` 的适配器按键还原。此前这里是
 * `any` —— 同一个意思，但写错负载字段（比如把 `createFailed` 的 `message` 写成
 * `reason`）连编译都不报。
 */
type KeyedToastInjected = {
  display: (notice: never, t: Translate, dismiss: () => void) => ToastDisplay
}

/**
 * Wrap a business display mapping without making the slot component generic.
 * @param display - 该键的纯文案映射；`notice` 的类型由键决定，写错字段即编译失败。
 */
function plainToast<K extends ToastKind>(
  display: (notice: ToastNotice<K>, t: Translate, dismiss: () => void) => ToastDisplay,
): () => KeyedToastInjected {
  return () => ({ display })
}

/**
 * 一条普通通知的登记数据：键与它自己的 display 成对。
 *
 * 键必须作为泛型实参先写出来，`display` 的 `notice` 才有类型——单看 display 推断不出
 * K，只能退回全部通知的联合。存下来的 `inject` 按 {@link KeyedToastInjected} 抹掉键
 * 负载：键 → 负载 的对应关系在入参这一侧已经校验过。
 */
function plainToastRow<K extends PlainToastKind>(
  key: K,
  display: (notice: ToastNotice<K>, t: Translate, dismiss: () => void) => ToastDisplay,
): { readonly key: K; readonly inject: () => KeyedToastInjected } {
  return { key, inject: plainToast(display) }
}

/** 归档通知表：两条之间只有文案键不同（撤销动作、筛选动作、store 座位完全一致）。 */
interface ArchiveToastRow {
  readonly key: ArchiveToastKind
  readonly text: 'toast.archived' | 'toast.stoppedAndArchived'
}

const ARCHIVE_TOASTS: readonly ArchiveToastRow[] = [
  { key: 'archived', text: 'toast.archived' },
  { key: 'stoppedAndArchived', text: 'toast.stoppedAndArchived' },
]

/**
 * 普通通知的适配器在注册时被检查的 props。
 *
 * 键负载写成一个**联合**（`PlainToastKind` 的每一份）而不是省略或任一具体键：九条
 * 注册各自的负载都是这个联合的成员，所以一个声明够用；写死成某一个键会让其余八条
 * 注册过不了类型检查。键负载在组件体内由 `Toast.tsx` 还原，本层不解释。
 */
type PlainToastComponentProps =
  PropsRuntime<'workspace.toast', PlainToastKind>
  & PropsLocale<'workspace'>
  & PropsRenderFactories
  & InjectFace<KeyedToastInjected>

/** 归档通知的适配器在注册时被检查的 props：多一个观看 store 座位与筛选动作。 */
type ArchiveToastComponentProps =
  PropsRuntime<'workspace.toast', ArchiveToastKind>
  & PropsLocale<'workspace'>
  & PropsRenderFactories
  & PropsStore<WorkspaceViewStoreHandle>
  & InjectFace<ArchiveToastInjected>

/**
 * Register notice presentations with their business-owned display fields and actions.
 * @param ctx - workspace plugin context.
 * @param viewStore - viewing store, read only by archive notices.
 * @param actions - archive and source-opening callbacks.
 */
export function registerToasts(
  ctx: Context,
  viewStore: WorkspaceViewStoreHandle,
  actions: Pick<RowToastActions, 'undoArchive' | 'showArchived' | 'openForkSource'>,
): void {
  const toastEntry = ToastEntry as unknown as SlotComponent<PlainToastComponentProps>
  const archiveToastEntry = ArchiveToastEntry as unknown as SlotComponent<ArchiveToastComponentProps>
  const archiveFilterAction = (t: Translate, dismiss: () => void): NonNullable<ToastDisplay['actions']>[number] => ({
    prefix: t('toast.archivedOr'),
    label: t('toast.archivedFilter'),
    onClick: () => {
      dismiss()
      actions.showArchived()
    },
  })

  // 十一次逐字相似的 ctx.slots.register 收成「表 + 循环」：键、文案、色档、holdMs、
  // 动作都写在行里，注册循环只负责把行搬进槽。此前每次改一条公共口径（比如 locale
  // 命名空间）都得在十一个对象字面量里逐处找，漏一处不报错、只在那条通知上静默失效。
  //
  // 顺序照抄迁移前的注册顺序。keyed 槽按 key 分格，顺序本可无关，但保持原样这份表
  // 才能逐行对着原来的十一次调用核对。表建在 registerToasts 里而不是模块级：`forkRequiresOpen`
  // 的动作闭包用到本次 apply 的 `actions`，搬出去就得把回调也当参数传进来。
  const plainToasts = [
    plainToastRow('sessionIdCopied', (_notice, t) => ({
      text: t('toast.sessionIdCopied'),
      tone: 'success',
    })),
    plainToastRow('sessionIdCopyFailed', (_notice, t) => ({
      text: t('toast.sessionIdCopyFailed'),
      tone: 'warning',
    })),
    plainToastRow('pinFailed', (_notice, t) => ({
      text: t('toast.pinFailed'),
      tone: 'warning',
    })),
    plainToastRow('unpinFailed', (_notice, t) => ({
      text: t('toast.unpinFailed'),
      tone: 'warning',
    })),
    plainToastRow('archivedNotOpenable', (_notice, t) => ({
      text: t('toast.archivedNotOpenable'),
      tone: 'warning',
    })),
    plainToastRow('defaultWorkspaceFailed', (_notice, t) => ({
      text: t('defaultWorkspace.failed'),
      tone: 'warning',
    })),
    plainToastRow('shortcutForkFailed', (notice, t) => ({
      text: t(notice.reason === 'unavailable' ? 'shortcut.noCompletedTurn' : 'shortcut.forkFailed'),
      tone: 'plain',
    })),
    plainToastRow('createFailed', (notice, t) => ({
      text: t('toast.createFailed', { message: notice.message }),
      tone: 'warning',
      holdMs: 6000,
    })),
    plainToastRow('forkRequiresOpen', (notice, t, dismiss) => ({
      text: t('toast.forkRequiresOpen'),
      tone: 'warning',
      holdMs: 6000,
      actions: [{
        label: t('toast.openForkSource'),
        onClick: () => {
          dismiss()
          actions.openForkSource(notice.sessionId)
        },
      }],
    })),
  ]

  ctx.slots.registerFactory({
    name: 'workspace.toast.content',
    scope: 'root',
  }, WorkspaceToast)

  ctx.slots.inject('workspace.toast', function* () {
    for (const { key, inject } of plainToasts) {
      yield ctx.slots.register({
        name: 'workspace.toast',
        key,
        locale: 'workspace',
        inject,
      }, toastEntry)
    }

    for (const { key, text } of ARCHIVE_TOASTS) {
      yield ctx.slots.register({
        name: 'workspace.toast',
        key,
        locale: 'workspace',
        store: viewStore,
        inject: () => ({
          display: (notice: ToastNotice<ArchiveToastKind>, t: Translate, dismiss: () => void): ToastDisplay => ({
            text: t(text),
            tone: 'success',
            holdMs: 6000,
            actions: [{
              label: t('toast.archivedUndo'),
              onClick: () => {
                dismiss()
                actions.undoArchive(notice.sessionId)
              },
            }],
          }),
          filterAction: archiveFilterAction,
        }),
      }, archiveToastEntry)
    }
  })
}

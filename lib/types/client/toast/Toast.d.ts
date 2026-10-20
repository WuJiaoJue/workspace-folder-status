import type { ToastDisplay, ToastOccurrence } from '../contract/toast.ts';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
type Translate = PropsLocale<'workspace'>['t'];
/** Shape read by the plain keyed entries. */
interface ToastEntryShape {
    dismissToast: () => void;
    display: (notice: never, t: Translate, dismiss: () => void) => ToastDisplay;
    t: Translate;
    renderFactorySlot: (name: 'workspace.toast.content', props: ToastOccurrence) => unknown;
    seq: number;
    kind: string;
}
/** Shape read by the archive keyed entries. */
interface ArchiveToastShape extends ToastEntryShape {
    sessionId: SessionId;
    useStore: <T>(selector: (state: {
        archivedFilter?: 'default' | 'show' | 'only';
    }) => T) => T;
    filterAction: (t: Translate, dismiss: () => void) => NonNullable<ToastDisplay['actions']>[number];
}
/**
 * Render one notice using the shared Factory.
 * @param props - keyed payload, injected display mapping, locale, and Factory renderer.
 * @returns the shared Toast occurrence.
 */
export declare function ToastEntry(props: ToastEntryShape): unknown;
/**
 * Keep the archive filter action reactive without subscribing unrelated notices.
 * @param props - archive notice, display mapping, and the existing viewing store.
 * @returns the shared Toast occurrence with its current actions.
 */
export declare function ArchiveToastEntry(props: ArchiveToastShape): unknown;
/**
 * Present plain display data with the shared primitive's timing and portal.
 * @param props - localized display fields, display identity, and dismissal.
 * @returns one Toast, remounted only for a new display identity.
 */
export declare function WorkspaceToast({ seq, text, tone, holdMs, actions, onDone }: ToastOccurrence): import("react").JSX.Element;
export {};
//# sourceMappingURL=Toast.d.ts.map
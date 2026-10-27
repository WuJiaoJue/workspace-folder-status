import type { WorkspaceBrowserProps } from '../contract/slots.ts';
import type { ArchivedFilter, SessionOrderBy } from '../tree.ts';
import type { SessionGroupBy } from '../stores.ts';
/** Grouping, ordering, and archived-filter menu; own open state so it resets with the wide chrome. */
export declare function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }: {
    groupBy: SessionGroupBy;
    orderBy: SessionOrderBy;
    archivedFilter: ArchivedFilter;
    onGroupPick: (mode: SessionGroupBy) => void;
    onOrderPick: (mode: SessionOrderBy) => void;
    onArchivedFilterPick: (filter: ArchivedFilter) => void;
    t: WorkspaceBrowserProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=ViewOptionsMenu.d.ts.map
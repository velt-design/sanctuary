'use client';

import {Search} from 'lucide-react';
import {PORTAL_SEARCH_MAX_LENGTH} from '@/lib/search/portalSearchContract';
import {useOptionalPortalQueryClient} from '@/lib/react-query/PortalQueryClientContext';
import GlobalPortalSearchSurface from './GlobalPortalSearchSurface';
import GlobalPortalSearchRead from './GlobalPortalSearchRead';
import styles from './GlobalPortalSearch.module.css';

function StaticGlobalPortalSearch() {
  return (
    <div
      className={styles.root}
      data-global-portal-search="true"
      data-global-search-state="idle"
      data-global-search-query=""
      data-global-search-refreshing="false"
    >
      <div className={styles.inputShell}>
        <Search aria-hidden="true" />
        <input
          type="search"
          maxLength={PORTAL_SEARCH_MAX_LENGTH}
          placeholder="Jump to a project or contact…"
          aria-label="Jump to a project or contact"
          aria-expanded="false"
          aria-haspopup="listbox"
          role="combobox"
          readOnly
        />
        <kbd>Ctrl K</kbd>
      </div>
    </div>
  );
}


/** Existing nonframe entry keeps its private reader; selected frames use their guarded registration. */
export default function GlobalPortalSearch({ shortcutEnabled = true }: { shortcutEnabled?: boolean }) {
  const queryClient=useOptionalPortalQueryClient();
  if(!queryClient)return <StaticGlobalPortalSearch/>;
  return <GlobalPortalSearchSurface reader={GlobalPortalSearchRead} shortcutEnabled={shortcutEnabled}/>;
}

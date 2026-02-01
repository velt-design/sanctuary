'use client';

import { useEffect, useMemo, useState } from 'react';
import MaterialsClient from '../admin/costs/materials/MaterialsClient';
import ActionsClient from '../admin/costs/actions/ActionsClient';
import OverheadsClient from '../admin/costs/overheads/OverheadsClient';
import styles from './pricebook.module.css';

type MaterialsItem = Parameters<typeof MaterialsClient>[0]['items'];
type ActionsItem = Parameters<typeof ActionsClient>[0]['actions'];

type PricebookHubProps = {
  loadedFrom: string;
  materialsSourceFile: string;
  actionsSourceFile: string;
  overheadsSourceFile: string;
  materials: MaterialsItem;
  actions: ActionsItem;
  overheads: unknown;
  materialOverrides: Record<string, number>;
  actionOverrides: Record<string, number>;
};

type TabKey = 'materials' | 'actions' | 'overheads';

const TAB_KEYS: TabKey[] = ['materials', 'actions', 'overheads'];

function normalizeHash(hash: string): TabKey {
  const raw = hash.replace('#', '').trim().toLowerCase();
  if (raw === 'actions') return 'actions';
  if (raw === 'overheads') return 'overheads';
  return 'materials';
}

export default function PricebookHub(props: PricebookHubProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('materials');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initial = normalizeHash(window.location.hash);
    setActiveTab(initial);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}#materials`);
    }

    const handler = () => {
      setActiveTab(normalizeHash(window.location.hash));
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const tabs = useMemo(
    () => [
      { key: 'materials' as const, label: 'Materials' },
      { key: 'actions' as const, label: 'Actions' },
      { key: 'overheads' as const, label: 'Overheads' },
    ],
    [],
  );

  const onSelect = (tab: TabKey) => {
    if (typeof window === 'undefined') return;
    window.history.pushState(null, '', `${window.location.pathname}#${tab}`);
    setActiveTab(tab);
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist" aria-label="Pricebook tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
            onClick={() => onSelect(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`pricebook-panel-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id="pricebook-panel-materials"
        role="tabpanel"
        className={activeTab === 'materials' ? styles.panel : styles.panelHidden}
      >
        <MaterialsClient
          loadedFrom={props.loadedFrom}
          sourceFile={props.materialsSourceFile}
          items={props.materials}
          overrides={props.materialOverrides}
          isAdmin
          showNav={false}
        />
      </div>

      <div
        id="pricebook-panel-actions"
        role="tabpanel"
        className={activeTab === 'actions' ? styles.panel : styles.panelHidden}
      >
        <ActionsClient
          loadedFrom={props.loadedFrom}
          sourceFile={props.actionsSourceFile}
          actions={props.actions}
          overrides={props.actionOverrides}
          isAdmin
          showNav={false}
        />
      </div>

      <div
        id="pricebook-panel-overheads"
        role="tabpanel"
        className={activeTab === 'overheads' ? styles.panel : styles.panelHidden}
      >
        <OverheadsClient
          loadedFrom={props.loadedFrom}
          sourceFile={props.overheadsSourceFile}
          overheads={props.overheads}
          showNav={false}
        />
      </div>
    </div>
  );
}

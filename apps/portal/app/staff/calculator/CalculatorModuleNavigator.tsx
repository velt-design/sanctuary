'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import ConfirmDialog from './ConfirmDialog';
import type {
  CalculatorModuleNavigatorItem,
  CalculatorModuleNavigatorModel,
} from './calculatorModuleNavigation';
import type { CalculatorPergola } from '@/lib/types/calculator';
import styles from './CalculatorModuleNavigator.module.css';

type CalculatorModuleNavigatorProps = {
  model: CalculatorModuleNavigatorModel;
  pergolas: CalculatorPergola[];
  moduleCount: number;
  onSelectModule: (moduleIndex: number) => void;
  onAddModule: (pergolaId: string) => void;
  onAddPergola: () => void;
  onDuplicateModule: (moduleIndex: number) => void;
  onMoveModule: (moduleIndex: number, targetPergolaId: string) => void;
  onRemoveModule: (moduleIndex: number) => void;
};

export default function CalculatorModuleNavigator({
  model,
  pergolas,
  moduleCount,
  onSelectModule,
  onAddModule,
  onAddPergola,
  onDuplicateModule,
  onMoveModule,
  onRemoveModule,
}: CalculatorModuleNavigatorProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [movingModuleIndex, setMovingModuleIndex] = useState<number | null>(null);
  const [moveTargetPergolaId, setMoveTargetPergolaId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<CalculatorModuleNavigatorItem | null>(null);

  const activeItem = model.items.find((item) => item.isActive) ?? model.items[0] ?? null;
  const removeTargetGroup = removeTarget
    ? model.groups.find((group) => group.pergolaId === removeTarget.pergolaId) ?? null
    : null;
  const removePrunesPergola = Boolean(removeTargetGroup && removeTargetGroup.items.length === 1);

  const movingItem = movingModuleIndex === null ? null : model.items[movingModuleIndex] ?? null;
  const moveTargets = useMemo(
    () => pergolas.filter((pergola) => pergola.id !== movingItem?.pergolaId),
    [movingItem?.pergolaId, pergolas],
  );

  const closeMobile = () => {
    setMobileOpen(false);
    setMovingModuleIndex(null);
    setMoveTargetPergolaId('');
  };

  const selectModule = (moduleIndex: number, closeAfter: boolean) => {
    onSelectModule(moduleIndex);
    setMovingModuleIndex(null);
    setMoveTargetPergolaId('');
    if (closeAfter) setMobileOpen(false);
  };

  const addModule = (pergolaId: string, closeAfter: boolean) => {
    onAddModule(pergolaId);
    if (closeAfter) setMobileOpen(false);
  };

  const duplicateModule = (moduleIndex: number, closeAfter: boolean) => {
    onDuplicateModule(moduleIndex);
    if (closeAfter) setMobileOpen(false);
  };

  const addPergola = (closeAfter: boolean) => {
    onAddPergola();
    if (closeAfter) setMobileOpen(false);
  };

  const beginMove = (item: CalculatorModuleNavigatorItem) => {
    const firstTarget = pergolas.find((pergola) => pergola.id !== item.pergolaId);
    setMovingModuleIndex(item.moduleIndex);
    setMoveTargetPergolaId(firstTarget?.id ?? '');
  };

  const confirmMove = (closeAfter: boolean) => {
    if (movingModuleIndex === null || !moveTargetPergolaId) return;
    onMoveModule(movingModuleIndex, moveTargetPergolaId);
    setMovingModuleIndex(null);
    setMoveTargetPergolaId('');
    if (closeAfter) setMobileOpen(false);
  };

  const requestRemove = (item: CalculatorModuleNavigatorItem, closeAfter: boolean) => {
    setRemoveTarget(item);
    if (closeAfter) setMobileOpen(false);
  };

  const renderNavigator = (surface: 'desktop' | 'mobile') => {
    const closeAfter = surface === 'mobile';
    return (
      <nav className={styles.navigator} aria-label="Pergolas and modules">
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Modules</h2>
            <p className={styles.summary}>
              {`${moduleCount} module${moduleCount === 1 ? '' : 's'} across ${model.groups.length} pergola${model.groups.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className={styles.addPergolaButton} onClick={() => addPergola(closeAfter)}>
            Add pergola
          </button>
        </div>

        <div className={styles.groups}>
          {model.groups.map((group) => (
            <section key={group.pergolaId} className={styles.group} aria-labelledby={`${surface}-${group.pergolaId}-heading`}>
              <div className={styles.groupHeader}>
                <h3 id={`${surface}-${group.pergolaId}-heading`} className={styles.groupTitle}>{group.label}</h3>
                <button
                  type="button"
                  className={styles.addModuleButton}
                  aria-label={`Add module to ${group.label}`}
                  onClick={() => addModule(group.pergolaId, closeAfter)}
                >
                  + Add module
                </button>
              </div>

              {group.items.length ? (
                <ul className={styles.moduleList}>
                  {group.items.map((item) => {
                    const moveExpanded = movingModuleIndex === item.moduleIndex;
                    const otherPergolas = pergolas.filter((pergola) => pergola.id !== item.pergolaId);
                    return (
                      <li key={item.key} className={item.isActive ? styles.moduleItemActive : styles.moduleItem}>
                        <button
                          type="button"
                          className={styles.moduleSelect}
                          aria-current={item.isActive ? 'true' : undefined}
                          onClick={() => selectModule(item.moduleIndex, closeAfter)}
                        >
                          <span className={styles.moduleSelectTop}>
                            <strong>{item.label}</strong>
                            {item.issueCount ? (
                              <span className={styles.issueBadge}>
                                {`${item.issueCount} issue${item.issueCount === 1 ? '' : 's'}`}
                              </span>
                            ) : (
                              <span className={styles.readyBadge}>Complete</span>
                            )}
                          </span>
                          <span className={styles.moduleMeta}>{`${item.styleLabel} · ${item.dimensionsLabel}`}</span>
                        </button>

                        {item.isActive ? (
                          <div className={styles.moduleActions} aria-label={`Actions for ${item.label}`}>
                            <button type="button" onClick={() => duplicateModule(item.moduleIndex, closeAfter)}>Duplicate</button>
                            <button
                              type="button"
                              aria-expanded={moveExpanded}
                              onClick={() => (moveExpanded ? setMovingModuleIndex(null) : beginMove(item))}
                              disabled={otherPergolas.length === 0}
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => requestRemove(item, closeAfter)}
                              disabled={moduleCount <= 1}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}

                        {item.isActive && moveExpanded ? (
                          <div className={styles.movePanel}>
                            <label htmlFor={`${surface}-move-module-${item.moduleIndex}`}>Move to pergola</label>
                            <select
                              id={`${surface}-move-module-${item.moduleIndex}`}
                              value={moveTargetPergolaId}
                              onChange={(event) => setMoveTargetPergolaId(event.target.value)}
                            >
                              {otherPergolas.map((pergola) => (
                                <option key={pergola.id} value={pergola.id}>{pergola.label}</option>
                              ))}
                            </select>
                            <div className={styles.moveActions}>
                              <button type="button" onClick={() => confirmMove(closeAfter)} disabled={!moveTargetPergolaId}>Move module</button>
                              <button type="button" onClick={() => setMovingModuleIndex(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.emptyGroup}>No modules in this pergola.</p>
              )}
            </section>
          ))}
        </div>
      </nav>
    );
  };

  return (
    <>
      <aside className={styles.desktopRail} aria-label="Module navigator">
        {renderNavigator('desktop')}
      </aside>

      <button
        type="button"
        className={styles.mobileLauncher}
        onClick={() => setMobileOpen(true)}
        aria-haspopup="dialog"
      >
        <span>
          <strong>{activeItem?.label ?? 'Modules'}</strong>
          <span>{activeItem ? `${activeItem.styleLabel} · ${activeItem.dimensionsLabel}` : 'Choose a module'}</span>
        </span>
        <span className={styles.mobileLauncherCount}>
          {model.totalIssueCount ? `${model.totalIssueCount} issues` : `${moduleCount} modules`}
        </span>
      </button>

      <Modal
        open={mobileOpen}
        onClose={closeMobile}
        ariaLabel="Module navigator"
        maxWidthPx={560}
        overlayClassName={styles.mobileOverlay}
        panelClassName={styles.mobilePanel}
      >
        <div className={styles.mobileHeader}>
          <strong>Choose module</strong>
          <button type="button" onClick={closeMobile}>Close</button>
        </div>
        {renderNavigator('mobile')}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove module?"
        body={
          removeTarget
            ? `Remove ${removeTarget.label}? This removes its configuration from this browser draft. It will not update the estimate until you use Save.${removePrunesPergola ? ` ${removeTarget.pergolaLabel} will also be removed because it has no other modules.` : ''}`
            : ''
        }
        confirmLabel="Remove module"
        danger
        onConfirm={() => {
          if (removeTarget) onRemoveModule(removeTarget.moduleIndex);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
}

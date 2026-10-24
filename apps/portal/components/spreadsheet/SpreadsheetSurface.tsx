'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import StaffPageHeader from '../layout/StaffPageHeaderSurface';
import {useSpreadsheetSurface,useSpreadsheetSurfaceRead} from './SpreadsheetSurfaceContext';
import styles from './spreadsheet.module.css';
export default function SpreadsheetSurface({toolbar,header,loading=true,hasError=false,loadingMessage,errorMessage,emptyMessage,embedded=false,zoomDockPlacement='sheet'}:{
  toolbar:ReactNode;header?:ReactNode;loading?:boolean;hasError?:boolean;loadingMessage:string;errorMessage:string;emptyMessage:string;embedded?:boolean;zoomDockPlacement?:'sheet'|'viewport';
}){
  const surface=useSpreadsheetSurface()!;const {viewport:shell,config}=surface;const read=useSpreadsheetSurfaceRead();
  toolbar=read?.toolbar??toolbar;
  const useViewportZoomDock=zoomDockPlacement==='viewport';
  const sectionRef = useRef<HTMLElement | null>(null);
  const [viewportZoomDockVisible, setViewportZoomDockVisible] = useState(zoomDockPlacement !== 'viewport');

  useEffect(() => {
    if (!useViewportZoomDock) {
      setViewportZoomDockVisible(true);
      return;
    }

    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setViewportZoomDockVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setViewportZoomDockVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: [0, 0.05, 0.1] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [useViewportZoomDock]);

  return (
    <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ''}`} data-ui-foundation-consumer="spreadsheet">
      {embedded ? null : header ?? <StaffPageHeader title={config.title} />}

      <div className={styles.stack}>
        <section ref={sectionRef} className={styles.section}>
          {toolbar}

            <div ref={shell.sheetViewportRef} className={styles.sheetViewport} {...shell.viewportProps}>
              <div ref={shell.gridRef} className={styles.tableScroller} style={shell.sheetVars} tabIndex={0} onKeyDown={read?.onKeyDown}>
                <table className={styles.table}>
                  <colgroup>
                    <col style={{ width: shell.rowNumberWidthPx }} />
                    {shell.displayColumns.map((column) => (
                      <col key={column.kind === 'actual' ? column.column.key : column.key} style={{ width: shell.scaledPixels(column.widthPx) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className={styles.letterRow}>
                      <th className={`${styles.cornerCell} ${styles.rowNumberBandCell}`} />
                      {shell.displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_letter` : `${column.key}_letter`}
                          className={`${styles.letterCell} ${column.kind === 'actual' && column.column.frozen ? styles.frozenLetterCell : ''}`}
                          style={column.kind === 'actual' ? shell.cellStyle(column.column, column.actualIndex) : undefined}
                          scope="col"
                        >
                          {column.letter}
                        </th>
                      ))}
                    </tr>
                    <tr className={styles.labelsRow}>
                      <th className={`${styles.rowNumberHeaderCell} ${styles.rowNumberBandCell}`} />
                      {shell.displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_header` : `${column.key}_header`}
                          className={
                            column.kind === 'actual'
                              ? `${styles.headerCell} ${column.column.frozen ? styles.frozenHeaderCell : ''}`
                              : styles.fillerHeaderCell
                          }
                          style={column.kind === 'actual' ? shell.cellStyle(column.column, column.actualIndex) : undefined}
                          scope="col"
                        >
                          {column.kind === 'actual' ? (
                            <>
                              <span className={styles.headerLabel}>{column.column.label}</span>
                              {column.column.sourceLabel ? <span className={styles.headerSource}>{column.column.sourceLabel}</span> : null}
                            </>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody ref={surface.setBody}>{!read?<tr><td colSpan={shell.displayColumns.length+1} className={styles.emptyTable} role={loading?'status':hasError?'alert':undefined}>{loading?loadingMessage:hasError?errorMessage:emptyMessage}</td></tr>:null}</tbody>
                </table>
              </div>
              <div
                className={`${styles.zoomDockLayer} ${useViewportZoomDock ? styles.zoomDockLayerViewport : ''}`}
                data-active={shell.zoom.dockActive ? 'true' : 'false'}
                data-visible={viewportZoomDockVisible ? 'true' : 'false'}
              >
                <div className={`${styles.zoomDock} ${useViewportZoomDock ? styles.zoomDockViewport : ''}`} aria-label="Sheet zoom controls">
                  <button type="button" className={styles.zoomButton} onClick={() => shell.zoom.stepBy(-1)} aria-label="Zoom out">
                    -
                  </button>
                  <input
                    className={styles.zoomSlider}
                    type="range"
                    min={shell.zoom.min}
                    max={shell.zoom.max}
                    step={shell.zoom.step}
                    value={shell.zoom.value}
                    onChange={(event) => shell.zoom.setValue(Number.parseInt(event.target.value, 10))}
                    aria-label="Sheet zoom"
                  />
                  <button type="button" className={styles.zoomButton} onClick={() => shell.zoom.stepBy(1)} aria-label="Zoom in">
                    +
                  </button>
                  <select
                    className={styles.zoomPreset}
                    value={shell.zoom.presetValue}
                    onChange={(event) => shell.zoom.setValue(Number.parseInt(event.target.value, 10))}
                    aria-label="Zoom preset"
                  >
                    {shell.zoom.presets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}%
                      </option>
                    ))}
                    {!shell.zoom.presets.includes(shell.zoom.value as (typeof shell.zoom.presets)[number]) ? (
                      <option value={shell.zoom.value}>{shell.zoom.value}%</option>
                    ) : null}
                  </select>
                  <button type="button" className={styles.fitButton} onClick={shell.zoom.fitVisibleColumns}>
                    Fit visible columns
                  </button>
                  <span className={styles.zoomValue}>{shell.zoom.value}%</span>
                </div>
              </div>
            </div>
        </section>
      </div>
    </main>
  );
}

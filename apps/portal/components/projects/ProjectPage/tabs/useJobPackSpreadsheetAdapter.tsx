'use client';

import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpreadsheetAdapter } from '@/components/spreadsheet/types';
import spreadsheetStyles from '@/components/spreadsheet/spreadsheet.module.css';
import type { EstimateDetail } from '@/lib/estimates/types';
import {jobPackSheetPresentation} from '@/lib/jobPacks/sheetPresentation';
import { normalizePowdercoatProfile } from '@/lib/jobPacks/powdercoating';
import type {
  JobPackPowdercoatOverrideState,
  JobPackPowdercoatSheetResponse,
  JobPackPowdercoatStoredRow,
  JobPackPowdercoatUpdateResponse,
} from '@/lib/jobPacks/types';
import {
  DEFAULT_JOB_PACK_SHEET,
  JOB_PACK_SHEETS,
  applyPowdercoatEditToModel,
  buildWorkbook,
  coerceJobPackSheet,
  emptyPowdercoatSheetResponse,
  formatDate,
  formatEstimateStatus,
  formatMoney,
  getPowdercoatValidationMessage,
  resolveVisibleJobPackColumns,
  resolveVisibleJobPackDefaultActiveKey,
  type JobPackCellKey,
  type JobPackEditableCellKey,
  type JobPackRow,
  type JobPackSheetKey,
} from '@/lib/jobPacks/workbook';
import { jobPackPowdercoatingQueryOptions } from '@/lib/queries/jobPackPowdercoating';
import { ApiError, apiJson } from '@/lib/repo/apiClient';

function parseFilenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadCurrentSheetPdf(args: {
  estimateId: string;
  sheet: JobPackSheetKey;
  showNotesColumn: boolean;
  fallbackFilename: string;
}): Promise<void> {
  const url = `/api/staff/v1/job-packs/pdf?estimateId=${encodeURIComponent(args.estimateId)}&sheet=${encodeURIComponent(args.sheet)}&showNotes=${args.showNotesColumn ? '1' : '0'}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let message = `Failed to download PDF (${res.status})`;
    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('application/json')) {
      const body = await res.json().catch(() => null);
      if (typeof body?.error === 'string' && body.error.trim()) message = body.error.trim();
    } else {
      const text = await res.text().catch(() => '');
      if (text.trim()) message = text.trim();
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = parseFilenameFromDisposition(res.headers.get('content-disposition')) ?? args.fallbackFilename;
  downloadBlob(filename, blob);
}

function SheetToolbar({
  detail,
  sheet,
  trueCostExGst,
  estimateTotal,
  onSheetChange,
  onBackToList,
  onOpenEstimate,
  showHideNotesToggle,
  showNotesColumn,
  onShowNotesColumnChange,
  warningMessage,pending=false,readOnly=false,onRetry,
}: {
  onRetry?:()=>void;pending?:boolean;readOnly?:boolean;detail: EstimateDetail|null;
  sheet: JobPackSheetKey;
  trueCostExGst: number|null;
  estimateTotal: number | null | undefined;
  onSheetChange: (sheet: JobPackSheetKey) => void;
  onBackToList: () => void;
  onOpenEstimate: () => void;
  showHideNotesToggle: boolean;
  showNotesColumn: boolean;
  onShowNotesColumnChange: (checked: boolean) => void;
  warningMessage: string | null;
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (isDownloadingPdf||!detail||readOnly) return;
    setIsDownloadingPdf(true);
    setDownloadError(null);
    try {
      await downloadCurrentSheetPdf({
        estimateId: detail.id,
        sheet,
        showNotesColumn,
        fallbackFilename: `job-pack-${detail.versionLabel}-${sheet}.pdf`,
      });
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [detail,readOnly,isDownloadingPdf, sheet, showNotesColumn]);

  return (
    <div className={spreadsheetStyles.toolbar}>
      <div className={spreadsheetStyles.toolbarPrimary}>
        <button type="button" className={spreadsheetStyles.toolbarAction} onClick={onBackToList}>
          Back to job packs
        </button>

        <select
          className={spreadsheetStyles.toolbarSelect}
          value={sheet}
          aria-label="Job pack sheet"
          onChange={(event) => onSheetChange(coerceJobPackSheet(event.target.value))}
        >
          {JOB_PACK_SHEETS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>

        {showHideNotesToggle ? (
          <label className={spreadsheetStyles.toolbarToggle}>
            <input
              type="checkbox"
              checked={showNotesColumn}
              onChange={(event) => onShowNotesColumnChange(event.target.checked)}
            />
            <span>Show notes</span>
          </label>
        ) : null}
      </div>

      <div className={spreadsheetStyles.toolbarSecondary}>
        <div className={spreadsheetStyles.toolbarMeta}>
          <span>{detail?.versionLabel??(pending?'Reading version…':'Version unavailable')}</span>
          <span>{detail?formatDate(detail.createdAt):pending?'Reading date…':'Date unavailable'}</span>
          <span>{detail?formatEstimateStatus(detail.status):pending?'Reading status…':'Status unavailable'}</span>
          {estimateTotal !== null && estimateTotal !== undefined ? <span>{`Estimate ${formatMoney(estimateTotal)}`}</span> : null}
          <span>{trueCostExGst===null?pending?'True cost Reading…':'True cost unavailable':`True cost ${formatMoney(trueCostExGst)}`}</span>
        </div>

        <button type="button" className={spreadsheetStyles.toolbarAction} disabled={isDownloadingPdf||!detail||readOnly} onClick={handleDownloadPdf}>
          {isDownloadingPdf ? 'Downloading PDF...' : 'Download PDF'}
        </button>

        <button type="button" className={spreadsheetStyles.toolbarAction} disabled={!detail} onClick={()=>{if(detail)onOpenEstimate();}}>
          Open estimate
        </button>
      </div>

      {warningMessage ? (
        <div className={spreadsheetStyles.toolbarWarning} role="status" aria-live="polite">
          {warningMessage} {!pending&&onRetry&&<button type="button" className={spreadsheetStyles.toolbarAction} onClick={onRetry}>Retry job pack</button>}
        </div>
      ) : null}

      {downloadError ? (
        <div className={spreadsheetStyles.toolbarWarning} role="alert">
          {downloadError}
        </div>
      ) : null}
    </div>
  );
}

export { coerceJobPackSheet, type JobPackSheetKey };

export function useJobPackSpreadsheetAdapter({
  hostKey,
  readOnly: sourceReadOnly = false,
  detail,pending=false,error=null,refreshing=false,onRetry,
  sheet,
  onSheetChange,
  onBackToList,
  onOpenEstimate,
  showNotesColumn,
  onShowNotesColumnChange,
}: {
  readOnly?: boolean;
  onRetry?:()=>void;pending?:boolean;error?:string|null;refreshing?:boolean;hostKey: string;
  detail: EstimateDetail | null;
  sheet: JobPackSheetKey;
  onSheetChange: (sheet: JobPackSheetKey) => void;
  onBackToList: () => void;
  onOpenEstimate: () => void;
  showNotesColumn: boolean;
  onShowNotesColumnChange: (checked: boolean) => void;
}): SpreadsheetAdapter<JobPackRow, JobPackCellKey, JobPackEditableCellKey, string, JobPackPowdercoatStoredRow[]> | null {
  const queryClient = useQueryClient();
  const powdercoatQueryOptions = useMemo(
    () => jobPackPowdercoatingQueryOptions(hostKey, detail?.id ?? '__pending__'),
    [detail?.id, hostKey],
  );
  const powdercoatQuery = useQuery({
    ...powdercoatQueryOptions,
    enabled: Boolean(detail?.id),
  });

  const powdercoatData = powdercoatQuery.data ?? emptyPowdercoatSheetResponse();
  const powdercoatWarningMessage = powdercoatQuery.isError
    ? powdercoatQuery.error instanceof Error
      ? powdercoatQuery.error.message
      : 'Powdercoating rows are available, but profile options could not be loaded.'
    : powdercoatData.warningMessage;

  const workbook = useMemo(() => {
    if (!detail) return null;
    try {
      return buildWorkbook(detail, powdercoatData.overrides, powdercoatData.options);
    } catch {
      return null;
    }
  }, [detail, powdercoatData.options, powdercoatData.overrides]);

  const readPowdercoatResponse = useCallback(
    () => queryClient.getQueryData<JobPackPowdercoatSheetResponse>(powdercoatQueryOptions.queryKey) ?? powdercoatData,
    [powdercoatData, powdercoatQueryOptions.queryKey, queryClient],
  );

  const setPowdercoatResponse = useCallback(
    (next: JobPackPowdercoatSheetResponse) => {
      queryClient.setQueryData<JobPackPowdercoatSheetResponse>(powdercoatQueryOptions.queryKey, next);
    },
    [powdercoatQueryOptions.queryKey, queryClient],
  );

  const setDisplayedPowdercoatRows = useCallback(
    (rows: JobPackPowdercoatStoredRow[]) => {
      const latest = readPowdercoatResponse();
      setPowdercoatResponse({
        ...latest,
        overrides: {
          ...latest.overrides,
          rows,
        },
      });
    },
    [readPowdercoatResponse, setPowdercoatResponse],
  );

  return useMemo(() => {
    const needsPowdercoat=sheet==='materials'||sheet==='powdercoating-order';
    const denied=powdercoatQuery.error instanceof ApiError&&[401,403,404].includes(powdercoatQuery.error.status);
    const powdercoatReady=Boolean(powdercoatQuery.data&&!powdercoatQuery.isError&&!powdercoatQuery.isFetching);
    const readOnly=sourceReadOnly||refreshing||Boolean(error)||!powdercoatReady;
    if (!detail || !workbook || (needsPowdercoat&&(!powdercoatQuery.data||denied))) {
      const definition={title:'Job Pack',...jobPackSheetPresentation(sheet),groups:[],defaultActiveKey:'a' as const,emptyMessage:'No job pack records.'};
      const reading=pending||Boolean(detail&&needsPowdercoat&&(powdercoatQuery.isPending||powdercoatQuery.isFetching));
      return {
       title:detail?`Job Pack ${detail.versionLabel}`:'Job Pack',
       toolbar:<SheetToolbar detail={detail} sheet={sheet} trueCostExGst={null} estimateTotal={detail?.summary.total} onSheetChange={onSheetChange} onBackToList={onBackToList} onOpenEstimate={onOpenEstimate} showHideNotesToggle={Boolean(definition.notesColumnKey)} showNotesColumn={showNotesColumn} onShowNotesColumnChange={onShowNotesColumnChange} warningMessage={reading?null:error??powdercoatWarningMessage??'Job pack records unavailable.'} onRetry={()=>{if(powdercoatQuery.isError){if(!powdercoatQuery.isFetching)void powdercoatQuery.refetch();}else onRetry?.();}} pending={reading} readOnly/>,
       columns:resolveVisibleJobPackColumns(definition,showNotesColumn),allRows:[],rowNumberRows:[],groups:[],zoomStorageKey:`sp_job_pack_${sheet}_zoom_v1`,defaultActiveKey:resolveVisibleJobPackDefaultActiveKey(definition,showNotesColumn),loading:reading,hasError:!reading,
       loadingMessage:'Reading verified job pack…',errorMessage:error??'Job pack source records unavailable. Retry the read.',emptyMessage:definition.emptyMessage,
       getRowId:row=>row.id,isEditableKey:(_key):_key is JobPackEditableCellKey=>false,getRowClassName:()=>'',getCellClassName:()=>spreadsheetStyles.bodyCell,formatCellValue:()=>'',renderCellContent:()=>null,getEditorValue:()=>'',renderEditor:()=>null,onCellActivated:()=> 'noop' as const,
      };
    }

    const activeSheet = workbook.sheets[sheet] ?? workbook.sheets[DEFAULT_JOB_PACK_SHEET];
    const visibleColumns = resolveVisibleJobPackColumns(activeSheet, showNotesColumn);
    const defaultActiveKey = resolveVisibleJobPackDefaultActiveKey(activeSheet, showNotesColumn);
    const allRows = activeSheet.groups.flatMap((group) => group.rows);

    return {
      title: `Job Pack ${detail.versionLabel}`,
      toolbar: (
        <SheetToolbar
          detail={detail}
          readOnly={sourceReadOnly||refreshing||Boolean(error)||(needsPowdercoat&&!powdercoatReady)}
          sheet={sheet}
          trueCostExGst={workbook.jobPack.summary.totals.trueCostExGst}
          estimateTotal={detail.summary.total ?? null}
          onSheetChange={onSheetChange}
          onBackToList={onBackToList}
          onOpenEstimate={onOpenEstimate}
          showHideNotesToggle={Boolean(activeSheet.notesColumnKey)}
          showNotesColumn={showNotesColumn}
          onShowNotesColumnChange={onShowNotesColumnChange}
          warningMessage={error??(sheet === 'powdercoating-order'||needsPowdercoat ? powdercoatWarningMessage : null)}
          onRetry={()=>{if(powdercoatQuery.isError){if(!powdercoatQuery.isFetching)void powdercoatQuery.refetch();}else onRetry?.();}}
        />
      ),
      columns: visibleColumns,
      allRows,
      rowNumberRows: allRows,
      groups: activeSheet.groups,
      zoomStorageKey: `sp_job_pack_${sheet}_zoom_v1`,
      defaultActiveKey,
      loading: false,
      hasError: Boolean(error),
      loadingMessage: 'Loading job pack...',
      errorMessage: error??'Failed to load the job pack workbook.',
      emptyMessage: activeSheet.emptyMessage,
      getRowId: (row) => row.id,
      isEditableKey: (key): key is JobPackEditableCellKey => !readOnly&&(key === 'a' || key === 'c' || key === 'd'),
      getRowClassName: () => '',
      getCellClassName: ({ row, column, active, editing, saving, conflict }) => {
        const classes = [spreadsheetStyles.bodyCell];
        if (column.frozen) classes.push(spreadsheetStyles.frozenCell);
        if (
          !readOnly&&sheet === 'powdercoating-order' &&
          row.powdercoat &&
          (column.key === 'a' || column.key === 'd' || (column.key === 'c' && row.powdercoat.stockLengthOptionsM.length > 1))
        ) {
          classes.push(spreadsheetStyles.editableCell);
        }
        if (active) classes.push(spreadsheetStyles.activeCell);
        if (editing) classes.push(spreadsheetStyles.editingCell);
        if (saving) classes.push(spreadsheetStyles.savingCell);
        if (conflict) classes.push(spreadsheetStyles.conflictCell);
        return classes.join(' ');
      },
      formatCellValue: (row, key) => row.cells[key] ?? '',
      renderCellContent: ({ row, column, text }) => {
        if (row.powdercoat?.origin === 'draft') {
          if (column.key === 'a') return <span className={spreadsheetStyles.muted}>Select profile...</span>;
          return '';
        }
        if (row.tone === 'total') return <strong>{text || '-'}</strong>;
        if (row.tone === 'muted') return <span className={spreadsheetStyles.muted}>{text || '-'}</span>;
        return text || '';
      },
      getEditorValue: (row, key) => {
        const powdercoat = row.powdercoat;
        if (!powdercoat) return '';
        if (key === 'a') return powdercoat.storedRow.profile;
        if (key === 'c') return typeof powdercoat.storedRow.stockLengthM === 'number' ? String(powdercoat.storedRow.stockLengthM) : '';
        if (key === 'd') return String(powdercoat.storedRow.qty);
        return '';
      },
      renderEditor: ({ row, key, value, setValue, commit, cancel, commitToNeighbor, editorRef, onBlur }) => {
        const powdercoat = row.powdercoat;
        if (!powdercoat) return null;

        const onKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
          if (event.key === 'Escape') {
            cancel();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            await commitToNeighbor(event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            await commit();
          }
        };

        if (key === 'a') {
          return (
            <select
              ref={editorRef}
              onBlur={onBlur}
              className={spreadsheetStyles.cellSelect}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            >
              <option value="" disabled>
                Select profile
              </option>
              {powdercoatData.options.map((option) => (
                <option key={option.profile} value={option.profile}>
                  {option.profile}
                </option>
              ))}
            </select>
          );
        }

        if (key === 'c') {
          return (
            <select
              ref={editorRef}
              onBlur={onBlur}
              className={spreadsheetStyles.cellSelect}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            >
              <option value="" disabled>
                Select length
              </option>
              {powdercoat.stockLengthOptionsM.map((stockLength) => (
                <option key={stockLength} value={stockLength}>
                  {`${stockLength}m`}
                </option>
              ))}
            </select>
          );
        }

        return (
          <input
            ref={editorRef}
            onBlur={onBlur}
            className={spreadsheetStyles.cellInput}
            type="number"
            min={1}
            step={1}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
          />
        );
      },
      optimisticEditing: !readOnly&&detail
        ? {
            getLatestConfirmedModel: () => readPowdercoatResponse().overrides.rows,
            displayModel: (_queueKey, model) => {
              setDisplayedPowdercoatRows(model);
            },
            prepareEdit: ({ row, rowId, key, value, displayedModel }) => {
              if (readOnly||sheet !== 'powdercoating-order' || !row.powdercoat) {
                return { kind: 'noop' } as const;
              }

              if (row.powdercoat.origin === 'draft' && key === 'a' && !normalizePowdercoatProfile(value)) {
                return { kind: 'noop' } as const;
              }

              const nextRows = applyPowdercoatEditToModel({
                detail,
                rows: displayedModel,
                options: powdercoatData.options,
                rowId,
                key,
                value,
              });

              if (!nextRows) {
                return { kind: 'error', message: getPowdercoatValidationMessage(key) } as const;
              }

              return {
                kind: 'enqueue',
                edit: {
                  applyToModel: (currentRows) =>
                    applyPowdercoatEditToModel({
                      detail,
                      rows: currentRows,
                      options: powdercoatData.options,
                      rowId,
                      key,
                      value,
                    }) ?? currentRows,
                  persist: async (currentRows) => {
                    const latest = readPowdercoatResponse();
                    const rowsForSave =
                      applyPowdercoatEditToModel({
                        detail,
                        rows: currentRows,
                        options: latest.options,
                        rowId,
                        key,
                        value,
                      }) ?? currentRows;

                    try {
                      const response = await apiJson<JobPackPowdercoatUpdateResponse>('/api/staff/v1/job-packs/powdercoating', {
                        method: 'POST',
                        body: JSON.stringify({
                          estimateId: detail.id,
                          expectedVersion: latest.overrides.version,
                          rows: rowsForSave,
                        }),
                      });

                      setPowdercoatResponse({
                        ...latest,
                        overrides: response.overrides,
                      });

                      return {
                        kind: 'success',
                        confirmedModel: response.overrides.rows,
                      } as const;
                    } catch (error) {
                      if (error instanceof ApiError && error.status === 409) {
                        const currentOverrides = (error.body as any)?.currentOverrides;
                        if (currentOverrides && typeof currentOverrides === 'object') {
                          setPowdercoatResponse({
                            ...latest,
                            overrides: currentOverrides as JobPackPowdercoatOverrideState,
                          });
                          return {
                            kind: 'drop',
                            confirmedModel: (currentOverrides as JobPackPowdercoatOverrideState).rows,
                            message: 'This powdercoating row changed in another tab. The latest values have been reloaded.',
                            conflict: true,
                          } as const;
                        }
                      }

                      return {
                        kind: 'drop',
                        confirmedModel: currentRows,
                        message: error instanceof Error ? error.message : 'Failed to save the powdercoating sheet.',
                      } as const;
                    }
                  },
                },
              } as const;
            },
          }
        : undefined,
      onCellActivated: async ({ trigger, row, key, seed, beginEdit }) => {
        if (readOnly||sheet !== 'powdercoating-order' || !row.powdercoat) return 'noop';
        if (key !== 'a' && key !== 'c' && key !== 'd') return 'noop';
        if (!powdercoatData.options.length && key === 'a') return 'noop';
        if (row.powdercoat.origin === 'draft' && key !== 'a') return 'noop';
        if (key === 'c' && row.powdercoat.stockLengthOptionsM.length <= 1) return 'noop';

        if (trigger === 'click' || trigger === 'enter' || trigger === 'double_click') {
          beginEdit();
          return 'handled';
        }

        if (trigger === 'printable' && seed && key === 'd') {
          beginEdit(seed);
          return 'handled';
        }

        return 'noop';
      },
    };
  }, [
    sourceReadOnly,detail,pending,error,refreshing,onRetry,powdercoatQuery.refetch,powdercoatQuery.error,powdercoatQuery.data,powdercoatQuery.isError,powdercoatQuery.isPending,powdercoatQuery.isFetching,
    onBackToList,
    onOpenEstimate,
    onSheetChange,
    onShowNotesColumnChange,
    powdercoatData.options,
    powdercoatWarningMessage,
    readPowdercoatResponse,
    setDisplayedPowdercoatRows,
    setPowdercoatResponse,
    sheet,
    showNotesColumn,
    workbook,
  ]);
}

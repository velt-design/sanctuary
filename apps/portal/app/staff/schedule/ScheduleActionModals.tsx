'use client';

import type { Dispatch, SetStateAction } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { addDaysYmd, isYmd as isYmdDate } from '@/lib/scheduling/date';
import { formatScheduleJobTiming, type ScheduleJobPresentation } from './ScheduleJobPresentation';
import styles from './schedule.module.css';

function parsePositiveInt(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseYmd(ymd: string): Date | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month, day);
}

function isYmd(value: string): boolean {
  return Boolean(parseYmd(value));
}

function endInclusiveFromExclusive(endExclusive: string, fallback: string): string {
  if (!isYmdDate(endExclusive)) return fallback;
  return addDaysYmd(endExclusive, -1);
}

function startOfWeekMonday(ymd: string): string {
  const date = parseYmd(ymd);
  if (!date) return ymd;
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

type QuickEditState = { id: string; startDateOverride: string; durationDays: string } | null;
type DurationEditState = { id: string; durationDays: string } | null;
type CommitmentEditState = {
  id: string;
  mode: 'lock' | 'reschedule';
  commitmentType: 'week_of' | 'fixed_date';
  weekOfDate: string;
  startDate: string;
  durationDays: string;
  flexDays: string;
  hardLock: boolean;
} | null;
type PinEditState = { id: string; requestedStart: string } | null;
type DaysRemainingEditState = { id: string; daysRemaining: string } | null;
type FinishEarlyPromptState = {
  jobId: string;
  scheduleItemId: string;
  freedDays: number;
  actualFinish: string;
  forecastEndExclusive: string | null;
  impacts: any[];
} | null;
type DowntimeEditState = {
  mode: 'create' | 'edit';
  crewId: string;
  position: number;
  downtimeId?: string | null;
  durationDays: string;
  reason: string;
  note: string;
} | null;

export type ScheduleModalState = {
  quickEdit: QuickEditState;
  commitmentEdit: CommitmentEditState;
  durationEdit: DurationEditState;
  pinEdit: PinEditState;
  daysRemainingEdit: DaysRemainingEditState;
  downtimeEdit: DowntimeEditState;
  finishEarlyPrompt: FinishEarlyPromptState;
};

export type ScheduleActionModalsProps = {
  state: ScheduleModalState;
  scheduleMode: 'v2' | 'legacy';
  findJobPresentation: (scheduleItemId: string) => ScheduleJobPresentation | null;
  formatShortDate: (ymd: string) => string;
  formatCommitImpactList: (impacts: any[]) => string;
  setQuickEdit: Dispatch<SetStateAction<QuickEditState>>;
  setCommitmentEdit: Dispatch<SetStateAction<CommitmentEditState>>;
  setDurationEdit: Dispatch<SetStateAction<DurationEditState>>;
  setPinEdit: Dispatch<SetStateAction<PinEditState>>;
  setDaysRemainingEdit: Dispatch<SetStateAction<DaysRemainingEditState>>;
  setDowntimeEdit: Dispatch<SetStateAction<DowntimeEditState>>;
  onCancelFinishEarly: () => void;
  onSaveQuickEdit: () => void;
  onSaveCommitment: () => void;
  onSaveDuration: () => void;
  onSavePin: () => void;
  onSaveDaysRemaining: () => void;
  onSaveDowntime: () => void;
  onFinishEarlyKeepSchedule: () => void;
  onFinishEarlyPullForward: () => void;
};

function JobContextPanel({
  presentation,
  formatShortDate,
  proposedTiming,
}: {
  presentation: ScheduleJobPresentation | null;
  formatShortDate: (ymd: string) => string;
  proposedTiming?: string | null;
}) {
  if (!presentation) return null;
  return (
    <section className={styles.actionJobContext} aria-label="Job and timing context">
      <div className={styles.actionJobIdentity}>
        <strong>{presentation.projectName}</strong>
        {presentation.identityDetail ? <span>{presentation.identityDetail}</span> : null}
        <span>Crew: {presentation.crewName}</span>
      </div>
      <div className={styles.actionTimingReview}>
        <div>
          <span>Current</span>
          <strong>{formatScheduleJobTiming(presentation, formatShortDate)}</strong>
        </div>
        {proposedTiming ? (
          <div>
            <span>Proposed</span>
            <strong>{proposedTiming}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function parsePositiveNumber(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ScheduleActionModals({
  state,
  scheduleMode,
  findJobPresentation,
  formatShortDate,
  formatCommitImpactList,
  setQuickEdit,
  setCommitmentEdit,
  setDurationEdit,
  setPinEdit,
  setDaysRemainingEdit,
  setDowntimeEdit,
  onCancelFinishEarly,
  onSaveQuickEdit,
  onSaveCommitment,
  onSaveDuration,
  onSavePin,
  onSaveDaysRemaining,
  onSaveDowntime,
  onFinishEarlyKeepSchedule,
  onFinishEarlyPullForward,
}: ScheduleActionModalsProps) {
  const { quickEdit, commitmentEdit, durationEdit, pinEdit, daysRemainingEdit, downtimeEdit, finishEarlyPrompt } = state;

  return (
    <>
      {quickEdit ? (
        <Modal
          open
          ariaLabel="Quick edit scheduled job"
          onClose={() => setQuickEdit(null)}
          maxWidthPx={520}
        >
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>Quick edit</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setQuickEdit(null)}>
                Close
              </button>
            </div>

            <JobContextPanel
              presentation={findJobPresentation(quickEdit.id)}
              formatShortDate={formatShortDate}
              proposedTiming={`${isYmd(quickEdit.startDateOverride) ? `Starts ${formatShortDate(quickEdit.startDateOverride)}` : 'Start auto-calculated'} · ${parsePositiveNumber(quickEdit.durationDays) ?? '—'}d`}
            />

            <p className={`${styles.hint} ${styles.actionModalIntro}`}>
              Overrides apply to this job only. Changing start/duration recalculates downstream jobs for the crew.
            </p>

            <div className={styles.actionModalFields}>
              <div>
                <label className={styles.actionModalLabel}>
                  Start date override
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={quickEdit.startDateOverride}
                  onChange={(e) => setQuickEdit((prev) => (prev ? { ...prev, startDateOverride: e.target.value } : prev))}
                />
                <p className={`${styles.hint} ${styles.actionModalHint}`}>
                  Leave blank to auto-calculate from lane availability.
                </p>
              </div>

              <div>
                <label className={styles.actionModalLabel}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step={scheduleMode === 'v2' ? 1 : 0.5}
                  min={scheduleMode === 'v2' ? 1 : 0.5}
                  className={styles.input}
                  value={quickEdit.durationDays}
                  onChange={(e) => setQuickEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
                <p className={`${styles.hint} ${styles.actionModalHint}`}>
                  1 day = 8h. {scheduleMode === 'v2' ? 'Whole days only.' : 'Use 0.5 increments.'}
                </p>
              </div>
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setQuickEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onSaveQuickEdit}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {commitmentEdit ? (
        <Modal
          open
          ariaLabel={commitmentEdit.mode === 'lock' ? 'Confirm schedule' : 'Reschedule'}
          onClose={() => setCommitmentEdit(null)}
          maxWidthPx={560}
        >
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>
                {commitmentEdit.mode === 'lock' ? 'Confirm schedule' : 'Reschedule'}
              </h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setCommitmentEdit(null)}>
                Close
              </button>
            </div>

            <JobContextPanel
              presentation={findJobPresentation(commitmentEdit.id)}
              formatShortDate={formatShortDate}
              proposedTiming={
                commitmentEdit.commitmentType === 'week_of'
                  ? `${isYmd(commitmentEdit.weekOfDate) ? `Week of ${formatShortDate(startOfWeekMonday(commitmentEdit.weekOfDate))}` : 'Week not set'} · ${parsePositiveInt(commitmentEdit.durationDays) ?? '—'}d`
                  : `${isYmd(commitmentEdit.startDate) ? `Starts ${formatShortDate(commitmentEdit.startDate)}` : 'Start not set'} · ${parsePositiveInt(commitmentEdit.durationDays) ?? '—'}d`
              }
            />

            <div className={`${styles.actionModalFields} ${styles.actionModalFieldsWide}`}>
              <div>
                <div className={styles.actionModalLegend}>Commitment type</div>
                <div className={styles.actionModalChoices}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    aria-pressed={commitmentEdit.commitmentType === 'week_of'}
                    onClick={() =>
                      setCommitmentEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              commitmentType: 'week_of',
                              flexDays: '4',
                              hardLock: false,
                            }
                          : prev,
                      )
                    }
                  >
                    Week-of
                  </button>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    aria-pressed={commitmentEdit.commitmentType === 'fixed_date'}
                    onClick={() =>
                      setCommitmentEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              commitmentType: 'fixed_date',
                              flexDays: '1',
                              hardLock: true,
                            }
                          : prev,
                      )
                    }
                  >
                    Fixed date
                  </button>
                </div>
              </div>

              {commitmentEdit.commitmentType === 'week_of' ? (
                <div>
                  <label className={styles.actionModalLabel}>
                    Week-of date
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={commitmentEdit.weekOfDate}
                    onChange={(e) =>
                      setCommitmentEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              weekOfDate: startOfWeekMonday(e.target.value),
                            }
                          : prev,
                      )
                    }
                  />
                  <p className={`${styles.hint} ${styles.actionModalHint}`}>
                    Date is snapped to Monday of the selected week.
                  </p>
                </div>
              ) : (
                <div>
                  <label className={styles.actionModalLabel}>
                    Start date
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={commitmentEdit.startDate}
                    onChange={(e) =>
                      setCommitmentEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              startDate: e.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                  <p className={`${styles.hint} ${styles.actionModalHint}`}>
                    Date snaps forward to a weekday; holiday handling is enforced server-side.
                  </p>
                </div>
              )}

              <div className={styles.actionModalTwoColumns}>
                <div>
                  <label className={styles.actionModalLabel}>
                    Approx duration (days)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={1}
                    className={styles.input}
                    value={commitmentEdit.durationDays}
                    onChange={(e) => setCommitmentEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <label className={styles.actionModalLabel}>
                    Flex days
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    className={styles.input}
                    value={commitmentEdit.flexDays}
                    onChange={(e) => setCommitmentEdit((prev) => (prev ? { ...prev, flexDays: e.target.value } : prev))}
                  />
                </div>
              </div>

              <label className={styles.actionModalCheckbox}>
                <input
                  type="checkbox"
                  checked={commitmentEdit.hardLock}
                  onChange={(e) => setCommitmentEdit((prev) => (prev ? { ...prev, hardLock: e.target.checked } : prev))}
                />
                Hard lock date (prevents auto movement)
              </label>

              {(() => {
                const datePart =
                  commitmentEdit.commitmentType === 'week_of'
                    ? isYmd(commitmentEdit.weekOfDate)
                      ? `Week of ${formatShortDate(startOfWeekMonday(commitmentEdit.weekOfDate))}`
                      : 'Week of —'
                    : isYmd(commitmentEdit.startDate)
                      ? `Starts ${formatShortDate(commitmentEdit.startDate)}`
                      : 'Starts —';
                const duration = parsePositiveInt(commitmentEdit.durationDays);
                const flexRaw = Number(commitmentEdit.flexDays.trim());
                const flex = Number.isFinite(flexRaw) ? Math.max(0, Math.trunc(flexRaw)) : null;
                return (
                  <p className={styles.hint}>
                    Planned: {datePart} · ~{duration ?? '—'} days · flex {flex ?? '—'} working days
                  </p>
                );
              })()}
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setCommitmentEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                disabled={(() => {
                  const validDuration = parsePositiveInt(commitmentEdit.durationDays) !== null;
                  const flexRaw = Number(commitmentEdit.flexDays.trim());
                  const validFlex = Number.isFinite(flexRaw) && Math.trunc(flexRaw) >= 0;
                  const validDate = commitmentEdit.commitmentType === 'week_of' ? isYmd(commitmentEdit.weekOfDate) : isYmd(commitmentEdit.startDate);
                  return !(validDuration && validFlex && validDate);
                })()}
                onClick={onSaveCommitment}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {durationEdit ? (
        <Modal open ariaLabel="Set job duration" onClose={() => setDurationEdit(null)} maxWidthPx={480}>
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>Set duration</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDurationEdit(null)}>
                Close
              </button>
            </div>

            <JobContextPanel
              presentation={findJobPresentation(durationEdit.id)}
              formatShortDate={formatShortDate}
              proposedTiming={`Duration ${parsePositiveInt(durationEdit.durationDays) ?? '—'}d`}
            />

            <p className={`${styles.hint} ${styles.actionModalIntro}`}>
              Duration is stored as whole working days.
            </p>

            <div className={styles.actionModalFields}>
              <div>
                <label className={styles.actionModalLabel}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={durationEdit.durationDays}
                  onChange={(e) => setDurationEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
              </div>
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDurationEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onSaveDuration}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {pinEdit ? (
        <Modal open ariaLabel="Pin job" onClose={() => setPinEdit(null)} maxWidthPx={480}>
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>Pin job</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setPinEdit(null)}>
                Close
              </button>
            </div>

            <JobContextPanel
              presentation={findJobPresentation(pinEdit.id)}
              formatShortDate={formatShortDate}
              proposedTiming={isYmd(pinEdit.requestedStart) ? `Starts ${formatShortDate(pinEdit.requestedStart)}` : 'Start not set'}
            />

            <p className={`${styles.hint} ${styles.actionModalIntro}`}>
              Pinned starts snap forward to the next working day if needed.
            </p>

            <div className={styles.actionModalFields}>
              <div>
                <label className={styles.actionModalLabel}>
                  Start date
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={pinEdit.requestedStart}
                  onChange={(e) => setPinEdit((prev) => (prev ? { ...prev, requestedStart: e.target.value } : prev))}
                />
              </div>
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setPinEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onSavePin}
              >
                Pin job
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {daysRemainingEdit ? (
        <Modal open ariaLabel="Set days remaining" onClose={() => setDaysRemainingEdit(null)} maxWidthPx={480}>
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>Days remaining</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDaysRemainingEdit(null)}>
                Close
              </button>
            </div>

            <JobContextPanel
              presentation={findJobPresentation(daysRemainingEdit.id)}
              formatShortDate={formatShortDate}
              proposedTiming={`${parsePositiveInt(daysRemainingEdit.daysRemaining) ?? '—'}d remaining`}
            />

            <p className={`${styles.hint} ${styles.actionModalIntro}`}>
              Updates the forecast duration for this in-progress job.
            </p>

            <div className={styles.actionModalFields}>
              <div>
                <label className={styles.actionModalLabel}>
                  Days remaining
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={daysRemainingEdit.daysRemaining}
                  onChange={(e) => setDaysRemainingEdit((prev) => (prev ? { ...prev, daysRemaining: e.target.value } : prev))}
                />
              </div>
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDaysRemainingEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onSaveDaysRemaining}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {downtimeEdit ? (
        <Modal
          open
          ariaLabel={downtimeEdit.mode === 'create' ? 'Add downtime' : 'Edit downtime'}
          onClose={() => setDowntimeEdit(null)}
          maxWidthPx={520}
        >
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>
                {downtimeEdit.mode === 'create' ? 'Add downtime' : 'Edit downtime'}
              </h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDowntimeEdit(null)}>
                Close
              </button>
            </div>

            <div className={styles.actionModalFields}>
              <div>
                <label className={styles.actionModalLabel}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={downtimeEdit.durationDays}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
              </div>

              <div>
                <label className={styles.actionModalLabel}>
                  Reason
                </label>
                <select
                  className={styles.input}
                  value={downtimeEdit.reason}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                >
                  <option value="weather">Weather</option>
                  <option value="materials">Materials</option>
                  <option value="site">Site</option>
                  <option value="staff">Staff</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className={styles.actionModalLabel}>
                  Note
                </label>
                <textarea
                  className={styles.input}
                  rows={3}
                  value={downtimeEdit.note}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                />
              </div>
            </div>

            <div className={styles.actionModalActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDowntimeEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onSaveDowntime}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {finishEarlyPrompt ? (
        <Modal
          open
          ariaLabel="Finish early options"
          onClose={onCancelFinishEarly}
          maxWidthPx={560}
        >
          <div className={styles.actionModalBody}>
            <div className={styles.actionModalHeader}>
              <h2 className={styles.actionModalTitle}>Finished early</h2>
              <button type="button" className={styles.buttonSecondary} onClick={onCancelFinishEarly}>
                Close
              </button>
            </div>

            {(() => {
              const presentation = findJobPresentation(finishEarlyPrompt.scheduleItemId);
              const endInclusive = finishEarlyPrompt.forecastEndExclusive
                ? endInclusiveFromExclusive(finishEarlyPrompt.forecastEndExclusive, finishEarlyPrompt.forecastEndExclusive)
                : null;
              const forecastLabel = endInclusive ? formatShortDate(endInclusive) : '—';
              return (
                <div className={styles.finishedJob}>
                  <JobContextPanel presentation={presentation} formatShortDate={formatShortDate} />
                  <p className={`${styles.hint} ${styles.actionModalHint}`}>
                    Finished on {formatShortDate(finishEarlyPrompt.actualFinish)} — {finishEarlyPrompt.freedDays} working day
                    {finishEarlyPrompt.freedDays === 1 ? '' : 's'} freed (forecast end {forecastLabel}).
                  </p>
                </div>
              );
            })()}

            {finishEarlyPrompt.impacts?.length ? (
              <div className={styles.finishedSummary}>
                <div className={`${styles.hint} ${styles.finishedSummaryLabel}`}>
                  Pull forward preview
                </div>
                <pre className={`${styles.note} ${styles.finishedSummaryNote}`}>
                  {formatCommitImpactList(finishEarlyPrompt.impacts)}
                </pre>
              </div>
            ) : null}

            <div className={`${styles.actionModalActions} ${styles.actionModalActionsWrap}`}>
              <button type="button" className={styles.buttonSecondary} onClick={onCancelFinishEarly}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={onFinishEarlyKeepSchedule}
              >
                Keep schedule as-is
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={onFinishEarlyPullForward}
              >
                Pull forward
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

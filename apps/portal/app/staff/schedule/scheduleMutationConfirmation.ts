import { isValidScheduleMutationEnvelope, parseScheduleConfirmationEnvelope, scheduleCommitImpactFingerprint } from './scheduleMutationTrust';

type ScheduleCommitOptions = {
  targetJobIds?: string[];
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationLabel?: string;
  allowMissingSchedule?: boolean;
  requireSourceSchedule?: boolean;
  expectedCrewId?: string;
  expectedSourceCrewId?: string;
  onPhase?: (phase: 'checking' | 'reviewing' | 'saving') => void;
};

type ConfirmationDependencies = {
  confirmScheduleAction: (input: { title: string; description: string; confirmLabel: string; details: string[] }) => Promise<boolean>;
  commitImpactsExcludingTargets: (impacts: any[], targetJobIds: string[] | undefined) => any[];
  formatCommitImpactDetails: (impacts: any[]) => string[];
  onCancel: () => void | Promise<void>;
};

// Owns the check/review/recheck/commit protocol; UI state and cache settlement
// stay with the page's checkpoint owner. No write is forced after impacts change.
export async function checkAndCommitScheduleMutation(run: (force: boolean) => Promise<any>, opts: ScheduleCommitOptions | undefined, dependencies: ConfirmationDependencies) {
  const { confirmScheduleAction, commitImpactsExcludingTargets, formatCommitImpactDetails, onCancel } = dependencies;
        opts?.onPhase?.('checking');
        let res = await run(false);

        if (res && typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'requires_confirmation')) {
          const reportedImpacts = parseScheduleConfirmationEnvelope(res);
          if (!reportedImpacts) {
            throw new Error('The server returned an invalid schedule confirmation. Refreshing the saved schedule now.');
          }
          const impacts = commitImpactsExcludingTargets(
            reportedImpacts,
            opts?.targetJobIds,
          );
          if (!impacts.length) {
            throw new Error('The server returned an invalid schedule confirmation. Refreshing the saved schedule now.');
          }
          if (impacts.length) {
            opts?.onPhase?.('reviewing');
            const count = impacts.length;
            const confirmed = await confirmScheduleAction({
              title: opts?.confirmationTitle ?? 'Move other scheduled jobs?',
              description:
                opts?.confirmationDescription ??
                `This change will move ${count} other scheduled job${count === 1 ? '' : 's'}. Review the dates before saving.`,
              confirmLabel: opts?.confirmationLabel ?? 'Save change',
              details: formatCommitImpactDetails(impacts),
            });
            if (!confirmed) {
              await onCancel();
              return { cancelled: true as const };
            }
          }
          const confirmedFingerprint = scheduleCommitImpactFingerprint(impacts);
          opts?.onPhase?.('checking');
          const verification = await run(false);
          if (
            !verification ||
            typeof verification !== 'object' ||
            !Object.prototype.hasOwnProperty.call(verification, 'requires_confirmation')
          ) {
            res = verification;
          } else {
            const parsedVerifiedImpacts = parseScheduleConfirmationEnvelope(verification);
            if (!parsedVerifiedImpacts) {
              throw new Error('The affected jobs changed before the schedule could be saved. Refresh and try again.');
            }
            const verifiedImpacts = commitImpactsExcludingTargets(
              parsedVerifiedImpacts,
              opts?.targetJobIds,
            );
            if (!verifiedImpacts.length || scheduleCommitImpactFingerprint(verifiedImpacts) !== confirmedFingerprint) {
              throw new Error('The affected jobs changed before the schedule could be saved. Refresh and try again.');
            }
            opts?.onPhase?.('saving');
            res = await run(true);
            if (
              res &&
              typeof res === 'object' &&
              Object.prototype.hasOwnProperty.call(res, 'requires_confirmation')
            ) {
              throw new Error('The affected jobs changed before the schedule could be saved. Refresh and try again.');
            }
          }
        }
        if (
          !isValidScheduleMutationEnvelope(res, {
            allowMissingSchedule: opts?.allowMissingSchedule,
            requireSourceSchedule: opts?.requireSourceSchedule,
            expectedCrewId: opts?.expectedCrewId,
            expectedSourceCrewId: opts?.expectedSourceCrewId,
          })
        ) {
          throw new Error('The server returned an invalid saved schedule. Refreshing the authoritative schedule now.');
        }

        return { cancelled: false as const, response: res };
}

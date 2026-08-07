import {
  assertPortalBundleBudgets,
  formatBytes,
  PortalBundleBudgetError,
  type PortalBundleBudgetReport,
} from '../apps/portal/lib/performance/portalBundleBudgets';

function printReport(report: PortalBundleBudgetReport) {
  console.log(`${report.route} bundle budget passed.`);
  console.log(`- Initial: ${formatBytes(report.initial.rawBytes)} raw, ${formatBytes(report.initial.gzipBytes)} gzip`);
  console.log(`- Lazy total: ${formatBytes(report.lazy.rawBytes)} raw, ${formatBytes(report.lazy.gzipBytes)} gzip`);
  if (report.postAuthShell.entries.length > 0) {
    console.log(
      `- Shared post-auth shell: ${formatBytes(report.postAuthShell.rawBytes)} raw, ${formatBytes(report.postAuthShell.gzipBytes)} gzip`,
    );
  }
  if (report.lazy.largestEntry) {
    console.log(`- Largest lazy entry: ${formatBytes(report.lazy.largestEntry.rawBytes)} raw, ${formatBytes(report.lazy.largestEntry.gzipBytes)} gzip`);
  }
}

try {
  for (const report of assertPortalBundleBudgets()) printReport(report);
} catch (error) {
  if (error instanceof PortalBundleBudgetError) {
    console.error(error.message);
    for (const report of error.reports) {
      if (report.postAuthShell.entries.length > 0) {
        console.error(
          `\n${report.route} shared post-auth shell: ${formatBytes(report.postAuthShell.rawBytes)} raw / ${formatBytes(report.postAuthShell.gzipBytes)} gzip`,
        );
      }
      console.error(`\n${report.route} top contributors:`);
      for (const file of report.topContributors.slice(0, 8)) {
        console.error(`  ${formatBytes(file.rawBytes)} raw / ${formatBytes(file.gzipBytes)} gzip  ${file.file}`);
      }
    }
    process.exit(1);
  }
  throw error;
}

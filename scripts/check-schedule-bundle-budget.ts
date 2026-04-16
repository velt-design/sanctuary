import { assertScheduleBundleBudgets, formatBytes, ScheduleBundleBudgetError } from '../apps/portal/lib/scheduling/scheduleBundleBudgets';

function printReport(report: NonNullable<ScheduleBundleBudgetError['report']>) {
  console.log('Schedule bundle budget check passed.');
  console.log(`- Initial route chunks: ${formatBytes(report.initial.rawBytes)} raw, ${formatBytes(report.initial.gzipBytes)} gzip`);
  console.log(`- Lazy schedule chunks: ${formatBytes(report.lazy.rawBytes)} raw, ${formatBytes(report.lazy.gzipBytes)} gzip`);
  if (report.lazy.largestEntry) {
    console.log(`- Largest lazy entry: ${formatBytes(report.lazy.largestEntry.rawBytes)} raw, ${formatBytes(report.lazy.largestEntry.gzipBytes)} gzip`);
  }
  console.log('- Top contributors:');
  for (const file of report.topContributors.slice(0, 8)) {
    console.log(`  ${formatBytes(file.rawBytes)} raw / ${formatBytes(file.gzipBytes)} gzip  ${file.file}`);
  }
}

try {
  printReport(assertScheduleBundleBudgets());
} catch (error) {
  if (error instanceof ScheduleBundleBudgetError) {
    console.error(error.message);
    if (error.report?.topContributors.length) {
      console.error('\nTop contributors:');
      for (const file of error.report.topContributors.slice(0, 8)) {
        console.error(`  ${formatBytes(file.rawBytes)} raw / ${formatBytes(file.gzipBytes)} gzip  ${file.file}`);
      }
    }
    process.exit(1);
  }
  throw error;
}

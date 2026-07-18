import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.resolve(process.argv[2] ?? 'artifacts/portal-performance');
const files = fs.existsSync(artifactDir)
  ? fs.readdirSync(artifactDir).filter((file) => file.endsWith('.json')).sort()
  : [];

if (files.length !== 5) {
  throw new Error(`Expected exactly five portal performance artifacts in ${artifactDir}; found ${files.length}.`);
}

const runs = files.map((file) => {
  const payload = JSON.parse(fs.readFileSync(path.join(artifactDir, file), 'utf8'));
  if (payload.schemaVersion !== 2 || !Array.isArray(payload.journeys) || payload.journeys.length === 0) {
    throw new Error(`${file} is not a valid non-empty PortalPerformanceRun schemaVersion 2 artifact.`);
  }
  return payload;
});

const expectedNames = runs[0].journeys.map((journey) => journey.name).sort();
for (const [index, run] of runs.entries()) {
  const names = run.journeys.map((journey) => journey.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error(`Performance run ${index + 1} silently skipped or added a journey.`);
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

const lines = [
  '## Portal Performance Baseline',
  '',
  `Five authenticated runs; build ${runs[0].buildId ?? 'local/unknown'}.`,
  '',
  '| Journey | Kind | Feedback p50 / p75 / p95 | Useful p50 / p75 / p95 | Requests p75 | Transfer p75 | Long task p95 | Product target | Regression budget |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | :---: | :---: |',
];

for (const name of expectedNames) {
  const samples = runs.map((run) => run.journeys.find((journey) => journey.name === name));
  const stat = (field, fraction) => percentile(samples.map((sample) => Number(sample[field]) || 0), fraction);
  const feedback = [0.5, 0.75, 0.95].map((fraction) => stat('feedbackMs', fraction));
  const useful = [0.5, 0.75, 0.95].map((fraction) => stat('usefulContentMs', fraction));
  const product = samples.every((sample) => sample.productTargetMet);
  const regression = samples.every((sample) => sample.regressionBudgetMet);
  lines.push(
    `| ${name} | ${samples[0].kind} | ${feedback.join(' / ')}ms | ${useful.join(' / ')}ms | ${stat('requestCount', 0.75)} | ${Math.round(stat('transferBytes', 0.75) / 1024)} KiB | ${stat('longestTaskMs', 0.95)}ms | ${product ? 'PASS' : 'MISS'} | ${regression ? 'PASS' : 'MISS'} |`,
  );
}

const output = `${lines.join('\n')}\n`;
process.stdout.write(output);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);

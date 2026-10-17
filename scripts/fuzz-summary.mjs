// Turns the Schemathesis reports into something readable on the run page:
// a job summary table, an error annotation per new failure and, when recording, the new baseline.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const dir = 'schemathesis-report';
if (!existsSync(`${dir}/report.json`)) {
  console.log(
    '::error title=Schemathesis::No report.json — the run did not start (is the Petstore container up?)',
  );
  process.exit(0);
}
const report = JSON.parse(readFileSync(`${dir}/report.json`, 'utf8'));
const junit = existsSync(`${dir}/junit.xml`) ? readFileSync(`${dir}/junit.xml`, 'utf8') : '';
const recording = process.env.RECORD_BASELINE === 'true';

// GitHub workflow commands need %, CR and LF escaped.
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const unxml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// In JUnit only failures that are NOT in the baseline are reported as <failure>.
const failures = [
  ...junit.matchAll(/<testcase name="([^"]+)"[^>]*>\s*<failure[^>]*>([\s\S]*?)<\/failure>/g),
].map(([, name, body]) => ({ name: unxml(name), body: unxml(body) }));

const { operations: ops, test_cases: tc, baseline: bl = {} } = report;
const summary = [
  '## Schemathesis — Swagger Petstore (local container)',
  '',
  '| Operations tested | Test cases generated | Known failures (baseline) | New failures |',
  '| --- | --- | --- | --- |',
  `| ${ops.tested} / ${ops.total} | ${tc.generated} | ${bl.known ?? 0} | ${bl.new ?? failures.length} |`,
  '',
  '| Phase | Result |',
  '| --- | --- |',
  ...Object.entries(report.phases).map(
    ([name, p]) => `| ${name} | ${p.status}${p.skip_reason ? ` (${p.skip_reason})` : ''} |`,
  ),
  '',
];
if (report.failures.length) {
  summary.push('| New failure type | Severity | Count | Operations |', '| --- | --- | --- | --- |');
  for (const f of report.failures)
    summary.push(`| ${f.title} | ${f.severity} | ${f.count} | ${f.operations.join(', ')} |`);
  summary.push('');
}
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
console.log(summary.join('\n'));

const line = `operations ${ops.tested}/${ops.total}, cases ${tc.generated}, known ${bl.known ?? 0}, new ${bl.new ?? failures.length}`;
console.log(`::notice title=Schemathesis totals::${esc(line)}`);

// GitHub shows at most 10 error annotations per step.
for (const f of failures.slice(0, 10)) {
  console.log(`::error title=Schemathesis: ${esc(f.name)}::${esc(f.body.slice(0, 4000))}`);
}

if (recording && existsSync('fuzz/baseline.json')) {
  console.log(`::notice title=Recorded baseline::${esc(readFileSync('fuzz/baseline.json', 'utf8'))}`);
}

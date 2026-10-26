import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(new URL('../../Source/package.json', import.meta.url));
const { parseDocument } = require('yaml');
function yaml(relative) {
  const document = parseDocument(readFileSync(resolve(root, relative), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(document.errors, [], `${relative} must be valid YAML`);
  return document.toJS();
}

test('PR CI has both hosted platforms, locked installs, Linux Xvfb, and no secret references', () => {
  const path = '.github/workflows/electron-ci.yml';
  const workflow = yaml(path);
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const checks = workflow.jobs.checks;
  assert.deepEqual(checks.strategy.matrix.include.map(item => item.os).sort(), ['ubuntu-22.04', 'windows-2022']);
  const commands = checks.steps.map(step => step.run).filter(Boolean);
  for (const required of ['npm ci', 'npm run typecheck', 'npm run test', 'npm run build', 'npm run test:e2e', 'xvfb-run -a npm run test:e2e', 'npm run package:dir -- --publish never', 'npm run package -- --publish never']) {
    assert.ok(commands.includes(required), `Missing CI command: ${required}`);
  }
  assert.doesNotMatch(readFileSync(resolve(root, path), 'utf8'), /secrets\.|contents: write|GH_TOKEN|SIGNING_PRIVATE_KEY/);
});

test('releases are manual, pinned to validated SHA, and only publish has write permission', () => {
  const workflow = yaml('.github/workflows/electron-release.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.match(workflow.jobs.validate.if, /refs\/heads\/main/);
  assert.match(workflow.jobs.validate.if, /Leos-byte\/MemoryGraph/);
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'write' });
  assert.deepEqual(workflow.jobs.sign.needs, ['validate', 'build']);
  assert.deepEqual(workflow.jobs.publish.needs, ['validate', 'sign']);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (name !== 'publish') assert.equal(job.permissions, undefined);
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with['persist-credentials'], false);
    if (name !== 'validate') assert.equal(checkout.with.ref, '${{ needs.validate.outputs.sha }}');
  }
  const signing = workflow.jobs.sign.steps.filter(step => step.env?.SIGNING_PRIVATE_KEY);
  assert.equal(signing.length, 1);
  assert.equal(signing[0].env.SIGNING_PRIVATE_KEY, '${{ secrets.SIGNING_PRIVATE_KEY }}');
  assert.equal(signing[0].run, 'npm run release:sign -- --dir dist-release --version "$VERSION" --channel "$CHANNEL"');
  assert.equal(signing[0].env.CHANNEL, '${{ needs.validate.outputs.channel }}');
  assert.ok(workflow.jobs.sign.steps.some(step => step.run === 'npm ci'));
  assert.ok(!workflow.jobs.publish.steps.some(step => /npm|secrets\./.test(JSON.stringify(step))));
  assert.ok(workflow.jobs.publish.steps.some(step => step.with?.name === 'signed-electron-release'));
});

test('all workflow actions are SHA-pinned, with no issue/comment execution or self-hosted runners', () => {
  for (const name of readdirSync(resolve(root, '.github/workflows'))) {
    if (!/\.ya?ml$/.test(name)) continue;
    const workflow = yaml(`.github/workflows/${name}`);
    for (const event of Object.keys(workflow.on)) assert.ok(['pull_request', 'push', 'workflow_dispatch'].includes(event), `Unexpected event: ${event}`);
    for (const job of Object.values(workflow.jobs)) {
      assert.doesNotMatch(JSON.stringify(job['runs-on']), /self-hosted/);
      for (const step of job.steps) {
        if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[a-f0-9]{40}$/);
        if (step.run) assert.doesNotMatch(step.run, /\$\{\{\s*(?:inputs\.|github\.event\.)/);
      }
    }
  }
});

test('bilingual issue form supports runtime prefill, required reproduction, optional evidence, and mail contact', () => {
  const form = yaml('.github/ISSUE_TEMPLATE/bug.yml');
  const fields = new Map(form.body.filter(item => item.id).map(item => [item.id, item]));
  for (const id of ['version', 'os', 'os-version', 'steps', 'expected', 'actual']) assert.equal(fields.get(id)?.validations?.required, true);
  assert.equal(fields.get('environment')?.type, 'textarea');
  for (const id of ['contact', 'evidence', 'environment']) assert.notEqual(fields.get(id)?.validations?.required, true);
  assert.equal(fields.get('privacy').attributes.options[0].required, true);
  const config = yaml('.github/ISSUE_TEMPLATE/config.yml');
  assert.equal(config.blank_issues_enabled, false);
  assert.ok(config.contact_links.some(item => item.url === 'mailto:leo.oceanai@gmail.com'));
});

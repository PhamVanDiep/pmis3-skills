import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseArgs, markdownToAdoHtml, htmlToText, parseFieldArgs, splitIdList, REL_MAP,
  resolveProject, missingFieldFromError, formatIdentity, formatAdoDate,
} from '../azdo-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mdDir = join(here, 'fixtures', 'md');

for (const f of readdirSync(mdDir).filter((n) => n.endsWith('.md')).sort()) {
  const name = f.replace(/\.md$/, '');
  test(`markdownToAdoHtml khớp golden ${name}`, () => {
    const md = readFileSync(join(mdDir, f), 'utf8');
    const html = readFileSync(join(mdDir, name + '.html'), 'utf8');
    assert.equal(markdownToAdoHtml(md), html);
  });
}

test('markdownToAdoHtml: rỗng và CRLF', () => {
  assert.equal(markdownToAdoHtml('  \n'), '');
  assert.equal(markdownToAdoHtml('# A\r\n\r\nb'), '<h2>A</h2>\n<p>b</p>');
});

test('parseArgs: finish với cờ không phân biệt hoa thường', () => {
  assert.deepEqual(parseArgs(['finish', '123', '-comment', 'x', '-YES']),
    { command: 'finish', arg1: '123', arg2: undefined, opts: { comment: 'x', yes: true } });
});

test('parseArgs: -Field lặp thành mảng', () => {
  const r = parseArgs(['state', '1', 'Done', '-Field', 'A=1', '-field', 'B=2']);
  assert.deepEqual(r.opts.field, ['A=1', 'B=2']);
  assert.equal(r.arg2, 'Done');
});

test('parseArgs: cờ lạ và command sai ném lỗi', () => {
  assert.throws(() => parseArgs(['show', '1', '-Foo']), /Cờ không hợp lệ: -Foo/);
  assert.throws(() => parseArgs(['bogus']), /whoami.*link/);
  assert.throws(() => parseArgs([]), /hợp lệ/);
});

test('parseArgs: giá trị cờ bắt đầu bằng gạch và camelCase', () => {
  const r = parseArgs(['create', 'Task', 'T', '-AssignTo', 'a@b', '-DescriptionFile', 'x.md', '-CrossProject', '-Html', '-Comment', '-lỗi']);
  assert.deepEqual(r.opts, { assignTo: 'a@b', descriptionFile: 'x.md', crossProject: true, html: true, comment: '-lỗi' });
});

test('parseFieldArgs', () => {
  assert.deepEqual(parseFieldArgs(['A.B=3 - Medium', 'C=x=y']), { 'A.B': '3 - Medium', C: 'x=y' });
  assert.throws(() => parseFieldArgs(['sai']), /Cờ -Field phải có dạng 'TenField=Gia tri', nhận được: sai/);
});

test('splitIdList và REL_MAP', () => {
  assert.deepEqual(splitIdList('1, 2;3 x 4'), ['1', '2', '3', '4']);
  assert.deepEqual(splitIdList(''), []);
  assert.equal(REL_MAP.BlockedBy, 'System.LinkTypes.Dependency-Reverse');
  assert.equal(REL_MAP.Parent, 'System.LinkTypes.Hierarchy-Reverse');
  assert.equal(REL_MAP.Blocks, 'System.LinkTypes.Dependency-Forward');
});

test('resolveProject: thứ tự ưu tiên', () => {
  const gitRemote = 'https://devops.evn.com.vn/EVNCollection/PMIS3%20X/_git/repo';
  const defaultProject = 'DEF';
  assert.deepEqual(resolveProject({ override: 'O', envProject: 'E', gitRemote, defaultProject }), { project: 'O', repoProject: 'E' });
  assert.deepEqual(resolveProject({ envProject: 'E', gitRemote, defaultProject }), { project: 'E', repoProject: 'E' });
  assert.deepEqual(resolveProject({ gitRemote, defaultProject }), { project: 'PMIS3 X', repoProject: 'PMIS3 X' });
  assert.deepEqual(resolveProject({ gitRemote: '', defaultProject }), { project: 'DEF', repoProject: 'DEF' });
});

test('missingFieldFromError', () => {
  assert.equal(missingFieldFromError('TF401320: Rule Error for field Microsoft.VSTS.Common.ResolvedReason. Error code: Required'),
    'Microsoft.VSTS.Common.ResolvedReason');
  assert.equal(missingFieldFromError('lỗi khác'), null);
});

test('formatIdentity', () => {
  assert.equal(formatIdentity(null), '—');
  assert.equal(formatIdentity('abc'), 'abc');
  assert.equal(formatIdentity({ providerDisplayName: 'P', uniqueName: 'u' }), 'P');
  assert.equal(formatIdentity({}), '—');
});

test('formatAdoDate dd/MM/yyyy HH:mm giờ local', () => {
  const iso = '2026-03-05T01:02:03Z';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  assert.equal(formatAdoDate(iso), `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`);
  assert.equal(formatAdoDate(''), '—');
  assert.equal(formatAdoDate('không phải ngày'), 'không phải ngày');
});

test('htmlToText', () => {
  assert.equal(htmlToText('<p>A &amp; B</p><ul><li>x</li><li>y</li></ul><script>z</script>'), 'A & B\n\n  - x\n\n  - y');
  assert.equal(htmlToText(''), '');
});

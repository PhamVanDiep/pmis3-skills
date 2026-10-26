import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseArgs, markdownToAdoHtml, htmlToText, parseFieldArgs, splitIdList, REL_MAP,
  resolveProject, missingFieldFromError, formatIdentity, formatAdoDate, checkPushed,
  collectionFromRemote, resolveCollectionUrl, rulesFor, serverUrlOf, collectionNameOf,
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

// ------------------------------------------------------------- checkPushed ---

function gitTmp() {
  const home = mkdtempSync(join(tmpdir(), 'azdo-cp-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, 'nocfg') };
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, env, stdio: 'pipe' });
  const mk = (parent, name, { remote = true, ahead = false } = {}) => {
    const dir = join(parent, name);
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'config', 'user.email', 't@t');
    writeFileSync(join(dir, 'a'), '1');
    git(dir, 'add', '.');
    git(dir, 'commit', '-m', 'c');
    if (remote) {
      const bare = join(parent, name + '.git');
      git(parent, 'init', '--bare', '-b', 'main', bare);
      git(dir, 'remote', 'add', 'origin', bare);
      git(dir, 'push', '-u', 'origin', 'main');
      if (ahead) { writeFileSync(join(dir, 'b'), '2'); git(dir, 'add', '.'); git(dir, 'commit', '-m', 'd'); }
    }
    return dir;
  };
  return { home, mk };
}

test('checkPushed: repo đã push -> ok', () => {
  const { home, mk } = gitTmp();
  try {
    const d = mk(home, 'r');
    const res = checkPushed(d);
    assert.equal(res.ok, true);
    assert.equal(res.repos.length, 1);
    assert.match(res.repos[0].reason, /đã push đầy đủ lên origin\/main/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('checkPushed: commit chưa push và không có upstream -> not ok, mỗi repo một dòng', () => {
  const { home, mk } = gitTmp();
  try {
    const ws = join(home, 'ws');
    mkdirSync(ws);
    mk(ws, 'good');
    mk(ws, 'ahead', { ahead: true });
    mk(ws, 'noup', { remote: false });
    const res = checkPushed(ws);
    assert.equal(res.ok, false);
    assert.equal(res.repos.length, 3);
    assert.match(res.reason, /ahead.*còn 1 commit chưa push/);
    assert.match(res.reason, /noup.*chưa có upstream/);
    assert.ok(!res.reason.includes('good'));
    assert.equal(res.reason.split('\n').length, 2);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('checkPushed: không có repo nào', () => {
  const home = mkdtempSync(join(tmpdir(), 'azdo-cp-'));
  try {
    const res = checkPushed(home);
    assert.equal(res.ok, false);
    assert.ok(res.reason.startsWith(`không tìm thấy git repo trong ${home}`));
    assert.match(res.reason, /\(git: .+\)$/); // kèm dòng đầu stderr của git
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('checkPushed: cwd nằm trong repo ngoài che các repo con -> vẫn quét repo con cấp 1', () => {
  const { home, mk } = gitTmp();
  try {
    const outer = join(home, 'outer');
    mkdirSync(outer);
    execFileSync('git', ['init', '-b', 'main'], { cwd: outer, stdio: 'pipe' });
    const ws = join(outer, 'ws');
    mkdirSync(ws);
    mk(ws, 'a');
    mk(ws, 'b', { ahead: true });
    const res = checkPushed(ws);
    assert.equal(res.repos.length, 2);
    assert.equal(res.ok, false);
    assert.match(res.reason, /^b: còn 1 commit chưa push/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('parseArgs: thừa đối số vị trí và cờ -- bị từ chối', () => {
  assert.throws(() => parseArgs(['comment', '123', 'Đã', 'sửa', 'lỗi', '-Yes']), /Thừa đối số: 'sửa'.*nháy kép/);
  assert.throws(() => parseArgs(['finish', '1', '-Comment', 'Đã', 'sửa', '-Yes']), /Thừa đối số: 'sửa'/);
  assert.throws(() => parseArgs(['state', '1', 'Done', '--yes']), /Cờ không hợp lệ: --yes/);
});

test('missingFieldFromError: tên thân thiện có khoảng trắng', () => {
  assert.equal(missingFieldFromError('TF401320: Rule Error for field Resolved Reason. Error code: Required'), 'Resolved Reason');
  assert.equal(missingFieldFromError('TF401320: Rule Error for field Microsoft.VSTS.Common.ResolvedReason. Error code: Required'), 'Microsoft.VSTS.Common.ResolvedReason');
  assert.equal(missingFieldFromError('TF401320: Rule Error for field Foo'), 'Foo');
});

const CFG = {
  collectionUrl: 'https://devops.evn.com.vn/EVNCollection',
  closedStates: ['Done', 'Removed'],
  workflow: {
    Bug: { allowedFrom: ['New', 'Reopened'], doneState: 'Committed' },
    Task: { allowedFrom: ['To Do'], doneState: 'Done' },
  },
  collections: {
    QUANTRI: { workflow: { Bug: { allowedFrom: ['New', 'Reopen'], doneState: 'Committed' } } },
    KTVH: { closedStates: ['Done', 'Closed'] },
  },
};

test('collectionFromRemote: https, ssh, URL rút gọn, không phải Azure DevOps', () => {
  assert.equal(collectionFromRemote('https://devops.evn.com.vn/QUANTRI/PMAT/_git/pmat-be'), 'QUANTRI');
  assert.equal(collectionFromRemote('https://u@devops.evn.com.vn/EVNCollection/PMIS3-NGUON/_git/x'), 'EVNCollection');
  assert.equal(collectionFromRemote('ssh://devops.evn.com.vn:22/KTVH/ETMS/_git/etms'), 'KTVH');
  assert.equal(collectionFromRemote('https://devops.evn.com.vn/tfs/QUANTRI/PMAT/_git/x'), 'QUANTRI');
  assert.equal(collectionFromRemote('https://devops.evn.com.vn/QUANTRI/_git/PMAT'), 'QUANTRI');
  assert.equal(collectionFromRemote('git@github.com:PhamVanDiep/pmis3-skills.git'), null);
  assert.equal(collectionFromRemote('https://github.com/a/b.git'), null);
  assert.equal(collectionFromRemote(''), null);
});

test('resolveCollectionUrl: env > remote (ghép với server của config) > config', () => {
  const remote = 'https://evil.example/QUANTRI/PMAT/_git/x';
  assert.equal(resolveCollectionUrl({ envUrl: 'http://127.0.0.1:5/Fake/', gitRemote: remote, cfg: CFG }), 'http://127.0.0.1:5/Fake');
  assert.equal(resolveCollectionUrl({ gitRemote: remote, cfg: CFG }), 'https://devops.evn.com.vn/QUANTRI');
  assert.equal(resolveCollectionUrl({ gitRemote: '', cfg: CFG }), 'https://devops.evn.com.vn/EVNCollection');
  assert.equal(serverUrlOf({ ...CFG, serverUrl: 'https://x/tfs/' }), 'https://x/tfs');
  assert.equal(collectionNameOf('https://devops.evn.com.vn/QUANTRI/'), 'QUANTRI');
});

test('rulesFor: ghép workflow theo type, closedStates riêng hoặc mặc định, không phân biệt hoa thường', () => {
  const q = rulesFor(CFG, 'quantri');
  assert.deepEqual(q.workflow.Bug.allowedFrom, ['New', 'Reopen']);
  assert.deepEqual(q.workflow.Task.allowedFrom, ['To Do']);
  assert.deepEqual(q.closedStates, ['Done', 'Removed']);
  assert.deepEqual(rulesFor(CFG, 'KTVH').closedStates, ['Done', 'Closed']);
  assert.deepEqual(rulesFor(CFG, 'EVNCollection').workflow, CFG.workflow);
  assert.deepEqual(rulesFor({ closedStates: ['Done'], workflow: {} }, 'X'), { closedStates: ['Done'], workflow: {} });
});

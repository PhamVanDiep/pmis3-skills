import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMock } from './mock-ado.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, '..', 'azdo.mjs');
const PAT = 'test-pat';

let mock;
let tmpHome;
let cwdDir;

const wi = (id, project, extra = {}) => ({
  id, rev: 1,
  fields: {
    'System.TeamProject': project, 'System.WorkItemType': 'Bug', 'System.Title': `Tiêu đề ${id}`,
    'System.State': 'New', 'System.AssignedTo': { displayName: 'Phạm Văn Điệp' },
    'System.CreatedBy': { displayName: 'Nguyễn A' }, 'System.CreatedDate': '2026-01-02T03:04:05Z',
    'System.ChangedDate': '2026-01-03T03:04:05Z', 'System.IterationPath': 'P\\S1', 'System.AreaPath': 'P',
    'System.Description': '<p>Nội dung <b>mô tả</b></p>', ...extra,
  },
  relations: [{ rel: 'System.LinkTypes.Related', url: 'http://x/_apis/wit/workItems/5', attributes: { name: 'Related' } }],
});

before(async () => {
  tmpHome = mkdtempSync(path.join(tmpdir(), 'azdo-home-'));
  cwdDir = mkdtempSync(path.join(tmpdir(), 'azdo-cwd-'));
  mock = await startMock([
    { method: 'GET', match: (p) => p.endsWith('/_apis/connectionData'), body: { authenticatedUser: { providerDisplayName: 'Phạm Văn Điệp' } } },
    { method: 'POST', match: (p) => p.endsWith('/_apis/wit/wiql'), body: { workItems: [{ id: 101 }, { id: 102 }] } },
    { method: 'GET', match: (p, s) => p.endsWith('/_apis/wit/workitems') && s.includes('ids=101,102'),
      body: { value: [wi(101, 'PMIS3-NGUON'), wi(102, 'KTAT')] } },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/101'), body: wi(101, 'PMIS3-NGUON') },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/103'), body: wi(103, 'PMIS3-NGUON') },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/104'), body: wi(104, 'PMIS3-NGUON', { 'System.WorkItemType': 'Epic' }) },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/105'), body: wi(105, 'PMIS3-NGUON', { 'System.State': 'Closed' }) },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/106'), body: wi(106, 'KTAT') },
    { method: 'GET', match: (p) => p.endsWith('/_apis/wit/workitems/107'), body: wi(107, 'PMIS3-NGUON', { 'System.State': 'new' }) },
    { method: 'PATCH', match: (p) => p.endsWith('/_apis/wit/workitems/103'), status: 400,
      body: { message: 'TF401320: Rule Error for field Microsoft.VSTS.Common.ResolvedReason. Error code: Required' } },
    { method: 'PATCH', match: (p) => /\/_apis\/wit\/workitems\/\d+$/.test(p), body: { id: 101 } },
    { method: 'POST', match: (p) => p.endsWith('/KTAT/_apis/wit/workitems/$Task'), body: { id: 777 } },
    { method: 'GET', match: (p) => p.endsWith('/Task/states'), body: { value: [{ name: 'To Do', category: 'Proposed' }] } },
    { method: 'GET', match: (p) => p.endsWith('/Epic/states'), body: { value: [{ name: 'New', category: 'Proposed' }] } },
    { method: 'GET', match: (p) => p.endsWith('/workItems/101/comments'),
      body: { comments: [{ text: '<div>bình luận</div>', createdDate: '2026-01-04T00:00:00Z', createdBy: { displayName: 'B' } }] } },
    { method: 'GET', match: (p) => p.endsWith('/Bug/states'), body: { value: [{ name: 'New', category: 'Proposed' }, { name: 'Committed', category: 'InProgress' }] } },
    { method: 'GET', match: (p) => p.endsWith('/Ticket/fields'),
      body: { value: [{ referenceName: 'System.Title', name: 'Title', alwaysRequired: true }, { referenceName: 'X.Y', name: 'Y', alwaysRequired: false }] } },
    { method: 'GET', match: (p) => p.endsWith('/workitems/401'), status: 401, contentType: 'text/html', body: '<html><body><h1>Unauthorized</h1></body></html>' },
  ]);
});
after(async () => {
  await mock.close();
  rmSync(tmpHome, { recursive: true, force: true });
  rmSync(cwdDir, { recursive: true, force: true });
});

function run(args, envOver = {}, cwd = cwdDir) {
  return new Promise((resolve) => {
    const env = {
      ...process.env, AZDO_PAT: PAT, AZDO_COLLECTION_URL: mock.url,
      HOME: tmpHome, USERPROFILE: tmpHome, AZDO_PROJECT: '', ...envOver,
    };
    const p = spawn(process.execPath, [SCRIPT, ...args], { env, cwd });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('whoami in tên đăng nhập và gửi Basic auth đúng', async () => {
  mock.requests.length = 0;
  const r = await run(['whoami']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /Đăng nhập     : Phạm Văn Điệp/);
  assert.equal(mock.requests[0].headers.authorization, 'Basic ' + Buffer.from(':' + PAT).toString('base64'));
  assert.ok(!r.stdout.includes(PAT) && !r.stderr.includes(PAT));
});

test('mine -All: WIQL cấp collection rồi GET workitems', async () => {
  mock.requests.length = 0;
  const r = await run(['mine', '-All']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(mock.requests[0].method, 'POST');
  assert.equal(mock.requests[0].path, '/EVNCollection/_apis/wit/wiql');
  assert.ok(JSON.parse(mock.requests[0].body).query.includes('@Me'));
  assert.equal(mock.requests[1].method, 'GET');
  assert.match(r.stdout, /ID       PROJECT        TYPE                   STATE          TITLE/);
  assert.match(r.stdout, /101      PMIS3-NGUON    Bug                    New            Tiêu đề 101/);
  assert.match(r.stdout, /102      KTAT/);
});

test('mine với AZDO_PROJECT=KTAT: WIQL theo project', async () => {
  mock.requests.length = 0;
  const r = await run(['mine'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(mock.requests[0].path, '/EVNCollection/KTAT/_apis/wit/wiql');
  assert.ok(JSON.parse(mock.requests[0].body).query.includes('[System.TeamProject] = @project'));
  assert.match(r.stdout, /chỉ project của repo này/);
});

test('show khác project: cảnh báo ở stderr, exit 0', async () => {
  const r = await run(['show', '101'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /CẢNH BÁO.*thuộc project 'PMIS3-NGUON'/);
  assert.match(r.stdout, /--- MÔ TẢ ---/);
  assert.match(r.stdout, /Project     : PMIS3-NGUON/);
  assert.match(r.stdout, /--- LIÊN KẾT \/ ĐÍNH KÈM ---/);
  assert.match(r.stdout, /--- THẢO LUẬN \(1\) ---/);
  assert.match(r.stdout, /_workitems\/edit\/101/);
});

test('states Bug', async () => {
  const r = await run(['states', 'Bug'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /Các state hợp lệ của 'Bug' \(project KTAT\):/);
  assert.match(r.stdout, /^ {3}1\. New {14}\[Proposed\]$/m);
  assert.match(r.stdout, /^ {3}2\. Committed {8}\[InProgress\]$/m);
});

test('required Ticket', async () => {
  const r = await run(['required', 'Ticket'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /Field bắt buộc \(alwaysRequired\) của 'Ticket' \(project KTAT\):/);
  assert.match(r.stdout, /^ {2}System\.Title {34}Title$/m);
  assert.ok(!r.stdout.includes('X.Y'));
});

test('HTTP 401 HTML: exit 1, thông điệp đọc được, không lộ PAT', async () => {
  const r = await run(['show', '401']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /PAT bị từ chối/);
  assert.match(r.stderr, /^Lỗi: /m);
  assert.ok(!r.stderr.includes(PAT) && !r.stdout.includes(PAT));
  assert.ok(!/\n\s+at /.test(r.stderr), 'không có stack trace');
});

test('Không có PAT: exit 1 với hướng dẫn', async () => {
  const r = await run(['whoami'], { AZDO_PAT: '', AZDO_CREDENTIALS_FILES: path.join(tmpHome, 'none.json') });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Chưa có PAT Azure DevOps/);
});

test('Command sai: exit 1', async () => {
  const r = await run(['bogus']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Command không hợp lệ/);
});

// ---------------------------------------------------------------- lệnh ghi ---

const patches = () => mock.requests.filter((r) => r.method === 'PATCH');
const gitEnv = (home) => ({ ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(home, 'nogitconfig') });
const git = (cwd, home, ...a) => execFileSync('git', a, { cwd, env: gitEnv(home), stdio: 'pipe' });
function makeRepo(parent, name, home, { push = true } = {}) {
  const bare = path.join(parent, name + '.git');
  const dir = path.join(parent, name);
  mkdirSync(dir, { recursive: true });
  git(parent, home, 'init', '--bare', '-b', 'main', bare);
  git(dir, home, 'init', '-b', 'main');
  git(dir, home, 'config', 'user.name', 't');
  git(dir, home, 'config', 'user.email', 't@t');
  git(dir, home, 'remote', 'add', 'origin', bare);
  writeFileSync(path.join(dir, 'a.txt'), '1');
  git(dir, home, 'add', '.');
  git(dir, home, 'commit', '-m', 'c1');
  git(dir, home, 'push', '-u', 'origin', 'main');
  if (!push) {
    writeFileSync(path.join(dir, 'b.txt'), '2');
    git(dir, home, 'add', '.');
    git(dir, home, 'commit', '-m', 'c2');
  }
  return dir;
}

test('comment -Yes: PATCH json-patch System.History nguyên chuỗi, không BOM', async () => {
  mock.requests.length = 0;
  const text = 'Đã sửa "x" ở `abc` — 100% $HOME\nxuống dòng';
  const r = await run(['comment', '101', text, '-Yes']);
  assert.equal(r.code, 0, r.stderr);
  const p = patches();
  assert.equal(p.length, 1);
  assert.equal(p[0].path, '/EVNCollection/_apis/wit/workitems/101');
  assert.equal(p[0].headers['content-type'], 'application/json-patch+json');
  assert.ok(!p[0].body.startsWith('﻿'));
  assert.deepEqual(JSON.parse(p[0].body), [{ op: 'add', path: '/fields/System.History', value: text }]);
  assert.match(r.stdout, /Đã thêm comment vào #101\./);
});

test('comment không -Yes: CHẠY KHÔ, không PATCH', async () => {
  mock.requests.length = 0;
  const r = await run(['comment', '101', 'abc']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /CHẠY KHÔ/);
  assert.equal(patches().length, 0);
});

test('state -Yes: một PATCH gồm State, field, History', async () => {
  mock.requests.length = 0;
  const r = await run(['state', '101', 'Committed', '-Comment', 'c', '-Field', 'A=1', '-Yes']);
  assert.equal(r.code, 0, r.stderr);
  const p = patches();
  assert.equal(p.length, 1);
  assert.deepEqual(JSON.parse(p[0].body), [
    { op: 'add', path: '/fields/System.State', value: 'Committed' },
    { op: 'add', path: '/fields/A', value: '1' },
    { op: 'add', path: '/fields/System.History', value: 'c' },
  ]);
  assert.match(r.stdout, /#101 \[Bug\] : 'New' -> 'Committed'\. Xong\./);
});

test('state sai: exit 1 và in danh sách đánh số', async () => {
  const r = await run(['state', '101', 'Sai']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /'Sai' không phải state hợp lệ của 'Bug'\./);
  assert.match(r.stdout, /^ {3}1\. New {14}\[Proposed\] {3}<-- hiện tại$/m);
});

test('finish: type không có quy ước -> exit 2; state ngoài allowedFrom -> exit 2', async () => {
  let r = await run(['finish', '104']);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /DỪNG: type 'Epic' không có quy ước tự động/);
  r = await run(['finish', '105']);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /DỪNG: 'Closed' nằm ngoài danh sách tự xử lý của 'Bug'/);
});

test('finish Bug: repo con chưa push -> exit 3; đã push hết -> PATCH Committed', async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'azdo-git-'));
  try {
    const parent = path.join(home, 'ws');
    mkdirSync(parent);
    makeRepo(parent, 'repo-ok', home);
    makeRepo(parent, 'repo-ahead', home, { push: false });
    mock.requests.length = 0;
    let r = await run(['finish', '101', '-Yes'], {}, parent);
    assert.equal(r.code, 3, r.stdout + r.stderr);
    assert.match(r.stdout, /repo-ahead/);
    assert.equal(patches().length, 0);
    git(path.join(parent, 'repo-ahead'), home, 'push');
    r = await run(['finish', '101', '-Yes'], {}, parent);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.equal(patches().length, 1);
    assert.equal(JSON.parse(patches()[0].body)[0].value, 'Committed');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('TF401320: exit 5 và in DỪNG: chuyển sang', async () => {
  const r = await run(['state', '103', 'Committed', '-Yes']);
  assert.equal(r.code, 5);
  assert.match(r.stdout, /DỪNG: chuyển sang 'Committed' đòi field 'Microsoft\.VSTS\.Common\.ResolvedReason'/);
});

test('khác project: ghi bị chặn exit 4, -CrossProject cho qua', async () => {
  for (const args of [['comment', '101', 'x', '-Yes'], ['state', '101', 'Committed', '-Yes'], ['finish', '101', '-Yes'],
    ['update', '101', 'T', '-Yes'], ['link', '101', '-Related', '5', '-Yes']]) {
    mock.requests.length = 0;
    const r = await run(args, { AZDO_PROJECT: 'KTAT' });
    assert.equal(r.code, 4, args[0] + r.stdout + r.stderr);
    assert.equal(patches().length, 0);
  }
  mock.requests.length = 0;
  const r = await run(['comment', '101', 'x', '-Yes', '-CrossProject'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(patches().length, 1);
});

test('create Task -Yes: POST với HTML mô tả và relation Parent', async () => {
  mock.requests.length = 0;
  const r = await run(['create', 'Task', 'Tiêu đề', '-Description', '**a**', '-Parent', '5', '-Yes'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const post = mock.requests.find((q) => q.method === 'POST');
  assert.equal(post.path, '/EVNCollection/KTAT/_apis/wit/workitems/$Task');
  assert.equal(post.headers['content-type'], 'application/json-patch+json');
  const body = JSON.parse(post.body);
  assert.ok(body.some((o) => o.path === '/fields/System.Title' && o.value === 'Tiêu đề'));
  assert.ok(body.some((o) => o.path === '/fields/System.Description' && o.value.includes('<strong>a</strong>')));
  assert.ok(body.some((o) => o.path === '/relations/-' && o.value.rel === 'System.LinkTypes.Hierarchy-Reverse'));
  assert.match(r.stdout, /Đã tạo #777 \[Task\]/);
});

test('create -Project khác AZDO_PROJECT: exit 4', async () => {
  mock.requests.length = 0;
  const r = await run(['create', 'Task', 'T', '-Project', 'PMIS3-NGUON', '-Yes'], { AZDO_PROJECT: 'KTAT' });
  assert.equal(r.code, 4);
  assert.equal(mock.requests.length, 0);
});

test('link -BlockedBy "7,8": 2 PATCH Dependency-Reverse', async () => {
  mock.requests.length = 0;
  const r = await run(['link', '101', '-BlockedBy', '7,8', '-Yes']);
  assert.equal(r.code, 0, r.stderr);
  const p = patches();
  assert.equal(p.length, 2);
  const b = p.map((x) => JSON.parse(x.body)[0]);
  assert.ok(b.every((o) => o.path === '/relations/-' && o.value.rel === 'System.LinkTypes.Dependency-Reverse'));
  assert.deepEqual(b.map((o) => o.value.url.split('/').pop()), ['7', '8']);
});

test('update: PATCH Title và Tags', async () => {
  mock.requests.length = 0;
  const r = await run(['update', '101', 'Tiêu đề mới', '-Tags', 'x', '-Yes']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(patches()[0].body), [
    { op: 'add', path: '/fields/System.Title', value: 'Tiêu đề mới' },
    { op: 'add', path: '/fields/System.Tags', value: 'x' },
  ]);
});

test('AZDO_PROJECT=ktat so với item KTAT: không phân biệt hoa thường, không exit 4', async () => {
  mock.requests.length = 0;
  const r = await run(['comment', '106', 'x', '-Yes'], { AZDO_PROJECT: 'ktat' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(patches().length, 1);
});

test('create -Project KTAT với AZDO_PROJECT=ktat: không exit 4', async () => {
  mock.requests.length = 0;
  const r = await run(['create', 'Task', 'T', '-Project', 'KTAT', '-Yes'], { AZDO_PROJECT: 'ktat' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
});

test('state đích viết thường -> gửi tên state chuẩn của server', async () => {
  mock.requests.length = 0;
  const r = await run(['state', '101', 'committed', '-Yes'], { AZDO_PROJECT: 'pmis3-nguon' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(patches()[0].body)[0].value, 'Committed');
  assert.match(r.stdout, /'New' -> 'Committed'/);
});

test('finish: allowedFrom không phân biệt hoa thường', async () => {
  const r = await run(['finish', '107']);
  assert.notEqual(r.code, 2, r.stdout + r.stderr);
  assert.equal(r.code, 3, r.stdout + r.stderr);
});

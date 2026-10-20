import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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

function run(args, envOver = {}) {
  return new Promise((resolve) => {
    const env = {
      ...process.env, AZDO_PAT: PAT, AZDO_COLLECTION_URL: mock.url,
      HOME: tmpHome, USERPROFILE: tmpHome, AZDO_PROJECT: '', ...envOver,
    };
    const p = spawn(process.execPath, [SCRIPT, ...args], { env, cwd: cwdDir });
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

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cronLine, parseCliArgs, renameSkill, syncSkills, withoutTask } from '../sync-agent-skills.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sync-agent-skills.mjs');
const REPO = path.join(path.dirname(SCRIPT), '..');

let root;
let repo;
let dest;

function addSkill(plugin, skill, name = skill) {
  const dir = path.join(repo, 'plugins', plugin, 'skills', skill);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Tiếng Việt có dấu\n---\n\nname: giữ nguyên\n`);
}

const nameOf = (skill) => readFileSync(path.join(dest, skill, 'SKILL.md'), 'utf8').match(/^name: (.*)$/m)[1];

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'sync-skills-'));
  repo = path.join(root, 'repo');
  dest = path.join(root, 'dest');
  addSkill('pmis3-frontend', 'testing');
  addSkill('pmis3-frontend', 'routing');
  addSkill('pmis3-backend', 'testing');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test('tách tên hai skill testing và đổi name khớp thư mục', () => {
  syncSkills({ repo, dest, plugins: ['pmis3-frontend', 'pmis3-backend'] });
  assert.equal(nameOf('pmis3-frontend-testing'), 'pmis3-frontend-testing');
  assert.equal(nameOf('pmis3-backend-testing'), 'pmis3-backend-testing');
  assert.equal(nameOf('routing'), 'routing');
  assert.equal(existsSync(path.join(dest, 'testing')), false);
});

test('chỉ đổi dòng name đầu tiên và giữ nguyên tiếng Việt', () => {
  const out = renameSkill('---\r\nname: a\r\ndescription: Dấu\r\n---\r\nname: b\r\n', 'moi');
  assert.equal(out, '---\r\nname: moi\r\ndescription: Dấu\r\n---\r\nname: b\r\n');
});

test('gỡ skill đã bị xóa khỏi repo nhưng không đụng skill của người khác', () => {
  syncSkills({ repo, dest, plugins: ['pmis3-frontend'] });
  mkdirSync(path.join(dest, 'skill-rieng'));
  rmSync(path.join(repo, 'plugins', 'pmis3-frontend', 'skills', 'routing'), { recursive: true });

  const { removed } = syncSkills({ repo, dest, plugins: ['pmis3-frontend'] });

  assert.deepEqual(removed, ['routing']);
  assert.equal(existsSync(path.join(dest, 'routing')), false);
  assert.equal(existsSync(path.join(dest, 'skill-rieng')), true);
});

test('manifest hỏng không chặn đồng bộ và không xóa ngoài thư mục đích', () => {
  mkdirSync(dest, { recursive: true });
  const outside = path.join(root, 'ngoai');
  mkdirSync(outside);
  writeFileSync(path.join(dest, '.pmis3-skills.json'), JSON.stringify({ skills: ['../ngoai'] }));
  syncSkills({ repo, dest, plugins: ['pmis3-frontend'] });
  assert.equal(existsSync(outside), true);

  writeFileSync(path.join(dest, '.pmis3-skills.json'), '{hỏng');
  assert.doesNotThrow(() => syncSkills({ repo, dest, plugins: ['pmis3-frontend'] }));
});

test('--scheduled bỏ qua khi vừa đồng bộ trong 12 giờ', () => {
  const run = (...args) => execFileSync(process.execPath, [SCRIPT, '--no-pull', '--dest', dest, ...args], { encoding: 'utf8' });
  assert.match(run('--plugins', 'pmis3-backend'), /Đã đồng bộ 14 skill/);
  assert.equal(run('--scheduled', '--plugins', 'pmis3-backend'), '');
});

test('đồng bộ repo thật: đủ skill, name khớp thư mục', () => {
  const { installed } = syncSkills({ repo: REPO, dest, plugins: ['pmis3-frontend', 'pmis3-backend', 'pmis3-workflow'] });
  assert.equal(new Set(installed).size, installed.length);
  assert.equal(installed.length, 41);
  for (const skill of installed) assert.equal(nameOf(skill), skill);
});

test('cron gọi mỗi giờ và cài lại không sinh dòng trùng', () => {
  const line = cronLine({ node: '/usr/bin/node', script: '/s.mjs', args: ['--scheduled'], pathEnv: '/usr/bin', log: '/l.log' });
  assert.match(line, /^0 \* \* \* \* PATH='\/usr\/bin' '\/usr\/bin\/node' '\/s\.mjs' '--scheduled' >> '\/l\.log' 2>&1 # pmis3-skills-sync$/);
  assert.deepEqual(withoutTask(`MAILTO=x\n${line}\n`), ['MAILTO=x']);
});

test('từ chối plugin không tồn tại', () => {
  assert.throws(() => parseCliArgs(['--plugins', 'pmis3-khac']), /--plugins chỉ nhận/);
});

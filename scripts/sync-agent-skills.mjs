#!/usr/bin/env node
// Đồng bộ skill sang ~/.agents/skills cho Codex và Cursor, chạy được trên Linux/macOS/Windows.
// Claude Code không cần script này: nó cài qua /plugin.
//
//   node scripts/sync-agent-skills.mjs                     # pull rồi đồng bộ
//   node scripts/sync-agent-skills.mjs --plugins pmis3-backend,pmis3-workflow
//   node scripts/sync-agent-skills.mjs --install-schedule  # đồng bộ + đặt lịch tự chạy
//   node scripts/sync-agent-skills.mjs --remove-schedule
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const REPO = path.dirname(HERE);
const ALL_PLUGINS = ['pmis3-frontend', 'pmis3-backend', 'pmis3-workflow'];
const MANIFEST = '.pmis3-skills.json';
const TASK_NAME = 'pmis3-skills-sync';
const INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 giờ, cùng nhịp với hook check-update

export function parseCliArgs(argv) {
  const opts = {
    plugins: ALL_PLUGINS,
    dest: path.join(os.homedir(), '.agents', 'skills'),
    pull: true,
    scheduled: false,
    installSchedule: false,
    removeSchedule: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--plugins') opts.plugins = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--dest') opts.dest = path.resolve(argv[++i] ?? '');
    else if (arg === '--no-pull') opts.pull = false;
    else if (arg === '--scheduled') opts.scheduled = true;
    else if (arg === '--install-schedule') opts.installSchedule = true;
    else if (arg === '--remove-schedule') opts.removeSchedule = true;
    else throw new Error(`Tham số không hợp lệ: ${arg}`);
  }
  const unknown = opts.plugins.filter((p) => !ALL_PLUGINS.includes(p));
  if (unknown.length || !opts.plugins.length) {
    throw new Error(`--plugins chỉ nhận: ${ALL_PLUGINS.join(', ')}`);
  }
  return opts;
}

// frontend và backend đều có skill `testing`; gộp về một thư mục thì phải tách tên.
export const skillName = (plugin, skill) => (skill === 'testing' ? `${plugin}-testing` : skill);

// Cursor bắt buộc `name` trùng tên thư mục. Không có `.` khớp \r nên giữ nguyên kiểu xuống dòng.
export const renameSkill = (text, name) => text.replace(/^name:.*$/m, `name: ${name}`);

function readManifest(dest) {
  try {
    return JSON.parse(readFileSync(path.join(dest, MANIFEST), 'utf8'));
  } catch {
    return { skills: [], syncedAt: 0 };
  }
}

export function syncSkills({ repo, dest, plugins }) {
  mkdirSync(dest, { recursive: true });
  const previous = readManifest(dest).skills ?? [];
  const installed = [];

  for (const plugin of plugins) {
    const source = path.join(repo, 'plugins', plugin, 'skills');
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = skillName(plugin, entry.name);
      const target = path.join(dest, name);
      rmSync(target, { recursive: true, force: true });
      cpSync(path.join(source, entry.name), target, { recursive: true });
      const md = path.join(target, 'SKILL.md');
      writeFileSync(md, renameSkill(readFileSync(md, 'utf8'), name));
      installed.push(name);
    }
  }

  // Chỉ dọn skill do chính script này cài, không đụng skill khác trong thư mục dùng chung.
  const removed = previous.filter((name) => !installed.includes(name) && name === path.basename(name));
  for (const name of removed) rmSync(path.join(dest, name), { recursive: true, force: true });

  writeFileSync(path.join(dest, MANIFEST), JSON.stringify({ skills: installed, syncedAt: Date.now() }, null, 2));
  return { installed, removed };
}

export const scheduleArgs = (opts) => {
  const args = ['--scheduled', '--plugins', opts.plugins.join(',')];
  return opts.dest === parseCliArgs([]).dest ? args : [...args, '--dest', opts.dest];
};

export function cronLine({ node, script, args, pathEnv, log }) {
  const command = [node, script, ...args].map((part) => `'${part}'`).join(' ');
  return `0 * * * * PATH='${pathEnv}' ${command} >> '${log}' 2>&1 # ${TASK_NAME}`;
}

export const withoutTask = (crontab) => crontab.split('\n').filter((l) => l.trim() && !l.includes(TASK_NAME));

function readCrontab() {
  try {
    return execFileSync('crontab', ['-l'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return ''; // chưa có crontab nào
  }
}

function writeCrontab(lines) {
  execFileSync('crontab', ['-'], { input: lines.length ? `${lines.join('\n')}\n` : '' });
}

function runPowerShell(command) {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
}

function installSchedule(opts) {
  const args = scheduleArgs(opts);
  if (process.platform === 'win32') {
    // Task Scheduler chạy bù được khi máy tắt lúc 8h; console chỉ hiện một lần mỗi ngày.
    const quoted = [SCRIPT, ...args].map((part) => `"${part}"`).join(' ').replaceAll("'", "''");
    runPowerShell([
      `$action = New-ScheduledTaskAction -Execute '${process.execPath}' -Argument '${quoted}'`,
      '$trigger = New-ScheduledTaskTrigger -Daily -At 8am',
      '$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable',
      `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null`,
    ].join('; '));
    return;
  }
  // cron không chạy bù khi máy ngủ, nên gọi mỗi giờ và để --scheduled giới hạn 12 giờ một lần.
  const line = cronLine({
    node: process.execPath,
    script: SCRIPT,
    args,
    pathEnv: process.env.PATH ?? '/usr/bin:/bin',
    log: path.join(path.dirname(opts.dest), `${TASK_NAME}.log`),
  });
  writeCrontab([...withoutTask(readCrontab()), line]);
}

function removeSchedule() {
  if (process.platform === 'win32') {
    runPowerShell(`Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue`);
    return;
  }
  writeCrontab(withoutTask(readCrontab()));
}

function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.removeSchedule) {
    removeSchedule();
    console.log('Đã gỡ lịch tự đồng bộ.');
    return;
  }
  if (opts.scheduled && Date.now() - (readManifest(opts.dest).syncedAt ?? 0) < INTERVAL_MS) return;

  // Pull lỗi thì execFileSync ném lỗi và dừng ở đây, bản skill đang dùng được giữ nguyên.
  if (opts.pull) execFileSync('git', ['-C', REPO, 'pull', '--ff-only', '--quiet'], { stdio: 'inherit' });

  const { installed, removed } = syncSkills({ repo: REPO, dest: opts.dest, plugins: opts.plugins });
  console.log(`Đã đồng bộ ${installed.length} skill vào ${opts.dest}`);
  if (removed.length) console.log(`Đã gỡ skill không còn dùng: ${removed.join(', ')}`);

  if (opts.installSchedule) {
    installSchedule(opts);
    console.log('Đã đặt lịch tự đồng bộ.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

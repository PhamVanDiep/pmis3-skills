// Logic của azdo.ps1, port sang Node để chạy được trên Linux.
// Hầu hết là hàm thuần; chỉ checkPushed chạy git. Không phụ thuộc gói ngoài.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const COMMANDS = ['whoami', 'mine', 'show', 'states', 'required', 'comment', 'state', 'finish', 'create', 'update', 'link'];

// Cờ kiểu PowerShell (một gạch, không phân biệt hoa thường) -> khóa camelCase.
const VALUE_FLAGS = {
  project: 'project', description: 'description', descriptionfile: 'descriptionFile', tags: 'tags',
  assignto: 'assignTo', areapath: 'areaPath', iterationpath: 'iterationPath', descfield: 'descField',
  comment: 'comment', parent: 'parent', related: 'related', blockedby: 'blockedBy',
};
const SWITCH_FLAGS = { html: 'html', all: 'all', crossproject: 'crossProject', yes: 'yes' };

export function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (/^-[A-Za-z]/.test(tok)) {
      const name = tok.slice(1).toLowerCase();
      if (name === 'field') {
        if (i + 1 >= argv.length) throw new Error(`Cờ ${tok} thiếu giá trị`);
        (opts.field ??= []).push(argv[++i]);
      } else if (name in VALUE_FLAGS) {
        if (i + 1 >= argv.length) throw new Error(`Cờ ${tok} thiếu giá trị`);
        opts[VALUE_FLAGS[name]] = argv[++i];
      } else if (name in SWITCH_FLAGS) {
        opts[SWITCH_FLAGS[name]] = true;
      } else {
        throw new Error(`Cờ không hợp lệ: ${tok}`);
      }
    } else {
      positional.push(tok);
    }
  }
  const command = (positional[0] ?? '').toLowerCase();
  if (!COMMANDS.includes(command)) {
    throw new Error(`Command không hợp lệ: '${positional[0] ?? ''}'. Các lệnh hợp lệ: ${COMMANDS.join(', ')}`);
  }
  return { command, arg1: positional[1], arg2: positional[2], opts };
}

// System.Net.WebUtility.HtmlEncode (.NET Framework, như bản ps1 5.1):
// < > & " ' và U+00A0..U+00FF -> thực thể; ký tự khác (kể cả tiếng Việt ngoài Latin-1) giữ nguyên.
export function htmlEncode(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0);
    if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '&') out += '&amp;';
    else if (ch === '"') out += '&quot;';
    else if (ch === "'") out += '&#39;';
    else if (c >= 160 && c < 256) out += `&#${c};`;
    else out += ch;
  }
  return out;
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' };
export function htmlDecode(s) {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z]+));/g, (m, dec, hex, name) => {
    try {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    } catch { return m; }
    return Object.hasOwn(NAMED, name) ? NAMED[name] : m;
  });
}

export function htmlToText(html) {
  if (html == null || String(html).trim() === '') return '';
  let t = String(html);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<li[^>]*>/gi, '\n  - ');
  t = t.replace(/<\/(p|div|tr|li|h[1-6]|ul|ol)>/gi, '\n');
  t = t.replace(/<\/t[dh]>/gi, '  |  ');
  t = t.replace(/<[^>]+>/g, '');
  t = htmlDecode(t);
  t = t.replace(/\r/g, '');
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function formatInline(s) {
  let t = htmlEncode(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

export function markdownToAdoHtml(text) {
  if (text == null || String(text).trim() === '') return '';
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = '';
  let inTable = false;
  let isHead = false;
  const flushPara = () => { if (para.length) { out.push('<p>' + formatInline(para.join(' ')) + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = ''; } };

  for (const raw of lines) {
    const trim = raw.trim();
    let m;

    if (/^\|.*\|$/.test(trim)) {
      flushPara();
      closeList();
      if (!inTable) {
        out.push('<table border="1" style="border-collapse:collapse">');
        inTable = true; isHead = true;
      }
      if (/^\|[\s:\-|]+\|$/.test(trim)) { isHead = false; continue; }
      const cells = trim.replace(/^\|+|\|+$/g, '').split('|');
      const tag = isHead ? 'th' : 'td';
      let row = '<tr>';
      for (const c of cells) row += `<${tag}>` + formatInline(c.trim()) + `</${tag}>`;
      out.push(row + '</tr>');
      continue;
    }
    if (inTable) { out.push('</table>'); inTable = false; }

    if (trim === '') { flushPara(); closeList(); continue; }

    if (/^(---+|===+|\*\*\*+)$/.test(trim)) {
      flushPara(); closeList();
      out.push('<hr />');
      continue;
    }

    if ((m = /^(#{1,6})\s+(.*)$/.exec(trim))) {
      flushPara(); closeList();
      const lvl = Math.min(m[1].length + 1, 6);
      out.push(`<h${lvl}>` + formatInline(m[2]) + `</h${lvl}>`);
      continue;
    }

    if ((m = /^>\s?(.*)$/.exec(trim))) {
      flushPara(); closeList();
      out.push('<blockquote>' + formatInline(m[1]) + '</blockquote>');
      continue;
    }

    if ((m = /^[-*+]\s+(.*)$/.exec(trim))) {
      flushPara();
      if (list !== 'ul') {
        if (list) out.push(`</${list}>`);
        out.push('<ul>'); list = 'ul';
      }
      out.push('<li>' + formatInline(m[1]) + '</li>');
      continue;
    }

    if ((m = /^\d+\.\s+(.*)$/.exec(trim))) {
      flushPara();
      if (list !== 'ol') {
        if (list) out.push(`</${list}>`);
        out.push('<ol>'); list = 'ol';
      }
      out.push('<li>' + formatInline(m[1]) + '</li>');
      continue;
    }

    if (list && /^\s{2,}\S/.test(raw)) {
      out.push(' ' + formatInline(trim));
      continue;
    }

    closeList();
    para.push(trim);
  }

  flushPara();
  closeList();
  if (inTable) out.push('</table>');
  return out.join('\n');
}

export function parseFieldArgs(list) {
  const res = {};
  for (const kv of list ?? []) {
    const m = /^([^=]+)=([\s\S]*)$/.exec(kv);
    if (!m) throw new Error(`Cờ -Field phải có dạng 'TenField=Gia tri', nhận được: ${kv}`);
    res[m[1]] = m[2];
  }
  return res;
}

export function splitIdList(s) {
  if (s == null || String(s).trim() === '') return [];
  return String(s).split(/[,;\s]+/).filter((x) => /^\d+$/.test(x));
}

export const REL_MAP = {
  Parent: 'System.LinkTypes.Hierarchy-Reverse',
  Child: 'System.LinkTypes.Hierarchy-Forward',
  Related: 'System.LinkTypes.Related',
  BlockedBy: 'System.LinkTypes.Dependency-Reverse',
  Blocks: 'System.LinkTypes.Dependency-Forward',
};

function projectFromRemote(remote) {
  const m = /\/([^/]+)\/_git\//.exec(remote ?? '');
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

// Thứ tự: -Project > AZDO_PROJECT > git remote > defaultProject.
// repoProject (để chặn xuyên project) = AZDO_PROJECT, nếu không có thì git remote, rồi defaultProject.
export function resolveProject({ override, envProject, gitRemote, defaultProject } = {}) {
  const repoProject = envProject || projectFromRemote(gitRemote) || defaultProject || '';
  return { project: override || repoProject, repoProject };
}

// Lưu ý: regex gốc của ps1 cắt tại dấu chấm đầu tiên nên chỉ ra "Microsoft";
// ở đây lấy trọn tên field (dấu chấm kết câu được bỏ).
export function missingFieldFromError(msg) {
  const m = /TF401320[^:]*:\s*Rule Error for field\s+([^\s]+?)\.?(?:\s|$)/.exec(msg ?? '');
  return m ? m[1] : null;
}

export function formatIdentity(v) {
  if (v == null) return '—';
  if (typeof v === 'object') {
    for (const k of ['displayName', 'providerDisplayName', 'customDisplayName', 'uniqueName']) {
      if (v[k]) return String(v[k]);
    }
    return '—';
  }
  return String(v);
}

export function formatAdoDate(iso) {
  if (iso == null || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- git push ---

function gitOut(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// Như Test-BranchPushed của ps1, cho một repo: không có upstream = chưa push.
function checkOneRepo(dir) {
  const res = { path: dir, branch: '', ok: false, reason: '' };
  try {
    const branch = gitOut(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    res.branch = branch;
    let upstream = '';
    try { upstream = gitOut(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { /* không có upstream */ }
    if (!upstream) {
      res.reason = `nhánh '${branch}' chưa có upstream (chưa push lần nào)`;
      return res;
    }
    const ahead = Number(gitOut(dir, ['rev-list', '--count', `${upstream}..HEAD`]));
    if (ahead > 0) {
      res.reason = `còn ${ahead} commit chưa push trên nhánh '${branch}'`;
      return res;
    }
    res.ok = true;
    res.reason = `nhánh '${branch}' đã push đầy đủ lên ${upstream}`;
  } catch (e) {
    res.reason = `không kiểm tra được trạng thái git: ${String(e.message).split('\n')[0]}`;
  }
  return res;
}

function normPath(p) {
  let r = path.resolve(p);
  try { r = realpathSync(r); } catch { /* giữ nguyên */ }
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

// Chỉ coi là repo khi gốc repo CHÍNH LÀ dir; nếu dir nằm trong một repo ngoài thì không (để còn quét repo con).
function isGitRepo(dir) {
  try { return normPath(gitOut(dir, ['rev-parse', '--show-toplevel'])) === normPath(dir); } catch { return false; }
}

// So sánh không phân biệt hoa thường (Azure DevOps không phân biệt hoa thường tên project/state).
export function eqi(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

// cwd là git repo -> kiểm tra repo đó; không thì quét thư mục con cấp 1 có .git.
export function checkPushed(cwd) {
  let dirs;
  if (isGitRepo(cwd)) {
    dirs = [cwd];
  } else {
    dirs = [];
    let names = [];
    try { names = readdirSync(cwd).sort(); } catch { /* không đọc được */ }
    for (const n of names) {
      const p = path.join(cwd, n);
      try { if (statSync(p).isDirectory() && existsSync(path.join(p, '.git'))) dirs.push(p); } catch { /* bỏ qua */ }
    }
  }
  if (dirs.length === 0) return { ok: false, reason: `không tìm thấy git repo trong ${cwd}`, repos: [] };
  const repos = dirs.map(checkOneRepo);
  const bad = repos.filter((r) => !r.ok);
  if (bad.length === 0) {
    return { ok: true, reason: repos.map((r) => `${path.basename(r.path)}: ${r.reason}`).join('\n'), repos };
  }
  return { ok: false, reason: bad.map((r) => `${path.basename(r.path)}: ${r.reason}`).join('\n'), repos };
}

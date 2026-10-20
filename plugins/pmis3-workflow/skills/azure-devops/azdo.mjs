#!/usr/bin/env node
// Helper Azure DevOps Server (on-prem) cho Claude Code — bản Node của azdo.ps1,
// chạy được trên Linux/macOS/Windows. Xem azdo.ps1 và SKILL.md để biết ngữ nghĩa lệnh.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, htmlToText, resolveProject, formatIdentity, formatAdoDate,
} from './azdo-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

class AdoError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AdoError';
    this.status = status;
  }
}

const out = (s = '') => process.stdout.write(s + '\n');
const warn = (s) => process.stderr.write('CẢNH BÁO: ' + s + '\n');
const padR = (s, n) => String(s ?? '').padEnd(n);
const padL = (s, n) => String(s ?? '').padStart(n);

// ------------------------------------------------------------ config / PAT --

function readConfig() {
  const p = path.join(HERE, 'azdo.config.json');
  if (!existsSync(p)) throw new Error(`Không tìm thấy config: ${p}`);
  return JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

function collectionUrl(cfg) {
  return String(process.env.AZDO_COLLECTION_URL || cfg.collectionUrl || '').replace(/\/+$/, '');
}

// AZDO_CREDENTIALS_FILES (danh sách phân cách bởi path.delimiter) ghi đè danh sách mặc định — dùng cho test.
function credentialPaths() {
  if (process.env.AZDO_CREDENTIALS_FILES) return process.env.AZDO_CREDENTIALS_FILES.split(path.delimiter).filter(Boolean);
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return [path.join(HERE, 'azdo.credentials.json'), path.join(home, '.claude', 'azdo.credentials.json')];
}

function readPat(cfg) {
  const env = (process.env.AZDO_PAT || '').trim();
  if (env) return env;
  for (const p of credentialPaths()) {
    if (!existsSync(p)) continue;
    let cred;
    try {
      cred = JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
    } catch {
      throw new Error(`File credentials không phải JSON hợp lệ: ${p}. Nội dung mong đợi: { "pat": "..." }`);
    }
    const pat = String(cred?.pat ?? '').trim();
    if (pat) return pat;
    throw new Error(`File credentials thiếu trường 'pat': ${p}`);
  }
  const hint = credentialPaths().map((p) => `  - ${p}`).join('\n');
  throw new Error(
    'Chưa có PAT Azure DevOps. Tạo PAT (scope: Work Items - Read & Write) tại '
    + `${collectionUrl(cfg)}/_usersSettings/tokens `
    + `rồi lưu vào một trong các file sau (nội dung: { "pat": "..." }):\n${hint}\n`
    + 'Hoặc đặt biến môi trường AZDO_PAT.');
}

// ------------------------------------------------------------------- HTTP ---

function makeAdo(cfg) {
  return async function ado(url, { method = 'GET', body, contentType = 'application/json' } = {}) {
    // Đọc PAT trước khi gọi mạng: thiếu PAT thì ném lỗi ngay. PAT chỉ nằm trong header trong tiến trình.
    const auth = 'Basic ' + Buffer.from(':' + readPat(cfg), 'ascii').toString('base64');
    const headers = { Authorization: auth, Accept: 'application/json' };
    const init = { method, headers };
    if (body !== undefined && body !== null && body !== '') {
      headers['Content-Type'] = contentType;
      init.body = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8'); // UTF-8 không BOM
    }
    const res = await fetch(url, init);
    const raw = await res.text();
    if (!res.ok) {
      let msg = raw;
      try {
        const err = JSON.parse(raw);
        if (err && err.message) msg = err.message;
      } catch {
        msg = htmlToText(raw);
      }
      if (msg.length > 500) msg = msg.slice(0, 500) + ' […]';
      if (res.status === 401) {
        msg = 'PAT bị từ chối (sai, hết hạn, hoặc thiếu scope Work Items Read & Write). '
          + `Tạo PAT mới rồi cập nhật file credentials. Chi tiết: ${msg}`;
      }
      throw new AdoError(res.status, `Azure DevOps trả về HTTP ${res.status} : ${msg}`);
    }
    return raw.trim() === '' ? null : JSON.parse(raw);
  };
}

// -------------------------------------------------------------------- main --

function gitRemote() {
  try {
    return execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

async function main(argv) {
  const { command, arg1, opts } = parseArgs(argv);
  const cfg = readConfig();
  const collection = collectionUrl(cfg);
  const apiVer = cfg.apiVersion ?? '6.0';
  const { project: repoProject } = resolveProject({
    override: opts.project,
    envProject: process.env.AZDO_PROJECT,
    gitRemote: gitRemote(),
    defaultProject: cfg.defaultProject,
  });
  const ado = makeAdo(cfg);
  const projectUrl = (name) => `${collection}/${encodeURIComponent(name)}`;

  // Đọc thì cảnh báo, không chặn (ghi sẽ chặn ở các lệnh ghi).
  const checkScopeRead = (itemProject, id) => {
    if (itemProject === repoProject) return;
    warn(`#${id} thuộc project '${itemProject}', nhưng repo hiện tại thuộc '${repoProject}'.`);
    if (opts.crossProject) { warn('Bỏ qua kiểm tra vì có cờ -CrossProject.'); return; }
    warn('Chỉ đọc nên vẫn hiển thị — nhưng kiểm tra lại xem có đang mở nhầm repo không.');
  };

  const wiql = async (query, projectName) => {
    const url = projectName
      ? `${projectUrl(projectName)}/_apis/wit/wiql?api-version=${apiVer}`
      : `${collection}/_apis/wit/wiql?api-version=${apiVer}`;
    const res = await ado(url, { method: 'POST', body: { query } });
    return (res?.workItems ?? []).map((w) => w.id);
  };

  switch (command) {
    case 'whoami': {
      // connectionData là resource preview -> phải dùng api-version riêng.
      const cdApi = cfg.connectionDataApiVersion ?? '6.0-preview';
      const res = await ado(`${collection}/_apis/connectionData?api-version=${cdApi}`);
      out(`Collection    : ${collection}`);
      out(`Project (repo): ${repoProject}`);
      out(`Đăng nhập     : ${formatIdentity(res?.authenticatedUser)}`);
      break;
    }

    case 'mine': {
      const closed = (cfg.closedStates ?? []).map((s) => `'${s}'`).join(',');
      const where = `[System.AssignedTo] = @Me AND [System.State] NOT IN (${closed})`;
      let ids;
      let scope;
      if (opts.all) {
        ids = await wiql(`SELECT [System.Id] FROM WorkItems WHERE ${where} ORDER BY [System.ChangedDate] DESC`);
        scope = 'TẤT CẢ project trong collection';
      } else {
        ids = await wiql(`SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND ${where} ORDER BY [System.ChangedDate] DESC`, repoProject);
        scope = `project '${repoProject}'`;
      }
      if (ids.length === 0) {
        out(`Không có work item nào đang gán cho bạn ở ${scope}.`);
        break;
      }
      const total = ids.length;
      ids = ids.slice(0, 200);
      out(`Work item đang gán cho bạn — ${scope} (hiện ${ids.length}/${total}):`);
      out();
      const row = (a, b, c, d, e) => `${padR(a, 8)} ${padR(b, 14)} ${padR(c, 22)} ${padR(d, 14)} ${e}`;
      out(row('ID', 'PROJECT', 'TYPE', 'STATE', 'TITLE'));
      out('-'.repeat(118));
      const fields = 'System.Id,System.TeamProject,System.WorkItemType,System.Title,System.State';
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const items = await ado(`${collection}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=${apiVer}`);
        for (const it of items?.value ?? []) {
          const f = it.fields ?? {};
          out(row(it.id, f['System.TeamProject'], f['System.WorkItemType'], f['System.State'], f['System.Title']));
        }
      }
      if (!opts.all) {
        out();
        out('(chỉ project của repo này — thêm -All để xem mọi project)');
      }
      break;
    }

    case 'show': {
      if (!arg1) throw new Error('Thiếu ID work item. Ví dụ: azdo.sh show 12345');
      const wi = await ado(`${collection}/_apis/wit/workitems/${arg1}?$expand=relations&api-version=${apiVer}`);
      const f = wi.fields ?? {};
      const itemProject = f['System.TeamProject'] ?? repoProject;
      checkScopeRead(itemProject, arg1);

      out('==============================================================');
      out(`#${wi.id}  [${f['System.WorkItemType']}]  ${f['System.Title']}`);
      out('==============================================================');
      out(`Project     : ${itemProject}`);
      out(`State       : ${f['System.State']}`);
      out(`Assigned    : ${formatIdentity(f['System.AssignedTo'])}`);
      out(`Tạo bởi     : ${formatIdentity(f['System.CreatedBy'])}  lúc ${formatAdoDate(f['System.CreatedDate'])}`);
      out(`Sửa lần cuối: ${formatAdoDate(f['System.ChangedDate'])}`);
      out(`Iteration   : ${f['System.IterationPath'] ?? '—'}`);
      out(`Area        : ${f['System.AreaPath'] ?? '—'}`);
      if (f['System.Tags']) out(`Tags        : ${f['System.Tags']}`);
      out(`Link        : ${projectUrl(itemProject)}/_workitems/edit/${wi.id}`);

      for (const [key, label] of [
        ['System.Description', 'MÔ TẢ'],
        ['Microsoft.VSTS.TCM.ReproSteps', 'REPRO STEPS'],
        ['Microsoft.VSTS.TCM.SystemInfo', 'SYSTEM INFO'],
        ['Microsoft.VSTS.Common.AcceptanceCriteria', 'ACCEPTANCE CRITERIA'],
      ]) {
        const text = htmlToText(f[key]);
        if (text) {
          out();
          out(`--- ${label} ---`);
          out(text);
        }
      }

      const rels = wi.relations ?? [];
      if (rels.length > 0) {
        out();
        out('--- LIÊN KẾT / ĐÍNH KÈM ---');
        for (const r of rels) out(`  [${r.rel}] ${r.attributes?.name ?? ''} ${r.url}`);
      }

      try {
        const cApi = cfg.commentsApiVersion ?? '6.0-preview.3';
        const cRes = await ado(`${projectUrl(itemProject)}/_apis/wit/workItems/${arg1}/comments?api-version=${cApi}`);
        const comments = cRes?.comments ?? [];
        if (comments.length > 0) {
          out();
          out(`--- THẢO LUẬN (${comments.length}) ---`);
          for (const c of comments) {
            out();
            out(`  [${formatAdoDate(c.createdDate)}] ${formatIdentity(c.createdBy)}:`);
            out(htmlToText(c.text).replace(/^/gm, '  '));
          }
        }
      } catch (e) {
        out();
        out(`(không đọc được thảo luận: ${e.message})`);
      }
      break;
    }

    case 'states': {
      if (!arg1) throw new Error('Thiếu tên type. Ví dụ: azdo.sh states Bug -Project CSDLMT');
      const res = await ado(`${projectUrl(repoProject)}/_apis/wit/workitemtypes/${encodeURIComponent(arg1)}/states?api-version=${apiVer}`);
      out();
      out(`Các state hợp lệ của '${arg1}' (project ${repoProject}):`);
      (res?.value ?? []).forEach((s, i) => out(`  ${padL(i + 1, 2)}. ${padR(s.name, 16)} [${s.category}]`));
      out();
      break;
    }

    case 'required': {
      if (!arg1) throw new Error('Thiếu tên type. Ví dụ: azdo.sh required Ticket');
      const res = await ado(`${projectUrl(repoProject)}/_apis/wit/workitemtypes/${encodeURIComponent(arg1)}/fields?api-version=${apiVer}`);
      const req = (res?.value ?? []).filter((x) => x.alwaysRequired);
      out(`Field bắt buộc (alwaysRequired) của '${arg1}' (project ${repoProject}):`);
      if (req.length === 0) out('  (không có ngoài Title)');
      for (const r of req) out(`  ${padR(r.referenceName, 45)} ${r.name}`);
      out();
      out('Field chỉ bắt buộc ở một bước chuyển state không hiện ở đây — chỉ biết khi state/finish thoát 5.');
      break;
    }

    default:
      throw new Error(`Lệnh '${command}' chưa được port sang azdo.mjs.`);
  }
}

main(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`Lỗi: ${e.message}\n`);
  process.exit(1);
});

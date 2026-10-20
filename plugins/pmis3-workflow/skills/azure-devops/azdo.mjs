#!/usr/bin/env node
// Helper Azure DevOps Server (on-prem) cho Claude Code — bản Node của azdo.ps1,
// chạy được trên Linux/macOS/Windows. Xem azdo.ps1 và SKILL.md để biết ngữ nghĩa lệnh.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, htmlToText, markdownToAdoHtml, parseFieldArgs, splitIdList, REL_MAP, missingFieldFromError,
  resolveProject, formatIdentity, formatAdoDate, checkPushed,
} from './azdo-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

class AdoError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AdoError';
    this.status = status;
  }
}

// Thoát với mã cụ thể nhưng vẫn để stdout/stderr được flush: main() bắt ExitCode rồi đặt process.exitCode.
class ExitCode extends Error {
  constructor(code) { super(`exit ${code}`); this.code = code; }
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
  const { command, arg1, arg2, opts } = parseArgs(argv);
  const cfg = readConfig();
  const collection = collectionUrl(cfg);
  const apiVer = cfg.apiVersion ?? '6.0';
  // repoProject = project hiệu lực (-Project > env > remote > default); gitProject = project của repo (chặn tạo xuyên project).
  const { project: repoProject, repoProject: gitProject } = resolveProject({
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

  // ---- helper cho lệnh ghi ----
  const itemUrl = (id) => `${collection}/_apis/wit/workitems/${id}?api-version=${apiVer}`;
  const getWorkItem = (id) => ado(itemUrl(id));
  const patchItem = (id, ops) => ado(itemUrl(id), { method: 'PATCH', body: JSON.stringify(ops), contentType: 'application/json-patch+json' });
  const fieldOps = (fields) => Object.entries(fields).map(([k, v]) => ({ op: 'add', path: `/fields/${k}`, value: String(v) }));
  const typeStates = async (projectName, typeName) => {
    const res = await ado(`${projectUrl(projectName)}/_apis/wit/workitemtypes/${encodeURIComponent(typeName)}/states?api-version=${apiVer}`);
    return res?.value ?? [];
  };
  const showStateMenu = async (projectName, typeName, current = '') => {
    out();
    out(`Các state hợp lệ của '${typeName}' (project ${projectName}):`);
    (await typeStates(projectName, typeName)).forEach((s, i) => {
      out(`  ${padL(i + 1, 2)}. ${padR(s.name, 16)} [${s.category}]${s.name === current ? '   <-- hiện tại' : ''}`);
    });
    out();
  };
  const extraFields = () => Object.fromEntries(Object.entries(parseFieldArgs(opts.field)).map(([k, v]) => [k.trim(), v]));
  const shortVal = (v) => { const t = String(v); return t.length > 90 ? t.slice(0, 90) + ' […]' : t; };
  const showFields = (fields) => { for (const [k, v] of Object.entries(fields)) out(`  ${k} = ${shortVal(v)}`); };
  const buildStateFields = (target) => {
    const fields = { 'System.State': target, ...extraFields() };
    if (opts.comment) fields['System.History'] = opts.comment;
    return fields;
  };
  // Đổi state; TF401320 thiếu field -> in tên field, thoát 5 để skill hỏi người dùng rồi chạy lại với -Field.
  const invokeStateChange = async (id, fields) => {
    try {
      await patchItem(id, fieldOps(fields));
    } catch (e) {
      const missing = e instanceof AdoError ? missingFieldFromError(e.message) : null;
      if (!missing) throw e;
      out();
      out(`DỪNG: chuyển sang '${fields['System.State']}' đòi field '${missing}'.`);
      out(`Chạy lại kèm -Field "${missing}=<giá trị>" (hỏi người dùng nếu không suy ra được).`);
      out(`Chi tiết: ${e.message}`);
      throw new ExitCode(5);
    }
  };
  // Ghi sang project khác repo thì chặn (trừ -CrossProject). Thông báo ra stderr.
  const checkScopeWrite = (itemProject, id) => {
    if (itemProject === repoProject) return;
    warn(`#${id} thuộc project '${itemProject}', nhưng repo hiện tại thuộc '${repoProject}'.`);
    if (opts.crossProject) { warn('Bỏ qua kiểm tra vì có cờ -CrossProject.'); return; }
    warn('DỪNG: không ghi sang project khác từ repo này.');
    warn(`Mở repo thuộc project '${itemProject}' rồi chạy lại. Nếu chắc chắn đúng thì thêm cờ -CrossProject.`);
    throw new ExitCode(4);
  };
  const requestedRelations = () => {
    const rels = [];
    for (const [kind, val] of [['Parent', opts.parent], ['Related', opts.related], ['BlockedBy', opts.blockedBy]]) {
      for (const id of splitIdList(val)) rels.push({ kind, id, rel: REL_MAP[kind], url: `${collection}/_apis/wit/workItems/${id}` });
    }
    return rels;
  };
  const resolveDescriptionHtml = () => {
    let text = opts.description;
    if (opts.descriptionFile) {
      if (!existsSync(opts.descriptionFile)) throw new Error(`Không tìm thấy file mô tả: ${opts.descriptionFile}`);
      text = readFileSync(opts.descriptionFile, 'utf8').replace(/^﻿/, '');
    }
    if (text == null || String(text).trim() === '') return '';
    if (opts.html || (opts.descriptionFile && /\.html?$/i.test(opts.descriptionFile))) return text;
    return markdownToAdoHtml(text);
  };
  const itemHeader = (id, f, itemProject) => out(`#${id} [${f['System.WorkItemType']}] @ ${itemProject} — ${f['System.Title']}`);
  const optionFields = (descHtml) => {
    const fields = {};
    if (descHtml) fields[opts.descField || 'System.Description'] = descHtml;
    if (opts.tags) fields['System.Tags'] = opts.tags;
    if (opts.assignTo) fields['System.AssignedTo'] = opts.assignTo;
    if (opts.areaPath) fields['System.AreaPath'] = opts.areaPath;
    if (opts.iterationPath) fields['System.IterationPath'] = opts.iterationPath;
    return fields;
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

    case 'create': {
      if (!arg1) throw new Error('Thiếu type. Ví dụ: azdo.sh create Task "Tiêu đề"');
      if (!arg2) throw new Error('Thiếu tiêu đề work item.');
      if (repoProject !== gitProject && !opts.crossProject) {
        warn(`Sẽ tạo ở project '${repoProject}', nhưng repo hiện tại thuộc '${gitProject}'.`);
        warn('DỪNG: không tạo work item sang project khác từ repo này.');
        warn(`Mở repo thuộc project '${repoProject}' rồi chạy lại. Nếu chắc chắn đúng thì thêm cờ -CrossProject.`);
        throw new ExitCode(4);
      }
      if ((await typeStates(repoProject, arg1)).length === 0) throw new Error(`Type '${arg1}' không tồn tại ở project '${repoProject}'.`);

      const descHtml = resolveDescriptionHtml();
      const rels = requestedRelations();
      const fields = { 'System.Title': arg2, ...optionFields(descHtml), ...extraFields() };

      out(`Project : ${repoProject}`);
      out(`Type    : ${arg1}`);
      out(`Title   : ${arg2}`);
      if (opts.tags) out(`Tags    : ${opts.tags}`);
      if (opts.assignTo) out(`Assign  : ${opts.assignTo}`);
      for (const r of rels) out(`Link    : ${r.kind} -> #${r.id}`);
      if (descHtml) {
        const plain = htmlToText(descHtml);
        const preview = plain.length > 400 ? plain.slice(0, 400) + ' […]' : plain;
        out(`Mô tả   : ${descHtml.length} ký tự HTML`);
        out(preview.replace(/^/gm, '  | '));
      }
      if (!opts.yes) {
        out();
        out('CHẠY KHÔ. Chưa tạo gì cả. Thêm cờ -Yes để thực thi.');
        break;
      }
      const ops = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v == null || v === '') continue;
        ops.push({ op: 'add', path: `/fields/${k}`, value: v });
      }
      for (const r of rels) ops.push({ op: 'add', path: '/relations/-', value: { rel: r.rel, url: r.url } });
      const created = await ado(`${projectUrl(repoProject)}/_apis/wit/workitems/$${encodeURIComponent(arg1)}?api-version=${apiVer}`,
        { method: 'POST', body: JSON.stringify(ops), contentType: 'application/json-patch+json' });
      out();
      out(`Đã tạo #${created?.id} [${arg1}] — ${arg2}`);
      out(`${projectUrl(repoProject)}/_workitems/edit/${created?.id}`);
      break;
    }

    case 'update': {
      if (!arg1) throw new Error('Thiếu ID work item. Ví dụ: azdo.sh update 122698 -DescriptionFile ./map.md');
      const wi = await getWorkItem(arg1);
      const f = wi.fields ?? {};
      const itemProject = f['System.TeamProject'] ?? repoProject;
      itemHeader(arg1, f, itemProject);
      checkScopeWrite(itemProject, arg1);

      const fields = {};
      if (arg2) fields['System.Title'] = arg2; // Arg2 (nếu có) là tiêu đề mới.
      Object.assign(fields, optionFields(resolveDescriptionHtml()), extraFields());
      if (Object.keys(fields).length === 0) {
        throw new Error('Không có gì để sửa. Dùng -DescriptionFile / -Description / -Tags / -AssignTo / -Field, hoặc truyền tiêu đề mới ở vị trí thứ 2.');
      }
      showFields(fields);
      if (!opts.yes) {
        out();
        out('CHẠY KHÔ. Thêm cờ -Yes để thực thi.');
        break;
      }
      await patchItem(arg1, Object.entries(fields).map(([k, v]) => ({ op: 'add', path: `/fields/${k}`, value: v })));
      out();
      out(`Đã cập nhật ${Object.keys(fields).length} field của #${arg1}.`);
      break;
    }

    case 'link': {
      if (!arg1) throw new Error('Thiếu ID work item nguồn.');
      const rels = requestedRelations();
      if (rels.length === 0) {
        throw new Error('Thiếu quan hệ. Dùng -Parent / -Related / -BlockedBy, ví dụ: azdo.sh link 12345 -BlockedBy "12301,12302"');
      }
      const wi = await getWorkItem(arg1);
      const f = wi.fields ?? {};
      const itemProject = f['System.TeamProject'] ?? repoProject;
      itemHeader(arg1, f, itemProject);
      checkScopeWrite(itemProject, arg1);
      for (const r of rels) out(`  ${r.kind} -> #${r.id}`);
      if (!opts.yes) {
        out();
        out('CHẠY KHÔ. Thêm cờ -Yes để thực thi.');
        break;
      }
      for (const r of rels) {
        await patchItem(arg1, [{ op: 'add', path: '/relations/-', value: { rel: r.rel, url: r.url } }]);
        out(`Đã nối #${arg1} --[${r.kind}]--> #${r.id}`);
      }
      break;
    }

    case 'comment': {
      if (!arg1) throw new Error('Thiếu ID work item.');
      if (!arg2) throw new Error('Thiếu nội dung comment.');
      const wi = await getWorkItem(arg1);
      const f = wi.fields ?? {};
      const itemProject = f['System.TeamProject'] ?? repoProject;
      itemHeader(arg1, f, itemProject);
      checkScopeWrite(itemProject, arg1);
      if (!opts.yes) {
        out(`CHẠY KHÔ. Sẽ thêm comment vào work item #${arg1} :`);
        out(`  ${arg2}`);
        out('Thêm cờ -Yes để thực thi.');
        break;
      }
      await patchItem(arg1, fieldOps({ 'System.History': arg2 }));
      out(`Đã thêm comment vào #${arg1}.`);
      break;
    }

    case 'state': {
      if (!arg1) throw new Error('Thiếu ID work item.');
      if (!arg2) throw new Error('Thiếu state đích.');
      const wi = await getWorkItem(arg1);
      const f = wi.fields ?? {};
      const type = f['System.WorkItemType'];
      const cur = f['System.State'];
      const itemProject = f['System.TeamProject'] ?? repoProject;
      checkScopeWrite(itemProject, arg1);

      const valid = (await typeStates(itemProject, type)).map((s) => s.name);
      if (!valid.includes(arg2)) {
        out(`'${arg2}' không phải state hợp lệ của '${type}'.`);
        await showStateMenu(itemProject, type, cur);
        throw new ExitCode(1);
      }
      const fields = buildStateFields(arg2);
      if (!opts.yes) {
        out(`CHẠY KHÔ. #${arg1} [${type}] @ ${itemProject} : '${cur}' -> '${arg2}'`);
        showFields(fields);
        out('Thêm cờ -Yes để thực thi.');
        break;
      }
      await invokeStateChange(arg1, fields);
      out(`#${arg1} [${type}] : '${cur}' -> '${arg2}'. Xong.`);
      break;
    }

    case 'finish': {
      if (!arg1) throw new Error('Thiếu ID work item.');
      const wi = await getWorkItem(arg1);
      const f = wi.fields ?? {};
      const type = f['System.WorkItemType'];
      const cur = f['System.State'];
      const itemProject = f['System.TeamProject'] ?? repoProject;
      itemHeader(arg1, f, itemProject);
      out(`State hiện tại: ${cur}`);
      checkScopeWrite(itemProject, arg1);

      const rule = Object.hasOwn(cfg.workflow ?? {}, type) ? cfg.workflow[type] : null;
      if (!rule) {
        out();
        out(`DỪNG: type '${type}' không có quy ước tự động. Phải hỏi người dùng chọn state.`);
        await showStateMenu(itemProject, type, cur);
        throw new ExitCode(2);
      }
      const allowed = rule.allowedFrom ?? [];
      if (!allowed.includes(cur)) {
        out();
        out(`DỪNG: '${cur}' nằm ngoài danh sách tự xử lý của '${type}' (${allowed.join(', ')}).`);
        out('Phải hỏi người dùng chọn state.');
        await showStateMenu(itemProject, type, cur);
        throw new ExitCode(2);
      }
      const target = rule.doneState;

      if (rule.requirePush) {
        const push = checkPushed(process.cwd());
        if (!push.ok) {
          out();
          out(`DỪNG: '${type}' yêu cầu push code trước khi chuyển sang '${target}'.`);
          out(`Lý do: ${push.reason}`);
          throw new ExitCode(3);
        }
        out(`Kiểm tra push: ${push.reason}`);
      }

      const fields = buildStateFields(target);
      if (!opts.yes) {
        out();
        out(`CHẠY KHÔ. Sẽ chuyển: '${cur}' -> '${target}'`);
        showFields(fields);
        out('Thêm cờ -Yes để thực thi.');
        break;
      }
      await invokeStateChange(arg1, fields);
      out();
      out(`#${arg1} [${type}] : '${cur}' -> '${target}'. Xong.`);
      break;
    }

    default:
      throw new Error(`Lệnh '${command}' chưa được port sang azdo.mjs.`);
  }
}

main(process.argv.slice(2)).catch((e) => {
  if (e instanceof ExitCode) { process.exitCode = e.code; return; }
  process.stderr.write(`Lỗi: ${e.message}\n`);
  process.exit(1);
});

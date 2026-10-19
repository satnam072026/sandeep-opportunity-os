import fs from 'node:fs';
import { getGoogleAccessToken } from '../supabase/functions/_shared/canonicalSync.mjs';

function loadEnv() {
  const content = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const ALL_RESOURCES = [
  // Bago Muse
  {
    sourceId: 'muse_social_job_hunter',
    name: 'MUSE | FACEBOOK & INSTAGRAM JOB HUNTER',
    owner: 'bago_muse',
    id: '1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0',
    type: 'sheet'
  },
  {
    sourceId: 'master_job_application_tracker',
    name: 'MASTER_JOB_APPLICATION_TRACKER.xlsx',
    owner: 'bago_muse',
    id: '1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1',
    type: 'drive_file'
  },
  {
    sourceId: 'masters_workbook',
    name: 'master-spreadsheet.xlsx (Master Admissions)',
    owner: 'haya_satnam',
    id: '156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj',
    type: 'drive_file'
  },
  {
    sourceId: 'graduate_schemes_tracker',
    name: 'GRADUATE SCHEMES - MASTER TRACKER',
    owner: 'bago_muse',
    id: '1zGcyFrXBXQKOrmgJngXGYfIlYm1n1s_AV_DlHJ9tgtQ',
    type: 'sheet'
  },
  {
    sourceId: 'job_apply_root',
    name: 'Job Apply Root Folder',
    owner: 'bago_muse',
    id: '1g0XUzrlsOr9ze6Peaw6SMhcDLDYZSuE0',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_pending',
    name: 'Job Apply — Pending',
    owner: 'bago_muse',
    id: '1OMDTYRW4uQmz8P1cCTXFTSz0yrGmpc_l',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_ready_for_approval',
    name: 'Job Apply — Ready for Approval',
    owner: 'bago_muse',
    id: '17dpw5xNHDm3yPy1KiBnDt_xfkyBrF3wy',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_applied',
    name: 'Job Apply — Applied',
    owner: 'bago_muse',
    id: '1eS96WrT6HQ8zqbSntUPgtnICYRNa-bUM',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_failed',
    name: 'Job Apply — Failed',
    owner: 'bago_muse',
    id: '101_-5fPC16bivgpNVkP7uueF49MpjHgq',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_rejected',
    name: 'Job Apply — Rejected',
    owner: 'bago_muse',
    id: '1y4UyghfocbkmyoGnUpD5oHSVQb4HuBk1',
    type: 'folder'
  },
  {
    sourceId: 'job_apply_trackers',
    name: 'Job Apply — Trackers',
    owner: 'bago_muse',
    id: '1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_',
    type: 'folder'
  },
  {
    sourceId: 'masters_admissions_folder',
    name: 'Master\'s Admissions Folder',
    owner: 'bago_muse',
    id: '1S_FYU8b1xeP6S098SkYaADWYIkH5a_Nf',
    type: 'folder'
  },
  {
    sourceId: 'bago_01_social',
    name: '01_SOCIAL_JOB_HUNTER',
    owner: 'bago_muse',
    id: '1yw6C0jjEpMr2_SbAYYsUgAJQoi_eHHVg',
    type: 'folder'
  },
  {
    sourceId: 'bago_02_eu',
    name: '02_EU_JOB_HELP',
    owner: 'bago_muse',
    id: '1uInVx_s6JLT4XeyCo1ekTerc-dsHQnAT',
    type: 'folder'
  },
  {
    sourceId: 'bago_03_web',
    name: '03_WEB_CLIENT',
    owner: 'bago_muse',
    id: '1e8WRQ3fYeLLIsSRyouwjrpbSjWWP3QHt',
    type: 'folder'
  },
  {
    sourceId: 'bago_04_masters',
    name: '04_MASTERS_HELP',
    owner: 'bago_muse',
    id: '1mqnKd0aFS0ieBPpHbtiiqAzV9wHzif12',
    type: 'folder'
  },
  {
    sourceId: 'bago_05_recruitment',
    name: '05_RECRUITMENT_AGENCIES',
    owner: 'bago_muse',
    id: '1Byscmy4m9bLPekXoX3GnjEimvaxIsG-g',
    type: 'folder'
  },
  {
    sourceId: 'bago_06_shared',
    name: '06_SHARED_RESOURCES',
    owner: 'bago_muse',
    id: '1n4_RN54PTo_QOMvCKsKVALHf8pZ6NbSs',
    type: 'folder'
  },

  // Haya Satnam
  {
    sourceId: 'satnam_root',
    name: 'Muse_Satnam Root Folder',
    owner: 'haya_satnam',
    id: '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    type: 'folder'
  },
  {
    sourceId: 'satnam_app_pipeline',
    name: 'GLOBAL APPLICATION PIPELINE',
    owner: 'haya_satnam',
    id: '1t5qkojwzDT7Eugz0q3PrXCPHOVonOkyYHzXLzzRYytE',
    type: 'sheet'
  },
  {
    sourceId: 'satnam_portal_dir',
    name: 'GLOBAL PORTAL DIRECTORY',
    owner: 'haya_satnam',
    id: '1zkIKQrIw3ZazPiRyfJ9UC5eJoDdjXQ4KRYV_dHnZ0YM',
    type: 'sheet'
  },
  {
    sourceId: 'satnam_hpv',
    name: 'HPV - CLIENT PROSPECTING MASTER',
    owner: 'haya_satnam',
    id: '1qir3bHP-M4vrB-XNLn7tRcfQPbXJxDZI0-z62GG0FBE',
    type: 'sheet'
  },
  {
    sourceId: 'satnam_business_lending',
    name: 'BUSINESS LENDING UK - COMMAND CENTER',
    owner: 'haya_satnam',
    id: '1Tt-qxWsjDApZopQUBLXzrf2N_8eaR3eV10bSyV4Sxew',
    type: 'sheet'
  },
  {
    sourceId: 'satnam_system_registry',
    name: 'MUSESATNAM - SYSTEM REGISTRY',
    owner: 'haya_satnam',
    id: '1mCJWN5ybA1LqC7OJNfeeyL9WGeaQpNHGXZAGLfeV-8s',
    type: 'sheet'
  },

  // Kattu AI (Real registered IDs specified by Sandeep)
  {
    sourceId: 'kattu_india_regional',
    name: 'Projects KattuAI — India Regional Job Research',
    owner: 'kattu_ai',
    id: '15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw',
    type: 'sheet'
  },
  {
    sourceId: 'kattu_eu_regional',
    name: 'Projects KattuAI — EU Regional Job Research',
    owner: 'kattu_ai',
    id: '1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4',
    type: 'sheet'
  },
  {
    sourceId: 'kattu_uk_regional',
    name: 'Projects KattuAI — UK Regional Job Research',
    owner: 'kattu_ai',
    id: '1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A',
    type: 'sheet'
  },
  {
    sourceId: 'kattu_usa_regional',
    name: 'Projects KattuAI — USA Regional Job Research',
    owner: 'kattu_ai',
    id: '1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo',
    type: 'sheet'
  },
  {
    sourceId: 'reports_folder',
    name: 'Reports Folder',
    owner: 'kattu_ai',
    id: '1yqpyzPa2FmuNNrzqM56J4qBAVm2bbBix',
    type: 'folder'
  }
];

async function runAudit() {
  const env = loadEnv();
  const token = await getGoogleAccessToken({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_PRIVATE_KEY
  });
  console.log('Google OAuth2 Token acquired successfully for:', env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

  const headers = { Authorization: `Bearer ${token}` };
  const auditReport = [];

  for (const item of ALL_RESOURCES) {
    const record = {
      sourceId: item.sourceId,
      owner: item.owner,
      resourceId: item.id,
      name: item.name,
      type: item.type,
      httpStatus: 0,
      status: 'Unknown',
      details: '',
      recordsCount: 0
    };

    try {
      // 1. Check Drive API metadata
      const dRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${item.id}?supportsAllDrives=true&fields=id,name,mimeType,parents,trashed`,
        { headers }
      );
      record.httpStatus = dRes.status;

      if (dRes.status === 200) {
        const meta = await dRes.json();
        record.status = 'Accessible';
        record.mimeType = meta.mimeType;

        if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Probe sheets metadata
          const sRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${item.id}?fields=sheets.properties(sheetId,title,gridProperties)`,
            { headers }
          );
          if (sRes.status === 200) {
            const sMeta = await sRes.json();
            const tabs = sMeta.sheets.map((s) => s.properties.title);
            record.details = `Tabs: [${tabs.join(', ')}]`;

            // Try reading first tab row count
            const firstTab = tabs[0];
            const vRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${item.id}/values/'${encodeURIComponent(firstTab)}'?valueRenderOption=FORMATTED_VALUE`,
              { headers }
            );
            if (vRes.status === 200) {
              const vData = await vRes.json();
              record.recordsCount = (vData.values || []).length;
              record.details += ` (Tab '${firstTab}' rows: ${record.recordsCount})`;
            }
          } else {
            record.details = `Drive OK (200), Sheets API HTTP ${sRes.status}`;
          }
        } else if (item.type === 'drive_file') {
          record.details = `Drive binary/XLSX: ${meta.mimeType}`;
        } else {
          record.details = `Drive folder: ${meta.name}`;
        }
      } else if (dRes.status === 403) {
        record.status = 'Permission required';
        const err = await dRes.json().catch(() => ({}));
        record.details = `HTTP 403: ${err.error?.message || 'Forbidden'}`;
      } else if (dRes.status === 404) {
        record.status = 'Not found / Unshared';
        record.details = 'HTTP 404: Resource not found or not shared with service account';
      } else {
        record.status = `HTTP ${dRes.status}`;
        record.details = await dRes.text().catch(() => '');
      }
    } catch (err) {
      record.status = 'Network Error';
      record.details = err.message;
    }

    auditReport.push(record);
  }

  console.log('\n=== LIVE GOOGLE DRIVE & SHEETS API AUDIT RESULTS ===\n');
  console.table(
    auditReport.map((r) => ({
      'Source ID': r.sourceId,
      'Owner Agent': r.owner,
      'Resource ID': r.resourceId.slice(0, 16) + '...',
      'HTTP': r.httpStatus,
      'Status': r.status,
      'Records': r.recordsCount,
      'Details': (r.details || '').slice(0, 50)
    }))
  );

  fs.writeFileSync('scripts/live-google-audit.json', JSON.stringify(auditReport, null, 2));
  console.log('Saved audit to scripts/live-google-audit.json');
}

runAudit().catch(console.error);

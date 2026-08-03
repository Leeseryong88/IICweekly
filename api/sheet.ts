import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { google } from 'googleapis';

function getAdminAuth(): Auth {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        `missing_firebase_admin_env:${JSON.stringify({
          FIREBASE_PROJECT_ID: !!projectId,
          FIREBASE_CLIENT_EMAIL: !!clientEmail,
          FIREBASE_PRIVATE_KEY: !!privateKey,
        })}`
      );
    }
    if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getAuth(getApp());
}

function extractIds(inputUrl: string) {
  try {
    const u = new URL(inputUrl);
    // Standard editor/export URL: /spreadsheets/d/<spreadsheetId>/...
    const m = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = m?.[1] || u.searchParams.get('id') || '';
    const gid = u.searchParams.get('gid') || (u.hash.match(/gid=(\d+)/)?.[1] ?? '');
    const isPublishedToken = /\/spreadsheets\/d\/e\//.test(u.pathname); // Published-to-web token URL (no spreadsheetId)
    return { sheetId, gid: gid, ...(isPublishedToken ? { publishedToken: true } : {}) } as any;
  } catch {
    return { sheetId: '', gid: '' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const authz = req.headers.authorization || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'unauthorized' });
    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);

    const url = (req.query.url as string) || '';
    const range = (req.query.range as string) || '';
    if (!url) return res.status(400).json({ error: 'url required' });

    const extracted: any = extractIds(url);
    const sheetId = extracted.sheetId as string;
    const gid = extracted.gid as string;
    if (extracted.publishedToken && !sheetId) {
      return res.status(400).json({
        error: 'unsupported_published_url',
        message:
          '게시 링크(d/e/...)는 지원되지 않습니다. 시트의 편집 URL(https://docs.google.com/spreadsheets/d/<스프레드시트ID>/edit#gid=<GID>)을 저장하세요.',
      });
    }
    if (!sheetId) return res.status(400).json({ error: 'invalid_sheet_url', message: 'sheetId를 추출할 수 없습니다.' });

    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let svcKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    if (!svcEmail || !svcKey) {
      return res.status(500).json({
        error: 'missing_google_service_env',
        message: 'GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY 환경변수 확인',
      });
    }
    if (svcKey.includes('\\n')) svcKey = svcKey.replace(/\\n/g, '\n');
    const jwt = new google.auth.JWT(
      svcEmail,
      undefined,
      svcKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    let a1Range = range;
    if (!a1Range) {
      if (gid) {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = meta.data.sheets?.find(s => s.properties?.sheetId === Number(gid));
        const title = sheet?.properties?.title || 'Sheet1';
        a1Range = `${title}!A:Z`;
      } else {
        a1Range = 'Sheet1!A:Z';
      }
    }

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: a1Range });
    const values = resp.data.values || [];
    if (values.length === 0) return res.status(200).json([]);

    const headers = values[0];
    const rows = values.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').toString()])));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(rows);
  } catch (e: any) {
    const message = e?.message || 'unknown_error';
    res.status(500).json({ error: 'internal_error', message });
  }
}



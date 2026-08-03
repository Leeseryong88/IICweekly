import { SheetRow } from '../types';
import { auth } from './firebase';

/**
 * A more robust CSV parser that handles multiline fields by first reconstructing logical rows.
 * This prevents an unclosed quote in one row from corrupting the rest of the file,
 * which was causing data loading to stop prematurely.
 * @param csvText The raw CSV string.
 * @returns An array of objects representing the rows.
 */
const parseCSV = (csvText: string): SheetRow[] => {
  // 1. Sanitize input text
  const text = csvText.trim().replace(/^\uFEFF/, '');
  if (!text) {
    return [];
  }

  // 2. Reconstruct logical rows by joining lines that are part of a multiline field.
  const logicalRows: string[] = [];
  let rowBuffer = '';
  // The regex splits by newlines (\n or \r\n or \r)
  const lines = text.split(/\r\n|\n|\r/); 

  for (const line of lines) {
    rowBuffer += line;
    // Check for an odd number of non-escaped quotes. If odd, it's a multiline field.
    const quoteCount = (rowBuffer.replace(/""/g, '').match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      logicalRows.push(rowBuffer);
      rowBuffer = '';
    } else {
      // It's a multiline field, add a newline to be preserved and continue.
      rowBuffer += '\n';
    }
  }
  // Add any remaining buffer content as the last row
  if (rowBuffer) {
    logicalRows.push(rowBuffer);
  }

  if (logicalRows.length < 2) {
    return []; // Not enough rows for a header and data.
  }

  // 3. Parse fields for each logical row.
  const allRows: string[][] = logicalRows
    .filter(rowStr => rowStr.trim() !== '') // Filter out empty lines
    .map(rowStr => {
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          if (inQuotes && rowStr[i + 1] === '"') { // Escaped quote
            currentField += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField);
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField); // Add the last field
      return fields;
    });

  // 4. Convert array of arrays into array of objects.
  const headers = allRows[0].map(h => h.trim().replace(/^"|"$/g, ''));
  const dataRows: SheetRow[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const values = allRows[i];
    if (values.length === 1 && values[0].trim() === '') continue;

    const rowObject = headers.reduce((acc, header, index) => {
      const value = values[index] || '';
      const cleanedValue = value.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
      acc[header] = cleanedValue;
      return acc;
    }, {} as { [key: string]: string });
    dataRows.push(rowObject as unknown as SheetRow);
  }

  return dataRows;
};


export const fetchSheetData = async (sheetUrl: string): Promise<SheetRow[]> => {
  if (!sheetUrl) return [];
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('인증 후 이용해주세요.');

  const res = await fetch(`/api/sheet?url=${encodeURIComponent(sheetUrl)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`시트 로드 실패: ${res.status} ${msg}`);
  }
  return (await res.json()) as SheetRow[];
};

// 헤더만 빠르게 가져오는 유틸 (디자이너에서 사용)
export const fetchSheetHeaders = async (sheetUrl: string): Promise<string[]> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('인증 후 이용해주세요.');
  // range를 강제 지정하지 않으면 서버가 gid로 시트 제목을 찾아 적절한 범위를 계산합니다.
  const res = await fetch(`/api/sheet?url=${encodeURIComponent(sheetUrl)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`헤더를 불러오지 못했습니다: ${res.status} ${msg}`);
  }
  const rows = (await res.json()) as SheetRow[];
  // 서버는 첫 행을 헤더로 간주하여 이후 행을 객체로 반환하므로, 첫 번째 데이터 행의 키가 헤더가 됩니다.
  return Object.keys(rows[0] || {});
};
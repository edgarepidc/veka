export interface BankTransactionImportRow {
  transaction_date: string;
  amount: number;
  description: string;
  reference: string;
  external_id: string;
}

export interface OfxAccountInfo {
  bankId: string;
  accountId: string;
  accountType: string;
}

export type BankImportFormat = 'csv' | 'ofx';

export function detectBankImportFormat(content: string): BankImportFormat {
  const trimmed = content.trimStart();
  if (
    trimmed.startsWith('OFXHEADER') ||
    /^<\?xml/i.test(trimmed) ||
    /<OFX\b/i.test(trimmed) ||
    /<STMTTRN>/i.test(trimmed)
  ) {
    return 'ofx';
  }
  return 'csv';
}

export function parseBankImportContent(
  content: string,
  format: 'auto' | BankImportFormat = 'auto',
): BankTransactionImportRow[] {
  const resolved = format === 'auto' ? detectBankImportFormat(content) : format;
  return resolved === 'ofx' ? parseOfxTransactions(content) : parseCsvBankTransactions(content);
}

export function parseCsvBankTransactions(csv: string): BankTransactionImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const rows = lines.slice(lines[0].toLowerCase().includes('fecha') ? 1 : 0);
  const parsed: BankTransactionImportRow[] = [];

  for (const [index, line] of rows.entries()) {
    const parts = line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const dateRaw = parts[0];
    const amountRaw = parts[1].replace(/[$,\s]/g, '');
    const amount = Number(amountRaw);
    if (!dateRaw || !Number.isFinite(amount)) continue;

    const isoDate = normalizeImportDate(dateRaw);
    if (!isoDate) continue;

    parsed.push({
      transaction_date: isoDate,
      amount,
      description: parts[2] ?? '',
      reference: parts[3] ?? '',
      external_id: parts[4] ?? `csv-${isoDate}-${amount}-${index}`,
    });
  }

  return parsed;
}

export function parseOfxTransactions(ofx: string): BankTransactionImportRow[] {
  const normalized = ofx.replace(/\r\n/g, '\n');
  const blocks = [...normalized.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((match) => match[1]!);

  const parsed: BankTransactionImportRow[] = [];

  for (const [index, block] of blocks.entries()) {
    const amountRaw = readOfxTag(block, 'TRNAMT');
    const amount = Number(amountRaw.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount === 0) continue;

    const posted = readOfxTag(block, 'DTPOSTED') || readOfxTag(block, 'DTUSER');
    const transactionDate = parseOfxDate(posted);
    if (!transactionDate) continue;

    const fitId = readOfxTag(block, 'FITID');
    const checkNum = readOfxTag(block, 'CHECKNUM');
    const refNum = readOfxTag(block, 'REFNUM');
    const name = readOfxTag(block, 'NAME');
    const memo = readOfxTag(block, 'MEMO');
    const payee = readOfxTag(block, 'PAYEE');

    const description = [name, memo, payee].filter(Boolean).join(' · ') || 'Movimiento bancario';
    const reference = checkNum || refNum || '';

    parsed.push({
      transaction_date: transactionDate,
      amount: roundMoney(amount),
      description,
      reference,
      external_id: fitId || `ofx-${transactionDate}-${amount}-${index}`,
    });
  }

  return parsed;
}

export function parseOfxAccountInfo(ofx: string): OfxAccountInfo | null {
  const accountId = readOfxTag(ofx, 'ACCTID');
  if (!accountId) return null;

  return {
    bankId: readOfxTag(ofx, 'BANKID'),
    accountId,
    accountType: readOfxTag(ofx, 'ACCTTYPE'),
  };
}

export function ofxAccountLast4(accountId: string): string | null {
  const digits = accountId.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function readOfxTag(source: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = source.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function parseOfxDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\[.*\]$/, '').trim();
  const ymd = cleaned.slice(0, 8);
  if (!/^\d{8}$/.test(ymd)) return null;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function normalizeImportDate(dateRaw: string): string | null {
  if (dateRaw.includes('-')) {
    const iso = dateRaw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }

  const parts = dateRaw.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

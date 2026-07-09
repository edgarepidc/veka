#!/usr/bin/env node
/**
 * Applies SQL migrations to the linked Supabase project using credentials from .env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = readEnvFile(path.join(root, '.env'));
const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const poolerHost = env.SUPABASE_POOLER_HOST || 'aws-1-us-east-1.pooler.supabase.com';
const poolerPort = Number(env.SUPABASE_POOLER_PORT || 6543);

if (!projectRef || !dbPassword) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const migrationArg = process.argv[2];
const migrationPath = migrationArg
  ? path.resolve(migrationArg)
  : path.join(root, 'supabase/migrations/20250709120000_annual_budgets_cluster.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sqlText = fs.readFileSync(migrationPath, 'utf8');
const sql = postgres({
  host: poolerHost,
  port: poolerPort,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: dbPassword,
  ssl: 'require',
  max: 1,
  connect_timeout: 30,
});

try {
  console.log(`Applying migration: ${path.basename(migrationPath)} via ${poolerHost}:${poolerPort}`);
  await sql.unsafe(sqlText);
  console.log('Migration applied successfully.');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function loadDotenv(file) {
  const raw = readFileSync(file, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotenv(path.join(process.cwd(), '.env.local'));

const provider = process.env.LLM_PROVIDER ?? 'openai-compatible';
if (provider === 'claude-cli') {
  const model = process.env.LLM_MODEL_CHAT ?? 'claude-sonnet-4-6';
  const proc = await new Promise((resolve) => {
    const child = spawn(
      'claude',
      [
        '-p',
        '--model',
        model,
        '--output-format',
        'json',
        '--no-session-persistence',
        '--tools',
        '',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], env: process.env }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end('只回复 OK');
  });
  if (proc.code !== 0) {
    console.error(`failed ${proc.code}: ${proc.stderr.slice(0, 500)}`);
    process.exit(1);
  }
  const json = JSON.parse(proc.stdout);
  console.log(`ok: ${model} -> ${(json.result ?? '').trim()}`);
  process.exit(0);
}

if (provider !== 'anthropic-compatible') {
  console.log(`skip: LLM_PROVIDER=${provider}`);
  process.exit(0);
}

const baseURL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(
  /\/+$/,
  ''
);
const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.LLM_MODEL_CHAT ?? 'claude-sonnet-4-6';

if (!authToken && !apiKey) {
  console.error('missing ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const response = await fetch(`${baseURL}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'anthropic-version': process.env.ANTHROPIC_VERSION ?? '2023-06-01',
    ...(authToken ? { authorization: `Bearer ${authToken}` } : { 'x-api-key': apiKey }),
  },
  body: JSON.stringify({
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: '只回复 OK' }],
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`failed ${response.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

const json = JSON.parse(text);
const reply =
  json.content
    ?.filter((block) => block.type === 'text' || typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('') ?? '';

console.log(`ok: ${model} -> ${reply.trim()}`);

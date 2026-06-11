import 'server-only';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';
import { z, ZodSchema } from 'zod';

export type LLMProvider =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'claude-cli';

export type LLMConfig = {
  provider?: LLMProvider;
  model?: string;
  baseUrl?: string;
};

const defaultProvider = (process.env.LLM_PROVIDER ??
  'openai-compatible') as LLMProvider;

function isAnthropicProvider(provider: LLMProvider) {
  return provider === 'anthropic-compatible';
}

function isClaudeCliProvider(provider: LLMProvider) {
  return provider === 'claude-cli';
}

if (
  isAnthropicProvider(defaultProvider) &&
  !process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_AUTH_TOKEN
) {
  console.warn(
    '[llm] LLM_PROVIDER=anthropic-compatible，但缺少 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN'
  );
}

if (isClaudeCliProvider(defaultProvider) && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn('[llm] LLM_PROVIDER=claude-cli，但缺少 ANTHROPIC_AUTH_TOKEN');
}

if (
  !isAnthropicProvider(defaultProvider) &&
  !isClaudeCliProvider(defaultProvider) &&
  !process.env.DEEPSEEK_API_KEY &&
  !process.env.OPENAI_API_KEY
) {
  console.warn(
    '[llm] 既无 DEEPSEEK_API_KEY 也无 OPENAI_API_KEY，API 调用将失败'
  );
}

const openAIClients = new Map<string, OpenAI>();

function defaultBaseUrl(provider: LLMProvider): string | undefined {
  if (provider === 'openai-compatible') {
    return (
      process.env.LLM_BASE_URL ??
      process.env.DEEPSEEK_BASE_URL ??
      'https://api.deepseek.com'
    );
  }
  if (provider === 'anthropic-compatible') {
    return process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  }
  return undefined;
}

function defaultChatModel(provider: LLMProvider) {
  return (
    process.env.LLM_MODEL_CHAT ??
    (isAnthropicProvider(provider) || isClaudeCliProvider(provider)
      ? 'claude-sonnet-4-6'
      : 'deepseek-chat')
  );
}

export function normalizeLLMConfig(config?: LLMConfig): Required<LLMConfig> {
  const isOldDeepSeekDefault =
    config?.provider === 'openai-compatible' &&
    (!config.model?.trim() || config.model.trim() === 'deepseek-chat') &&
    (!config.baseUrl?.trim() || config.baseUrl.trim() === 'https://api.deepseek.com') &&
    !process.env.DEEPSEEK_API_KEY &&
    !process.env.OPENAI_API_KEY;
  const effectiveConfig = isOldDeepSeekDefault ? undefined : config;
  const provider = effectiveConfig?.provider ?? defaultProvider;
  return {
    provider,
    model: effectiveConfig?.model?.trim() || defaultChatModel(provider),
    baseUrl: effectiveConfig?.baseUrl?.trim() || defaultBaseUrl(provider) || '',
  };
}

function openAICompatibleApiKey(baseURL: string): string {
  if (/api\.openai\.com/i.test(baseURL)) {
    return process.env.OPENAI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
  }
  return process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
}

function getOpenAIClient(config?: LLMConfig): OpenAI {
  const resolved = normalizeLLMConfig(config);
  const key = `${resolved.baseUrl}::${openAICompatibleApiKey(resolved.baseUrl)}`;
  const cached = openAIClients.get(key);
  if (cached) return cached;

  // OpenAI 兼容协议 — DeepSeek / OpenAI / Moonshot / 通义等代理都走这层。
  const client = new OpenAI({
    apiKey: openAICompatibleApiKey(resolved.baseUrl),
    baseURL: resolved.baseUrl,
  });
  openAIClients.set(key, client);
  return client;
}

export const MODELS = {
  // Anthropic-compatible 可用 claude-sonnet-4-6 / claude-opus-4-6；
  // OpenAI-compatible 可用 deepseek-chat / deepseek-v4-pro 等。
  CHAT:
    process.env.LLM_MODEL_CHAT ??
    (isAnthropicProvider(defaultProvider) || isClaudeCliProvider(defaultProvider)
      ? 'claude-sonnet-4-6'
      : 'deepseek-chat'),
  // 推理模型预留位，做实验时可显式传入或覆盖环境变量。
  REASONER: process.env.LLM_MODEL_REASONER ?? 'deepseek-reasoner',
} as const;

export type SystemBlock = {
  type: 'text';
  text: string;
  /** 兼容字段：DeepSeek 走自动 context caching，cache_control 在此层无效，保留只为不破坏调用方接口 */
  cache_control?: { type: 'ephemeral' };
};

// ============ extract: 用户输入 → 结构化 JSON ============

export type ExtractOpts<T> = {
  system: string;
  user: string;
  schema: ZodSchema<T>;
  model?: string;
  llmConfig?: LLMConfig;
  maxTokens?: number;
};

type Usage = {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  web_search_requests?: number;
  web_fetch_requests?: number;
  permission_denials?: number;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AnthropicContentBlock = {
  type?: string;
  text?: string;
};

type AnthropicMessageResponse = {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
};

type AnthropicStreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string };
  message?: AnthropicMessageResponse;
  usage?: AnthropicMessageResponse['usage'];
  error?: { message?: string };
};

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : trimmed).trim();
}

function parseJsonFromText(text: string): unknown {
  const stripped = stripJsonFence(text);
  try {
    return JSON.parse(stripped);
  } catch {
    const embedded = extractFirstJsonObject(stripped);
    if (!embedded) throw new Error('no JSON object found');
    return JSON.parse(embedded);
  }
}

async function callExtractOnce(args: {
  model: string;
  llmConfig?: LLMConfig;
  maxTokens: number;
  messages: ChatMessage[];
}): Promise<{ text: string; usage: Usage }> {
  const config = normalizeLLMConfig(args.llmConfig);
  if (isClaudeCliProvider(config.provider)) {
    return callClaudeCliOnce({
      model: args.model,
      messages: args.messages,
    });
  }

  if (isAnthropicProvider(config.provider)) {
    return callAnthropicOnce({ ...args, llmConfig: config });
  }

  const response = await getOpenAIClient(config).chat.completions.create({
    model: args.model,
    max_tokens: args.maxTokens,
    response_format: { type: 'json_object' },
    messages: args.messages,
  });
  return {
    text: response.choices[0]?.message?.content ?? '',
    usage: (response.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
    }) as Usage,
  };
}

function messagesToPrompt(messages: ChatMessage[]): {
  system: string;
  prompt: string;
} {
  const { system, messages: rest } = splitSystem(messages);
  const prompt = rest
    .map((message) => {
      const role = message.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}:\n${message.content}`;
    })
    .join('\n\n');
  return { system, prompt };
}

function cliUsage(usage?: {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  server_tool_use?: {
    web_search_requests?: number;
    web_fetch_requests?: number;
  };
}): Usage {
  return {
    prompt_tokens:
      (usage?.input_tokens ?? 0) +
      (usage?.cache_creation_input_tokens ?? 0) +
      (usage?.cache_read_input_tokens ?? 0),
    completion_tokens: usage?.output_tokens ?? 0,
    prompt_cache_hit_tokens: usage?.cache_read_input_tokens ?? 0,
    prompt_cache_miss_tokens: usage?.cache_creation_input_tokens ?? 0,
    web_search_requests: usage?.server_tool_use?.web_search_requests ?? 0,
    web_fetch_requests: usage?.server_tool_use?.web_fetch_requests ?? 0,
  };
}

type ClaudeCliJson = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  usage?: Parameters<typeof cliUsage>[0];
  errors?: unknown[];
  permission_denials?: unknown[];
};

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

function parseClaudeCliJson(raw: string): ClaudeCliJson {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as ClaudeCliJson;
  } catch {
    const embedded = extractFirstJsonObject(trimmed);
    if (embedded) {
      try {
        return JSON.parse(embedded) as ClaudeCliJson;
      } catch {
        // Fall through to the plain HTML/text fallback below.
      }
    }

    if (/<!DOCTYPE html|<html[\s>]/i.test(trimmed)) {
      return { type: 'result', subtype: 'success', result: trimmed };
    }

    throw new Error(
      `[llm.claude-cli] returned non-JSON output: ${trimmed.slice(0, 500)}`
    );
  }
}

async function callClaudeCliOnce(args: {
  model: string;
  messages?: ChatMessage[];
  system?: string;
  prompt?: string;
  timeoutMs?: number;
  tools?: string;
  maxTurns?: number;
  permissionMode?: 'default' | 'bypassPermissions' | 'dontAsk';
}): Promise<{ text: string; usage: Usage }> {
  const fromMessages = args.messages ? messagesToPrompt(args.messages) : null;
  const system = args.system ?? fromMessages?.system ?? '';
  const prompt = args.prompt ?? fromMessages?.prompt ?? '';
  const fullPrompt = system
    ? `System:\n${system}\n\nUser:\n${prompt}`
    : prompt;
  const timeoutMs =
    args.timeoutMs ?? Number(process.env.LLM_CLAUDE_CLI_TIMEOUT_MS ?? 180000);

  const cliArgs = [
    '-p',
    '--model',
    args.model,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--max-turns',
    String(args.maxTurns ?? 1),
  ];
  if (args.tools !== 'default') {
    cliArgs.push('--tools', args.tools ?? '');
  }
  if (args.permissionMode) {
    cliArgs.push('--permission-mode', args.permissionMode);
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const child = spawn('claude', cliArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    }, timeoutMs);
    timer.unref();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`[llm.claude-cli] timed out after ${timeoutMs}ms`));
      } else if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`[llm.claude-cli] exit ${code}: ${stderr.slice(0, 1000)}`));
      }
    });
    child.stdin.end(fullPrompt);
  });

  const parsed = parseClaudeCliJson(raw);

  if (parsed.is_error || parsed.subtype?.startsWith('error')) {
    throw new Error(
      `[llm.claude-cli] ${parsed.subtype ?? 'error'} ${JSON.stringify(parsed.errors ?? []).slice(0, 500)}`
    );
  }

  return {
    text: parsed.result ?? '',
    usage: {
      ...cliUsage(parsed.usage),
      permission_denials: parsed.permission_denials?.length ?? 0,
    },
  };
}

function anthropicBaseUrl(config?: LLMConfig): string {
  return normalizeLLMConfig(config).baseUrl.replace(/\/+$/, '');
}

function anthropicHeaders(stream = false): HeadersInit {
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return {
    'content-type': 'application/json',
    accept: stream ? 'text/event-stream' : 'application/json',
    'anthropic-version': process.env.ANTHROPIC_VERSION ?? '2023-06-01',
    ...(authToken
      ? { authorization: `Bearer ${authToken}` }
      : { 'x-api-key': apiKey ?? '' }),
  };
}

function splitSystem(messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const rest = messages.filter((message) => message.role !== 'system');
  return { system, messages: rest };
}

function anthropicUsage(
  usage?: AnthropicMessageResponse['usage']
): Usage {
  return {
    prompt_tokens: usage?.input_tokens ?? 0,
    completion_tokens: usage?.output_tokens ?? 0,
    prompt_cache_hit_tokens: usage?.cache_read_input_tokens ?? 0,
    prompt_cache_miss_tokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

async function callAnthropicOnce(args: {
  model: string;
  maxTokens: number;
  messages: ChatMessage[];
  llmConfig?: LLMConfig;
}): Promise<{ text: string; usage: Usage }> {
  const { system, messages } = splitSystem(args.messages);
  const response = await fetch(`${anthropicBaseUrl(args.llmConfig)}/v1/messages`, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      system,
      messages,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `[llm.anthropic] request failed ${response.status}: ${raw.slice(0, 500)}`
    );
  }

  const json = JSON.parse(raw) as AnthropicMessageResponse;
  return {
    text:
      json.content
        ?.filter((block) => block.type === 'text' || typeof block.text === 'string')
        .map((block) => block.text ?? '')
        .join('') ?? '',
    usage: anthropicUsage(json.usage),
  };
}

export type CompleteTextOpts = {
  system: string;
  user: string;
  model?: string;
  llmConfig?: LLMConfig;
  maxTokens?: number;
  timeoutMs?: number;
  /**
   * Claude CLI only. Use ''/undefined to disable tools, 'default' to omit
   * --tools, or a comma-separated list such as 'WebSearch,WebFetch'.
   */
  tools?: string;
  maxTurns?: number;
  permissionMode?: 'default' | 'bypassPermissions' | 'dontAsk';
};

export async function completeText(opts: CompleteTextOpts): Promise<{
  text: string;
  usage: Usage;
}> {
  const config = normalizeLLMConfig({ ...opts.llmConfig, model: opts.model });
  const model = config.model;
  const maxTokens = opts.maxTokens ?? 8192;
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];

  if (isClaudeCliProvider(config.provider)) {
    return callClaudeCliOnce({
      model,
      messages,
      timeoutMs: opts.timeoutMs,
      tools: opts.tools,
      maxTurns: opts.maxTurns,
      permissionMode: opts.permissionMode,
    });
  }

  if (isAnthropicProvider(config.provider)) {
    return callAnthropicOnce({ model, maxTokens, messages, llmConfig: config });
  }

  const response = await getOpenAIClient(config).chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages,
  });
  return {
    text: response.choices[0]?.message?.content ?? '',
    usage: (response.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
    }) as Usage,
  };
}

export async function extract<T>(opts: ExtractOpts<T>): Promise<{
  data: T;
  usage: Usage;
}> {
  const config = normalizeLLMConfig({ ...opts.llmConfig, model: opts.model });
  const model = config.model;
  const maxTokens = opts.maxTokens ?? 8192;

  // 第一次抽取
  const first = await callExtractOnce({
    model,
    llmConfig: config,
    maxTokens,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });

  const firstStr = stripJsonFence(first.text);
  let firstParsed: unknown;
  try {
    firstParsed = parseJsonFromText(first.text);
  } catch {
    const looksTruncated = !firstStr.trim().endsWith('}');
    const hint = looksTruncated
      ? `（看起来是被 max_tokens 截断：输出长度 ${firstStr.length} 字符，末尾未闭合 \`}\`。提示用户简化输入，或增大 extract maxTokens）`
      : '';
    throw new Error(
      `[llm.extract] 首轮返回非 JSON${hint}。前 300 字：\n${first.text.slice(0, 300)}`
    );
  }

  const firstCheck = opts.schema.safeParse(firstParsed);
  if (firstCheck.success) {
    return { data: firstCheck.data, usage: first.usage };
  }

  // 把 schema 错误回灌给 LLM 修一次
  const errSummary = z.prettifyError(firstCheck.error);
  const repairUser = `你上一轮输出的 JSON 在 schema 校验时报了以下错误，请修正后**只输出修正后的完整 JSON**，不要解释：

错误：
${errSummary}

你上一轮的 JSON：
${JSON.stringify(firstParsed).slice(0, 6000)}`;

  const second = await callExtractOnce({
    model,
    llmConfig: config,
    maxTokens,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
      { role: 'assistant', content: firstStr },
      { role: 'user', content: repairUser },
    ],
  });

  let secondParsed: unknown;
  try {
    secondParsed = parseJsonFromText(second.text);
  } catch {
    throw new Error(
      `[llm.extract] 修复轮返回非 JSON。原始错误：\n${errSummary}\n修复轮前 300 字：\n${second.text.slice(0, 300)}`
    );
  }

  const secondCheck = opts.schema.safeParse(secondParsed);
  if (!secondCheck.success) {
    throw new Error(
      `[llm.extract] 修复后仍未通过 schema：\n${z.prettifyError(secondCheck.error)}\n原始：${JSON.stringify(secondParsed).slice(0, 300)}`
    );
  }

  // 修复轮 usage 累计返回
  return {
    data: secondCheck.data,
    usage: {
      prompt_tokens: first.usage.prompt_tokens + second.usage.prompt_tokens,
      completion_tokens:
        first.usage.completion_tokens + second.usage.completion_tokens,
    },
  };
}

// ============ render: JSON + design prompt → HTML（流式） ============

export type RenderOpts = {
  systemBlocks: SystemBlock[];
  user: string;
  model?: string;
  llmConfig?: LLMConfig;
  maxTokens?: number;
};

export type RenderStream = {
  textStream: AsyncIterable<string>;
  final: Promise<{ html: string; usage: Usage }>;
};

export function renderStream(opts: RenderOpts): RenderStream {
  const systemText = opts.systemBlocks.map((b) => b.text).join('\n\n---\n\n');
  const config = normalizeLLMConfig({ ...opts.llmConfig, model: opts.model });

  let resolveFinal!: (v: { html: string; usage: Usage }) => void;
  let rejectFinal!: (err: Error) => void;
  const final = new Promise<{ html: string; usage: Usage }>((res, rej) => {
    resolveFinal = res;
    rejectFinal = rej;
  });

  async function* textIter(): AsyncIterable<string> {
    let acc = '';
    let usage: Usage | undefined;
    try {
      if (isClaudeCliProvider(config.provider)) {
        const result = await callClaudeCliOnce({
          model: config.model,
          system: systemText,
          prompt: opts.user,
          timeoutMs: Number(
            process.env.LLM_CLAUDE_CLI_RENDER_TIMEOUT_MS ?? 600000
          ),
        });
        acc = result.text;
        usage = result.usage;
        if (acc) yield acc;
        resolveFinal({
          html: acc,
          usage,
        });
        return;
      }

      if (isAnthropicProvider(config.provider)) {
        const { messages } = splitSystem([
          { role: 'system', content: systemText },
          { role: 'user', content: opts.user },
        ]);
        const response = await fetch(`${anthropicBaseUrl(config)}/v1/messages`, {
          method: 'POST',
          headers: anthropicHeaders(true),
          body: JSON.stringify({
            model: config.model,
            max_tokens: opts.maxTokens ?? 16000,
            stream: true,
            system: systemText,
            messages,
          }),
        });

        if (!response.ok || !response.body) {
          const raw = await response.text().catch(() => '');
          throw new Error(
            `[llm.anthropic.stream] request failed ${response.status}: ${raw.slice(0, 500)}`
          );
        }

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;

          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLines = event
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());
            for (const line of dataLines) {
              if (!line || line === '[DONE]') continue;
              const parsed = JSON.parse(line) as AnthropicStreamEvent;
              if (parsed.type === 'error') {
                throw new Error(
                  `[llm.anthropic.stream] ${parsed.error?.message ?? 'unknown error'}`
                );
              }
              const text = parsed.delta?.text;
              if (typeof text === 'string' && text.length > 0) {
                acc += text;
                yield text;
              }
              if (parsed.type === 'message_start') {
                usage = anthropicUsage(parsed.message?.usage);
              }
              if (parsed.type === 'message_delta') {
                usage = {
                  prompt_tokens: usage?.prompt_tokens ?? 0,
                  completion_tokens:
                    parsed.usage?.output_tokens ?? usage?.completion_tokens ?? 0,
                  prompt_cache_hit_tokens: usage?.prompt_cache_hit_tokens ?? 0,
                  prompt_cache_miss_tokens:
                    usage?.prompt_cache_miss_tokens ?? 0,
                };
              }
            }
          }
        }

        resolveFinal({
          html: acc,
          usage: usage ?? { prompt_tokens: 0, completion_tokens: 0 },
        });
        return;
      }

      const stream = await getOpenAIClient(config).chat.completions.create({
        model: config.model,
        max_tokens: opts.maxTokens ?? 16000,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content: opts.user },
        ],
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          acc += delta;
          yield delta;
        }
        // stream_options.include_usage 让最后一个 chunk 带 usage
        if (chunk.usage) usage = chunk.usage as unknown as Usage;
      }

      resolveFinal({
        html: acc,
        usage: usage ?? { prompt_tokens: 0, completion_tokens: 0 },
      });
    } catch (err) {
      rejectFinal(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  return {
    textStream: textIter(),
    final,
  };
}

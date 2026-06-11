'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type CategoryKey = 'knowledge' | 'travel' | 'recipe';
type LLMProvider = 'openai-compatible' | 'anthropic-compatible' | 'claude-cli';
type LLMChoice = 'deepseek' | 'openai' | 'anthropic';
type UiImageProvider = 'image-a' | 'image-b' | 'image-c';

type LLMConfig = {
  provider: LLMProvider;
  model: string;
  baseUrl: string;
};

type ImageConfig = {
  provider: UiImageProvider;
  model: string;
  size: string;
  enabled: boolean;
};

const CATEGORIES: { key: CategoryKey; name: string; placeholder: string }[] = [
  {
    key: 'knowledge',
    name: '知识',
    placeholder: '帮我总结一下大模型 Scaling Law 的核心观点',
  },
  {
    key: 'travel',
    name: '旅游',
    placeholder: '做一个新疆14天的自驾旅游攻略，从上海飞新疆，落地租车自驾',
  },
  {
    key: 'recipe',
    name: '食谱',
    placeholder: '给我一份红烧肉的食谱，适合厨房小白照着做',
  },
];

type JobStatus =
  | 'queued'
  | 'researching'
  | 'extracting'
  | 'rendering'
  | 'done'
  | 'error';

type Job = {
  id: string;
  categoryKey: CategoryKey;
  input: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  bytes: number;
  truncated: boolean;
  previewUrl?: string;
  error?: string;
  researchUsage?: { input: number; output: number };
  extractUsage?: { input: number; output: number };
  renderUsage?: {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
  };
  llmConfig?: LLMConfig;
  imageConfig?: ImageConfig;
};

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'claude-cli',
  model: 'claude-sonnet-4-6',
  baseUrl: '',
};

const DEFAULT_IMAGE_CONFIG: ImageConfig = {
  provider: 'image-a',
  model: 'gpt-image-2',
  size: '1024x1024',
  enabled: true,
};

const imageProviderOptions: { value: UiImageProvider; label: string; hint: string }[] = [
  {
    value: 'image-a',
    label: 'OpenAI',
    hint: '默认生图模型，适合食谱主图和步骤示意图',
  },
  {
    value: 'image-b',
    label: '千问',
    hint: '备用生图模型',
  },
  {
    value: 'image-c',
    label: '豆包',
    hint: '备用生图模型',
  },
];

const providerOptions: { value: LLMChoice; label: string; hint: string }[] = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    hint: '适合通用结构化生成',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    hint: '适合通用文本生成',
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    hint: '默认大语言模型',
  },
];

function defaultConfigForProvider(provider: LLMChoice): LLMConfig {
  if (provider === 'anthropic') {
    return {
      provider: 'claude-cli',
      model: 'claude-sonnet-4-6',
      baseUrl: '',
    };
  }
  if (provider === 'openai') {
    return {
      provider: 'openai-compatible',
      model: 'gpt-4.1',
      baseUrl: 'https://api.openai.com/v1',
    };
  }
  return {
    provider: 'openai-compatible',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
  };
}

function llmChoice(config: LLMConfig): LLMChoice {
  if (config.provider === 'claude-cli' || config.provider === 'anthropic-compatible') {
    return 'anthropic';
  }
  if (/openai\.com/i.test(config.baseUrl)) return 'openai';
  return 'deepseek';
}

function normalizeSavedLlmConfig(saved: LLMConfig): LLMConfig {
  const isLegacyDefault = saved.provider === 'openai-compatible' && !saved.baseUrl;
  return isLegacyDefault ? DEFAULT_LLM_CONFIG : { ...DEFAULT_LLM_CONFIG, ...saved };
}

function normalizeSavedImageConfig(saved: ImageConfig): ImageConfig {
  const providerMap: Record<string, UiImageProvider> = {
    'image-a': 'image-a',
    'image-b': 'image-b',
    'image-c': 'image-c',
  };
  return {
    ...DEFAULT_IMAGE_CONFIG,
    ...saved,
    provider: providerMap[saved.provider] ?? DEFAULT_IMAGE_CONFIG.provider,
  };
}

function defaultImageConfigForProvider(provider: UiImageProvider): ImageConfig {
  if (provider === 'image-a') {
    return {
      provider,
      model: 'gpt-image-2',
      size: '1024x1024',
      enabled: true,
    };
  }
  if (provider === 'image-c') {
    return {
      provider,
      model: 'doubao-seedream-3-0-t2i-250415',
      size: '1024*1024',
      enabled: true,
    };
  }
  return DEFAULT_IMAGE_CONFIG;
}

const statusLabel: Record<JobStatus, string> = {
  queued: '排队中',
  researching: '研究中',
  extracting: '结构化中',
  rendering: '渲染中',
  done: '完成',
  error: '失败',
};

const statusClass: Record<JobStatus, string> = {
  queued: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  researching: 'bg-violet-50 text-violet-700 border-violet-200',
  extracting: 'bg-blue-50 text-blue-700 border-blue-200',
  rendering: 'bg-amber-50 text-amber-700 border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

function isActive(status: JobStatus) {
  return (
    status === 'queued' ||
    status === 'researching' ||
    status === 'extracting' ||
    status === 'rendering'
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [category, setCategory] = useState<CategoryKey>('knowledge');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [imageConfig, setImageConfig] =
    useState<ImageConfig>(DEFAULT_IMAGE_CONFIG);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null,
    [jobs, selectedId]
  );
  const selectedLlmChoice = llmChoice(llmConfig);

  const placeholder =
    CATEGORIES.find((c) => c.key === category)?.placeholder ?? '';

  const refreshJobs = useCallback(async () => {
    const res = await fetch('/api/jobs', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { jobs: Job[] };
    setJobs(json.jobs);
    setSelectedId((current) => current ?? json.jobs[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refreshJobs();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshJobs]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      const savedLlm = window.localStorage.getItem('generation.llmConfig');
      const savedImage = window.localStorage.getItem('generation.imageConfig');

      if (savedLlm) {
        try {
          setLlmConfig(
            normalizeSavedLlmConfig(JSON.parse(savedLlm) as LLMConfig)
          );
        } catch {
          setLlmConfig(DEFAULT_LLM_CONFIG);
        }
      }

      if (savedImage) {
        try {
          setImageConfig(
            normalizeSavedImageConfig(JSON.parse(savedImage) as ImageConfig)
          );
        } catch {
          setImageConfig(DEFAULT_IMAGE_CONFIG);
        }
      }

      setSettingsLoaded(true);
    }, 0);

    return () => window.clearTimeout(initial);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem('generation.llmConfig', JSON.stringify(llmConfig));
  }, [llmConfig, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem('generation.imageConfig', JSON.stringify(imageConfig));
  }, [imageConfig, settingsLoaded]);

  const handleGenerate = useCallback(async () => {
    const text = input.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          categoryKey: category,
          llmConfig,
          imageConfig,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        job?: Job;
        error?: string;
      };
      if (!res.ok || !json.job) {
        throw new Error(json.error ?? `create job failed: ${res.status}`);
      }
      setJobs((prev) => [json.job!, ...prev.filter((job) => job.id !== json.job!.id)]);
      setSelectedId(json.job.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [input, category, llmConfig, imageConfig, submitting]);

  const handleOpenJob = useCallback((job: Job) => {
    if (job.status !== 'done') return;
    window.open(`/preview/${job.id}`, '_blank', 'noopener,noreferrer');
  }, []);

  const handleDownloadJob = useCallback(async (job: Job) => {
    if (job.status !== 'done' || downloadingId) return;
    setDownloadingId(job.id);
    setError(null);
    try {
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `snapshot failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${job.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

  const handleDeleteJob = useCallback(
    async (job: Job) => {
      const confirmed = window.confirm(`删除这条记录？\n\n${job.input}`);
      if (!confirmed) return;

      setError(null);
      try {
        const res = await fetch(`/api/jobs?id=${encodeURIComponent(job.id)}`, {
          method: 'DELETE',
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? `delete failed: ${res.status}`);
        }
        setJobs((current) => {
          const next = current.filter((item) => item.id !== job.id);
          if (selectedId === job.id) {
            setSelectedId(next[0]?.id ?? null);
          }
          return next;
        });
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [selectedId]
  );

  return (
    <main className="flex flex-col flex-1 w-full min-h-screen">
      <header className="px-8 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">生成式内容卡片</h1>
        <p className="text-sm text-zinc-500 mt-1">
          知识类先横纵研究，旅游类直接规划，食谱类生成小红书风步骤卡；完成后可预览 / 下载 PNG
        </p>
      </header>

      <section className="px-8 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 flex-1 pb-8">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                  category === c.key
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
          />

          <section className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold">LLM 配置</h2>
              <button
                type="button"
                onClick={() => setLlmConfig(DEFAULT_LLM_CONFIG)}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                恢复默认
              </button>
            </div>
            <label className="block text-xs text-zinc-500 mb-1">大语言模型</label>
            <select
              value={selectedLlmChoice}
              onChange={(event) => {
                const provider = event.target.value as LLMChoice;
                setLlmConfig(defaultConfigForProvider(provider));
              }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-zinc-400 mt-1">
              {providerOptions.find((option) => option.value === selectedLlmChoice)?.hint}
            </div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <label className="block">
                <span className="block text-xs text-zinc-500 mb-1">模型</span>
                <input
                  value={llmConfig.model}
                  onChange={(event) =>
                    setLlmConfig((current) => ({
                      ...current,
                      model: event.target.value,
                    }))
                  }
                  placeholder={
                    llmConfig.provider === 'openai-compatible'
                      ? '输入模型名称'
                      : 'claude-sonnet-4-6'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>
              {llmConfig.provider !== 'claude-cli' && (
                <label className="block">
                  <span className="block text-xs text-zinc-500 mb-1">接口地址</span>
                  <input
                    value={llmConfig.baseUrl}
                    onChange={(event) =>
                      setLlmConfig((current) => ({
                        ...current,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder={
                      llmConfig.provider === 'openai-compatible'
                        ? 'https://example.com/v1'
                        : 'https://example.com'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-3">
              鉴权信息从本地环境配置读取，页面不会展示密钥。
            </p>
          </section>

          <section className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold">生图配置</h2>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={imageConfig.enabled}
                  onChange={(event) =>
                    setImageConfig((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="size-3.5"
                />
                启用
              </label>
            </div>
            <label className="block text-xs text-zinc-500 mb-1">生图模型</label>
            <select
              value={imageConfig.provider}
              onChange={(event) => {
                const provider = event.target.value as UiImageProvider;
                setImageConfig(defaultImageConfigForProvider(provider));
              }}
              disabled={!imageConfig.enabled}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
            >
              {imageProviderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-zinc-400 mt-1">
              {
                imageProviderOptions.find(
                  (option) => option.value === imageConfig.provider
                )?.hint
              }
            </div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <label className="block">
                <span className="block text-xs text-zinc-500 mb-1">模型</span>
                <input
                  value={imageConfig.model}
                  onChange={(event) =>
                    setImageConfig((current) => ({
                      ...current,
                      model: event.target.value,
                    }))
                  }
                  disabled={!imageConfig.enabled}
                  placeholder={
                    imageConfig.provider === 'image-a'
                      ? 'gpt-image-2'
                      : imageConfig.provider === 'image-b'
                      ? 'qwen-image'
                      : 'doubao-seedream-3-0-t2i-250415'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-zinc-500 mb-1">尺寸</span>
                <input
                  value={imageConfig.size}
                  onChange={(event) =>
                    setImageConfig((current) => ({
                      ...current,
                      size: event.target.value,
                    }))
                  }
                  disabled={!imageConfig.enabled}
                  placeholder="1024x1024"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
                />
              </label>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-3">
              鉴权信息从本地环境配置读取，页面不会展示密钥。
            </p>
          </section>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting || !input.trim()}
            className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交任务中…' : '生成'}
          </button>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
              {error}
            </div>
          )}

          <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold">任务列表</h2>
              <button
                type="button"
                onClick={() => void refreshJobs()}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                刷新
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto divide-y divide-zinc-100">
              {jobs.length === 0 ? (
                <div className="p-4 text-sm text-zinc-400">暂无任务</div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className={`group p-4 transition-colors ${
                      selectedJob?.id === job.id ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(job.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${
                              statusClass[job.status]
                            }`}
                          >
                            {statusLabel[job.status]}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {job.id.slice(-8)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-zinc-800 line-clamp-2">
                          {job.input}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400 flex justify-between">
                          <span>
                            {job.categoryKey === 'travel'
                              ? '旅游'
                              : job.categoryKey === 'recipe'
                                ? '食谱'
                                : '知识'}
                          </span>
                          <span>
                            {isActive(job.status)
                              ? `${job.bytes.toLocaleString()} 字`
                              : new Date(job.updatedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {job.error && (
                          <div className="mt-2 text-xs text-red-600 line-clamp-2">
                            {job.error}
                          </div>
                        )}
                      </button>
                      <div className="shrink-0 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenJob(job)}
                          disabled={job.status !== 'done'}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`新标签页打开 ${job.input}`}
                        >
                          打开
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadJob(job)}
                          disabled={job.status !== 'done' || Boolean(downloadingId)}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`下载 ${job.input} PNG`}
                        >
                          {downloadingId === job.id ? '截图' : 'PNG'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteJob(job)}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label={`删除 ${job.input}`}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {selectedJob?.renderUsage && (
            <div className="text-xs text-zinc-500 font-mono leading-relaxed bg-white border border-zinc-200 rounded-lg p-3">
              {selectedJob.researchUsage && (
                <div>
                  research {selectedJob.researchUsage.input.toLocaleString()} /
                  {selectedJob.researchUsage.output.toLocaleString()} tok
                </div>
              )}
              {selectedJob.extractUsage && (
                <div>
                  extract {selectedJob.extractUsage.input.toLocaleString()} /
                  {selectedJob.extractUsage.output.toLocaleString()} tok
                </div>
              )}
              <div>render output {selectedJob.renderUsage.output.toLocaleString()} tok</div>
              <div>render input {selectedJob.renderUsage.input.toLocaleString()} tok</div>
              <div>
                cache read {selectedJob.renderUsage.cache_read.toLocaleString()} ·
                creation {selectedJob.renderUsage.cache_creation.toLocaleString()}
              </div>
              <div className="text-zinc-400 mt-1 break-all">id {selectedJob.id}</div>
            </div>
          )}

          {selectedJob?.truncated && selectedJob.status === 'done' && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
              HTML 未完整闭合，可能被 token 限制截断。截图可能不完整，建议再生成一次。
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 min-h-[70vh]">
          {selectedJob?.status === 'done' ? (
            <iframe
              key={selectedJob.id}
              src={`/preview/${selectedJob.id}`}
              className="w-full h-full border-0 bg-[#E5E5EA] flex-1"
              title="preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-zinc-400 gap-2 px-6 text-center">
              {!selectedJob && '左侧输入主题，选类目，点生成'}
              {selectedJob?.status === 'queued' && '任务已提交，等待后台开始…'}
              {selectedJob?.status === 'researching' &&
                '后台正在按横纵分析法获取知识素材：纵向脉络、横向截面、交汇洞察'}
              {selectedJob?.status === 'extracting' &&
                '后台正在把一句话扩展为结构化 JSON，可继续提交其他任务'}
              {selectedJob?.status === 'rendering' &&
                `后台正在渲染 HTML（已收到 ${selectedJob.bytes.toLocaleString()} 字）`}
              {selectedJob?.status === 'error' && '任务失败，查看左侧错误详情'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

# 生成式内容卡片 / Generative Content Cards

> 中文说明见上半部分，English documentation follows below.

## 项目背景

项目目标：**让世界上没有难懂的知识。**

这是一个 vibe coding 过程中逐步打磨出来的生成式内容卡片项目。整体视觉灵感来自苹果发布会中高度凝练、信息密度很高的一览图：复杂的产品能力、技术参数和核心卖点可以被组织进一张图里，让人快速建立整体印象。

另一个初心来自日常和大模型对话时的体验：模型经常返回一大段长文本，信息量很高，但用户需要花时间阅读、筛选和重组。对于很多“先建立整体认知”的场景，图文结合的一览图比纯文字更快、更直观，也更适合保存和分享。

在知识类卡片中，内容整理方法借鉴了数字生命卡兹克分享的纵横分析法，尤其是 [KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills) 中 `hv-analysis` 所强调的“纵向追时间深度，横向追同期广度，最终交汇出判断”。这套方法只用于知识类主题的结构化分析，帮助卡片同时保留历史脉络、横向对比和关键判断；旅游类和食谱类则使用各自更贴近场景的行程规划、步骤拆解和信息编排方式。

这个项目希望把“一览图化”的表达方式产品化：当一个人想了解某个知识、概念、人物、技术、路线或生活方案时，不必先被长篇文字和零散搜索结果淹没，而是先得到一张结构清晰、信息可信、视觉友好的一览图。它不追求替代深度阅读，而是帮助用户更快进入一个主题，建立正确的第一层认知，再决定是否继续深入。

最初目标是“一句话生成可发布的一览图”，后来扩展成面向三类内容的卡片生成工具：

- **知识类**：适合概念解释、技术图谱、行业脉络、横向对比和时间线梳理。
- **旅游类**：适合城市短途、自驾路线、多城市行程、住宿和预算规划。
- **食谱类**：适合生成带主图、食材、调料、用量、步骤、过程态检查点的菜谱卡片。

当前最核心的方向仍然是知识类：让抽象概念变得更容易看懂，让复杂脉络变得更容易分享，让知识从“读完才知道有没有用”变成“先看见结构，再决定深入”。旅游类和食谱类是对同一套生成式卡片能力的场景延伸，用来验证长内容编排、图片生成、任务管理和导出能力。

更长期的目标是产出可交互的知识图谱：用户先看到主题的一览结构，再针对感兴趣的知识点点击展开详细内容，从“看见知识关系”进入“理解知识深度”。卡片不只是终点，也可以成为继续探索的入口。

项目采用“结构化数据 + 本地稳定模板”的方式生成 HTML 卡片。LLM 主要负责把用户的一句话扩展为结构化 JSON，前端预览和 PNG 导出由本地服务完成。这样比让模型直接写完整 HTML 更稳定，也更容易处理长内容、图片、事实校验和后续模板迭代。

## 核心能力

- 一句话创建后台生成任务。
- 任务列表支持轮询、预览、下载 PNG、删除记录。
- 支持知识、旅游、食谱三类内容。
- 知识类支持横纵研究、长图自适应高度、开放图库配图和 AI fallback 配图。
- 旅游类支持 1920 宽长图，自驾/多日行程自动展开。
- 食谱类支持菜品主图、步骤图、食材/调料/用量、过程态说明和厨房小白检查点。
- 支持多种大语言模型配置：DeepSeek、OpenAI、Anthropic 兼容链路。
- 支持多种生图模型配置：OpenAI、千问、豆包兼容链路。
- 生成结果保存在本地，便于预览、截图和二次渲染。

## 参考效果图

以下图片来自 `参考/` 目录，用于记录当前项目期望接近的卡片视觉效果。

![参考效果图一](参考/参考一.png)

![参考效果图二](参考/参考二.png)

## 目录结构

```text
.
├── 参考/                # README 展示用参考效果图
├── app/                 # Next.js 应用主体
│   ├── app/             # App Router 页面和 API 路由
│   ├── categories/      # 三类内容的 schema / prompt / meta
│   ├── lib/             # LLM、生图、任务、存储、渲染逻辑
│   ├── scripts/         # 本地调试脚本
│   └── storage/         # 本地生成缓存，已被 git 忽略
├── 知识类/              # 知识类设计 prompt；samples/ 仅本地测试使用
├── 旅游类/              # 旅游类设计 prompt；samples/ 仅本地测试使用
├── 食谱类/              # 食谱类设计 prompt；samples/ 仅本地测试使用
├── docs/                # 开发计划和项目过程记录
└── README.md
```

## 环境要求

- Node.js 20+，推荐使用当前项目已经验证过的 Node 环境。
- pnpm。
- 如需截图导出，需要 Playwright 可用浏览器；项目会优先使用 Playwright 浏览器，也兼容本机 Google Chrome fallback。
- 至少配置一个可用的大语言模型密钥。
- 如需食谱/知识 AI 配图，需要配置至少一个生图模型密钥。

## 安装依赖

```bash
cd app
pnpm install
```

## 配置环境变量

复制示例文件：

```bash
cd app
cp .env.example .env.local
```

`.env.local` 只用于本地运行，已经被 `.gitignore` 忽略，不会上传到 GitHub。

常用配置项：

```bash
# LLM
LLM_PROVIDER=claude-cli
LLM_MODEL_CHAT=claude-sonnet-4-6
ANTHROPIC_AUTH_TOKEN=

# OpenAI-compatible / DeepSeek-compatible
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1

# Image generation
IMAGE_PACKY_API_KEY=
PACKY_API_KEY=
DASHSCOPE_API_KEY=
IMAGE_QWEN_API_KEY=
IMAGE_DOUBAO_API_KEY=
ARK_API_KEY=

# Snapshot
SNAPSHOT_BASE_URL=http://localhost:3000
```

不要把真实 API Key 写入 README、源码或 prompt 文件。只写入 `.env.local` 或运行环境变量。

## 启动开发服务

```bash
cd app
pnpm dev
```

默认访问：

```text
http://localhost:3000
```

如果你想临时避开 shell 中已有的 Anthropic 相关环境变量，可以使用：

```bash
pnpm dev:clean
```

## 常用命令

```bash
cd app

# 类型检查
pnpm typecheck

# ESLint
pnpm lint

# 类型检查 + lint
pnpm check

# 生产构建
pnpm build

# LLM 简单连通性测试
pnpm llm:smoke
```

## 使用流程

1. 打开首页，输入一句话需求。
2. 选择类目：知识、旅游或食谱。
3. 选择大语言模型和生图模型。
4. 点击生成，任务进入后台队列。
5. 任务完成后可在右侧预览 HTML 卡片。
6. 点击下载 PNG 导出图片。
7. 不需要的任务可在任务列表中删除。

## 后续优化方向

- **知识类**：继续完善整体知识架构，让输出内容更有效、更正确、更易懂。重点包括事实来源、概念层级、时间线、横向对比、关键结论和适合新手理解的解释方式。
- **旅游类**：集成地图 API，将整体路线、城市节点、每日行程和交通关系可视化，进一步完善住宿、预算、景点、餐饮和路线节点信息。
- **食谱类**：当前模板和生图链路已满足阶段需求，暂时没有新的大方向计划。
- **类目扩展**：未来可能进一步细化知识类，例如人文历史、科学、神学、商业、产品研究等，也可能新增更多适合“一览图化”的内容类目。

## 本地数据和隐私

生成记录保存到：

```text
app/storage/generations/
```

该目录包含用户输入、结构化 JSON、HTML 和生成图片，默认不纳入 Git。上传 GitHub 前应确认：

- `.env.local` 不在 Git 跟踪列表中。
- `app/storage/` 不在 Git 跟踪列表中。
- `app/.next/` 和 `app/node_modules/` 不在 Git 跟踪列表中。
- 源码、README、prompt、样例中没有真实 API Key。

## GitHub 上传前检查

在上传前建议运行：

```bash
git status --short
git ls-files
git grep -n -E "sk-[A-Za-z0-9]{8,}|(API_KEY|AUTH_TOKEN|PACKY_API_KEY|OPENAI_API_KEY|ANTHROPIC_AUTH_TOKEN|DEEPSEEK_API_KEY|DASHSCOPE_API_KEY|ARK_API_KEY)=[^#[:space:]]+" || true
```

本项目当前要求：**推送 GitHub 前必须先人工确认文件清单和隐私扫描结果**。

---

# Generative Content Cards

## Background

Project goal: **make knowledge easier to understand for everyone.**

This project is a generative content-card tool built through an iterative vibe-coding workflow. The overall visual inspiration comes from Apple keynote overview graphics, where complex product capabilities, technical details, and key messages are compressed into one highly readable visual.

Another motivation comes from everyday conversations with large language models. Models often return long text responses with a lot of useful information, but users still need time to read, filter, and reorganize that content. For many “build the first mental model” scenarios, a visual overview with text and images is faster to absorb, easier to save, and easier to share than plain text.

For knowledge cards specifically, the content-organization method borrows from the vertical/horizontal analysis method shared by KKKKhazix, especially the `hv-analysis` skill in [KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills), which combines historical depth, horizontal comparison, and final judgment. This method is only used for structuring knowledge topics. Travel and recipe cards use their own scenario-specific planning, sequencing, and information-layout logic instead.

The ambition is to turn overview-style expression into a practical product. When someone wants to understand a concept, technology, person, route, or life scenario, they should not have to start by drowning in long articles and scattered search results. They should first get a structured, visually clear, and reasonably trustworthy overview card, then decide whether to go deeper.

It started as a simple “one sentence to one visual overview” prototype and gradually evolved into a multi-category generator for structured visual cards.

It currently supports:

- **Knowledge cards**: concepts, technical maps, industry timelines, comparisons, and structured explainers.
- **Travel cards**: city trips, road trips, multi-city itineraries, budgets, hotels, and day-by-day plans.
- **Recipe cards**: dish photos, ingredients, seasonings, quantities, cooking steps, process images, and beginner-friendly checkpoints.

The knowledge category is still the main direction: turning abstract concepts into something easier to read, making complex context easier to share, and helping knowledge move from “read everything first” to “see the structure first, then go deeper.” Travel and recipe cards extend the same card-generation system into practical scenarios, validating long-layout rendering, images, job management, and PNG export.

The longer-term goal is to generate interactive knowledge graphs. Users should first see the overall structure of a topic, then click the knowledge points they care about to reveal deeper explanations. In that direction, a card is not only an output, but also an entry point for further exploration.

The app uses a “structured JSON + deterministic local renderer” architecture. The LLM extracts structured data from the user prompt, while the app renders stable HTML templates locally. This makes the output more reliable than asking the model to write the full HTML every time, and it also makes long content, images, fact-checking, and template iteration easier to control.

## Features

- Create background generation jobs from one prompt.
- Job list with polling, preview, PNG download, and record deletion.
- Three content categories: knowledge, travel, and recipe.
- Knowledge cards support vertical/horizontal research, auto-height long cards, open-media image search, and AI image fallback.
- Travel cards support 1920px-wide long layouts for multi-day itineraries.
- Recipe cards support hero images, process images, ingredients, seasonings, quantities, cooking steps, and state checkpoints.
- Configurable LLM providers: DeepSeek, OpenAI, and Anthropic-compatible flows.
- Configurable image providers: OpenAI, Qwen, and Doubao-compatible flows.
- Local storage for generation JSON, HTML, and generated/downloaded images.

## Reference Outputs

The following images are stored in `参考/` and document the visual direction this project is aiming for.

![Reference output 1](参考/参考一.png)

![Reference output 2](参考/参考二.png)

## Project Structure

```text
.
├── 参考/                # Reference images shown in README
├── app/                 # Next.js application
│   ├── app/             # App Router pages and API routes
│   ├── categories/      # Schemas, prompts, and metadata
│   ├── lib/             # LLM, image generation, jobs, storage, renderers
│   ├── scripts/         # Local debugging scripts
│   └── storage/         # Local generation cache, ignored by git
├── 知识类/              # Knowledge design prompts; samples/ is local-only
├── 旅游类/              # Travel design prompts; samples/ is local-only
├── 食谱类/              # Recipe design prompts; samples/ is local-only
├── docs/                # Development notes and plans
└── README.md
```

## Requirements

- Node.js 20+.
- pnpm.
- A working LLM API key or compatible local/CLI setup.
- An image-generation key if recipe/knowledge images are needed.
- Playwright or local Chrome for PNG snapshots.

## Install

```bash
cd app
pnpm install
```

## Environment Variables

Create a local environment file:

```bash
cd app
cp .env.example .env.local
```

`.env.local` is ignored by git and must not be committed.

Common variables:

```bash
# LLM
LLM_PROVIDER=claude-cli
LLM_MODEL_CHAT=claude-sonnet-4-6
ANTHROPIC_AUTH_TOKEN=

# OpenAI-compatible / DeepSeek-compatible
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1

# Image generation
IMAGE_PACKY_API_KEY=
PACKY_API_KEY=
DASHSCOPE_API_KEY=
IMAGE_QWEN_API_KEY=
IMAGE_DOUBAO_API_KEY=
ARK_API_KEY=

# Snapshot
SNAPSHOT_BASE_URL=http://localhost:3000
```

Never put real API keys in README files, source code, prompts, or samples. Keep them in `.env.local` or deployment environment variables only.

## Start the Dev Server

```bash
cd app
pnpm dev
```

Open:

```text
http://localhost:3000
```

To temporarily ignore Anthropic-related shell variables:

```bash
pnpm dev:clean
```

## Useful Commands

```bash
cd app

pnpm typecheck
pnpm lint
pnpm check
pnpm build
pnpm llm:smoke
```

## How to Use

1. Open the app.
2. Enter a one-sentence request.
3. Choose a category: knowledge, travel, or recipe.
4. Choose LLM and image models.
5. Generate a background job.
6. Preview the finished HTML card.
7. Export a PNG snapshot.
8. Delete records you no longer need.

## Roadmap

- **Knowledge cards**: improve the overall knowledge architecture so generated cards are useful, correct, and easy to understand. Focus areas include sources, concept hierarchy, timelines, horizontal comparison, key takeaways, and beginner-friendly explanations.
- **Travel cards**: integrate map APIs to visualize routes, city nodes, daily plans, and transportation relationships. Improve hotels, budgets, attractions, restaurants, and itinerary-node details.
- **Recipe cards**: the current template and image-generation flow are good enough for this stage, so there is no major near-term roadmap.
- **Category expansion**: future iterations may split knowledge into more specific domains, such as humanities, history, science, theology, business, and product research. More card-friendly categories may also be added.

## Local Data and Privacy

Generated records are stored under:

```text
app/storage/generations/
```

This folder may contain user inputs, structured JSON, generated HTML, and images. It is ignored by git.

Before publishing to GitHub, verify:

- `.env.local` is not tracked.
- `app/storage/` is not tracked.
- `app/.next/` and `app/node_modules/` are not tracked.
- No real API keys appear in code, prompts, samples, or documentation.

## Pre-push Checklist

Run:

```bash
git status --short
git ls-files
git grep -n -E "sk-[A-Za-z0-9]{8,}|(API_KEY|AUTH_TOKEN|PACKY_API_KEY|OPENAI_API_KEY|ANTHROPIC_AUTH_TOKEN|DEEPSEEK_API_KEY|DASHSCOPE_API_KEY|ARK_API_KEY)=[^#[:space:]]+" || true
```

This project should only be pushed to GitHub after the file list and privacy scan are manually confirmed.

## Star History

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=juedaijiaren/generative-content-cards&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=juedaijiaren/generative-content-cards&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=juedaijiaren/generative-content-cards&type=Date" />
</picture>

## License

本项目采用 [MIT License](LICENSE) 开源。This project is released under the [MIT License](LICENSE).

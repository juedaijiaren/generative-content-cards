# Prompt v2 泛化性压测 · 分析与补丁建议

> 三个差异极大的输入跑完手扮 LLM 模拟后，把 prompt 撑出的裂缝和该补的东西列清。

## 测试样本一览

| 样例 | 输入 | 主轴 | 配色 | 文件 |
|------|------|------|------|------|
| Scaling Law（标杆） | "大模型 Scaling Law 核心观点" | concept + 数字 | 蓝 | sample-output-v2.html |
| 大萧条（历史叙事） | "1929 大萧条是怎么发生的" | timeline | 红 | sample-output-history.html |
| PMF 验证（方法论） | "如何验证 PMF" | stepflow | 绿 | sample-output-method.html |
| 中美 AI 对比（数据对比） | "中美 AI 发展现状对比" | dueling entities | 蓝 | sample-output-versus.html |

---

## 发现的 5 个 prompt 裂缝

### 裂缝 1 · Schema 缺关键字段

当前 knowledge schema 只有：`title / subtitle / keyMessage / sections / keyNumbers / takeaway`。
跑这四个样例时分别需要：

| 样例 | 缺的字段 |
|------|----------|
| 大萧条 | `timeline[]` — 时间事件序列（日期/事件名/副标） |
| PMF | `steps[]` — 步骤序列（编号/标题/描述） |
| 中美对比 | `entities[]` — 两实体 + 各自指标矩阵 |
| 所有样例 | `quote` 应该独立字段，含 `body / source / date`，而不是塞在 takeaway 里 |

**建议 schema 扩展（全部 optional）**：

```ts
timeline?: Array<{ date: string; event: string; sub?: string; major?: boolean }>;  // 3-6 stops
steps?: Array<{ title: string; desc: string }>;                                    // 3-5 steps
entities?: Array<{
  name: string;       // 'US' / 'China' / 'Before' / 'After'
  metrics: Array<{ label: string; value: string; unit?: string }>;
  strengths?: string[];
}>;                   // 至多 2 个
quote?: { body: string; source: string; date?: string; ironic?: boolean };
```

LLM 在 Step 1 extract 时根据用户问题"形态"决定填哪些 optional 字段。
Step 2 render 时根据存在哪些字段，挑布局模板。

### 裂缝 2 · 缺三种核心卡片类型

v2 prompt 列了 hero/bignum/bignum-filled/concept/compare/quote/label-icon/tag-strip 共 8 种卡片。
实测必须新增三种：

#### A. `timeline` — 横贯式时间脊柱（12×1）
- 左侧 sf-label（窄列），右侧 track
- track 内 4-5 个 stop：圆点 + 日期 + 事件名 + 副标
- 横向连线穿过所有圆点
- `major` stop 用实心圆，其他用描边圆

#### B. `stepflow` — 过程脊柱（12×1）
- 同 timeline 横贯式
- 每个 step：方形编号 chip (01/02/03/04) + 标题 + 副标
- 步骤间用 `→` 箭头（accent 色，弱化 opacity）
- 4 步最佳；3 步或 5 步可行；不超过 6 步

#### C. `vs-pair` — 双实体对照（big 6×2 / slim 6×1）
- big：双侧大数字 + 中间 VS + 底部说明
- slim：横排紧凑，可外挂第三列说明
- 一侧 accent，一侧 neutral dark（关键约定 → 见裂缝 4）

### 裂缝 3 · 缺两种布局模板

v2 只有 α（左主右网格）/ β（中央主角）/ γ（数字主导）。
实测对历史和对比内容不够用：

#### Template δ · "spine 脊柱式"（适合 timeline 或 stepflow 内容）

```
[ HERO 6×3 ............ ] [ N 3×2 ] [ N 3×2 ]
                          [ FILLED 6×1 ........]
[ SPINE 12×1 timeline/stepflow .................]
[ Card 4×2 ] [ Card 4×2 ] [ Card 4×2 ]
```

历史样例和 PMF 样例都用了这套，差异只在 spine 用 timeline 还是 stepflow。

#### Template ε · "dueling 对决式"（适合双实体 vs 内容）

```
[ HERO 6×3 ............ ] [ VS-BIG 6×2 .........]
                          [ VS-SLIM 6×1 ........]
[ FILLED 12×1 综合对比指标 .....................]
[ DUEL-LEFT 6×2 .....] [ DUEL-RIGHT 6×2 ........]
```

主语序约定：左实体=accent，右实体=neutral（见裂缝 4）。

### 裂缝 4 · 单 accent 规则在"对比内容"下需要补充约定

v2 规定整图只有一个 accent，这对单一主题（如 Scaling Law）很优雅；但**对比内容里两个实体平等并列时**，单 accent 会把另一方"压暗"，违反平等感。

**补充约定（仅 vs 类布局适用）**：

- 标记一个 "subject" 实体（一般是 keyMessage 偏向的一方），用 accent
- 另一个实体用 neutral dark（`#1D1D1F` + 灰底 chip `#E5E5EA`）
- **不引入第二个 accent**，靠 dark vs accent 形成对比节奏
- 中性 dark 实体的 chip / dot / 数字保持黑色，desc 仍为灰

我在中美对比样例里就是这样处理的：US=蓝 accent，China=黑（中性）。视觉上中国并未被弱化，因为它仍然字号一致、卡片对称。

### 裂缝 5 · keyMessage 内联高亮规则没写明

四个样例都在 keyMessage 里用 `<span class="acc">` 高亮 1-3 个词："精确预测" / "三重叠加" / "用户行为" / "1-1.5 年 / 反超"。
v2 prompt 提到 hero 可以"关键词 accent 高亮"，但没强制——应该改成**强约束**：

> KeyMessage 必须包含 1-3 个 `<span class="acc">` 高亮的关键词或短语，**且总高亮字数不超过 keyMessage 总长的 25%**。这是 hero 视觉张力的核心来源，不允许整段无高亮。

---

## 没出问题、可以保留不变的部分

- 12×6 网格 + 必须填满 72 格 → 强制密度感，**这是最关键的一条规则**
- Hero / BigNum / Filled-strip / Compare / Quote / Concept-numbered-list 这 6 种卡片在 4 个样例里复用率 100%，证明粒度合适
- 浅灰底卡 + 偶尔白底带边框 + 偶尔实底 accent 三种视觉层次，节奏感够
- "单 accent 选色按主题"规则可用（蓝=科技、红=风险、绿=增长，符合直觉）
- 自适应缩放 + snapshot 模式切换的 CSS 模板没出问题

---

## 自己挑出的瑕疵

- **历史 timeline 5 stop 略挤**：1929-10-29 那种长日期 + "黑色星期二" + 副标三行，相邻 stop 容易撞。**建议 prompt 限制 timeline 最多 4 stops**（多了改用 vertical timeline 卡片，那是后话）。
- **PMF stepflow 箭头 → 偏弱**：纯文字箭头不够"流程感"。建议换成简单 SVG triangle 或加粗 `›`。
- **中美对比 compute gap 实底条信息密度过高**：左标签 + 两个数字对 + 长 note，46px 高度有点挤。可拆成两行或减一项。
- **VS-pair 大数字没反映量级差异**：$400B vs $80B 视觉字号一样，没体现 5 倍差距。可选项：值的字号按比例缩放（accent 一侧字号 76px，劣势一侧 56px），或者卡内底部加一根 mini-bar 表示比例。

---

## 建议的 prompt v3 改动清单

1. ✅ Schema 增加 `timeline / steps / entities / quote` 四个 optional 字段
2. ✅ 卡片类型库增加 `timeline / stepflow / vs-pair` 三种（含 CSS 模板示例）
3. ✅ 布局模板增加 `δ spine-layout` 和 `ε dueling-layout`
4. ✅ 单 accent 规则补充"对比内容例外条款"（accent + neutral dark 二元对照）
5. ✅ Hero keyMessage 强制 1-3 个 accent span 高亮
6. ✅ Timeline 最多 4 stops；Stepflow 最多 5 steps
7. ✅ VS-pair 量级悬殊时（≥3 倍）字号按比例区分或加底部 mini-bar

---

## 下一步建议

两条路：

**A. 直接把 v2 改成 v3** ——把上面 7 条改动落到 `knowledge-design.prompt.md` 里。然后**不再手扮 LLM**，开始搭 Next.js 工程，用真实 API 在 v3 上跑这 4 个输入验证。手扮模拟到此为止，再继续会脱离真实 LLM 行为。

**B. 再压一轮极端样本** ——比如纯叙事散文（"庄子的思想"）、纯枚举（"2026 年 AI 趋势 10 条"）、纯辩证（"该不该开源大模型"）。如果这些都能 fit 进 v3 schema/template，则上工程的把握会更高。

我倾向 **A**。理由：四个样例已经把"timeline / step / vs / 单主题"四种主轴都覆盖到了；继续手扮模拟的边际收益递减，真实 LLM 的"惊喜"和"惊吓"只有真跑了才知道。

# 南京小学生学习规划（3—6 年级）

面向南京「教考分离」背景的小学生自学工具，覆盖 3—6 年级语文（人教版）、数学（苏教版）、英语（译林版）。用于预习、复习、错题巩固与查漏补缺，示例练习与考点难度参照拉萨路小学、力学小学一类校内测评风格（句式仿写、病句标点、情境化运用、实践类应用题等）。纯前端项目，不上架应用市场，PC 与手机浏览器均可使用。

## 数据来源（2026-11-20 起）

- **知识点 / 重难点 / 常考点：全量数据从网上同步最新教材**。当前为 **2026 秋新版**（统编语文修订版、苏教版数学 4—6 年级大调整、译林英语三起新版 Unit 全更新），共 **555 条考点**（语文 186 / 数学 177 / 英语 192，覆盖 3—6 年级上下册）。
- 原始大纲与来源 URL 存于 `src/data/syllabus-source.json`（含 `syncDate` 与 10 个来源链接：人教社 pep.com.cn、电子课本网 dzkbw、苏教版目录 sxydy、各校 2026 秋教学计划等）；展开后的考点数据为 `src/data/knowledge-base.json`。
- **同步更新方法**：从网上核对最新教材目录 → 修改 `scripts/sync-knowledge.mjs` 里的 `SYLLABUS` 大纲数据（或 `src/data/syllabus-source.json`）→ 运行 `node scripts/sync-knowledge.mjs` 重新生成。前端无需改动。
- **错题库只来自两个渠道**：①拍照 / 相册 / PDF / Word 试卷经 GLM 识别录入（支持一次识别多道题）；②定时任务从 IMA 语文 / 数学 / 英语知识库识别提炼。知识点数据不混入错题来源。

## 启动步骤

需要 Node.js 18+（推荐 20/22）。

```bash
cd C:\projects\nj-study-planner
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 <http://localhost:5173>）。

生产构建与本地预览：

```bash
npm run build
npm run preview
```

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 年级切换 | 顶部切换 3、4、5、6 年级，所有页面同步 |
| 三级筛选 | 科目 → 单元 → 常见考点；练习按基础 / 提升 / 挑战三档展示 |
| 预习 / 复习计划 | 每个考点含预习要点、复习资料、示例练习（可展开答案）与示例错题 |
| 错题本 | 筛选、搜索；**文件录入**——拍照 / 相册 / PDF / Word 试卷，GLM 自动识别题目 / 答案 / 科目，一次可切出多道题（题号切换），结果可校对，按关键词自动匹配知识点 / 单元 / 考点并推荐练习与复习 |
| 文件识别 | 照片走视觉识别；PDF 用 pdfjs 逐页渲染为图片识别（最多前 3 页）；Word(.docx) 用 mammoth 提取文字走文本解析；调用服务端 GLM（主模型 `glm-4.5v`，失效自动降级免费模型）。照片随错题存入云数据库并归档到 IMA GradeⅢ（PDF / Word 不存原图）；**API Key 只在服务端，前端无 key** |
| 掌握状态 | 未掌握 / 模糊 / 已掌握，可在计划卡片、错题卡片和进度页随时修改 |
| 每日打卡 | 今日打卡、巩固题数、小记、最近 21 天日历与连续打卡天数 |
| 学习进度 | 按年级-科目-单元展示掌握比例进度条与考点状态 |

## PWA 与移动端（2026-11-20 新增）

- **manifest**：`public/manifest.webmanifest`（应用名 / 图标 / 主题色 #5a7bf7 / 独立窗口模式），图标在 `public/icons/`（192 / 512 / maskable / apple-touch，由内联 SVG 设计生成）。
- **Service Worker**：`public/sw.js`（手工实现，无第三方依赖）。策略：页面导航缓存优先（弱网秒开、后台更新）；静态资源与 `.json`（含知识库数据包）缓存优先；`/api/*` 动态接口与跨域请求（云端同步、GLM 识别）一律不缓存直接放行。用户数据存 localStorage，离线不丢。
- **注册时机**：仅生产构建（`npm run build` + `npm run preview` / 部署）注册 SW；`npm run dev` / `npm start`（dev 模式有 HMR）不注册，避免与热更新冲突。注册逻辑见 `src/utils/pwa.ts`。
- **移动端**：拍照 / 相册按钮在竖屏下底部固定（单手可点，适配 safe-area）；顶部导航四等分、年级切换占满一行；错题与考点卡片单列；输入框字号 ≥16px 避免 iOS 聚焦缩放。
- **图片体积控制**：`src/utils/image.ts` 压缩策略自适应网络——省流模式 / 2G / 3G 时用 960px、质量 0.6、150KB 预算，普通网络 1280px、0.72、350KB；超预算自动逐级降质量、缩边长重试。识别接口与入库照片共用同一份压缩图。
- **多格式试卷录入**（2026-11-20 新增）：录入页两个入口——「拍照」（`capture=environment` 直接拍摄）与「相册 / PDF / Word」（`accept="image/*,.pdf,.docx"`）。前端按文件类型自动路由：照片压缩走视觉识别；PDF 用 `pdfjs-dist` 逐页渲染为 JPEG（最多前 3 页，动态 import 不进主包）；Word `.docx` 用 `mammoth` 提取纯文本走文本解析（旧版 `.doc` 提示另存为 `.docx`）。服务端 `/api/recognize` 兼容 `{ image }` / `{ images: [...] }` / `{ text }` 三种负载。

### 手机浏览器验证「添加到主屏幕」与离线打开

前置：PWA 需要 **安全上下文（HTTPS 或 localhost）**，且要用生产模式。

```bash
npm run build
npm run preview     # 监听 0.0.0.0:5173，手机与电脑同一局域网可访问
```

1. 手机浏览器打开 `http://<电脑局域网IP>:5173`。
   - Android Chrome 默认拦截非安全上下文的 SW：可在 `chrome://flags` 搜索 `unsafely-treat-insecure-origin-as-secure` 填入该地址后重启；或用 `adb reverse tcp:5173 tcp:5173` 后访问 `localhost:5173`。
   - iPhone Safari 无法用 flag，局域网 IP 只能验证界面（需 HTTPS 才能装 PWA）；线上 HTTPS 地址（如 `https://nj-study-planner.app.workbuddy.host`）无此限制。
2. **添加到主屏幕**：Android Chrome → 菜单「添加到主屏幕 / 安装应用」；iOS Safari → 分享按钮 →「添加到主屏幕」。桌面版 Chrome 地址栏右侧会出现安装图标。
3. **离线打开**：联网时正常浏览一次（让 SW 完成预缓存与运行时缓存）→ 手机开飞行模式（或断开网络）→ 从主屏幕图标打开应用。计划 / 打卡 / 进度 / 错题浏览全部可用；拍照识别与云端同步会提示网络不可用，恢复网络后自动继续。
4. **验证 SW 生效**：Chrome DevTools → Application → Service Workers 显示 `sw.js` activated；Cache Storage 里能看到 `njsp-v1.0.1` 与缓存清单。

## 目录结构

```
nj-study-planner/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 年级/页面状态与整体布局
│   ├── types.ts                 # 全部数据类型定义
│   ├── styles.css               # 响应式样式（浅色主题）
│   ├── data/
│   │   └── knowledge-base.json  # 独立知识库数据文件（72 条考点）
│   ├── components/              # 年级切换、导航、筛选、卡片、表单、进度条等
│   ├── pages/                   # 计划、错题、打卡、进度四个页面
│   └── utils/
│       ├── storage.ts           # localStorage + 云数据库双向同步的 state hook
│       ├── cloud.ts             # WorkBuddy Cloud SDK 封装：错题云端读写
│       ├── image.ts             # 试卷照片压缩为 JPEG data URL
│       ├── match.ts             # 错题关键词自动匹配
│       ├── date.ts              # 打卡日期与连续天数
│       ├── imaKnowledgeBase.ts  # 接口 stub（对接 ima 知识库，保留）
│       ├── glmImageRecognition.ts # 前端：压缩照片并 POST /api/recognize（已接入）
│       └── pwa.ts               # Service Worker 注册入口（仅生产构建）
├── public/
│   ├── manifest.webmanifest     # PWA 清单（名称 / 图标 / 主题色）
│   ├── sw.js                    # Service Worker（应用壳 + 静态资源缓存）
│   └── icons/                   # 192/512/maskable/apple-touch 图标
├── server/
│   └── glmApi.ts                # 服务端 GLM 代理：读取环境变量 key，调用智谱视觉模型
├── vite.config.ts               # 注册 /api/recognize 中间件（dev 与 preview 均生效）
├── SYNC-TO-IMA.md               # 定时任务把错题归档到 GradeⅢ 的执行规程
├── SYNC-FROM-IMA.md             # 定时任务从 IMA 三科知识库识别错题入库的执行规程
└── server/
    └── glmApi.ts                # 服务端 GLM 识别代理（含模型降级链，key 不进前端）
└── .ima-archive/                # 归档时生成的临时 Markdown / 图片
```

## 知识库数据结构

`src/data/knowledge-base.json` 是独立 JSON 数组，每条为**考点级**条目。4 个年级 × 3 科 × 每科 2 单元 × 每单元 3 考点 = 72 条。字段如下：

| 字段 | 含义 |
| --- | --- |
| `id` | 唯一标识，格式 `年级-科目-单元序号-考点序号` |
| `grade` / `subject` / `textbookVersion` | 年级 / 科目 / 教材版本 |
| `unit` / `unitIndex` | 单元名称 / 单元序号 |
| `knowledgePoint` / `examPoint` | 知识点 / 常见考点 |
| `difficulty` | `基础` / `提升` / `挑战` |
| `keywords` | 用于错题自动匹配的关键词 |
| `exercises` | 练习题数组（题干、参考答案、提示） |
| `reviewMaterials` | 预习要点 / 复习资料 / 方法指导数组（含来源） |
| `wrongRecords` | 内置示例错题记录（题干、我的答案、正确答案、错因、掌握状态） |
| `masteryStatus` | 默认掌握状态；用户修改后保存在 localStorage 覆盖 |

扩充方法：直接按上述结构往 JSON 数组追加条目即可；年级取 3/4/5/6，科目取 语文/数学/英语，难度与状态取规定枚举值。页面无需改动。

示例内容整理自 IMA 知识库资料：苏教版三上期中模拟卷（长度/质量单位、多位数乘一位数、混合运算、解决问题）、《三上期中阅读题型总结》《病句+标点符号》专项、家长会学习指导纪要（错题 1 周/2 周/1 月巩固、英语字母-单词-短语-句型复习法、语文预习复习与书写要求）。资料中明确标注了来源，便于后续核对与替换。

## 数据存储

- **错题**：录入后实时写入云数据库 `wrong_entries`（含题干、答案、错因、匹配考点、掌握状态、照片压缩数据），同时在本机 `localStorage`（键名 `nj-study-planner:v1`）缓存。换设备或清缓存后会自动从云端按设备标识合并回来。
- **打卡记录与知识点掌握状态**：保存在浏览器 `localStorage`，刷新不丢失。
- **归档标记**：云数据库 `synced_to_ima` 字段标识错题是否已写入 IMA GradeⅢ，由定时任务维护。

## 接口说明

`imaKnowledgeBase` 仍为预留 stub；`glmImageRecognition` 已接入真实服务，两者函数签名均保持不变：

### 1. `imaKnowledgeBase(action, params)` — `src/utils/imaKnowledgeBase.ts`

对接 GradeⅢ ima 知识库：

```ts
imaKnowledgeBase(
  action: 'pull' | 'push',
  params: { kbId: string; grade?: Grade; subject?: Subject; items?: KnowledgeItem[] }
): Promise<{ success: boolean; message: string; items?: KnowledgeItem[]; stub: true }>
```

`pull` 用于从 ima 拉取知识资料替换/扩充本地 JSON，`push` 用于回写新增考点与巩固记录。当前返回 `stub: true` 且不发网络请求。对应知识库：数学 `<YOUR_IMA_KB_MATH>`、语文 `<YOUR_IMA_KB_CHINESE>`、英语 `<YOUR_IMA_KB_ENGLISH>`。

### 2. `glmImageRecognition(file)` — `src/utils/glmImageRecognition.ts`（已接入）

拍照后把试卷图片交给 GLM 视觉模型（`glm-4.5v`）做切题与题目结构化：

```ts
glmImageRecognition(
  file: File
): Promise<{ success: boolean; message: string; questions: RecognizedQuestion[]; rawText?: string; stub: false }>
```

函数签名保持不变。内部把照片压缩为 JPEG data URL，POST 到同源 `/api/recognize`，由服务端调用智谱视觉模型，返回 `question / myAnswer / correctAnswer / reason / subject` 结构化题目并回填表单。**API Key 不出现在前端**：

- 服务端模块 `server/glmApi.ts` 从环境变量 `GLM_API_KEY` 读取 key（缺省值仅供本地开发）；通过 `vite.config.ts` 插件把 `/api/recognize` 注册为 Node 端中间件，dev 与 preview（公网部署）均生效。
- 中间件拦截 `/server/`、`/.env*`、`/vite.config*` 的直接 HTTP 访问；公网分享链接的网关要求请求带 `sharecode`，前端从当前地址自动继承。
- 更换模型或 key：设置环境变量 `GLM_MODEL` / `GLM_API_KEY` 即可，前端无需改动。
- **模型降级链（2026-11-20 新增）**：主模型不可用时（欠费 / 429 限流 / 模型下线 / 网络错误），服务端自动依次尝试免费视觉模型，识别不中断：

  | 顺序 | 模型 | 说明 |
  |---|---|---|
  | 1 | `glm-4.5v` | 付费主模型，质量最高 |
  | 2 | `glm-4.1v-thinking-flash` | 免费视觉模型（实测可用，默认首选后备） |
  | 3 | `glm-4.6v-flash` | 免费视觉模型（高峰期可能 429，最后后备） |

  响应中的 `model` / `fallback` 字段标注实际使用的模型。可用 `GLM_FALLBACK_MODELS`（逗号分隔）覆盖后备链。这样即使付费 key 欠费或主模型下线，仍能免费识别。

## 验收说明

- `npm install && npm run dev`：四个页面全部可操作，无控制台报错。
- `npm run build`：TypeScript 严格模式检查与 Vite 生产构建均通过。

## 公网访问与云端版本（2026-11-20 更新）

- 公网地址：<https://nj-study-planner.app.workbuddy.host/?sharecode=BYQ4YPESKT>
- 云端 README（后续说明的权威版本）：<https://www.workbuddy.cn/space/d/MDoIeXPkdtQWKTceI9vwUu>
- 已发布应用管理入口：设置—数据管理—应用。

为支持公网部署，`npm start` 使用 Vite 读取 `PORT` 环境变量、绑定 `0.0.0.0`，并开启 `allowedHosts` 以通过反向代理域名访问。

### 错题云端保存与 GradeⅢ 自动归档（已完成）

- 已开通 WorkBuddy 云服务（复用原应用 `<YOUR_CLOUD_APP_ID>`，域名不变）。公网录入的错题实时写入云数据库 `wrong_entries`，不再只依赖浏览器本地存储。
- 目标知识库：GradeⅢ（ID `<YOUR_IMA_KB_ARCHIVE>`）。照片在前端压缩后随错题存入云端。
- 归档链路：错题写入时标记 `synced_to_ima=false`；定时任务「错题归档到 IMA-GradeⅢ」每 12 小时读取未归档错题，生成 Markdown（照片另行附档）写入 GradeⅢ，成功后回写标记避免重复。全过程用平台内置工具完成归档，密钥不进前端。完整规程见 `SYNC-TO-IMA.md`。
- **拍照识别（最新）**：错题录入改为拍照优先，`glm-4.5v` 服务端识别切题，识别结果可校对后保存；纯手打录入已取消。GLM Key 只在服务端，前端与公网产物均无 key。
- 端到端验证：公网拍照「309×6」→ GLM 识别题干成功 → 云数据库写入成功（控制台 0 报错）→ 同步后 GradeⅢ 可检索到该错题的解析内容。

### 手机侧手动触发「知识库更新错题库」（2026-11-20 新增）

- 错题本页新增「🔄 请求更新错题库」按钮。手机浏览器点击后，向云数据库 `kb_sync_requests` 写入一条 `pending` 请求。
- 定时任务「知识库更新错题库（手机触发）」**每小时**消费 pending 请求，从 IMA 语文 `<YOUR_IMA_KB_CHINESE>`、数学 `<YOUR_IMA_KB_MATH>`、英语 `<YOUR_IMA_KB_ENGLISH>` 三个知识库读取文档、提炼真实例题/易错题，按题干去重后写入 `wrong_entries`（`client_id=ima-kb-import`），并用本地知识库关键词匹配单元/考点。执行规程见 `SYNC-FROM-IMA.md`。
- 新导入错题被归档任务（同样提升为每小时）写入 GradeⅢ `<YOUR_IMA_KB_ARCHIVE>`。
- **调度延迟**：WorkBuddy 定时任务最小粒度为小时级，手机触发后通常在下一次调度（约 1 小时内）完成；按钮下方会显示最近一次更新状态。
- 两个任务均绑定 `ima-mcp`，只读三科来源库、不修改删除来源内容；全过程无需 GLM key / API Key。

### 每月 1 号自动同步知识库错题（2026-11-20 新增）

- 定时任务「每月1号知识库错题同步到GradeⅢ和数据库」：**每月 1 号 08:00** 自动从 IMA 语文 / 数学 / 英语三库识别例题 / 易错题，按题干去重后写入云数据库 `wrong_entries`，并立即把新增错题归档到 GradeⅢ `<YOUR_IMA_KB_ARCHIVE>`（归档成功后回写 `synced_to_ima=true`）。
- 「如果有的话」：仅当知识库中确实识别到错题才写入；识别不到则本轮不写任何数据。按题干去重保证幂等，每月执行不会累积重复。
- 与手机手动触发任务共用 `SYNC-FROM-IMA.md` 规程和去重规则；三个定时任务（每月同步 / 手机触发同步 / 错题归档）均绑定 `ima-mcp`，无需任何 API Key。

### 当前定时任务一览

| 任务 | 频率 | 作用 |
|---|---|---|
| 每月1号知识库错题同步到GradeⅢ和数据库 | 每月 1 号 08:00 | 从三科知识库识别错题 → 数据库 + GradeⅢ |
| 知识库更新错题库（手机触发） | 每小时 | 消费手机按钮提交的 pending 请求 |
| 错题归档到 IMA-GradeⅢ | 每小时 | 把 `synced_to_ima=false` 的错题写入 GradeⅢ |

## 资源与收费说明（2026-11-20 核实）

本应用**没有自建或租用任何腾讯云服务器 / CVM / 独立数据库**，全部跑在 WorkBuddy 平台能力上：

| 用到的资源 | 性质 | 是否单独收费 |
|---|---|---|
| 公网地址 `app.workbuddy.host` | WorkBuddy 应用发布/托管 | 含在 WorkBuddy 套餐内，不单独向腾讯云付费 |
| 云数据库 `wrong_entries` 等 | WorkBuddy 云服务（单应用 5000 资源点，限时免费用 10000） | 含在套餐/限免额度内 |
| IMA 知识库（含 GradeⅢ） | WorkBuddy / ima 能力 | 含在套餐内（资料库容量按套餐，体验版 5GB） |
| GLM 视觉识别 | 智谱开放平台，用你自己的 API Key 按量计费 | **付费**：`glm-4.5v` 按 token 计费；后备 `glm-4.1v-thinking-flash` / `glm-4.6v-flash` 免费 |
| WorkBuddy 套餐 | 体验版限时免费（500 积分/月）；标准版约 ¥70/月（连续包月）等 | 视套餐而定 |

结论：除 GLM 主模型按量消耗你的智谱账户 token 外，公网托管、云数据库、IMA 知识库都走 WorkBuddy 套餐（体验版限免即可运行）；后备免费视觉模型不花钱。详见 <https://www.workbuddy.cn/pricing>。

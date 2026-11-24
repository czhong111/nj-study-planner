# 定时任务执行规程：从 IMA 三科知识库识别错题 → 加入错题库 → 归档 GradeⅢ

本文件供 WorkBuddy 会话侧两个定时任务共同遵循：
1. 「知识库更新错题库（手机触发）」——每小时消费手机端 pending 请求；
2. 「每月1号知识库错题同步」——每月 1 号 08:00 自动执行一次。

本质是把 IMA 知识库里的例题 / 易错题提炼成结构化错题，写入云数据库错题库，并同步归档到 GradeⅢ。
「如果有的话」指：仅当知识库中确实存在可识别的例题 / 易错题时才写入；没有则本轮不新增任何数据。
两个任务共用同一套去重规则（按题干），不会重复入库。

## 固定参数（不要改动）

- 云数据库应用 ID：`<YOUR_CLOUD_APP_ID>`
- 云数据库表：`public.wrong_entries`（错题库）、`public.kb_sync_requests`（触发请求）
- IMA 知识库（来源，只读）：
  - 语文：`<YOUR_IMA_KB_CHINESE>`
  - 数学：`<YOUR_IMA_KB_MATH>`
  - 英语：`<YOUR_IMA_KB_ENGLISH>`
- IMA 知识库（归档目标，只写）：GradeⅢ `<YOUR_IMA_KB_ARCHIVE>`
- 本地知识库参考：`src/data/knowledge-base.json`（用于考点/单元/知识点关键词对照与匹配）

## 执行步骤

### 第 1 步：读取待处理请求
用云数据库 SQL 工具（mode: read）查询：

```sql
SELECT id, grade, requested_at, status FROM kb_sync_requests
WHERE status = 'pending' ORDER BY requested_at ASC LIMIT 10
```

- 结果为空：本轮无事可做，直接结束，不要写任何数据。
- `grade > 0` 表示该用户只想更新对应年级；`grade = 0` 表示 3—6 年级全部。

### 第 2 步：把请求置为处理中（防止并发重复执行）

```sql
UPDATE kb_sync_requests SET status = 'processing' WHERE id = '<请求id>'
```

### 第 3 步：从三科 IMA 知识库提取错题
对每个科目（语文 / 数学 / 英语）：

1. 用 `mcp__ima-mcp__get_knowledge_list`（knowledge_base_id 见上，limit ≤ 50）列出文档。
2. 挑选与小学 3—6 年级例题 / 易错题 / 练习 / 试卷相关的文档，用
   `mcp__ima-mcp__fetch_media_content`（media_id）读取正文。
3. 从正文中提炼出**真实存在的例题或易错题**，每条整理为：
   - `question`（题目文字，保留数字与运算）
   - `myAnswer`（若有学生典型错误答案则填，否则空）
   - `correctAnswer`（正文给出的答案；没有则空）
   - `reason`（一句话错因 / 考查点）
   - `subject`（语文 / 数学 / 英语）
   - `grade`（按文档标注年级；推断不出则用请求里的 grade，仍为 0 则默认 3）
4. 每科最多提取 5 条，全部三科合计控制在 15 条以内，避免刷屏。
5. 用 `src/data/knowledge-base.json` 的 `keywords` / `examPoint` / `unit` 做关键词比对，
   为每条错题匹配 `unit` / `exam_point` / `knowledge_id`（匹配不到留 null）。

### 第 4 步：写入错题库（去重）
对每条错题，先用 SQL 按题干去重，再插入：

```sql
-- 去重检查
SELECT id FROM wrong_entries WHERE question = '<题目文字>' LIMIT 1
-- 无结果才插入
INSERT INTO wrong_entries
  (id, client_id, grade, subject, unit, exam_point, knowledge_id,
   question, my_answer, correct_answer, reason, mastery, review_count, synced_to_ima)
VALUES
  ('ima-<时间戳>-<序号>', 'ima-kb-import', <grade>, '<subject>',
   <unit 或 null>, <exam_point 或 null>, <knowledge_id 或 null>,
   '<题目文字>', '<myAnswer 或 null>', '<correctAnswer 或 null>', '<reason 或 null>',
   '未掌握', 0, false)
```

> `client_id` 固定为 `ima-kb-import`，表示来源是知识库导入；`synced_to_ima=false` 让它随后被归档任务写入 GradeⅢ。
> 插入失败不要中断，记录后继续下一条。

### 第 5 步：标记请求完成
本批错题全部处理后：

```sql
UPDATE kb_sync_requests SET status = 'done', finished_at = now(), note = '导入 N 条错题' WHERE id = '<请求id>'
```

若中途报错，回写 `status='failed'`、`note=错误摘要`，便于排查。

### 第 6 步：归档到 GradeⅢ
本任务写入的错题 `synced_to_ima=false`，会被已有的每 12 小时任务
「错题归档到 IMA-GradeⅢ」（见 `SYNC-TO-IMA.md`）自动写入 GradeⅢ 并回写标记。
若希望立即归档，可在完成第 4 步后按 `SYNC-TO-IMA.md` 的流程手动跑一次归档。

## 约束

- 只读三科来源库，绝不修改 / 删除来源知识库内容。
- 不编造知识库里不存在的题目；提取不到就如实报告"本轮未提取到可用错题"。
- 不删除 GradeⅢ 中的历史文件。
- 不打印任何密钥；本任务不需要 GLM key、不需要 API Key，全部用平台内置工具。
- 幂等：按题干去重，重复触发不会重复入库。

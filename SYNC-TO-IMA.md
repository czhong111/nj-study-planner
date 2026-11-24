# 错题同步到 IMA GradeⅢ · 执行规程（SOP）

本文件供定时任务（自动化会话）严格遵循，把云数据库中未归档的错题写入 IMA 知识库
**GradeⅢ**（`ima_kb_rrdduh8I`）。全程使用平台内置工具，不需要 GLM、不需要任何 API Key。

## 固定标识

- 应用 ID（云数据库）：`wbapp_2VJ79C0u8SHSKIYKVv4GHs`
- IMA 知识库：GradeⅢ / `ima_kb_rrdduh8I`（可写）
- 数据表：`public.wrong_entries`
- 工作目录：`C:\projects\nj-study-planner`
- 归档临时目录：`C:\projects\nj-study-planner\.ima-archive`

## 步骤

### 1. 读取未同步错题

用云数据库 SQL 工具（`workbuddy_cloudservice_db_exec_sql`，`mode: read`）执行：

```sql
SELECT id, grade, subject, unit, exam_point, question, my_answer, correct_answer,
       reason, mastery, image_name, image_base64, created_at
FROM wrong_entries
WHERE synced_to_ima = false
ORDER BY created_at ASC
LIMIT 50
```

若返回为空 → 本轮无需归档，直接结束。

### 2. 生成归档 Markdown

把本批错题按「年级 · 科目 · 单元」组织成一个 Markdown 文件，写入
`.ima-archive/错题归档-YYYY-MM-DD.md`，每道题包含：考点、题目、我的答案、正确答案、
错误原因、掌握状态、录入时间。文件命名中的日期取当天。

### 3. 写入 IMA GradeⅢ（每份 Markdown）

对上一步生成的文件：

1. 统计文件字节数 `file_size`（ASCII 字符按 1 字节、中文按 3 字节，或用 `wc -c`）。
2. 调用 IMA `create_media`：
   - `knowledge_base_id`: `ima_kb_rrdduh8I`
   - `file_name`: 文件名（如 `错题归档-2026-11-20.md`）
   - `file_ext`: `md`
   - `content_type`: `text/markdown`
   - `file_size`: 第 1 步字节数
   - `apply_upload_mode`: `1`
3. 用返回的 `upload_url.presigned_url` 上传文件；HTTP PUT，请求头原样携带
   `auth_headers` 里的 `Content-Type`、`Content-Length`、`x-cos-acl`；成功返回 HTTP 200。
4. 调用 IMA `add_knowledge`，参数 `knowledge_base_id` 与 `media_id`（第 2 步返回）。

### 4. 归档照片（如有）

若错题 `image_base64` 非空（JPEG data URL）：

1. 去掉 `data:image/jpeg;base64,` 前缀，base64 解码写成 `.jpg` 文件到 `.ima-archive`。
2. `create_media`：`content_type: image/jpeg`、`file_ext: jpg`、`file_size` 为解码后字节数。
3. 按步骤 3 的方式 PUT 上传，再 `add_knowledge` 到同一个 GradeⅢ。
4. 文件名用错题 id，便于对应，如 `wrong-1795143415033.jpg`。

### 5. 回写同步标记（关键，防止重复归档）

全部写入成功后，用 `workbuddy_cloudservice_db_exec_sql`（`mode: write`）执行：

```sql
UPDATE wrong_entries
SET synced_to_ima = true, updated_at = now()
WHERE synced_to_ima = false AND created_at <= now()
```

⚠️ 只有当第 3、4 步的 `add_knowledge` 全部返回成功时才回写；若有失败，保留
`synced_to_ima=false`，下一轮重试。

### 6. 校验

用 IMA `get_knowledge_list`（`knowledge_base_id: ima_kb_rrdduh8I`）确认本轮文件已出现在列表中。

## 失败处理

- 网络失败 / 工具报错：不要回写标记，本轮跳过，等下一轮重试。
- 文件过大：`file_size` 必须与实际字节数一致，否则 COS 签名校验失败（HTTP 403）。
- 永不删除 GradeⅢ 中的历史归档文件。

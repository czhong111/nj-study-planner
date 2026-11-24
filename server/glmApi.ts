/**
 * ============================================================================
 * 服务端专用模块：GLM 试卷照片识别代理
 * ----------------------------------------------------------------------------
 * 安全约束（务必遵守）：
 *  - 本文件只在 Node 端被 vite.config.ts 引用，绝不能被 src/ 下任何前端代码
 *    import，否则 API Key 会进入浏览器bundle。
 *  - GLM_API_KEY 只从服务端环境变量读取（由 vite.config.ts 从本地 .env 注入）；
 *    .env 已被 gitignore 排除，绝不把 key 写进代码或提交到仓库。
 *  - vite.config.ts 中的中间件会拦截 /server/ 等路径的直接 HTTP 访问。
 *
 * 对外接口：POST /api/recognize
 *   请求 JSON：{ image: "data:image/jpeg;base64,..." }
 *   响应 JSON：{ success, message, questions: RecognizedQuestion[] }
 * ============================================================================
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

// 惰性读取：本模块在 vite.config.ts 注入 .env 之前就被 import，
// 顶层常量会读到空值，必须在调用时才读 process.env。
function getGlmApiKey(): string {
  return process.env.GLM_API_KEY || ''
}
const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const MAX_BODY_BYTES = 8 * 1024 * 1024

/**
 * 模型降级链：主模型不可用（欠费 / 限流 429 / 模型下线 / 网络错误）时，
 * 依次尝试免费视觉模型，保证识别链路不中断。
 * - glm-4.5v：付费主模型，识别质量最高
 * - glm-4.1v-thinking-flash：免费，支持视觉推理（2026-11 实测可用）
 * - glm-4.6v-flash：免费，支持视觉推理（高峰期可能 429，作为最后后备）
 * 可用 GLM_MODEL 覆盖主模型，GLM_FALLBACK_MODELS 用逗号覆盖后备链。
 */
const GLM_MODELS: string[] = [
  process.env.GLM_MODEL || 'glm-4.5v',
  ...(process.env.GLM_FALLBACK_MODELS
    ? process.env.GLM_FALLBACK_MODELS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['glm-4.1v-thinking-flash', 'glm-4.6v-flash']),
]

const EXTRACT_PROMPT = [
  '你是小学错题录入助手。分析这张试卷或作业照片，提取每道被标记为错误的题目。',
  '仅输出严格的 JSON 数组，不要 Markdown 代码块，不要任何解释文字，格式：',
  '[{"question":"题目完整文字","myAnswer":"学生写的答案，看不清则空字符串","correctAnswer":"批改后的正确答案，没有则空字符串","reason":"一句话错因","subject":"数学"}]',
  'subject 只能是 语文/数学/英语 之一。若图片中没有可识别的题目，返回 []。',
  '保留题目中的数字、运算符与单位，不要改写题意。',
].join('\n')

/** Word/文本试卷：不需要视觉，把文字内容直接结构化成题目 */
const EXTRACT_TEXT_PROMPT = [
  '你是小学错题录入助手。下面是一份试卷或作业的文字内容（来自 Word 文档或纯文本）。',
  '从中提取适合小学生巩固的题目（计算题、填空题、判断题、选择题、应用题等）。',
  '仅输出严格的 JSON 数组，不要 Markdown 代码块，不要任何解释文字，格式：',
  '[{"question":"题目完整文字（含题号可去掉）","myAnswer":"","correctAnswer":"参考答案","reason":"一句话说明该题考查点或易错点","subject":"数学"}]',
  'subject 只能是 语文/数学/英语 之一；correctAnswer 尽量给出参考答案；最多提取 10 道；',
  '若内容中没有合适的题目，返回 []。',
].join('\n')

/** 单次请求最多携带的图片页数（PDF 每页一张） */
const MAX_IMAGES_PER_REQUEST = 4

export interface RecognizedQuestion {
  question: string
  myAnswer: string
  correctAnswer: string
  reason: string
  subject: string
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

/** 从模型输出中健壮地解析出题目数组（兼容 ```json 包裹与纯 JSON） */
function parseQuestions(content: string): RecognizedQuestion[] {
  let text = content.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((q) => q && typeof q.question === 'string' && q.question.trim())
      .map((q) => ({
        question: String(q.question).trim(),
        myAnswer: q.myAnswer ? String(q.myAnswer).trim() : '',
        correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : '',
        reason: q.reason ? String(q.reason).trim() : '',
        subject: ['语文', '数学', '英语'].includes(q.subject) ? q.subject : '数学',
      }))
  } catch {
    return []
  }
}

/** 单次调用某个模型；失败则抛出异常交给上层降级。
 *  images 非空时走视觉识别（PDF/拍照，支持多页），否则走文本解析（Word/纯文本）。 */
async function callGlmModel(model: string, images: string[], text: string): Promise<RecognizedQuestion[]> {
  const prompt = images.length > 0
    ? EXTRACT_PROMPT
    : `${EXTRACT_TEXT_PROMPT}\n\n=== 试卷文字内容 ===\n${text}`
  const content: unknown[] = [{ type: 'text', text: prompt }]
  for (const image of images) {
    content.push({ type: 'image_url', image_url: { url: image } })
  }
  const response = await fetch(GLM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGlmApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${model} 返回 ${response.status}${detail ? `：${detail.slice(0, 160)}` : ''}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(`${model}：${data.error.message}`)
  const reply = data.choices?.[0]?.message?.content ?? ''
  return parseQuestions(reply)
}

/**
 * 按降级链依次尝试模型。
 * 判定"不可用"：HTTP 非 200（含 429 限流 / 402 欠费 / 404 下线）、网络错误、
 * 解析后无有效题目。只要有一个模型返回题目即成功。
 * 返回实际使用的模型名，便于前端展示与排查。
 */
async function callGlm(images: string[], text: string): Promise<{ questions: RecognizedQuestion[]; model: string; fallback: boolean }> {
  let lastError = ''
  for (let i = 0; i < GLM_MODELS.length; i++) {
    const model = GLM_MODELS[i]
    try {
      const questions = await callGlmModel(model, images, text)
      if (questions.length > 0) {
        return { questions, model, fallback: i > 0 }
      }
      lastError = `${model} 未识别出题目`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    // 只记录错误类型，不打印 key 或图片内容
    console.warn(`[glm-recognize] 模型 ${model} 不可用，尝试下一个：${lastError.slice(0, 160)}`)
  }
  throw new Error(lastError || '所有模型均不可用')
}

/**
 * 创建 connect 中间件：注册识别接口 + 拦截服务端敏感路径。
 * 返回的函数可直接传给 Vite 的 server.middlewares.use()。
 */
export function createGlmApiMiddleware(): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  // 中间件创建时 .env 已由 vite.config.ts 注入，此时检查才有意义
  if (!getGlmApiKey()) {
    console.warn('[glm-recognize] 未配置 GLM_API_KEY，照片识别不可用。请在项目根目录 .env 中设置。')
  }
  return (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]

    // 防止浏览器直接读取服务端源码 / 环境变量文件
    if (/^\/server\//.test(url) || /^\/\.env/.test(url) || /^\/vite\.config/.test(url)) {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    if (url !== '/api/recognize') {
      next()
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, message: '仅支持 POST 请求', questions: [] })
      return
    }

    void (async () => {
      try {
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of req) {
          size += (chunk as Buffer).length
          if (size > MAX_BODY_BYTES) {
            sendJson(res, 413, { success: false, message: '图片过大，请选择更小的照片', questions: [] })
            return
          }
          chunks.push(Buffer.from(chunk as Buffer))
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          image?: string
          images?: string[]
          text?: string
        }

        // 三种输入：单图（拍照/相册）、多图（PDF 每页一张）、纯文本（Word/文字卷子）
        const images: string[] = []
        if (typeof body.image === 'string' && body.image) images.push(body.image)
        if (Array.isArray(body.images)) {
          for (const item of body.images) {
            if (typeof item === 'string' && item) images.push(item)
          }
        }
        if (images.length > MAX_IMAGES_PER_REQUEST) {
          sendJson(res, 400, { success: false, message: `一次最多识别 ${MAX_IMAGES_PER_REQUEST} 页`, questions: [] })
          return
        }
        for (const image of images) {
          if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
            sendJson(res, 400, { success: false, message: '图片数据无效，请重新拍照', questions: [] })
            return
          }
        }
        const text = typeof body.text === 'string' ? body.text.trim().slice(0, 20_000) : ''
        if (images.length === 0 && !text) {
          sendJson(res, 400, { success: false, message: '请提供试卷照片、PDF 页面或文字内容', questions: [] })
          return
        }

        const { questions, model, fallback } = await callGlm(images, text)
        if (questions.length === 0) {
          const hint = images.length > 0 ? '没有从照片中识别出题目，请拍清楚题目后重试' : '没有从文字内容中识别出合适的题目'
          sendJson(res, 200, { success: false, message: hint, questions: [], model })
          return
        }
        const hint = fallback ? `（已自动切换到免费备用模型 ${model}）` : ''
        sendJson(res, 200, {
          success: true,
          message: `识别到 ${questions.length} 道题${hint}`,
          questions,
          model,
          fallback,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : '识别失败，请稍后重试'
        // 不要在日志中打印 key 或图片内容，只记录错误类型
        console.error('[glm-recognize] 识别失败：', message.slice(0, 200))
        sendJson(res, 502, { success: false, message, questions: [] })
      }
    })()
  }
}

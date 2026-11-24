import type { Subject } from '../types'
import { compressImageToDataUrl } from './image'

/**
 * ============================================================================
 * 接口 ②：glmImageRecognition —— 试卷文件 → GLM 结构化识别（已接入）
 * ----------------------------------------------------------------------------
 * 固定函数签名（保持不变）：
 *   glmImageRecognition(file) => Promise<ImageRecognitionResponse>
 *
 * 内部按文件类型自动路由，调用方（拍照 / 相册 / 文件选择器）无需区分：
 *   - 照片（image/*）      ：压缩为 JPEG data URL，走视觉识别
 *   - PDF（含扫描件）      ：pdfjs 逐页渲染为图片（最多 3 页），走视觉识别
 *   - Word（.docx）        ：mammoth 提取纯文本，走服务端文本解析
 * pdfjs / mammoth 均为动态 import，不进入主 bundle。
 *
 * 服务端 /api/recognize 接受 { image } / { images: [...] } / { text } 三种负载，
 * GLM API Key 只存在于服务端环境变量，前端代码与浏览器 bundle 中不含任何 key。
 * ============================================================================
 */
export interface RecognizedQuestion {
  question: string
  myAnswer?: string
  correctAnswer?: string
  subject?: Subject
  reason?: string
}

export interface ImageRecognitionResponse {
  success: boolean
  message: string
  questions: RecognizedQuestion[]
  rawText?: string
  /** 保留字段：接入真实后端后恒为 false */
  stub: false
}

/** PDF 一次最多送识别的页数（页数过多时逐张调用太慢） */
const MAX_PDF_PAGES = 3

async function postToServer(payload: Record<string, unknown>): Promise<ImageRecognitionResponse> {
  // 公网分享链接的网关校验要求请求携带 sharecode；从当前地址继承即可。
  // sharecode 是公开的分享参数（并非密钥），本地开发时不存在则忽略。
  const shareCode = new URLSearchParams(window.location.search).get('sharecode')
  const endpoint = shareCode
    ? `/api/recognize?sharecode=${encodeURIComponent(shareCode)}`
    : '/api/recognize'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as {
    success?: boolean
    message?: string
    questions?: RecognizedQuestion[]
    rawText?: string
  }
  return {
    success: Boolean(data.success),
    message: data.message ?? '',
    questions: Array.isArray(data.questions) ? data.questions : [],
    rawText: data.rawText,
    stub: false,
  }
}

/** 照片：压缩后走视觉识别 */
async function recognizeImage(file: File): Promise<ImageRecognitionResponse> {
  const image = await compressImageToDataUrl(file)
  return postToServer({ image })
}

/** PDF（含扫描件）：逐页渲染为 JPEG，一次请求带上多页 */
async function recognizePdf(file: File): Promise<ImageRecognitionResponse> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const doc = await loadingTask.promise
  const totalPages = doc.numPages
  const pages = Math.min(totalPages, MAX_PDF_PAGES)
  const images: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    // 长边约 1280px，与照片压缩目标一致
    const scale = Math.max(1, Math.min(2, 1280 / Math.max(base.width, base.height)))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.8))
  }
  if (totalPages > pages) {
    // 只识别前几页时提前销毁解析任务，释放 worker 资源
    await loadingTask.destroy()
  }

  const result = await postToServer({ images })
  if (result.success && totalPages > pages) {
    result.message = `已解析 PDF 前 ${pages} 页（共 ${totalPages} 页）。${result.message}`
  }
  return result
}

/** Word（.docx）：提取纯文本，走服务端文本解析 */
async function recognizeDocx(file: File): Promise<ImageRecognitionResponse> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  const text = value.replace(/[ \t]+/g, ' ').trim()
  if (!text) {
    return { success: false, message: 'Word 文档中没有提取到文字，请确认文档内容', questions: [], stub: false }
  }
  return postToServer({ text })
}

export async function glmImageRecognition(file: File): Promise<ImageRecognitionResponse> {
  try {
    const name = file.name.toLowerCase()
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      return await recognizePdf(file)
    }
    if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
      return await recognizeDocx(file)
    }
    if (name.endsWith('.doc')) {
      return {
        success: false,
        message: '暂不支持旧版 .doc 格式，请在 Word 中另存为 .docx 或导出 PDF 后重试',
        questions: [],
        stub: false,
      }
    }
    if (file.type.startsWith('image/') || /\.(?:png|jpe?g|webp)$/.test(name)) {
      return await recognizeImage(file)
    }
    return {
      success: false,
      message: '不支持的文件类型，请选择照片、PDF 或 Word（.docx）文件',
      questions: [],
      stub: false,
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? `文件解析失败：${err.message}` : '文件解析失败，请重试',
      questions: [],
      stub: false,
    }
  }
}

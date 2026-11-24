/**
 * 图片压缩工具：把用户拍摄的试卷照片压缩为 JPEG data URL。
 * 云数据库、IMA 归档与 GLM 识别均使用压缩后的数据，避免原图过大导致失败。
 *
 * 体积控制策略（面向移动网络）：
 *  1. 网络自适应：浏览器开启省流模式（Data Saver）或处于 2G/3G 时，
 *     自动使用更小的尺寸与更严格的体积预算；
 *  2. 体积预算阶梯：压缩结果超过预算时，先逐级降低 JPEG 质量，
 *     仍超标再按 80% 缩小边长重试（最多 5 轮），保证上传请求体积可控。
 */

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.72
const MAX_BYTES = 350 * 1024 // 默认体积预算（base64 解码后的字节数）

const METERED_MAX_EDGE = 960
const METERED_JPEG_QUALITY = 0.6
const METERED_MAX_BYTES = 150 * 1024

interface NetworkInfo {
  saveData?: boolean
  effectiveType?: string
}

/** 粗略判断当前是否弱网 / 省流模式（不支持 Network Information API 时视为普通网络） */
function isMeteredConnection(): boolean {
  const nav = navigator as Navigator & { connection?: NetworkInfo }
  const conn = nav.connection
  if (!conn) return false
  if (conn.saveData) return true
  const type = conn.effectiveType ?? ''
  return type === 'slow-2g' || type === '2g' || type === '3g'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = src
  })
}

/** 把图片按目标尺寸与质量编码为 JPEG data URL（白底，避免透明区域变黑） */
function encodeJpeg(img: HTMLImageElement, width: number, height: number, quality: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** 估算 data URL 解码后的字节数（base64：3/4 倍率） */
function approxBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor(base64.length * 3 / 4)
}

/** 把 File 读取并压缩为 JPEG data URL；失败时抛出错误 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const metered = isMeteredConnection()
  const maxEdge = metered ? METERED_MAX_EDGE : MAX_EDGE
  let quality = metered ? METERED_JPEG_QUALITY : JPEG_QUALITY
  const budget = metered ? METERED_MAX_BYTES : MAX_BYTES

  const raw = await readFileAsDataUrl(file)
  const img = await decodeImage(raw)

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  let width = Math.max(1, Math.round(img.width * scale))
  let height = Math.max(1, Math.round(img.height * scale))

  let out = encodeJpeg(img, width, height, quality)
  // 体积预算阶梯：先降质量（不低于 0.4），再缩尺寸（每轮 -20%）
  for (let attempt = 0; attempt < 5 && approxBytes(out) > budget; attempt++) {
    if (quality > 0.45) {
      quality = Math.max(0.4, quality - 0.1)
    } else {
      width = Math.max(320, Math.round(width * 0.8))
      height = Math.max(240, Math.round(height * 0.8))
    }
    out = encodeJpeg(img, width, height, quality)
  }
  return out
}

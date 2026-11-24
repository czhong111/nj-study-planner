import { useEffect, useState } from 'react'
import { compressImageToDataUrl } from '../utils/image'

interface Props {
  onFileChange: (file: File | null, dataUrl?: string) => void
}

/**
 * 错题照片上传入口：本机预览 + 前端压缩。
 * 压缩后的图片随错题存入云数据库，由定时任务一并归档到 IMA GradeⅢ 知识库。
 * 图片结构化识别（原 GLM stub）已按需求移除，不再调用任何识别接口。
 */
export default function ImageUploader({ onFileChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function handleSelect(selected: File | null) {
    setFile(selected)
    setStatus('')
    if (!selected) {
      onFileChange(null)
      return
    }
    setStatus('正在压缩照片…')
    try {
      const dataUrl = await compressImageToDataUrl(selected)
      onFileChange(selected, dataUrl)
      setStatus('照片已就绪，将随错题一起保存到 GradeⅢ。')
    } catch (err) {
      onFileChange(selected)
      setStatus(err instanceof Error ? err.message : '照片处理失败，仍可只保存文字错题。')
    }
  }

  return (
    <div className="image-uploader">
      <label className="upload-zone">
        <span className="upload-title">上传试卷 / 错题照片（可选）</span>
        <span className="upload-hint">支持 JPG、PNG；照片会压缩后随错题归档到 IMA GradeⅢ</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void handleSelect(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <div className="upload-preview">
          {preview && <img src={preview} alt="所选试卷预览" />}
          <div className="upload-actions">
            <span className="file-name">{file.name}</span>
            <button type="button" className="btn small ghost" onClick={() => void handleSelect(null)}>
              移除
            </button>
          </div>
        </div>
      )}
      {status && <p className="upload-status">{status}</p>}
    </div>
  )
}

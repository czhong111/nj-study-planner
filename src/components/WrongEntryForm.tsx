import { useMemo, useState } from 'react'
import type { Grade, KnowledgeItem, Subject, UserWrongEntry } from '../types'
import { matchKnowledge } from '../utils/match'
import { glmImageRecognition, type RecognizedQuestion } from '../utils/glmImageRecognition'
import { compressImageToDataUrl } from '../utils/image'

interface Props {
  grade: Grade
  items: KnowledgeItem[]
  onSubmit: (entry: Omit<UserWrongEntry, 'id' | 'createdAt' | 'reviewCount'>) => void
  onCancel: () => void
}

type Draft = Omit<
  UserWrongEntry,
  'id' | 'createdAt' | 'reviewCount' | 'grade' | 'matchedKnowledgeId' | 'matchedExamPoint' | 'matchedUnit' | 'mastery'
>

/** 把识别结果转成表单草稿；识别不出科目时用关键词猜测 */
function toDraft(question: RecognizedQuestion): Draft {
  return {
    subject: (question.subject as Subject) ?? '数学',
    question: question.question,
    myAnswer: question.myAnswer ?? '',
    correctAnswer: question.correctAnswer ?? '',
    reason: question.reason ?? '',
  }
}

export default function WrongEntryForm({ grade, items, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>()
  const [imageDataUrl, setImageDataUrl] = useState<string>()
  const [recognizing, setRecognizing] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [recognized, setRecognized] = useState<RecognizedQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)

  const text = draft ? `${draft.question} ${draft.reason}`.trim() : ''
  const effectiveSubject = draft ? draft.subject : '数学'
  const matches = useMemo(
    () => (text ? matchKnowledge(text, items, grade, effectiveSubject, 3) : []),
    [text, items, grade, effectiveSubject],
  )
  const selected = matches.find((match) => match.item.id === selectedId)?.item ?? matches[0]?.item

  /** 拍照 / 相册 / PDF / Word 统一入口，自动调用 GLM 识别 */
  async function handleFile(file: File | null) {
    if (!file) return
    setError('')
    setDraft(null)
    setRecognized([])
    setQuestionIndex(0)
    const isImage = file.type.startsWith('image/')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(isImage ? URL.createObjectURL(file) : undefined)
    setImageName(file.name)
    setRecognizing(true)
    const result = await glmImageRecognition(file)
    setRecognizing(false)
    if (!result.success || result.questions.length === 0) {
      setError(result.message || '没有识别出题目，请重新拍照')
      return
    }
    // 试卷文件常常一次识别出多道题：先录第一道，其余通过题号切换
    setRecognized(result.questions)
    setQuestionIndex(0)
    setDraft(toDraft(result.questions[0]))
    setSelectedId(null)
    // 入库照片与识别共用同一份压缩图（仅图片文件；PDF / Word 不存原图）
    if (isImage) {
      try {
        setImageDataUrl(await compressImageToDataUrl(file))
      } catch {
        setImageDataUrl('')
      }
    } else {
      setImageDataUrl(undefined)
    }
  }

  /** 在识别出的多道题之间切换（载入该题的识别内容） */
  function switchQuestion(index: number) {
    const question = recognized[index]
    if (!question) return
    setQuestionIndex(index)
    setDraft(toDraft(question))
    setSelectedId(null)
  }

  function update(field: keyof Draft, value: string) {
    if (!draft) return
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
    if (field === 'question' || field === 'reason') setSelectedId(null)
  }

  function submit() {
    if (!draft) {
      setError('请先拍照并识别出题目。')
      return
    }
    if (!draft.question.trim()) {
      setError('识别结果为空，请重新拍照。')
      return
    }
    onSubmit({
      ...draft,
      grade,
      subject: effectiveSubject,
      question: draft.question.trim(),
      myAnswer: draft.myAnswer.trim(),
      correctAnswer: draft.correctAnswer.trim(),
      reason: draft.reason.trim() || '（GLM 识别，未填写错因）',
      matchedKnowledgeId: selected?.id ?? null,
      matchedExamPoint: selected?.examPoint ?? null,
      matchedUnit: selected?.unit ?? null,
      mastery: '未掌握',
      imageName,
      imageBase64: imageDataUrl,
    })
  }

  return (
    <div className="wrong-form">
      <div className="photo-first">
        <div className="photo-bar">
          <label className="upload-zone primary-upload">
            <span className="upload-title">📷 拍照录入错题</span>
            <span className="upload-hint">直接拍摄试卷或作业上的错题，GLM 会自动切题并提取题目与答案</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              disabled={recognizing}
            />
          </label>
          <label className="upload-alt">
            <input
              type="file"
              accept="image/*,.pdf,.docx"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              disabled={recognizing}
            />
            🖼 相册 / PDF / Word
          </label>
        </div>
        {!previewUrl && imageName && !recognizing && (
          <p className="file-name">已选择文件：{imageName}（PDF / Word 会解析内容后识别，最多识别 PDF 前 3 页）</p>
        )}
        {previewUrl && (
          <div className="upload-preview">
            <img src={previewUrl} alt="拍摄的错题照片" />
            <div className="upload-actions">
              <span className="file-name">{imageName}</span>
              <button type="button" className="btn small ghost" onClick={() => {
                URL.revokeObjectURL(previewUrl)
                setPreviewUrl(undefined)
                setDraft(null)
                setRecognized([])
                setQuestionIndex(0)
                setImageDataUrl(undefined)
              }}>重新选择</button>
            </div>
          </div>
        )}
      </div>

      {recognizing && (
        <div className="recognizing">
          <span className="spinner" /> 正在识别照片，提取题目与答案…
        </div>
      )}

      {draft && !recognizing && (
        <>
          <div className="recognized-result">
            <h4>识别结果（可校对修改）</h4>
            {recognized.length > 1 && (
              <div className="question-pager">
                <span>识别到 {recognized.length} 道题：</span>
                {recognized.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`chip ${index === questionIndex ? 'active' : ''}`}
                    onClick={() => switchQuestion(index)}
                  >
                    第 {index + 1} 道
                  </button>
                ))}
              </div>
            )}
            <div className="form-grid">
              <label className="field">
                <span>科目（识别）</span>
                <select value={draft.subject} onChange={(e) => {
                  setDraft((prev) => (prev ? { ...prev, subject: e.target.value as Subject } : prev))
                  setSelectedId(null)
                }}>
                  <option value="语文">语文</option>
                  <option value="数学">数学</option>
                  <option value="英语">英语</option>
                </select>
              </label>
              <label className="field">
                <span>我的答案</span>
                <input value={draft.myAnswer} onChange={(e) => update('myAnswer', e.target.value)} placeholder="识别出的作答" />
              </label>
              <label className="field">
                <span>正确答案</span>
                <input value={draft.correctAnswer} onChange={(e) => update('correctAnswer', e.target.value)} placeholder="识别出的正确答案" />
              </label>
            </div>
            <label className="field">
              <span>题干</span>
              <textarea rows={3} value={draft.question} onChange={(e) => update('question', e.target.value)} />
            </label>
            <label className="field">
              <span>错误原因</span>
              <textarea rows={2} value={draft.reason} onChange={(e) => update('reason', e.target.value)} />
            </label>
          </div>

          <div className="match-panel">
            <h4>自动匹配考点</h4>
            {matches.length === 0 ? (
              <p className="muted">未能自动匹配考点，可直接保存（不影响入库）。</p>
            ) : (
              <>
                <p className="muted">按题干关键词找到以下考点，点击可更换：</p>
                <div className="match-list">
                  {matches.map(({ item, score }) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`match-item ${selected?.id === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <strong>{item.examPoint}</strong>
                      <span>{item.unit} · {item.knowledgePoint} · 匹配度 {score}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {selected && (
              <div className="recommend-box">
                <strong>推荐练习</strong>
                <p>{selected.exercises[0]?.question}</p>
                <strong>推荐复习</strong>
                <p>{selected.reviewMaterials[0]?.content}</p>
              </div>
            )}
          </div>
        </>
      )}

      {!draft && !recognizing && (
        <p className="muted">还没有识别出题目。拍照、从相册选择照片，或上传 PDF / Word 试卷开始吧。</p>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={submit} disabled={!draft || recognizing}>保存到错题本</button>
        <button type="button" className="btn ghost" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

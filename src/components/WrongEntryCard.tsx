import type { KnowledgeItem, Mastery, UserWrongEntry } from '../types'
import MasterySelect from './MasterySelect'
import { shortDate } from '../utils/date'

interface Props {
  entry: UserWrongEntry
  item?: KnowledgeItem
  onMasteryChange: (id: string, mastery: Mastery) => void
  onReview: (entry: UserWrongEntry) => void
  onDelete: (id: string) => void
}

export default function WrongEntryCard({ entry, item, onMasteryChange, onReview, onDelete }: Props) {
  return (
    <article className="wrong-card">
      <header className="wrong-head">
        <div>
          <span className="tag subject-tag">{entry.subject}</span>
          <span className="muted">{shortDate(entry.createdAt.slice(0, 10))}</span>
          {entry.imageName && <span className="tag">{entry.imageName}</span>}
        </div>
        <MasterySelect value={entry.mastery} onChange={(value) => onMasteryChange(entry.id, value)} />
      </header>

      <p className="wrong-question">{entry.question}</p>
      <div className="answer-grid">
        <div><span>我的答案</span><p className="wrong-answer">{entry.myAnswer || '（未填写）'}</p></div>
        <div><span>正确答案</span><p className="right-answer">{entry.correctAnswer || '（未填写）'}</p></div>
      </div>
      {entry.reason && <p className="wrong-reason">错因：{entry.reason}</p>}

      {item && (
        <details className="recommend-details">
          <summary>
            已匹配：{item.unit} · {item.examPoint}
          </summary>
          <p><strong>相关练习：</strong>{item.exercises[0]?.question}</p>
          <p><strong>复习资料：</strong>{item.reviewMaterials[0]?.content}</p>
        </details>
      )}
      {!item && <p className="muted">未匹配到考点，可与“预习/复习”页的考点对照复习。</p>}

      <footer className="wrong-foot">
        <span className="muted">已巩固 {entry.reviewCount} 次</span>
        <div>
          <button type="button" className="btn small" onClick={() => onReview(entry)}>打卡巩固</button>
          <button type="button" className="btn small ghost danger" onClick={() => onDelete(entry.id)}>删除</button>
        </div>
      </footer>
    </article>
  )
}

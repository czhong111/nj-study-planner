import { useState } from 'react'
import type { KnowledgeItem, Mastery } from '../types'
import MasterySelect from './MasterySelect'

interface Props {
  item: KnowledgeItem
  mastery: Mastery
  onMasteryChange: (id: string, mastery: Mastery) => void
}

const difficultyClass: Record<string, string> = {
  基础: 'level-easy',
  提升: 'level-medium',
  挑战: 'level-hard',
}

export default function KnowledgeCard({ item, mastery, onMasteryChange }: Props) {
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <article className="knowledge-card">
      <header className="card-head">
        <div className="card-head-top">
          <span className={`tag ${difficultyClass[item.difficulty]}`}>{item.difficulty}</span>
          <span className="tag subject-tag">{item.subject}</span>
          <span className="tag version-tag">{item.textbookVersion}</span>
        </div>
        <p className="unit-line">{item.unit}</p>
        <h3>{item.knowledgePoint}</h3>
        <p className="exam-point">常考：{item.examPoint}</p>
      </header>

      <div className="card-section">
        <h4>预习与复习资料</h4>
        <ul className="material-list">
          {item.reviewMaterials.map((material, index) => (
            <li key={`${material.title}-${index}`}>
              <span className={`material-type type-${material.type}`}>{material.type}</span>
              <div>
                <strong>{material.title}</strong>
                <p>{material.content}</p>
                {material.source && <small>来源：{material.source}</small>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-section">
        <h4>示例练习</h4>
        {item.exercises.map((exercise, index) => (
          <div className="exercise" key={`${exercise.question}-${index}`}>
            <p><b>{index + 1}.</b> {exercise.question}</p>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => setShowAnswer((v) => !v)}
            >
              {showAnswer ? '隐藏答案' : '显示答案'}
            </button>
            {showAnswer && (
              <div className="answer">
                <span>参考答案：{exercise.answer ?? '略'}</span>
                <small>{exercise.hint}</small>
              </div>
            )}
          </div>
        ))}
      </div>

      {item.wrongRecords.length > 0 && (
        <div className="card-section">
          <h4>示例错题</h4>
          {item.wrongRecords.map((record) => (
            <div className="seed-wrong" key={record.id}>
              <p>{record.question}</p>
              <small>错因：{record.reason} · 正确答案：{record.correctAnswer}</small>
            </div>
          ))}
        </div>
      )}

      <footer className="card-foot">
        <span>今日掌握情况，随时可以改</span>
        <MasterySelect
          value={mastery}
          onChange={(value) => onMasteryChange(item.id, value)}
        />
      </footer>
    </article>
  )
}

import { useState } from 'react'
import rawKnowledge from './data/knowledge-base.json'
import type { Grade, KnowledgeItem, Mastery } from './types'
import { useUserData } from './utils/storage'
import GradeSwitcher from './components/GradeSwitcher'
import NavTabs, { type PageKey } from './components/NavTabs'
import PlanPage from './pages/PlanPage'
import WrongBookPage from './pages/WrongBookPage'
import CheckinPage from './pages/CheckinPage'
import ProgressPage from './pages/ProgressPage'

const knowledgeBase = rawKnowledge as unknown as KnowledgeItem[]

export default function App() {
  const [grade, setGrade] = useState<Grade>(3)
  const [page, setPage] = useState<PageKey>('plan')
  const [data, setData] = useUserData()

  const getMastery = (item: KnowledgeItem): Mastery =>
    data.masteryOverrides[item.id] ?? item.masteryStatus

  const onMasteryChange = (id: string, mastery: Mastery) => {
    setData((prev) => ({ ...prev, masteryOverrides: { ...prev.masteryOverrides, [id]: mastery } }))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">学</div>
            <div>
              <h1>南京小学生学习规划</h1>
              <p>教考分离背景 · 3—6 年级语数英自学工具</p>
            </div>
          </div>
          <GradeSwitcher grade={grade} onChange={setGrade} />
        </div>
        <NavTabs page={page} onChange={setPage} />
      </header>

      <main>
        {page === 'plan' && (
          <PlanPage
            grade={grade}
            items={knowledgeBase}
            getMastery={getMastery}
            onMasteryChange={onMasteryChange}
          />
        )}
        {page === 'wrong' && (
          <WrongBookPage grade={grade} data={data} update={setData} allItems={knowledgeBase} />
        )}
        {page === 'checkin' && <CheckinPage data={data} update={setData} />}
        {page === 'progress' && (
          <ProgressPage
            grade={grade}
            items={knowledgeBase}
            data={data}
            getMastery={getMastery}
            onMasteryChange={onMasteryChange}
          />
        )}
      </main>

      <footer className="app-footer">
        示例数据来自本地知识库 JSON 与 IMA「数学 / 语文 / 英语」知识库要点整理 · 错题、打卡与掌握状态保存在本机浏览器
      </footer>
    </div>
  )
}

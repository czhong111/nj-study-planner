export type PageKey = 'plan' | 'wrong' | 'checkin' | 'progress'

interface Props {
  page: PageKey
  onChange: (page: PageKey) => void
}

const tabs: { key: PageKey; label: string; hint: string }[] = [
  { key: 'plan', label: '预习 / 复习', hint: '按单元和考点规划' },
  { key: 'wrong', label: '错题本', hint: '录入、筛选与巩固' },
  { key: 'checkin', label: '每日打卡', hint: '记录连续天数' },
  { key: 'progress', label: '学习进度', hint: '掌握比例一目了然' },
]

export default function NavTabs({ page, onChange }: Props) {
  return (
    <nav className="nav-tabs" aria-label="主导航">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`nav-tab ${page === tab.key ? 'active' : ''}`}
          aria-current={page === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.hint}</span>
        </button>
      ))}
    </nav>
  )
}

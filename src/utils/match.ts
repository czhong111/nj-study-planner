import type { Grade, KnowledgeItem, Subject } from '../types'

export interface MatchResult {
  item: KnowledgeItem
  score: number
}

const subjectSignals: Record<Subject, string[]> = {
  语文: ['拼音', '词语', '古诗', '修辞', '阅读', '作文', '习作', '病句', '标点', '文言', '课文', '填空', '摘抄', '描写'],
  数学: ['计算', '乘法', '除法', '加减', '方程', '面积', '周长', '单位', '厘米', '千克', '吨', '分数', '小数', '百分数', '竖式', '应用题', '比', '角'],
  英语: ['单词', '句型', '字母', 'hello', 'english', 'grammar', 'be动词', '过去式', '背诵', 'cartoon', 'story', 'read', 'like', 'there'],
}

/** 把容易混淆的口语说法映射到教材关键词，提升自动匹配命中率 */
const synonymHints: Record<string, string[]> = {
  粗心: ['审题', '格式', '书写'],
  马虎: ['审题', '计算'],
  乘法口诀: ['乘法'],
  应用题: ['解决问题'],
  写作文: ['习作'],
  背书: ['背诵'],
  音标: ['字母', '语音'],
}

function expand(text: string): string {
  const lower = text.toLowerCase()
  let extra = ''
  for (const [key, words] of Object.entries(synonymHints)) {
    if (lower.includes(key.toLowerCase())) extra += ` ${words.join(' ')}`
  }
  return `${lower}${extra}`
}

/** 根据题干文字猜测科目（猜测不准时用户仍可手动切换） */
export function guessSubject(text: string): Subject | null {
  const lower = expand(text)
  const scores = (Object.keys(subjectSignals) as Subject[]).map((subject) => ({
    subject,
    score: subjectSignals[subject].reduce((sum, word) => sum + (lower.includes(word.toLowerCase()) ? 1 : 0), 0),
  }))
  scores.sort((a, b) => b.score - a.score)
  return scores[0].score > 0 ? scores[0].subject : null
}

/**
 * 按关键词自动匹配知识点、单元与考点。
 * @param text 题干 / 错因描述
 * @param items 知识库条目
 * @param grade 当前年级
 * @param subject 科目筛选，'全部' 时自动猜测
 */
export function matchKnowledge(
  text: string,
  items: KnowledgeItem[],
  grade: Grade,
  subject: Subject | '全部' = '全部',
  limit = 3,
): MatchResult[] {
  const lower = expand(text)
  if (!lower.trim()) return []

  const targetSubject = subject === '全部' ? guessSubject(lower) : subject
  const pool = items.filter(
    (item) => item.grade === grade && (!targetSubject || item.subject === targetSubject),
  )

  const results = pool.map((item) => {
    let score = 0
    for (const keyword of item.keywords) {
      const kw = keyword.toLowerCase()
      if (lower.includes(kw)) {
        score += 6
      } else if (kw.length >= 3) {
        const parts = [kw.slice(0, 2), kw.slice(-2)]
        score += parts.filter((part) => lower.includes(part)).length
      }
    }
    if (lower.includes(item.examPoint.toLowerCase())) score += 8
    if (lower.includes(item.knowledgePoint.toLowerCase())) score += 6
    if (lower.includes(item.unit.toLowerCase().split(' ')[0])) score += 1
    return { item, score }
  })

  return results
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** 年级：3—6 年级 */
export type Grade = 3 | 4 | 5 | 6

/** 科目 */
export type Subject = '语文' | '数学' | '英语'

/** 难度分档 */
export type Difficulty = '基础' | '提升' | '挑战'

/** 掌握状态 */
export type Mastery = '未掌握' | '模糊' | '已掌握'

/** 练习题示例 */
export interface Exercise {
  question: string
  answer?: string
  hint?: string
}

/** 预习要点 / 复习资料条目 */
export interface ReviewMaterial {
  title: string
  type: '预习要点' | '复习资料' | '方法指导'
  content: string
  source?: string
}

/** 知识库中内置的示例错题记录 */
export interface WrongRecord {
  id: string
  question: string
  myAnswer: string
  correctAnswer: string
  reason: string
  mastery: Mastery
}

/**
 * 知识库条目（考点级）。
 * 字段满足：年级、科目、教材版本、单元、知识点、考点、难度、
 * 练习题、复习资料、错题记录、掌握状态。
 */
export interface KnowledgeItem {
  id: string
  grade: Grade
  subject: Subject
  textbookVersion: string
  unit: string
  unitIndex: number
  knowledgePoint: string
  examPoint: string
  difficulty: Difficulty
  keywords: string[]
  exercises: Exercise[]
  reviewMaterials: ReviewMaterial[]
  wrongRecords: WrongRecord[]
  masteryStatus: Mastery
}

/** 用户手动录入 / 未来图片识别录入的错题 */
export interface UserWrongEntry {
  id: string
  grade: Grade
  subject: Subject
  question: string
  myAnswer: string
  correctAnswer: string
  reason: string
  matchedKnowledgeId: string | null
  matchedExamPoint: string | null
  matchedUnit: string | null
  mastery: Mastery
  reviewCount: number
  createdAt: string
  imageName?: string
  /** 照片压缩后的 data URL（JPEG），随错题存入云数据库并归档到 IMA GradeⅢ */
  imageBase64?: string
}

/** 每日打卡记录 */
export interface CheckinRecord {
  date: string
  wrongReviewed: number
  note?: string
}

/** localStorage 中持久化的完整用户数据 */
export interface UserData {
  wrongEntries: UserWrongEntry[]
  checkins: CheckinRecord[]
  masteryOverrides: Record<string, Mastery>
}

/** 页面通用的数据更新函数（由 App 提供给各页面） */
export type DataUpdater = (updater: (prev: UserData) => UserData) => void

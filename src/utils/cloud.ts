/**
 * 云端数据访问层。
 *
 * 通过 WorkBuddy Cloud Service 的公开配置初始化客户端（endpoint + publishableKey
 * 均来自平台下发的 publicConfig，可安全打进前端产物；权限由服务端 Origin 校验 +
 * 数据库 RLS 控制）。本应用是面向小学生的无登录自学工具，wrong_entries 表对 anon
 * 角色开放读写，按 clientId 区分不同设备录入的错题。
 *
 * 数据链路：公网录入 -> 云数据库 wrong_entries -> 定时任务读取 synced_to_ima=false
 * 的记录 -> 生成文件写入 IMA GradeⅢ 知识库 -> 回写 synced_to_ima=true。
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import type { Mastery, UserWrongEntry } from '../types'

/** wrong_entries 表的行结构（Row / Insert / Update），供 SDK 生成类型 */
interface WrongEntriesTable {
  Row: {
    id: string
    client_id: string
    grade: number
    subject: string
    textbook_version: string | null
    unit: string | null
    exam_point: string | null
    knowledge_id: string | null
    question: string
    my_answer: string | null
    correct_answer: string | null
    reason: string | null
    mastery: string
    review_count: number
    image_name: string | null
    image_base64: string | null
    synced_to_ima: boolean
    created_at: string
    updated_at: string
  }
  Insert: {
    id: string
    client_id: string
    grade: number
    subject: string
    textbook_version?: string | null
    unit?: string | null
    exam_point?: string | null
    knowledge_id?: string | null
    question: string
    my_answer?: string | null
    correct_answer?: string | null
    reason?: string | null
    mastery?: string
    review_count?: number
    image_name?: string | null
    image_base64?: string | null
    synced_to_ima?: boolean
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    client_id?: string
    grade?: number
    subject?: string
    textbook_version?: string | null
    unit?: string | null
    exam_point?: string | null
    knowledge_id?: string | null
    question?: string
    my_answer?: string | null
    correct_answer?: string | null
    reason?: string | null
    mastery?: string
    review_count?: number
    image_name?: string | null
    image_base64?: string | null
    synced_to_ima?: boolean
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}

interface KbSyncRequestsTable {
  Row: {
    id: string
    grade: number
    requested_at: string
    status: string
    note: string | null
    finished_at: string | null
  }
  Insert: {
    id: string
    grade?: number
    requested_at?: string
    status?: string
    note?: string | null
    finished_at?: string | null
  }
  Update: {
    id?: string
    grade?: number
    requested_at?: string
    status?: string
    note?: string | null
    finished_at?: string | null
  }
  Relationships: []
}

interface AppDatabase {
  public: {
    Tables: { wrong_entries: WrongEntriesTable; kb_sync_requests: KbSyncRequestsTable }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

/**
 * 平台下发的公开配置。endpoint 必须是当前应用的发布域名，服务端按 Origin 精确匹配。
 * publishableKey 只标识应用、不携带权限，可放前端；请勿写入日志。
 */
export const publicConfig = {
  resourceId: 'wbcs_aaq6WHzs1EUnQH47hJXI5V',
  endpoint: 'https://nj-study-planner.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_2VJ79C0u8SHSKIYKVv4GHs_x0o4RYL5vVuFshAGhXp2zTP9LRDhrrQn',
}

const cloud = createWorkBuddyCloud<AppDatabase>({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
})

/** 每个浏览器一个稳定标识，用于区分错题来源设备 */
const CLIENT_KEY = 'nj-study-planner:client-id'

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY)
    if (!id) {
      id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(CLIENT_KEY, id)
    }
    return id
  } catch {
    return 'c-anonymous'
  }
}

/** 云数据库中的错题行 */
interface WrongEntryRow {
  id: string
  client_id: string
  grade: number
  subject: string
  textbook_version: string | null
  unit: string | null
  exam_point: string | null
  knowledge_id: string | null
  question: string
  my_answer: string | null
  correct_answer: string | null
  reason: string | null
  mastery: string
  review_count: number
  image_name: string | null
  image_base64: string | null
  synced_to_ima: boolean
  created_at: string
  updated_at: string
}

function toRow(entry: UserWrongEntry, textbookVersion = ''): WrongEntryRow {
  return {
    id: entry.id,
    client_id: getClientId(),
    grade: entry.grade,
    subject: entry.subject,
    textbook_version: textbookVersion,
    unit: entry.matchedUnit ?? null,
    exam_point: entry.matchedExamPoint ?? null,
    knowledge_id: entry.matchedKnowledgeId ?? null,
    question: entry.question,
    my_answer: entry.myAnswer || null,
    correct_answer: entry.correctAnswer || null,
    reason: entry.reason || null,
    mastery: entry.mastery,
    review_count: entry.reviewCount,
    image_name: entry.imageName ?? null,
    image_base64: entry.imageBase64 ?? null,
    synced_to_ima: false,
    created_at: entry.createdAt,
    updated_at: new Date().toISOString(),
  }
}

/** 更新用的轻量字段（不含 synced_to_ima，避免改写归档标记 / 清空照片） */
interface WrongEntryPatch {
  grade: number
  subject: string
  unit: string | null
  exam_point: string | null
  knowledge_id: string | null
  question: string
  my_answer: string | null
  correct_answer: string | null
  reason: string | null
  mastery: string
  review_count: number
  image_name: string | null
  image_base64: string | null
  updated_at: string
}

function toPatch(entry: UserWrongEntry): WrongEntryPatch {
  return {
    grade: entry.grade,
    subject: entry.subject,
    unit: entry.matchedUnit ?? null,
    exam_point: entry.matchedExamPoint ?? null,
    knowledge_id: entry.matchedKnowledgeId ?? null,
    question: entry.question,
    my_answer: entry.myAnswer || null,
    correct_answer: entry.correctAnswer || null,
    reason: entry.reason || null,
    mastery: entry.mastery,
    review_count: entry.reviewCount,
    image_name: entry.imageName ?? null,
    image_base64: entry.imageBase64 ?? null,
    updated_at: new Date().toISOString(),
  }
}

function fromRow(row: WrongEntryRow): UserWrongEntry {
  return {
    id: row.id,
    grade: row.grade as UserWrongEntry['grade'],
    subject: row.subject as UserWrongEntry['subject'],
    question: row.question,
    myAnswer: row.my_answer ?? '',
    correctAnswer: row.correct_answer ?? '',
    reason: row.reason ?? '',
    matchedKnowledgeId: row.knowledge_id,
    matchedExamPoint: row.exam_point,
    matchedUnit: row.unit,
    mastery: row.mastery as Mastery,
    reviewCount: row.review_count ?? 0,
    createdAt: row.created_at,
    imageName: row.image_name ?? undefined,
    imageBase64: row.image_base64 ?? undefined,
  }
}

/** 拉取当前设备录入的全部错题（按创建时间倒序） */
export async function fetchCloudEntries(): Promise<UserWrongEntry[]> {
  const { data, error } = await cloud.database
    .from('wrong_entries')
    .select('*')
    .eq('client_id', getClientId())
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    console.warn('云端错题读取失败，继续使用本地数据：', error.message)
    return []
  }
  return ((data ?? []) as WrongEntryRow[]).map(fromRow)
}

/**
 * 写入或更新单条错题。
 * - 新记录：insert，synced_to_ima 默认 false，等待定时任务归档
 * - 已有记录：只更新业务字段，保留 synced_to_ima 与图片，避免重复归档
 */
export async function upsertCloudEntry(entry: UserWrongEntry, textbookVersion = ''): Promise<boolean> {
  const { data: existing, error: queryError } = await cloud.database
    .from('wrong_entries')
    .select('id')
    .eq('id', entry.id)
    .maybeSingle()
  if (queryError) {
    console.warn('云端错题查询失败：', queryError.message)
    return false
  }

  if (existing) {
    const { error } = await cloud.database
      .from('wrong_entries')
      .update(toPatch(entry))
      .eq('id', entry.id)
    if (error) {
      console.warn('云端错题更新失败：', error.message)
      return false
    }
    return true
  }

  const { error } = await cloud.database.from('wrong_entries').insert(toRow(entry, textbookVersion))
  if (error) {
    console.warn('云端错题写入失败：', error.message)
    return false
  }
  return true
}

/** 更新错题的掌握状态 */
export async function updateCloudMastery(id: string, mastery: Mastery): Promise<void> {
  const { error } = await cloud.database
    .from('wrong_entries')
    .update({ mastery, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.warn('云端掌握状态更新失败：', error.message)
}

/** 删除一条错题 */
export async function deleteCloudEntry(id: string): Promise<void> {
  const { error } = await cloud.database.from('wrong_entries').delete().eq('id', id)
  if (error) console.warn('云端错题删除失败：', error.message)
}

/**
 * 手机侧手动触发「从 IMA 知识库更新错题库」：写入一条 pending 请求。
 * 会话侧定时任务会消费 status='pending' 的请求，完成后回写 done。
 * grade=0 表示全部年级。
 */
export async function requestKbSync(grade = 0): Promise<boolean> {
  const { error } = await cloud.database.from('kb_sync_requests').insert({
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    grade,
    status: 'pending',
    note: '手机端手动触发',
  })
  if (error) {
    console.warn('更新请求写入失败：', error.message)
    return false
  }
  return true
}

/** 查询最近一条更新请求的状态，用于按钮下方展示 */
export async function fetchLatestKbSync(): Promise<{ status: string; requestedAt: string; finishedAt: string | null } | null> {
  const { data, error } = await cloud.database
    .from('kb_sync_requests')
    .select('status, requested_at, finished_at')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('更新请求查询失败：', error.message)
    return null
  }
  if (!data) return null
  return { status: data.status, requestedAt: data.requested_at, finishedAt: data.finished_at }
}

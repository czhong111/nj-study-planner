import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mastery, UserData, UserWrongEntry } from '../types'
import { deleteCloudEntry, fetchCloudEntries, updateCloudMastery, upsertCloudEntry } from './cloud'

const STORAGE_KEY = 'nj-study-planner:v1'

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

/** 首次打开时放入两条示例错题，方便直接体验筛选、匹配与打卡功能 */
export const emptyUserData: UserData = {
  wrongEntries: [
    {
      id: 'demo-wrong-1',
      grade: 3,
      subject: '数学',
      question: '用竖式计算：302 × 3 = ?',
      myAnswer: '96',
      correctAnswer: '906',
      reason: '乘数中间有 0，漏乘了百位上的 3',
      matchedKnowledgeId: '3-数学-上1-3',
      matchedExamPoint: '乘数中间末尾有0',
      matchedUnit: '上册 · 第一单元 两三位数乘一位数',
      mastery: '未掌握',
      reviewCount: 1,
      createdAt: yesterday.toISOString(),
    },
    {
      id: 'demo-wrong-2',
      grade: 3,
      subject: '语文',
      question: '“雨一来，花朵便放假了。”照样子补充：风一来，______便______。',
      myAnswer: '风一来，树叶便动了。',
      correctAnswer: '示例：风一来，树叶便跳起舞来。',
      reason: '没有用拟人手法，句子不够生动',
      matchedKnowledgeId: '3-语文-上3-1',
      matchedExamPoint: '体会拟人手法',
      matchedUnit: '上册 · 第三单元 童话世界',
      mastery: '模糊',
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    },
  ],
  checkins: [],
  masteryOverrides: {},
}

/** 从 localStorage 读取用户数据；解析失败时安全回退到空数据 */
export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyUserData
    const parsed = JSON.parse(raw) as Partial<UserData>
    return {
      wrongEntries: Array.isArray(parsed.wrongEntries) ? parsed.wrongEntries : [],
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
      masteryOverrides: parsed.masteryOverrides && typeof parsed.masteryOverrides === 'object'
        ? parsed.masteryOverrides
        : {},
    }
  } catch {
    return emptyUserData
  }
}

/** 保存用户数据到 localStorage */
export function saveUserData(data: UserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 隐私模式或存储超限时静默降级，页面仍可正常使用（仅本次会话有效）
  }
}

/**
 * 与 localStorage + 云数据库双向同步的 state hook。
 * - 首次挂载：拉取云端错题并按 id 合并进本地（云端优先，保证换设备/清缓存后不丢）
 * - 本地错题增删改：异步写入云端（upsert / update / delete）
 * - 打卡与知识点掌握状态仍存 localStorage，无需逐条上云
 */
export function useUserData() {
  const [data, setData] = useState<UserData>(() => loadUserData())
  const [cloudReady, setCloudReady] = useState(false)
  const hydratedRef = useRef(false)
  /** 上一次已完成云端同步的错题 id 集合，用于识别本地删除 */
  const cloudIdsRef = useRef<Set<string>>(new Set())

  // 首次从云端合并错题（云端不可达时降级为纯本地模式，不阻塞页面、不产生未捕获异常）
  useEffect(() => {
    let cancelled = false
    fetchCloudEntries()
      .then((remote) => {
        if (cancelled || hydratedRef.current) return
        hydratedRef.current = true
        if (remote.length > 0) {
          setData((prev) => {
            const merged = new Map<string, UserWrongEntry>()
            for (const entry of remote) merged.set(entry.id, entry)
            for (const entry of prev.wrongEntries) if (!merged.has(entry.id)) merged.set(entry.id, entry)
            const wrongEntries = [...merged.values()].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            return { ...prev, wrongEntries }
          })
        }
        cloudIdsRef.current = new Set(remote.map((entry) => entry.id))
        setCloudReady(true)
      })
      .catch((err) => {
        console.warn('云端错题合并失败，继续使用本地数据：', err instanceof Error ? err.message : err)
      })
    return () => { cancelled = true }
  }, [])

  // 本地变更持久化到 localStorage；云端同步在合并完成后进行
  useEffect(() => {
    saveUserData(data)
    if (!cloudReady) return
    const localIds = new Set(data.wrongEntries.filter((e) => !e.id.startsWith('demo-')).map((e) => e.id))
    // 本地已删除、云端仍存在的记录 -> 删除云端
    for (const id of cloudIdsRef.current) {
      if (!localIds.has(id)) void deleteCloudEntry(id)
    }
    // 写入/更新本地错题
    for (const entry of data.wrongEntries) {
      if (entry.id.startsWith('demo-')) continue
      void upsertCloudEntry(entry)
    }
    cloudIdsRef.current = localIds
  }, [data, cloudReady])

  /** 更新单条错题的掌握状态（同时更新云端） */
  const setEntryMastery = useCallback((id: string, mastery: Mastery) => {
    setData((prev) => ({
      ...prev,
      wrongEntries: prev.wrongEntries.map((e) => (e.id === id ? { ...e, mastery } : e)),
    }))
    void updateCloudMastery(id, mastery)
  }, [])

  /** 删除错题（同时删除云端） */
  const removeEntry = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      wrongEntries: prev.wrongEntries.filter((e) => e.id !== id),
    }))
    void deleteCloudEntry(id)
  }, [])

  return [data, setData, { cloudReady, setEntryMastery, removeEntry }] as const
}

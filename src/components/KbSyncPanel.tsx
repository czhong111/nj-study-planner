/**
 * 手动触发「从 IMA 语文/数学/英语知识库识别错题 → 加入错题库 → 归档 GradeⅢ」。
 * 手机浏览器点击即可；写入云数据库请求表后，由 WorkBuddy 会话侧定时任务消费执行。
 * 注意：平台定时任务最小调度粒度为小时级，触发后通常在下一次调度（约 1 小时内）完成。
 */
import { useEffect, useState } from 'react'
import { fetchLatestKbSync, requestKbSync } from '../utils/cloud'

interface Props {
  grade: number
}

type SyncStatus = { status: string; requestedAt: string; finishedAt: string | null } | null

export default function KbSyncPanel({ grade }: Props) {
  const [busy, setBusy] = useState(false)
  const [latest, setLatest] = useState<SyncStatus>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    void fetchLatestKbSync()
      .then(setLatest)
      .catch((err) => {
        console.warn('知识库同步状态读取失败（云端不可达时忽略）：', err instanceof Error ? err.message : err)
      })
  }, [])

  async function trigger() {
    if (busy) return
    setBusy(true)
    setToast('')
    let ok = false
    try {
      ok = await requestKbSync(grade)
    } catch (err) {
      console.warn('更新请求提交失败：', err instanceof Error ? err.message : err)
    }
    setToast(ok ? '已提交更新请求，将在下一次定时任务中执行（约 1 小时内）。' : '提交失败，请检查网络后重试。')
    setBusy(false)
    if (ok) {
      try {
        const fresh = await fetchLatestKbSync()
        setLatest(fresh)
      } catch {
        // 状态刷新失败不影响提交结果
      }
    }
  }

  const pending = latest?.status === 'pending'

  return (
    <section className="panel kb-sync-panel">
      <div className="kb-sync-head">
        <div>
          <h3>从知识库更新错题库</h3>
          <p>让 WorkBuddy 从 IMA 的语文、数学、英语知识库里识别例题/易错题，加入错题库，并同步归档到 GradeⅢ。</p>
        </div>
        <button type="button" className="btn secondary" onClick={trigger} disabled={busy}>
          {busy ? '提交中…' : '🔄 请求更新错题库'}
        </button>
      </div>
      <p className="kb-sync-note">
        {latest
          ? pending
            ? `⏳ 有一次更新请求正在等待定时任务处理（提交于 ${new Date(latest.requestedAt).toLocaleString('zh-CN')}）。`
            : `✅ 上次更新于 ${new Date(latest.finishedAt ?? latest.requestedAt).toLocaleString('zh-CN')} 完成。`
          : '尚未发起过知识库更新。'}
      </p>
      {toast && <p className="kb-sync-toast">{toast}</p>}
    </section>
  )
}

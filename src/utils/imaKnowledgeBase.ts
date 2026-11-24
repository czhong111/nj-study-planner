import type { Grade, KnowledgeItem, Subject } from '../types'

/**
 * ============================================================================
 * 接口 stub ①：imaKnowledgeBase —— 对接 GradeⅢ ima 知识库
 * ----------------------------------------------------------------------------
 * 用途：把本应用内置的知识库与 ima「数学 / 语文 / 英语」知识库打通。
 *      pull = 从 ima 拉取指定年级、科目的知识点与复习资料，替换/扩充本地 JSON；
 *      push = 把本地新增的考点、错题巩固记录回写到 ima 知识库。
 *
 * 固定函数签名（后续替换实现时请勿修改参数与返回值结构）：
 *   imaKnowledgeBase(action, params) => Promise<KnowledgeBaseResponse>
 *
 * 当前实现：stub。不发起网络请求，返回 stub: true 与提示信息。
 * 后续接入：在函数中调用 ima OpenAPI（知识库 id 见 README），
 *           把返回结果映射为 KnowledgeItem[] 即可，页面代码无需改动。
 * ============================================================================
 */
export interface KnowledgeBaseParams {
  kbId: string
  grade?: Grade
  subject?: Subject
  items?: KnowledgeItem[]
}

export interface KnowledgeBaseResponse {
  success: boolean
  message: string
  items?: KnowledgeItem[]
  stub: true
}

export async function imaKnowledgeBase(
  action: 'pull' | 'push',
  params: KnowledgeBaseParams,
): Promise<KnowledgeBaseResponse> {
  void action
  void params
  return {
    success: false,
    message: 'ima 知识库接口尚未接入（stub）。当前使用本地示例知识库；接入后此处将调用 ima OpenAPI。',
    stub: true,
  }
}

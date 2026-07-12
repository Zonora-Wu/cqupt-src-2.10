export const identityTypes = ['本科生', '研究生', '教师', '信息化办老师', '社团/工作室成员']

export const teacherIdentityTypes = new Set(['教师', '信息化办老师'])

export const collegeOptions = [
  '通信与信息工程学院',
  '计算机科学与技术学院（示范性软件学院）',
  '人工智能学院（重邮科大讯飞人工智能学院）',
  '自动化学院 / 工业互联网学院',
  '电子科学与工程学院',
  '集成电路学院（重庆国际半导体学院）',
  '生命健康信息科学与工程学院',
  '网络空间安全与信息法学院',
  '数学与统计学院',
  '国际学院',
  '经济管理学院',
  '现代邮政学院',
  '传媒艺术学院',
  '外国语学院',
  '马克思主义学院',
  '体育学院',
  '创新创业教育学院 / 继续教育学院',
  '远东联邦大学联合学院（国际合作学院）',
]

export type ProfileBasics = {
  college: string
  grade: string
  identityText: string
  studentNo: string
}

export function isProfileBasicsComplete(profile: ProfileBasics) {
  const college = profile.college.trim()
  const identityText = profile.identityText.trim()
  const studentNo = profile.studentNo.trim()

  return Boolean(college && identityText && (teacherIdentityTypes.has(identityText) || studentNo))
}

import { currentGradeLabel, enrollLabel, schoolStatusClass } from '../utils/studentAcademic'

function Row({ label, children }) {
  return (
    <div className="profile-fact">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  )
}

export default function ProfileFacts({ user, admin = false }) {
  const enroll = enrollLabel(user.USER_ENROLL_YEAR, user.USER_ENROLL_GRADE)
  const current = currentGradeLabel(user.USER_CURRENT_GRADE)

  return (
    <div className="profile-facts">
      <Row label="帳號">{user.USER_USERNAME || user.USER_MOBILE || '-'}</Row>
      {admin && (
        <>
          <Row label="身份">{user.USER_TYPE === 2 ? '教師' : '學員'}</Row>
          <Row label="帳號狀態">
            <span className={user.USER_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
              {user.USER_STATUS === 1 ? '正常' : '停用'}
            </span>
          </Row>
        </>
      )}
      {Number(user.USER_TYPE) !== 2 && (
        <>
          <Row label="學籍">
            <span className={schoolStatusClass(user.USER_SCHOOL_STATUS)}>{user.USER_SCHOOL_STATUS || '未設定'}</span>
          </Row>
          {enroll ? <Row label="入學">{enroll}</Row> : null}
          {current ? <Row label="現況">{current}</Row> : null}
          {Number(user.USER_TYPE) !== 2 && <Row label="收費群組">{user.GROUP_NAME || '未設定'}</Row>}
        </>
      )}
      <Row label="電話">{user.USER_PHONE || '—'}</Row>
      <Row label="電郵">{user.USER_EMAIL || '—'}</Row>
      <Row label="Instagram">{user.USER_IG ? `@${String(user.USER_IG).replace(/^@/, '')}` : '—'}</Row>
      {admin && (
        <Row label="備註"><span style={{ whiteSpace: 'pre-wrap' }}>{user.USER_NOTE || '—'}</span></Row>
      )}
    </div>
  )
}

export function pickMeetTitle(res, fallback = '') {
  return res?.data?.MEET_TITLE || res?.MEET_TITLE || fallback
}

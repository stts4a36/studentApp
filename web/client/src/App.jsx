import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import Home from './pages/Home'
import NewsList from './pages/NewsList'
import NewsDetail from './pages/NewsDetail'
import MeetList from './pages/MeetList'
import MeetDetail from './pages/MeetDetail'
import MeetJoin from './pages/MeetJoin'
import MyIndex from './pages/MyIndex'
import MyJoinList from './pages/MyJoinList'
import MyJoinDetail from './pages/MyJoinDetail'
import LessonLog from './pages/LessonLog'
import MyCourse from './pages/MyCourse'
import Login from './pages/Login'
import Register from './pages/Register'
import MyProfile from './pages/MyProfile'
import AdminLogin from './pages/admin/AdminLogin'
import AdminHome from './pages/admin/AdminHome'
import AdminMeetList from './pages/admin/AdminMeetList'
import AdminMeetAdd from './pages/admin/AdminMeetAdd'
import AdminPrivateList from './pages/admin/AdminPrivateList'
import MeetHub, { MeetHubRedirect } from './components/MeetHub'
import AdminNewsList from './pages/admin/AdminNewsList'
import AdminNewsAdd from './pages/admin/AdminNewsAdd'
import AdminNewsEdit from './pages/admin/AdminNewsEdit'
import AdminUserList from './pages/admin/AdminUserList'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import AdminSchedule from './pages/admin/AdminSchedule'
import AdminFeeGroups from './pages/admin/AdminFeeGroups'
import AdminLogs from './pages/admin/AdminLogs'
import Settings from './pages/Settings'
import NoticeHost from './components/NoticeHost'
import WorkLayout from './components/WorkLayout'
import WorkLogin from './pages/work/WorkLogin'
import WorkHome from './pages/work/WorkHome'
import WorkMeetList from './pages/work/WorkMeetList'
import WorkPrivateList from './pages/work/WorkPrivateList'
import WorkSchedule from './pages/work/WorkSchedule'

function App() {
  return (
    <>
      <NoticeHost />
      <Routes>
      {/* Student pages */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="news" element={<NewsList />} />
        <Route path="news/:id" element={<NewsDetail />} />
        <Route path="meet" element={<MeetList />} />
        <Route path="meet/calendar" element={<Navigate to="/" replace />} />
        <Route path="meet/:id" element={<MeetDetail />} />
        <Route path="meet/:id/join" element={<MeetJoin />} />
        <Route path="my" element={<MyIndex />} />
        <Route path="my/profile" element={<MyProfile />} />
        <Route path="my/course" element={<MyCourse />} />
        <Route path="my/joins" element={<MyJoinList />} />
        <Route path="my/joins/:id" element={<MyJoinDetail />} />
        <Route path="my/lessons" element={<LessonLog />} />
        <Route path="settings" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin pages */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="meet" element={<AdminMeetList />} />
        <Route path="meet/add" element={<AdminMeetAdd />} />
        <Route path="meet/:id" element={<MeetHubRedirect mode="admin" />} />
        <Route path="meet/:id/:tab" element={<MeetHub mode="admin" />} />
        <Route path="private" element={<AdminPrivateList />} />
        <Route path="news" element={<AdminNewsList />} />
        <Route path="news/add" element={<AdminNewsAdd />} />
        <Route path="news/:id/edit" element={<AdminNewsEdit />} />
        <Route path="users" element={<Navigate to="/admin/users/students" replace />} />
        <Route path="users/teachers" element={<AdminUserList userType={2} />} />
        <Route path="users/students" element={<AdminUserList userType={1} />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="fee-groups" element={<AdminFeeGroups />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="schedule" element={<Navigate to="/admin/schedule/calendar" replace />} />
        <Route path="schedule/teachers" element={<Navigate to="/admin/schedule/calendar" replace />} />
        <Route path="schedule/students" element={<Navigate to="/admin/schedule/calendar" replace />} />
        <Route path="schedule/team" element={<AdminSchedule view="team" />} />
        <Route path="schedule/activity" element={<AdminSchedule view="activity" />} />
        <Route path="schedule/calendar" element={<AdminSchedule view="calendar" />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Teacher pages */}
      <Route path="/work/login" element={<WorkLogin />} />
      <Route path="/work" element={<WorkLayout />}>
        <Route index element={<WorkHome />} />
        <Route path="schedule" element={<Navigate to="/work/schedule/calendar" replace />} />
        <Route path="schedule/team" element={<WorkSchedule view="team" />} />
        <Route path="schedule/activity" element={<WorkSchedule view="activity" />} />
        <Route path="schedule/calendar" element={<WorkSchedule view="calendar" />} />
        <Route path="meet" element={<WorkMeetList />} />
        <Route path="meet/:id" element={<MeetHubRedirect mode="work" />} />
        <Route path="meet/:id/:tab" element={<MeetHub mode="work" />} />
        <Route path="private" element={<WorkPrivateList />} />
        <Route path="course" element={<Navigate to="/work/meet" replace />} />
        <Route path="meet/edit" element={<Navigate to="/work/meet" replace />} />
        <Route path="meet/time" element={<Navigate to="/work/meet" replace />} />
        <Route path="meet/joins" element={<Navigate to="/work/meet" replace />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App

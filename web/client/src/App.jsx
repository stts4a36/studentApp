import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import Home from './pages/Home'
import NewsList from './pages/NewsList'
import NewsDetail from './pages/NewsDetail'
import MeetList from './pages/MeetList'
import MeetCalendar from './pages/MeetCalendar'
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
import AdminMeetEdit from './pages/admin/AdminMeetEdit'
import AdminMeetTime from './pages/admin/AdminMeetTime'
import AdminJoinList from './pages/admin/AdminJoinList'
import AdminNewsList from './pages/admin/AdminNewsList'
import AdminNewsAdd from './pages/admin/AdminNewsAdd'
import AdminNewsEdit from './pages/admin/AdminNewsEdit'
import AdminUserList from './pages/admin/AdminUserList'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import WorkLayout from './components/WorkLayout'
import WorkLogin from './pages/work/WorkLogin'
import WorkHome from './pages/work/WorkHome'
import WorkMeetEdit from './pages/work/WorkMeetEdit'
import WorkMeetTime from './pages/work/WorkMeetTime'
import WorkJoinList from './pages/work/WorkJoinList'

function App() {
  return (
    <Routes>
      {/* Student pages */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="news" element={<NewsList />} />
        <Route path="news/:id" element={<NewsDetail />} />
        <Route path="meet" element={<MeetList />} />
        <Route path="meet/calendar" element={<MeetCalendar />} />
        <Route path="meet/:id" element={<MeetDetail />} />
        <Route path="meet/:id/join" element={<MeetJoin />} />
        <Route path="my" element={<MyIndex />} />
        <Route path="my/profile" element={<MyProfile />} />
        <Route path="my/course" element={<MyCourse />} />
        <Route path="my/joins" element={<MyJoinList />} />
        <Route path="my/joins/:id" element={<MyJoinDetail />} />
        <Route path="my/lessons" element={<LessonLog />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin pages */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="meet" element={<AdminMeetList />} />
        <Route path="meet/add" element={<AdminMeetAdd />} />
        <Route path="meet/:id/edit" element={<AdminMeetEdit />} />
        <Route path="meet/:id/time" element={<AdminMeetTime />} />
        <Route path="meet/:id/joins" element={<AdminJoinList />} />
        <Route path="news" element={<AdminNewsList />} />
        <Route path="news/add" element={<AdminNewsAdd />} />
        <Route path="news/:id/edit" element={<AdminNewsEdit />} />
        <Route path="users" element={<AdminUserList />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
      </Route>

      {/* Teacher pages */}
      <Route path="/work/login" element={<WorkLogin />} />
      <Route path="/work" element={<WorkLayout />}>
        <Route index element={<WorkHome />} />
        <Route path="course" element={<MyCourse />} />
        <Route path="meet/edit" element={<WorkMeetEdit />} />
        <Route path="meet/time" element={<WorkMeetTime />} />
        <Route path="meet/joins" element={<WorkJoinList />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

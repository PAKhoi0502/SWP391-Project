import { Outlet } from 'react-router-dom'
import PublicPillNavbar from '../components/public/PublicPillNavbar'

function ProfileLayout() {
  return (
    <>
      <PublicPillNavbar />
      <Outlet />
    </>
  )
}

export default ProfileLayout

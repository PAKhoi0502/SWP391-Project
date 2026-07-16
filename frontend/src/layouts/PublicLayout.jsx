import { Outlet } from 'react-router-dom'
import PublicPillNavbar from '../components/public/PublicPillNavbar'

function PublicLayout() {
  return (
    <div className="public-layout">
      <PublicPillNavbar />
      <Outlet />
    </div>
  )
}

export default PublicLayout

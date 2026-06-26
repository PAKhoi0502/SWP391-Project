import { Link, Outlet } from 'react-router-dom'
import { storage } from '../utils/storage'
import './layout.css'

function PublicLayout() {
  const user = storage.getUser()

  return (
    <div className="public-layout">
      <header className="app-header">
        <Link className="app-brand" to="/">
          AutoWash Pro
        </Link>
        <nav className="app-nav" aria-label="Public navigation">
          <Link to="/">Trang chủ</Link>
          <Link to="/uikit">UI Kit</Link>
          {user ? <Link to={`/${String(user.role || 'customer').toLowerCase()}`}>Dashboard</Link> : <Link to="/login">Đăng nhập</Link>}
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="app-footer">© {new Date().getFullYear()} AutoWash Pro</footer>
    </div>
  )
}

export default PublicLayout

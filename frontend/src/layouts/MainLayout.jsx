// Main application layout: header + content area + footer.
// Child routes are rendered into <Outlet /> in the middle.
import { Link, Outlet } from 'react-router-dom'

function MainLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '12px 24px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none', color: '#111' }}>
          Audela Washing
        </Link>
        <nav style={{ display: 'flex', gap: 16 }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#374151' }}>
            Home
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>

      <footer
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #e5e7eb',
          color: '#777',
          fontSize: 14,
        }}
      >
        © {new Date().getFullYear()} Audela Washing
      </footer>
    </div>
  )
}

export default MainLayout

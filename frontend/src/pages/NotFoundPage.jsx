// 404 page - path not found.
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
      <p style={{ color: '#555' }}>The page you're looking for doesn't exist.</p>
      <Link to="/" style={{ color: '#3b82f6' }}>
        Back to home
      </Link>
    </div>
  )
}

export default NotFoundPage

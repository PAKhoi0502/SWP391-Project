import { Link } from 'react-router-dom'
import { getRedirectPathByRole, useAuth } from '../contexts/AuthContext'

function ForbiddenPage() {
  const { role, isAuthenticated } = useAuth()

  const dashboardPath = isAuthenticated
    ? getRedirectPathByRole(role)
    : '/login'

  return (
    <section className="state-page">
      <h1>403</h1>
      <p>You do not have permission to access this page.</p>

      <Link to={dashboardPath}>
        {isAuthenticated ? 'Back to dashboard' : 'Sign in'}
      </Link>
    </section>
  )
}

export default ForbiddenPage
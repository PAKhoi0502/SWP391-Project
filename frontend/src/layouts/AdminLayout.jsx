import { ROLES } from '../constants/roles'
import DashboardLayout from './DashboardLayout'

function AdminLayout() {
  return <DashboardLayout role={ROLES.ADMIN} />
}

export default AdminLayout

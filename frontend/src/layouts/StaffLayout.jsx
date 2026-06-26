import { ROLES } from '../constants/roles'
import DashboardLayout from './DashboardLayout'

function StaffLayout() {
  return <DashboardLayout role={ROLES.STAFF} />
}

export default StaffLayout

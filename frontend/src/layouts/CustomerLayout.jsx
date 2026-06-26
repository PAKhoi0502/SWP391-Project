import { ROLES } from '../constants/roles'
import DashboardLayout from './DashboardLayout'

function CustomerLayout() {
  return <DashboardLayout role={ROLES.CUSTOMER} />
}

export default CustomerLayout

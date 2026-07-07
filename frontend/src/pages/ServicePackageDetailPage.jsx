import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getErrorMessage,
  getPackageDuration,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackageById,
} from '../services/servicePackageApi'
import './ServicePackagePage.css'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

export default function ServicePackageDetailPage() {
  const { id } = useParams()
  const [servicePackage, setServicePackage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true)
        setError('')
        const data = await getServicePackageById(id)
        setServicePackage(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Không thể tải chi tiết gói dịch vụ'))
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [id])

  if (loading) {
    return <div className="service-package-page">Đang tải chi tiết gói dịch vụ...</div>
  }

  if (error) {
    return (
      <div className="service-package-page">
        <div className="service-package-alert error">{error}</div>
        <Link className="service-package-ghost-btn" to="/customer/service-packages">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  if (!servicePackage) {
    return <div className="service-package-page">Không tìm thấy gói dịch vụ.</div>
  }

  const price = getPackagePrice(servicePackage)
  const duration = getPackageDuration(servicePackage)
  const includedServices =
    servicePackage.includedServices ||
    servicePackage.services ||
    servicePackage.serviceItems ||
    []

  const steps =
    servicePackage.stepsTemplate ||
    servicePackage.stepTemplates ||
    servicePackage.steps ||
    []

  return (
    <div className="service-package-page">
      <Link className="service-package-ghost-btn" to="/customer/service-packages">
        ← Quay lại danh sách
      </Link>

      <section className="service-package-hero" style={{ marginTop: 16 }}>
        <div>
          <p className="service-package-kicker">{getPackageType(servicePackage)}</p>
          <h1>{getPackageName(servicePackage)}</h1>
          <p>{servicePackage.description || 'Thông tin chi tiết gói dịch vụ chăm sóc xe.'}</p>
        </div>

        <div className="service-package-stats">
          <div className="service-package-stat">
            <span>Giá</span>
            <strong>{money.format(Number(price) || 0)}</strong>
          </div>
          <div className="service-package-stat">
            <span>Thời lượng</span>
            <strong>{duration || '-'} phút</strong>
          </div>
          <div className="service-package-stat">
            <span>Loại xe</span>
            <strong>{formatVehicleType(servicePackage.vehicleType)}</strong>
          </div>
        </div>
      </section>

      <section className="service-package-panel">
        <div className="service-package-panel-header">
          <div>
            <h2>Dịch vụ bao gồm</h2>
            <p>Các dịch vụ nằm trong gói này.</p>
          </div>
        </div>

        {includedServices.length === 0 ? (
          <div className="service-package-empty">Chưa có danh sách dịch vụ kèm theo.</div>
        ) : (
          <div className="service-package-grid">
            {includedServices.map((item, index) => (
              <div className="service-package-card" key={item.id || item.serviceId || index}>
                <h3>{item.name || item.serviceName || `Dịch vụ ${index + 1}`}</h3>
                <p className="service-package-desc">{item.description || item.note || 'Dịch vụ trong gói.'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="service-package-panel">
        <div className="service-package-panel-header">
          <div>
            <h2>Quy trình thực hiện</h2>
            <p>Steps template của gói dịch vụ.</p>
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="service-package-empty">Chưa có steps template.</div>
        ) : (
          <div className="service-package-grid">
            {steps.map((step, index) => (
              <div className="service-package-card" key={step.id || index}>
                <span className="service-package-pill">Bước {index + 1}</span>
                <h3>{step.title || step.name || step.stepName || `Bước ${index + 1}`}</h3>
                <p className="service-package-desc">
                  {step.description || step.note || String(step)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function formatVehicleType(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'CAR') return 'Ô tô'
  if (normalized === 'BIKE' || normalized === 'MOTORBIKE') return 'Xe máy'
  return 'Mọi loại xe'
}
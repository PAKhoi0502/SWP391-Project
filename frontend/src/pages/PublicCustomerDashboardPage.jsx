import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { TierGemIcon, getTierColor } from '../components/common/TierGem'
import PublicReviewShowcase from '../components/reviews/PublicReviewShowcase'
import './PublicCustomerDashboardPage.css'

function CountUpNumber({ num, suffix = '', decimals = 0 }) {
  const spanRef = useRef(null)
  const hasRun = useRef(false)

  const fmt = (n) =>
    decimals > 0
      ? n.toFixed(decimals) + suffix
      : Math.round(n).toLocaleString('en-US') + suffix

  useEffect(() => {
    const el = spanRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRun.current) return
        hasRun.current = true
        observer.disconnect()
        const duration = 1400
        const start = performance.now()
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1)
          const ease = 1 - (1 - t) ** 3
          el.textContent = fmt(num * ease)
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [num, suffix, decimals])

  return <span ref={spanRef}>{fmt(num)}</span>
}

const Icon = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11l1.7-4.3A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.2L19 11"/>
      <path d="M3 11h18v5.2a.8.8 0 0 1-.8.8H18"/>
      <path d="M6 17H3.8a.8.8 0 0 1-.8-.8V11"/>
      <circle cx="7.5" cy="17" r="1.7"/>
      <circle cx="16.5" cy="17" r="1.7"/>
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c0-8 6-13 15-13 0 9-5 14-13 14a6 6 0 0 1-2-1z"/>
      <path d="M9.5 17.5c2.3-4 4.7-6 7.5-7.4"/>
    </svg>
  ),
  badge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3.6"/>
      <path d="M3.6 20a6.5 6.5 0 0 1 11.6-4"/>
      <path d="M15.8 18.4l1.9 1.9 3.7-4.1"/>
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  ),
}

const PROCESS_STEPS = [
  { id: 1, icon: Icon.calendar, title: 'Book Appointment' },
  { id: 2, icon: Icon.car,      title: 'Vehicle Inspection' },
  { id: 3, icon: Icon.leaf,     title: 'Wash & Care' },
  { id: 4, icon: Icon.badge,    title: 'QA & Handover' },
]

const SERVICES = [
  {
    icon: Icon.car,
    title: 'Basic Wash',
    desc: 'Full exterior wash, window clean, and wheel scrub. Perfect for everyday upkeep.',
    badge: 'Popular',
    color: '#6EC2F7',
  },
  {
    icon: Icon.sparkle,
    title: 'Premium Wash',
    desc: 'Exterior wash + interior polish, leather seat cleaning, and full deodorising.',
    badge: 'Recommended',
    color: '#a78bfa',
  },
  {
    icon: Icon.shield,
    title: 'Full Detail',
    desc: 'VIP package including ceramic coating, scratch protection, and long-term paint care.',
    badge: 'Premium',
    color: '#f59e0b',
  },
  {
    icon: Icon.leaf,
    title: 'Eco Wash',
    desc: 'Water-saving techniques and biodegradable solutions — clean car, clean planet.',
    badge: 'Eco',
    color: '#34d399',
  },
]

const TIERS = [
  { name: 'BRONZE',   desc: 'For new members · earn points every wash · ×1.0 multiplier' },
  { name: 'SILVER',   desc: '×1.2 point multiplier · book up to 10 days ahead' },
  { name: 'GOLD',     desc: '×1.35 point multiplier · book up to 12 days ahead · up to 2 queued bookings' },
  { name: 'PLATINUM', desc: '×1.5 point multiplier · book up to 14 days ahead · up to 3 queued bookings' },
]

const STATS = [
  { num: 5000,  suffix: '+',  decimals: 0, label: 'Happy customers' },
  { num: 50000, suffix: '+',  decimals: 0, label: 'Washes completed' },
  { num: 4.9,   suffix: '★',  decimals: 1, label: 'Average rating' },
  { num: 12,    suffix: '+',  decimals: 0, label: 'Garages across the city' },
]


export default function PublicCustomerDashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    const els = document.querySelectorAll('[data-animate]')
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pcd-anim-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.10 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleBookingClick = () => {
    if (!loading && isAuthenticated) {
      navigate('/booking')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="pcd-page">

      {/* ── HERO (includes process) ── */}
      <section className="pcd-hero" id="process">
        {/* img sets the natural height — no cropping */}
        <img src="/images/Hero1.jpg" className="pcd-hero-img" alt="" aria-hidden="true" />

        {/* overlay + content float on top */}
        <div className="pcd-hero-inner">
          <div className="pcd-hero-overlay" aria-hidden="true" />

          <div className="pcd-hero-content">
            <div className="pcd-hero-badge">
              <span className="pcd-hero-badge-dot" aria-hidden="true" />
              Premium Car Wash Service
            </div>

            <h1 className="pcd-hero-title">
              Giving every vehicle<br />
              <span className="pcd-hero-accent">the ultimate premium look</span>
            </h1>

            <div className="pcd-hero-actions">
              <button className="pcd-btn pcd-btn-primary" type="button" onClick={handleBookingClick}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
                  <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
                </svg>
                Book now
              </button>
              <button
                className="pcd-btn pcd-btn-ghost"
                type="button"
                onClick={() => {
                  const el = document.getElementById('services')
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 80
                    window.scrollTo({ top: y, behavior: 'smooth' })
                  }
                }}
              >
                View services
              </button>
            </div>
          </div>

          <div className="pcd-hero-process">
            <h2 className="pcd-process-title">Our Wash Process</h2>
            <p className="pcd-process-sub">Simple · Fast · Professional</p>
            <div className="pcd-process-steps">
              {PROCESS_STEPS.map((step) => (
                <div className="pcd-process-step" key={step.id}>
                  <div className="pcd-process-circle">
                    <span className="pcd-process-icon">{step.icon}</span>
                  </div>
                  <h3 className="pcd-process-step-title">{step.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="pcd-stats-section">
        <div className="pcd-stats-grid">
          {STATS.map((s, i) => (
            <div
              className="pcd-stat-card"
              key={s.label}
              data-animate
              style={{ '--anim-delay': `${i * 0.08}s` }}
            >
              <div className="pcd-stat-value">
                <CountUpNumber num={s.num} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="pcd-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="pcd-section" id="services">
        <div className="pcd-section-inner">
          <div className="pcd-section-header">
            <p className="pcd-section-eyebrow">Services</p>
            <h2 className="pcd-section-title">Wash packages for every need</h2>
            <p className="pcd-section-sub">
              From a quick everyday wash to a full detailing session — pick the package that suits you best.
            </p>
          </div>
          <div className="pcd-services-grid">
            {SERVICES.map((svc, i) => (
              <div
                className="pcd-service-card"
                key={svc.title}
                style={{ '--svc-color': svc.color }}
              >
                <div className="pcd-service-icon-wrap">{svc.icon}</div>
                {svc.badge && <span className="pcd-service-badge">{svc.badge}</span>}
                <h3 className="pcd-service-title">{svc.title}</h3>
                <p className="pcd-service-desc">{svc.desc}</p>
                <button className="pcd-service-cta" type="button" onClick={handleBookingClick}>
                  Book now →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MEMBERSHIP TIERS ── */}
      <section className="pcd-section pcd-section-alt" id="membership">
        <div className="pcd-section-inner">
          <div className="pcd-section-header" data-animate>
            <p className="pcd-section-eyebrow">Membership</p>
            <h2 className="pcd-section-title">Tiers & exclusive perks</h2>
            <p className="pcd-section-sub">
              Earn points with every wash — level up and unlock better rewards as you go.
            </p>
          </div>
          <div className="pcd-tiers-grid">
            {TIERS.map((tier, i) => (
              <div
                className="pcd-tier-card"
                key={tier.name}
                style={{ '--tier-color': getTierColor(tier.name), '--anim-delay': `${i * 0.09}s` }}
              >
                <div className="pcd-tier-gem">
                  <TierGemIcon tier={tier.name} size={32} />
                </div>
                <div className="pcd-tier-name">{tier.name}</div>
                <p className="pcd-tier-desc">{tier.desc}</p>
              </div>
            ))}
          </div>
          <div className="pcd-tiers-cta">
            <button className="pcd-btn pcd-btn-primary" type="button" onClick={() => navigate('/register')}>
              Join for free
            </button>
          </div>
        </div>
      </section>

      {/* ── CUSTOMER REVIEWS — before footer ── */}
      <PublicReviewShowcase />

      {/* ── FOOTER ── */}
      <footer className="pcd-footer">
        <div className="pcd-footer-inner">
          <div className="pcd-footer-grid">
            <div className="pcd-footer-intro">
              <Link className="pcd-footer-brand" to="/" aria-label="Audela Washing home">
                <svg width="25" height="18" viewBox="0 0 48 32" fill="none" aria-hidden="true">
                  <path d="M5 8 Q14 2 24 8 Q34 14 43 8" stroke="#73dcff" strokeWidth="3.8" strokeLinecap="round"/>
                  <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2ec2f7" strokeWidth="2.8" strokeLinecap="round"/>
                  <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#b7ecff" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
                <span>Audela Washing</span>
              </Link>
              <p>Premium car care, made simple.</p>
              <Link className="pcd-footer-book" to="/booking">Book a wash <span aria-hidden="true">→</span></Link>
            </div>

            <nav className="pcd-footer-column" aria-label="Explore Audela Washing">
              <h3>Explore</h3>
              <Link to="/customer/service-packages">Services</Link>
              <Link to="/customer/garages">Garages</Link>
              <Link to="/customer/leaderboard">Leaderboard</Link>
            </nav>

            <nav className="pcd-footer-column" aria-label="Customer support">
              <h3>Support</h3>
              <Link to="/about">About Us</Link>
              <Link to="/customer/booking-history">Booking History</Link>
              <Link to="/customer/promotions">Promotions</Link>
            </nav>

            <div className="pcd-footer-column pcd-footer-contact">
              <h3>Contact</h3>
              <a href="mailto:audelabooking@gmail.com">audelabooking@gmail.com</a>
              <a href="tel:+84984643093">0984 643 093</a>
            </div>
          </div>

          <div className="pcd-footer-bottom">
            <p className="pcd-footer-copy">© {new Date().getFullYear()} Audela Washing. All rights reserved.</p>
            <Link to="/about">Care in every detail.</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

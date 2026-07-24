import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookingEntry } from '../hooks/useBookingEntry'
import './AboutUsPage.css'

/* ── Scroll-reveal ── */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('au-visible'); obs.unobserve(e.target) }
      }),
      { threshold: 0.10 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

/* ── Count-up ── */
function CountUp({ num, suffix = '', decimals = 0 }) {
  const ref = useRef(null)
  const ran = useRef(false)
  const fmt = (n) =>
    decimals > 0 ? n.toFixed(decimals) + suffix : Math.round(n).toLocaleString('en-US') + suffix

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(num); return }
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || ran.current) return
      ran.current = true; obs.disconnect()
      const duration = 1600; const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        el.textContent = fmt(num * (1 - (1 - t) ** 3))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [num, suffix, decimals])

  return <span ref={ref}>{fmt(num)}</span>
}

/* ── Data ── */
const MANIFESTO_LINES = [
  'A clean car is more than appearance.',
  'It\'s respect — for the vehicle, for yourself.',
  'We believe that.',
]

const PILLARS = [
  {
    num: '01',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
      </svg>
    ),
    title: 'Quality is never negotiable',
    body: 'Every step of our process is tightly controlled — from the chemicals we use, to water pressure, to processing time. There is no room for shortcuts.',
    accent: '#2EC2F7',
    glow: 'rgba(46,194,247,0.18)',
  },
  {
    num: '02',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    title: 'Transparent from start to finish',
    body: 'Clear pricing before we begin. No hidden fees. No add-ons you didn\'t ask for. You know exactly what you\'re getting.',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.18)',
  },
  {
    num: '03',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: 'Fast — but never rushed',
    body: 'We respect your time. Easy booking, quick turnaround — but we never cut corners to save a few minutes.',
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
  },
  {
    num: '04',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19c0-8 6-13 15-13 0 9-5 14-13 14a6 6 0 0 1-2-1z"/>
        <path d="M9.5 17.5c2.3-4 4.7-6 7.5-7.4"/>
      </svg>
    ),
    title: 'Responsibility for the environment',
    body: 'Water recycling technology, fully biodegradable chemicals. A clean car shouldn\'t come at the cost of a clean planet.',
    accent: '#f59e0b',
    glow: 'rgba(245,158,11,0.18)',
  },
]

const STATS = [
  { num: 5000,  suffix: '+', decimals: 0, label: 'Happy customers' },
  { num: 50000, suffix: '+', decimals: 0, label: 'Washes completed' },
  { num: 4.9,   suffix: '★', decimals: 1, label: 'Average rating' },
  { num: 12,    suffix: '+', decimals: 0, label: 'Garages city-wide' },
]

const PROMISES = [
  { icon: '◈', text: 'Your car is handled the right way — no shortcuts taken' },
  { icon: '◈', text: 'Chemicals safe for paint, glass, and leather seats' },
  { icon: '◈', text: 'If it\'s not right, we redo it — free of charge' },
  { icon: '◈', text: 'Flexible booking, no cancellation fee within 24 hours' },
]

export default function AboutUsPage() {
  const navigate = useNavigate()
  const handleBookingEntry = useBookingEntry()
  useScrollReveal()

  return (
    <div className="au-page">

      {/* ══ HERO — full bleed, Hero1.jpg ══ */}
      <section className="au-hero">
        <div className="au-hero-bg" aria-hidden="true" />
        <div className="au-hero-content">
          <div className="au-hero-label" data-reveal>About Audela Washing</div>
          <h1 className="au-hero-headline" data-reveal>
            We don&apos;t just<br />
            <em>wash cars.</em>
          </h1>
          <p className="au-hero-sub" data-reveal>
            We care about every detail — delivering the finish your vehicle deserves, and the trust you&apos;ve earned.
          </p>
        </div>
        <div className="au-hero-wave" aria-hidden="true">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none">
            <path d="M0,36 C480,72 960,0 1440,36 L1440,72 L0,72 Z" fill="#060e1c"/>
          </svg>
        </div>
      </section>

      {/* ══ MANIFESTO ══ */}
      <section className="au-manifesto">
        <div className="au-manifesto-inner">
          {MANIFESTO_LINES.map((line, i) => (
            <p
              key={i}
              className="au-manifesto-line"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.14}s` }}
            >
              {line}
            </p>
          ))}
          <div className="au-manifesto-rule" data-reveal style={{ '--reveal-delay': '0.45s' }} />
          <p className="au-manifesto-note" data-reveal style={{ '--reveal-delay': '0.55s' }}>
            That&apos;s why every service we build is centred around standards — not speed.
          </p>
        </div>
      </section>

      {/* ══ PILLARS ══ */}
      <section className="au-pillars">
        <div className="au-section-inner">
          <div className="au-pillars-header" data-reveal>
            <span className="au-eyebrow">Principles</span>
            <h2 className="au-section-title">Four things we never compromise on</h2>
          </div>
          <div className="au-pillars-grid">
            {PILLARS.map((p, i) => (
              <div
                key={p.num}
                className="au-pillar-card"
                data-reveal
                style={{
                  '--reveal-delay': `${i * 0.1}s`,
                  '--pa': p.accent,
                  '--pg': p.glow,
                }}
              >
                <div className="au-pillar-card-top">
                  <div className="au-pillar-icon">{p.icon}</div>
                  <span className="au-pillar-num">{p.num}</span>
                </div>
                <h3 className="au-pillar-title">{p.title}</h3>
                <p className="au-pillar-desc">{p.body}</p>
                <div className="au-pillar-bar" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section className="au-stats">
        <div className="au-section-inner">
          <p className="au-eyebrow au-eyebrow--center" data-reveal>By the numbers</p>
          <div className="au-stats-grid">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="au-stat"
                data-reveal
                style={{ '--reveal-delay': `${i * 0.09}s` }}
              >
                <div className="au-stat-num">
                  <CountUp num={s.num} suffix={s.suffix} decimals={s.decimals} />
                </div>
                <div className="au-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SPLIT — How we think ══ */}
      <section className="au-split">
        <div className="au-section-inner">
          <div className="au-split-grid">
            <div className="au-split-img-col" data-reveal>
              <div className="au-split-frame">
                <img src="/images/Hero1.jpg" alt="Audela Washing" className="au-split-img" />
                <div className="au-split-overlay" aria-hidden="true" />
                <div className="au-split-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Quality guarantee</span>
                </div>
              </div>
            </div>
            <div className="au-split-text" data-reveal style={{ '--reveal-delay': '0.12s' }}>
              <span className="au-eyebrow">Philosophy</span>
              <h2 className="au-section-title">
                A clean car<br />
                says a lot
              </h2>
              <p className="au-split-body">
                When you get into a car that&apos;s been properly looked after — you feel something different. Not just clean. Cared for.
              </p>
              <p className="au-split-body">
                We built Audela Washing around that feeling. Every action, every product, every second spent on your car is deliberate.
              </p>
              <div className="au-split-promises">
                {PROMISES.map((pr) => (
                  <div key={pr.text} className="au-promise-row">
                    <span className="au-promise-icon" aria-hidden="true">{pr.icon}</span>
                    <span className="au-promise-text">{pr.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="au-cta">
        <div className="au-cta-bg" aria-hidden="true" />
        <div className="au-cta-inner" data-reveal>
          <span className="au-eyebrow au-eyebrow--glow">Start today</span>
          <h2 className="au-cta-headline">
            Your car deserves<br />better care.
          </h2>
          <div className="au-cta-actions">
            <button className="au-cta-btn au-cta-btn--primary" onClick={() => handleBookingEntry()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
                <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
              </svg>
              Book now
            </button>
            <button className="au-cta-btn au-cta-btn--ghost" onClick={() => navigate('/customer/service-packages')}>
              View service packages →
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}

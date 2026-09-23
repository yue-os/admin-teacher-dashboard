import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '../assets/hero.png'
import './HomePage.css'

const ROLE_DATA = [
  {
    id: 'admin',
    label: '01',
    title: 'Admin command center',
    description: 'Keep every class, account, and game session moving in the same direction.',
    icon: '✦',
    accent: 'cyan',
    status: 'Full oversight',
    capabilities: [
      { title: 'User management', description: 'Create, organize, and support accounts for students, teachers, and parents.' },
      { title: 'Real-time analytics', description: 'Monitor participation and game activity across the whole platform.' },
      { title: 'Class orchestration', description: 'Coordinate classes, groups, and educational leaders from one place.' },
      { title: 'Platform settings', description: 'Shape permissions, game rules, and shared settings for the whole community.' }
    ]
  },
  {
    id: 'teacher',
    label: '02',
    title: 'Teacher command center',
    description: 'Turn a lesson into a shared mission with simple tools for play, progress, and connection.',
    icon: '◒',
    accent: 'emerald',
    status: 'Ready to teach',
    capabilities: [
      { title: 'Host game lobbies', description: 'Launch and manage social deduction sessions with your class.' },
      { title: 'Track student progress', description: 'Review performance and social interaction patterns over time.' },
      { title: 'Class communication', description: 'Keep students and guardians connected around every lesson.' },
      { title: 'Quiz Creator', description: 'Build and customize game quizzes that turn your curriculum into playable missions.' }
    ]
  },
  {
    id: 'parent',
    label: '03',
    title: 'Parent command center',
    description: 'See the bigger picture of your child\'s learning, confidence, and collaboration.',
    icon: '◌',
    accent: 'orange',
    status: 'Stay connected',
    capabilities: [
      { title: 'Child monitoring', description: 'View activity summaries and game-based learning outcomes.' },
      { title: 'Direct messaging', description: 'Stay in a secure communication channel with classroom teachers.' },
      { title: 'Achievement records', description: 'Celebrate milestones and follow your child\'s social growth.' },
      { title: 'Learning updates', description: 'Keep up with new missions, classroom moments, and next steps.' }
    ]
  }
]

function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openCapability, setOpenCapability] = useState(null)

  const closeMenu = () => setIsMenuOpen(false)

  const toggleCapability = (roleId, capabilityIndex) => {
    const capabilityId = `${roleId}-${capabilityIndex}`
    setOpenCapability((current) => current === capabilityId ? null : capabilityId)
  }

  const downloadBtnRef = useRef(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://static.itch.io/api.js'
    script.async = true
    
    script.onload = () => {
      if (window.Itch && downloadBtnRef.current) {
        window.Itch.attachBuyButton(downloadBtnRef.current, {
          user: "grahambel",
          game: "batangaware"
        });
      }
    }
    
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="home-layout">
      <nav className="home-nav">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <img src="/batangaware-logo.png" alt="BatangAware" className="nav-logo" />
            <span className="nav-brand-copy">
              <span className="nav-brand-title">BatangAware</span>
            </span>
          </Link>
          <button
            type="button"
            className="nav-menu-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="home-navigation"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div id="home-navigation" className={`nav-links ${isMenuOpen ? 'is-open' : ''}`}>
            <a href="#roles" className="nav-link" onClick={closeMenu}>Roles</a>
            <Link to="/login" className="btn btn-secondary btn-small">Sign in</Link>
          </div>
        </div>
      </nav>

      <main className="home-hero">
        <div className="hero-content">
          <div className="hero-visual">
            <img src={heroImage} alt="BatangAware game" className="hero-image" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">BatangAware</p>
            <h1 className="hero-title">Education meets <span>social deduction.</span></h1>
            <p className="hero-subtitle">
              BatangAware is a multiplayer social deduction game where students collaborate, trade, and complete missions while uncovering hidden roles in a playful learning world.
            </p>
              <div className="hero-actions">
                <button
                  ref={downloadBtnRef}
                  className="btn btn-primary btn-large glow-cta"
                >
                  Download Game
                </button>
                <Link to="/login" className="btn btn-secondary btn-large">
                  Sign in
                </Link>
              </div>         
            </div>
        </div>
      </main>

      <section className="home-roles" id="roles">
        <div className="section-heading">
          <p className="eyebrow">One platform, three perspectives</p>
          <h2>Everyone has a role in the story.</h2>
        </div>
        <div className="role-feed">
          {ROLE_DATA.map((role) => (
            <article key={role.id} id={role.id} className={`role-card role-card-${role.accent}`}>
              <div className="role-sidebar">
                <div className="role-card-top">
                  <span className="role-number">{role.label}</span>
                  <span className="role-icon" aria-hidden="true">{role.icon}</span>
                </div>
                <span className="role-status">{role.status}</span>
                <h3>{role.title}</h3>
                <p>{role.description}</p>
              </div>
              <div className="role-body">
                <p className="capability-label">Capabilities</p>
                <div className="capability-list">
                  {role.capabilities.map((capability, index) => {
                    const capabilityId = `${role.id}-${index}`
                    const isOpen = openCapability === capabilityId

                    return (
                      <div key={capability.title} className={`capability-item ${isOpen ? 'is-open' : ''}`}>
                        <button
                          type="button"
                          className="capability-trigger"
                          aria-expanded={isOpen}
                          aria-controls={`${capabilityId}-description`}
                          onClick={() => toggleCapability(role.id, index)}
                        >
                          <span>{capability.title}</span>
                          <span className="capability-chevron" aria-hidden="true">⌄</span>
                        </button>
                        <div className="capability-panel" id={`${capabilityId}-description`}>
                          <p>{capability.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; 2026 BatangAware. All rights reserved.</p>
        <nav className="footer-links" aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  )
}

export default HomePage

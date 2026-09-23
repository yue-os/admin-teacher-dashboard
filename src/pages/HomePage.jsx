import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import RoleSection from '../components/RoleSection'
import { AdminVisual, TeacherVisual, ParentVisual } from '../components/RoleVisuals'
import './HomePage.css'

const HomeHeroCanvas = lazy(() => import('../components/HomeHeroCanvas'))

const ROLE_DATA = [
  {
    id: 'admin',
    title: 'Command Center for Admins',
    subtitle: 'Full oversight of the BatangAware ecosystem.',
    visual: AdminVisual,
    features: [
      { icon: '👥', title: 'User Management', description: 'Create and manage accounts for students, teachers, and parents.' },
      { icon: '📊', title: 'Real-time Analytics', description: 'Monitor platform-wide engagement and game metrics.' },
      { icon: '🏫', title: 'Class Orchestration', description: 'Organize student groups and assign educational leaders.' }
    ]
  },
  {
    id: 'teacher',
    title: 'Empowerment for Teachers',
    subtitle: 'Tools to guide learning through play.',
    visual: TeacherVisual,
    features: [
      { icon: '🎮', title: 'Host Game Lobbies', description: 'Launch and manage social deduction sessions effortlessly.' },
      { icon: '📈', title: 'Progress Tracking', description: 'Analyze student performance and social interaction patterns.' },
      { icon: '💬', title: 'Class Communication', description: 'Stay connected with students and their guardians.' }
    ],
    reverse: true
  },
  {
    id: 'parent',
    title: 'Insights for Parents',
    subtitle: 'Stay involved in your child\'s development.',
    visual: ParentVisual,
    features: [
      { icon: '🧿', title: 'Child Monitoring', description: 'View activity summaries and game-based learning outcomes.' },
      { icon: '📧', title: 'Direct Messaging', description: 'Secure communication channel with classroom teachers.' },
      { icon: '🏆', title: 'Achievement Records', description: 'Celebrate your child\'s milestones and social growth.' }
    ]
  }
]

function HomePage() {
  const sectionRefs = useRef([])
  const bgRef = useRef(null)
  const keyboardNavLockRef = useRef(false)
  const keyboardNavTimerRef = useRef(null)
  const keyboardSectionIndexRef = useRef(0)

  useEffect(() => {
    if (window.innerWidth <= 768) return;
    let rafId = null
    let cachedMaxScroll = 1;

    // Cache the height ONLY when the window resizes, not every frame
    const updateMaxScroll = () => {
      cachedMaxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
    };
    
    updateMaxScroll();
    window.addEventListener('resize', updateMaxScroll, { passive: true });

    const handleScroll = () => {
      if (!bgRef.current) return
      if (rafId !== null) return

      rafId = window.requestAnimationFrame(() => {
        // Use the cached value instead of querying the DOM
        const scrollPct = Math.min(Math.max(window.scrollY / cachedMaxScroll, 0), 1)
        bgRef.current.style.setProperty('--scroll-progress', scrollPct)

        const perspective = 1000 - scrollPct * 300
        bgRef.current.style.perspective = `${perspective}px`
        rafId = null
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateMaxScroll)
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.15 }
    )

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const topOffset = 96
    const sectionSelectors = ['.home-hero', '#admin', '#teacher', '#parent']

    const isTypingTarget = (target) => {
      if (!target) return false
      const tagName = target.tagName
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
    }

    const getSectionPositions = () =>
      sectionSelectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .map((element) => element.offsetTop)

    const getClosestSectionIndex = (positions) => {
      const currentPosition = window.scrollY + topOffset
      let currentIndex = 0
      let smallestDistance = Number.POSITIVE_INFINITY

      for (let index = 0; index < positions.length; index += 1) {
        const distance = Math.abs(currentPosition - positions[index])
        if (distance < smallestDistance) {
          smallestDistance = distance
          currentIndex = index
        }
      }

      return currentIndex
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (event.defaultPrevented) return
      if (isTypingTarget(document.activeElement)) return
      if (event.repeat) {
        event.preventDefault()
        return
      }
      if (keyboardNavLockRef.current) {
        event.preventDefault()
        return
      }

      const positions = getSectionPositions()
      if (!positions.length) return

      keyboardSectionIndexRef.current = getClosestSectionIndex(positions)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const targetIndex = keyboardSectionIndexRef.current + direction

      if (targetIndex < 0 || targetIndex >= positions.length) return

      event.preventDefault()
      keyboardNavLockRef.current = true
      keyboardSectionIndexRef.current = targetIndex
      window.scrollTo({
        top: Math.max(positions[targetIndex] - topOffset, 0),
        behavior: 'smooth',
      })

      if (keyboardNavTimerRef.current) {
        window.clearTimeout(keyboardNavTimerRef.current)
      }

      keyboardNavTimerRef.current = window.setTimeout(() => {
        keyboardNavLockRef.current = false
        keyboardNavTimerRef.current = null
      }, 420)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (keyboardNavTimerRef.current) {
        window.clearTimeout(keyboardNavTimerRef.current)
      }
      keyboardNavLockRef.current = false
      keyboardSectionIndexRef.current = 0
    }
  }, [])

  return (
    <div className="home-layout">
      <div className="immersive-bg" ref={bgRef}>
        <div className="mesh-gradient-base" />
        <div className="fluid-orbs">
          <div className="orb o1" />
          <div className="orb o2" />
          <div className="orb o3" />
        </div>
        <div className="perspective-grid" />
      </div>

      <Suspense fallback={<div className="home-canvas-bg hero-canvas-fallback" />}>
        <HomeHeroCanvas className="home-canvas-bg" />
      </Suspense>

      <div className="retro-grid" aria-hidden="true" />
      <div className="floating-particles" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <span key={i} style={{ '--index': i }} />
        ))}
      </div>

      <nav className="home-nav">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <img src="/batangaware-logo.png" alt="BatangAware" className="nav-logo" />
            <span className="nav-brand-copy">
              <span className="nav-brand-title neon-text">BatangAware</span>
              {/* <span className="nav-brand-subtitle">Multiplayer card game</span> */}
            </span>
          </Link>
          <div className="nav-links">
            <a href="#admin" className="nav-link">Admin</a>
            <a href="#teacher" className="nav-link">Teacher</a>
            <a href="#parent" className="nav-link">Parent</a>
            <Link to="/login" className="btn btn-secondary btn-small">Sign in</Link>
          </div>
        </div>
      </nav>

      <main className="home-hero">
        <div className="hero-content animate-in">
          <div className="hero-copy">
            <p className="eyebrow">BatangAware</p>
            <h1 className="hero-title">Education meets social deduction.</h1>
            <p className="hero-subtitle">
              BatangAware is a multiplayer social deduction game where students collaborate, trade, and complete missions while uncovering hidden roles in a playful learning world.
            </p>
            <div className="hero-actions">
              <a
                href="https://grahambel.itch.io/batangaware"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-large glow-cta"
              >
                Download Game
              </a>
              <Link to="/login" className="btn btn-secondary btn-large">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>

      <section className="home-roles" id="roles">
        <div className="background-decor">
          <div className="data-stream s1" />
          <div className="data-stream s2" />
        </div>
        {ROLE_DATA.map((role, idx) => (
          <div 
            key={role.id} 
            ref={el => sectionRefs.current[idx] = el} 
            className="reveal-section"
          >
            <RoleSection {...role} />
          </div>
        ))}
      </section>

      <footer className="home-footer">
        <p>&copy; 2026 BatangAware. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default HomePage

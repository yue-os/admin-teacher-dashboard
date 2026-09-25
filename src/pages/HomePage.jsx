import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import doctorImage from '../assets/DOCTOR.png'
import caretakerImage from '../assets/CARETAKER.png'
import guardImage from '../assets/GUARD.png'
import infectedImage from '../assets/INFECTED.png'
import studentImage from '../assets/STUDENT.png'
import vendorImage from '../assets/VENDOR.png'
import schoolImage from '../assets/SCHOOL.png'
import clinicImage from '../assets/CLINIC.png'
import marketImage from '../assets/MARKET.png'
import parkImage from '../assets/PARK.png'
import canteenImage from '../assets/CANTEEN.png'
import bookImage from '../assets/BOOK.png'
import cleaningKitImage from '../assets/CLEANING KIT.png'
import coinsImage from '../assets/COINS.png'
import disinfectantSprayImage from '../assets/DISINFECTANT SPRAY.png'
import faceShieldImage from '../assets/FACE SHIELD.png'
import glovesImage from '../assets/GLOVES.png'
import idBadgeImage from '../assets/ID BADGE.png'
import juiceImage from '../assets/JUICE.png'
import maskImage from '../assets/MASK.png'
import medKitImage from '../assets/MED KIT.png'
import medicineImage from '../assets/MEDICINE.png'
import notebookImage from '../assets/NOTEBOOK.png'
import packedLunchImage from '../assets/PACKED LUNCH.png'
import penImage from '../assets/PEN.png'
import sanitizerImage from '../assets/SANITIZER.png'
import snackImage from '../assets/SNACK.png'
import trashBagImage from '../assets/TRASH BAG.png'
import vitaminsImage from '../assets/VITAMINS.png'
import waterImage from '../assets/WATER.png'
import whistleImage from '../assets/WHISTLE.png'
import hp1Image from '../assets/hp1.jpg'
import hp2Image from '../assets/hp2.jpg'
import './HomePage.css'

const heroImages = [
  { src: hp1Image, alt: 'BatangAware game scene' },
  { src: hp2Image, alt: 'BatangAware gameplay' }
]

const roles = [
  { name: 'Doctor', image: doctorImage, description: 'Support the team and respond to health-aware missions.' },
  { name: 'Caretaker', image: caretakerImage, description: 'Help others stay prepared throughout the round.' },
  { name: 'Guard', image: guardImage, description: 'Watch the environment and protect your community.' },
  { name: 'Student', image: studentImage, description: 'Explore, collaborate, and complete your mission.' },
  { name: 'Vendor', image: vendorImage, description: 'Trade useful resources as the round unfolds.' },
  { name: 'Infected', image: infectedImage, description: 'Navigate hidden objectives while avoiding detection.' }
]

const locations = [
  { name: 'School', image: schoolImage },
  { name: 'Clinic', image: clinicImage },
  { name: 'Market', image: marketImage },
  { name: 'Park', image: parkImage },
  { name: 'Canteen', image: canteenImage }
]

const inventory = [
  ['Book', bookImage], ['Cleaning Kit', cleaningKitImage], ['Coins', coinsImage],
  ['Disinfectant Spray', disinfectantSprayImage], ['Face Shield', faceShieldImage], ['Gloves', glovesImage],
  ['ID Badge', idBadgeImage], ['Juice', juiceImage], ['Mask', maskImage], ['Med Kit', medKitImage],
  ['Medicine', medicineImage], ['Notebook', notebookImage], ['Packed Lunch', packedLunchImage], ['Pen', penImage],
  ['Sanitizer', sanitizerImage], ['Snack', snackImage], ['Trash Bag', trashBagImage], ['Vitamins', vitaminsImage],
  ['Water', waterImage], ['Whistle', whistleImage]
].map(([name, image]) => ({ name, image }))

const monitoringRoles = [
  {
    id: 'teacher',
    eyebrow: 'Teacher',
    title: 'Guide the classroom experience.',
    features: ['Create and manage game lobbies', 'Manage classes', 'Monitor student progress', 'Create quizzes', 'Send announcements', 'Communicate with parents'],
    href: '/teacher'
  },
  {
    id: 'parent',
    eyebrow: 'Parent',
    title: 'Stay connected.',
    features: ['View linked child information', 'Monitor gameplay progress', 'View learning updates', 'View achievements', 'Communicate with teachers'],
    href: '/parent'
  },
  {
    id: 'admin',
    eyebrow: 'Admin',
    title: 'Keep everything organized.',
    features: ['Manage users', 'Manage classes', 'Manage teachers and students', 'Monitor system activity', 'Manage platform settings'],
    href: '/admin'
  }
]

const playSteps = [
  ['01', 'Get your role', 'Your role and mission are randomly assigned.'],
  ['02', 'Discover', 'A random location or event determines what happens next.'],
  ['03', 'Interact', 'Trade, communicate, and complete activities with other players.'],
  ['04', 'Make decisions', 'Choose how you act while managing your health and resources.'],
  ['05', 'Stay aware', 'Complete your mission while protecting yourself and avoiding infection.']
]

function SectionHeading({ eyebrow, title, children, align = 'left' }) {
  return (
    <div className={`home-section-heading home-section-heading-${align}`}>
      {eyebrow && <p className="home-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children && <p className="home-section-lede">{children}</p>}
    </div>
  )
}

function GameCard({ item, variant = 'role' }) {
  return (
    <article className={`game-card game-card-${variant}`}>
      <div className="game-card-image-wrap">
        <img src={item.image} alt={item.name} className="game-card-image" />
      </div>
      <h3>{item.name}</h3>
      {item.description && <p>{item.description}</p>}
    </article>
  )
}

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % heroImages.length)
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [])

  const showPrevious = () => {
    setCurrentIndex((current) => (current - 1 + heroImages.length) % heroImages.length)
  }

  const showNext = () => {
    setCurrentIndex((current) => (current + 1) % heroImages.length)
  }

  return (
    <div className="hero-carousel" aria-label="BatangAware images">
      <img
        src={heroImages[currentIndex].src}
        alt={heroImages[currentIndex].alt}
        className="hero-image"
      />
      <button
        type="button"
        className="carousel-button carousel-button-previous"
        onClick={showPrevious}
        aria-label="Previous image"
      >
        &#8249;
      </button>
      <button
        type="button"
        className="carousel-button carousel-button-next"
        onClick={showNext}
        aria-label="Next image"
      >
        &#8250;
      </button>
      <div className="carousel-dots" aria-label="Choose image">
        {heroImages.map((image, index) => (
          <button
            key={image.src}
            type="button"
            className={`carousel-dot ${index === currentIndex ? 'is-active' : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === currentIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

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
            <a href="#game-elements" className="nav-link" onClick={closeMenu}>The game</a>
            <a href="#how-you-play" className="nav-link" onClick={closeMenu}>How it works</a>
            <a href="#monitoring-system" className="nav-link" onClick={closeMenu}>Monitoring</a>
            <Link to="/login" className="btn btn-secondary btn-small">Sign in</Link>
          </div>
        </div>
      </nav>

      <main className="home-main">
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="home-eyebrow">BatangAware</p>
            <h1 id="hero-title">Learn. Play. <span>Stay Aware.</span></h1>
            <p className="hero-subtitle">BatangAware is a multiplayer health-awareness game where students learn, interact, and make decisions while playing together.</p>
            <div className="hero-actions">
              <a href="https://grahambel.itch.io/batangaware" target="_blank" rel="noreferrer" className="home-button home-button-primary">Download Game</a>
              <a href="#game-elements" className="home-button home-button-secondary">Explore the Game</a>
            </div>
          </div>
          <div className="hero-visual"><ImageCarousel /></div>
        </section>

          <section className="intro-band" aria-labelledby="intro-title">
            <SectionHeading eyebrow="A game for curious minds" title="Play. Explore. Stay Aware." align="center">
              BatangAware combines multiplayer gameplay with health-awareness activities, giving students opportunities to learn while they play.
            </SectionHeading>
          </section>

          <section className="home-section game-elements" id="game-elements" aria-labelledby="game-elements-title">
            <SectionHeading eyebrow="Inside every round" title="Everything has a role.">
              Discover the characters, locations, and items that make every round different.
            </SectionHeading>

            <div className="element-group" id="roles">
              <div className="element-group-heading"><h3>Characters / Roles</h3><p>Every player receives a randomly assigned role with unique missions and objectives.</p></div>
              <div className="game-card-grid role-grid">{roles.map((role) => <GameCard key={role.name} item={role} />)}</div>
            </div>

            <div className="element-group location-group">
              <div className="element-group-heading"><h3>Locations</h3><p>Randomized locations and events keep every round unpredictable.</p></div>
              <div className="game-card-grid location-grid">{locations.map((location) => <GameCard key={location.name} item={location} variant="location" />)}</div>
            </div>

            <div className="element-group inventory-group">
              <div className="element-group-heading"><h3>Inventory</h3><p>Collect and use items to complete missions and make safer choices.</p></div>
              <div className="inventory-grid">{inventory.map((item) => <GameCard key={item.name} item={item} variant="inventory" />)}</div>
            </div>
          </section>

          <section className="home-section how-section" id="how-you-play" aria-labelledby="how-title">
            <SectionHeading eyebrow="The round unfolds" title="How You Play">
              A simple flow with plenty of room for teamwork, surprises, and smart decisions.
            </SectionHeading>
            <div className="steps-grid">
              {playSteps.map(([number, title, description]) => (
                <article className="step-item" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p></article>
              ))}
            </div>
          </section>

          <section className="random-section" aria-labelledby="random-title">
            <div className="random-copy"><p className="home-eyebrow">No two rounds feel alike</p><h2 id="random-title">Every round can be different.</h2><p>Random roles, locations, events, and player interactions create new situations to discover and respond to.</p></div>
            <div className="random-flow" aria-label="Randomized gameplay flow">
              {['Random role', 'Random location / event', 'Player interaction', 'Decisions', 'Different outcomes'].map((label, index) => <div className="random-flow-item" key={label}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}
            </div>
          </section>

          <section className="home-section monitoring-section" id="monitoring-system" aria-labelledby="monitoring-title">
            <SectionHeading eyebrow="Beyond the game" title="One game. Three perspectives.">
              BatangAware also provides a web-based monitoring system that connects the classroom, home, and school.
            </SectionHeading>
            <div className="monitoring-grid">
              {monitoringRoles.map((role) => (
                <article className={`monitoring-panel monitoring-panel-${role.id}`} key={role.id}>
                  <p className="panel-eyebrow">{role.eyebrow}</p><h3>{role.title}</h3>
                  <ul>{role.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  <Link to={role.href} className="text-link">Explore {role.eyebrow} Tools <span aria-hidden="true">-&gt;</span></Link>
                </article>
              ))}
            </div>
          </section>

          <section className="connection-section" aria-label="From playing to progress">
            <SectionHeading eyebrow="Learning in motion" title="From playing to progress." />
            <div className="connection-layout">
              <div className="connection-column"><p className="connection-label">Student game</p>{['Play', 'Complete missions', 'Answer quizzes', 'Interact', 'Make health-aware decisions'].map((item) => <div className="connection-step" key={item}>{item}</div>)}</div>
              <div className="connection-arrow" aria-hidden="true">&darr;</div>
              <div className="connection-column connection-column-result"><p className="connection-label">Monitoring system</p><div className="monitoring-audience"><span>Teacher</span><span>Parent</span><span>Admin</span></div><p>Progress<br />Learning information<br />Gameplay records</p></div>
            </div>
          </section>

          <section className="home-section why-section" id="why-batangaware" aria-labelledby="why-title">
            <SectionHeading eyebrow="Why it matters" title="Why BatangAware?" />
            <div className="why-grid">
              <article><span className="why-number">01</span><h3>Learn through play</h3><p>Health-awareness concepts are introduced through interactive gameplay.</p></article>
              <article><span className="why-number">02</span><h3>Make decisions</h3><p>Players experience different situations and make choices throughout the game.</p></article>
              <article><span className="why-number">03</span><h3>Play together</h3><p>Multiplayer interaction encourages communication, observation, and social decision-making.</p></article>
            </div>
          </section>

          <section className="final-cta" aria-labelledby="final-cta-title">
            <div><p className="home-eyebrow">Ready for the next round?</p><h2 id="final-cta-title">Learn. Play. Stay Aware.</h2><p>Discover BatangAware and experience health awareness through multiplayer play, interaction, and decision-making.</p></div>
            <div className="hero-actions"><a href="https://grahambel.itch.io/batangaware" target="_blank" rel="noreferrer" className="home-button home-button-primary">Download Game</a><a href="#monitoring-system" className="home-button home-button-secondary">Explore the Monitoring System</a></div>
          </section>
      </main>

      <footer className="home-footer">
        <div className="footer-brand"><img src="/batangaware-logo.png" alt="BatangAware" className="nav-logo" /><div><strong>BatangAware</strong><span>Learn. Play. Stay Aware.</span></div></div>
        <nav className="footer-links" aria-label="Footer"><a href="#game-elements">Game</a><a href="#how-you-play">How It Works</a><a href="#monitoring-system">Monitoring System</a><a href="#why-batangaware">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
        <p className="footer-copyright">&copy; 2026 BatangAware. All rights reserved.</p>
      </footer>

      <a
        href="https://grahambel.itch.io/batangaware"
        target="_blank"
        rel="noreferrer"
        className="floating-download"
        aria-label="Download BatangAware game"
      >
        <span aria-hidden="true">↓</span>
        Download Game
      </a>
    </div>
  )
}

export default HomePage

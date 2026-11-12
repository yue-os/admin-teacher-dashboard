import { useState } from 'react'
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
import './HomePage.css'
import FannedCardDeck from '../components/FannedCardDeck'
import InventoryDeck from '../components/InventoryDeck'
import RoleRevealCard from '../components/RoleRevealCard'
import RoleMissionPreview from '../components/RoleMissionPreview'
import LocationPreview from '../components/LocationPreview'
import HowYouPlayStepper from '../components/HowYouPlayStepper'
import ReplayabilityPanel from '../components/ReplayabilityPanel'
import StudentProgressPanel from '../components/StudentProgressPanel'

const roles = [
  { name: 'Doctor', image: doctorImage, borderColor: '#a87545', badge: 'Public Role - Immune', description: 'Help players recover and supply medical items.', missions: ['Trade Medicine to a Weak or Sick player', 'Collect a Medical Kit'], ability: 'Group Heal', cooldown: '45s', abilityEffect: '+10 HP healed for players in your location.' },
  { name: 'Caretaker', image: caretakerImage, borderColor: '#3f875d', badge: 'Public Role', description: 'Sanitize locations to reduce environmental risk.', missions: ['Collect Cleaning Kit, Trash Bag, & Gloves', 'Sanitize 3 unique locations', 'Complete 2 safe trades in risky areas'], ability: 'Sanitize', cooldown: '3 Rounds', abilityEffect: 'Sanitizing lowers outbreak exposure in this location through the next round.' },
  { name: 'Guard', image: guardImage, borderColor: '#354052', badge: 'Public Role', description: 'Control risky exchanges and check on ill players.', missions: ['Restrict trade during a high-risk round', 'Whisper 2 Weak or Sick players', 'Hold an ID Badge and Whistle'], ability: 'Restrict Trade', cooldown: '4 Rounds', abilityEffect: 'Trades are restricted during a high-risk round.' },
  { name: 'Student', image: studentImage, borderColor: '#3b72bf', badge: 'Public Role', description: 'Learn, gather school supplies, and stay healthy.', missions: ['Complete 2 quizzes consecutively', 'Collect Notebook, Pen, and Book', 'Finish Healthy (80-100 HP)'], ability: 'Study', cooldown: '20s', abilityEffect: 'Study activated: restore +5 HP.' },
  { name: 'Vendor', image: vendorImage, borderColor: '#c79328', badge: 'Public Role', description: 'Trade often and build supplies for the group.', missions: ['Accumulate coins', 'Collect Snacks, Drinks, & Packed Meals', 'Complete 5 successful trades'], ability: 'Trade Bonus', cooldown: '2 Rounds', abilityEffect: 'Trade Bonus activated: earn extra coins from trades.' },
  { name: 'Infected', image: infectedImage, borderColor: '#a33142', badge: 'Hidden Carrier / Cover: Student', isHidden: true, description: 'Blend in with your regular cover identity while pursuing secret goals.', missions: ['Complete 1 cover-role mission', 'Make 3 safe trades while Weak without spreading', 'Avoid Critical health'], ability: 'Cough Cue', cooldown: '15s', abilityEffect: 'Cough cue sent to nearby players.' }
]

const locations = [
  { name: 'School', image: schoolImage, risk: 0.5, definition: 'Medium Risk. Take the 5-question Influenza Awareness Quiz to earn coins and +2 health.' },
  { name: 'Clinic', image: clinicImage, risk: 0.1, definition: 'Low Risk. Medical shop offering Medicine, Vitamins, Medical Kit, Mask, and Sanitizer.' },
  { name: 'Market', image: marketImage, risk: 0.5, definition: 'Medium Risk. Card shop offering 3 randomized items from the supply pool.' },
  { name: 'Park', image: parkImage, risk: 0.2, definition: 'Low Risk. Complete the 6-card memory matching game to earn coins and a random item.' },
  { name: 'Canteen', image: canteenImage, risk: 0.9, definition: 'Very High Risk. High outbreak exposure, but sells Snacks, Drinks, and Packed Meals for health recovery.' }
]

const inventory = [
  ['Book', bookImage, 'Student Supplies: collect this book for your school-supply mission checklist.'],
  ['Cleaning Kit', cleaningKitImage, 'Caretaker gear: sanitize locations to lower outbreak exposure through the next round and fulfill your cleaning-supply checklist.'],
  ['Coins', coinsImage, 'Food and trade: spend coins on supplies and build your total for coin-based missions.'],
  ['Disinfectant Spray', disinfectantSprayImage, 'Protection & Recovery: disinfect shared surfaces to help reduce transmission risk during trades.'],
  ['Face Shield', faceShieldImage, 'Protection & Recovery: use this protective gear as part of your prevention mission checklist.'],
  ['Gloves', glovesImage, 'Caretaker gear: collect gloves to complete your cleaning-supply mission checklist.'],
  ['ID Badge', idBadgeImage, 'Guard gear: collect the ID Badge to fulfill your role mission checklist.'],
  ['Juice', juiceImage, 'Food: collect a drink for food-item missions and use it to support health recovery.'],
  ['Mask', maskImage, 'Protection & Recovery: reduce infection transmission risk during trades and fulfill prevention missions.'],
  ['Med Kit', medKitImage, 'Medical: collect the Medical Kit for the Doctor mission checklist and help with care objectives.'],
  ['Medicine', medicineImage, 'Medical: restore health and support Doctor missions when treating Weak or Sick players.'],
  ['Notebook', notebookImage, 'Student Supplies: collect this notebook for your school-supply mission checklist.'],
  ['Packed Lunch', packedLunchImage, 'Food: collect Packed Meals for food-item missions and use them to support health recovery.'],
  ['Pen', penImage, 'Student Supplies: collect this pen for your school-supply mission checklist.'],
  ['Sanitizer', sanitizerImage, 'Protection & Recovery: reduce infection transmission risk during trades and fulfill prevention missions.'],
  ['Snack', snackImage, 'Food: collect Snacks for food-item missions and use them to support health recovery.'],
  ['Trash Bag', trashBagImage, 'Caretaker gear: collect the Trash Bag to complete your cleaning-supply mission checklist.'],
  ['Vitamins', vitaminsImage, 'Medical: restore health and support medical-care mission objectives.'],
  ['Water', waterImage, 'Food: collect a drink for food-item missions and use it to support health recovery.'],
  ['Whistle', whistleImage, 'Guard gear: collect the Whistle to fulfill your role mission checklist.']
].map(([name, image, definition]) => ({ name, image, definition }))

const monitoringRoles = [
  {
    id: 'teacher',
    eyebrow: 'Teacher',
    title: 'Guide the classroom experience.',
    features: ['Author built-in and teacher-assigned quizzes', 'Maintain persistent class lobbies', 'Track student performance'],
    href: '/teacher'
  },
  {
    id: 'parent',
    eyebrow: 'Parent',
    title: 'Stay connected.',
    features: ['View linked student progress', 'Review match statistics'],
    href: '/parent'
  },
  {
    id: 'admin',
    eyebrow: 'Admin',
    title: 'Keep everything organized.',
    features: ['Manage accounts', 'Assign users to class sections', 'Review platform analytics'],
    href: '/admin'
  }
]

const playSteps = [
  ['01', 'Get Your Role', 'Receive your public role, secret mission checklist, and find out if you are the hidden Infected carrier.'],
  ['02', 'Discover', 'Move to a new location each round—facing quizzes, card-matching games, or supply shops.'],
  ['03', 'Interact', 'Negotiate face-to-face item trades, send public messages or private whispers, and trigger your role ability.'],
  ['04', 'Observe & Infer', 'Track health bands (Healthy, Weak, Sick, Critical) and watch for suspicious cough cues.'],
  ['05', 'Stay Aware', 'Finish your role missions, manage your coins and health, and climb the end-of-match leaderboard.']
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
            {/* <p className="home-eyebrow">BatangAware</p> */}
            <h1 id="hero-title">Learn. Play. <span>Stay Aware.</span></h1>
            <p className="hero-subtitle">BatangAware is a school-based multiplayer social deduction and trading game. Team up to complete missions and stop an influenza outbreak—while watching out for a hidden carrier among you.</p>
            <div className="hero-actions">
              <a href="https://grahambel.itch.io/batangaware" target="_blank" rel="noreferrer" className="home-button home-button-primary">Download Game</a>
              <a href="#game-elements" className="home-button home-button-secondary">Explore the Game</a>
            </div>
          </div>
          <div className="hero-visual hero-visual-role"><RoleRevealCard /></div>
        </section>

          <section className="intro-band" aria-labelledby="intro-title">
            <SectionHeading eyebrow="PROTECT YOUR SCHOOL COMMUNITY" title="Trade Smart. Spot the Symptoms." align="center">
              Navigate a simulated flu outbreak across familiar school spots. Answer health quizzes, trade protective supplies, and pay close attention to cough cues and behavior to figure out who is secretly infected.
            </SectionHeading>
          </section>

          <section className="home-section game-elements" id="game-elements" aria-labelledby="game-elements-title">
            <SectionHeading eyebrow="Inside every round" title="Everything has a role.">
              Discover the characters, locations, and items that make every round different.
            </SectionHeading>

            <div className="element-group" id="roles">
              <div className="element-group-heading"><h3>Characters / Roles</h3><p>Every player receives a public role and a private mission checklist—except one player, who hides their Infected identity behind a regular cover role.</p></div>
              <FannedCardDeck className="role-deck" items={roles} renderCard={(role) => <GameCard item={role} />} renderDetails={(role, onClose) => <RoleMissionPreview role={role} onClose={onClose} />} />
            </div>

            <div className="element-group location-group">
              <div className="element-group-heading"><h3>Locations</h3><p>Matches rotate through 5 locations across 10 timed rounds, each with its own infection risk and mini-activity.</p></div>
              <FannedCardDeck className="location-deck" items={locations} renderCard={(location) => <GameCard item={location} variant="location" />} renderDetails={(location) => <LocationPreview location={location} />} />
            </div>

            <div className="element-group inventory-group">
              <InventoryDeck items={inventory} />
            </div>
          </section>

          <section className="home-section how-section" id="how-you-play" aria-labelledby="how-title">
            <SectionHeading eyebrow="The round unfolds" title="How You Play">
              Ten 60-second rounds of strategy, teamwork, and social deduction.
            </SectionHeading>
            <HowYouPlayStepper steps={playSteps} />
          </section>

          <ReplayabilityPanel />

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
            <StudentProgressPanel />
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
        <span aria-hidden="true">?</span>
        Download Game
      </a>
    </div>
  )
}

export default HomePage

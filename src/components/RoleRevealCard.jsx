import { useEffect, useRef, useState } from 'react'
import caretakerImage from '../assets/CARETAKER.png'
import doctorImage from '../assets/DOCTOR.png'
import guardImage from '../assets/GUARD.png'
import infectedImage from '../assets/INFECTED.png'
import studentImage from '../assets/STUDENT.png'
import vendorImage from '../assets/VENDOR.png'
import './RoleRevealCard.css'

const roles = [
  {
    name: 'Student',
    status: 'Public Role',
    image: studentImage,
    description: 'Learn, gather school supplies, and stay healthy.',
    missions: ['Complete 2 quizzes consecutively', 'Collect Notebook, Pen, and Book', 'Finish Healthy (80-100 HP)'],
    ability: 'Study (+5 HP)',
    effect: 'Study activated: +5 HP.'
  },
  {
    name: 'Doctor',
    status: 'Public Role - Immune',
    image: doctorImage,
    description: 'Help players recover and supply medical items.',
    missions: ['Trade Medicine to a Weak or Sick player', 'Collect a Medical Kit'],
    ability: 'Group Heal (+10 HP)',
    effect: '+10 HP healed for players in your location.'
  },
  {
    name: 'Caretaker',
    status: 'Public Role',
    image: caretakerImage,
    description: 'Sanitize locations to reduce environmental risk.',
    missions: ['Collect Cleaning Kit, Trash Bag, & Gloves', 'Sanitize 3 unique locations', 'Complete 2 safe trades in risky areas'],
    ability: 'Sanitize Area',
    effect: 'Sanitize Area activated: local environmental risk reduced.'
  },
  {
    name: 'Guard',
    status: 'Public Role',
    image: guardImage,
    description: 'Control risky exchanges and check on ill players.',
    missions: ['Restrict trade during a high-risk round', 'Whisper 2 Weak or Sick players', 'Hold an ID Badge and Whistle'],
    ability: 'Restrict Trade',
    effect: 'Restrict Trade activated for this high-risk round.'
  },
  {
    name: 'Vendor',
    status: 'Public Role',
    image: vendorImage,
    description: 'Trade often and build supplies for the group.',
    missions: ['Accumulate coins', 'Collect Snacks, Drinks, & Packed Meals', 'Complete 5 successful trades'],
    ability: 'Trade Bonus',
    effect: 'Trade Bonus activated: earn extra coins from trades.'
  },
  {
    name: 'Infected',
    status: 'Hidden Carrier / Cover: Student',
    image: infectedImage,
    description: 'Blend in with your cover role while pursuing secret goals.',
    missions: ['Complete 1 cover-role mission', 'Make 3 safe trades while Weak without spreading', 'Avoid Critical health'],
    ability: 'Cough Cue',
    effect: 'Cough cue sent to nearby players.'
  }
]

function pickDifferentRole(currentIndex) {
  const options = roles.map((_, index) => index).filter((index) => index !== currentIndex)
  return options[Math.floor(Math.random() * options.length)]
}

export default function RoleRevealCard() {
  const [isRevealed, setIsRevealed] = useState(false)
  const [roleIndex, setRoleIndex] = useState(() => Math.floor(Math.random() * roles.length))
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef(null)
  const role = roles[roleIndex]

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const dealRole = () => {
    window.clearTimeout(noticeTimer.current)
    setRoleIndex(Math.floor(Math.random() * roles.length))
    setNotice('')
    setIsRevealed(true)
  }

  const activateAbility = () => {
    window.clearTimeout(noticeTimer.current)
    setNotice(role.effect)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2800)
  }

  const drawAnother = () => {
    window.clearTimeout(noticeTimer.current)
    setIsRevealed(false)
    setNotice('')
    window.setTimeout(() => {
      setRoleIndex((currentIndex) => pickDifferentRole(currentIndex))
      setIsRevealed(true)
    }, 360)
  }

  const hideCard = () => {
    window.clearTimeout(noticeTimer.current)
    setNotice('')
    setIsRevealed(false)
  }

  return (
    <section className="role-reveal" aria-label="Interactive role reveal">
      <div className={`role-reveal__stage${isRevealed ? ' is-revealed' : ''}`}>
        <div className="role-reveal__inner">
          <div className="role-reveal__face role-reveal__front">
            <p className="role-reveal__round">Round 01 <span aria-hidden="true">&#8226;</span> Role Reveal</p>
            <div className="role-reveal__mystery-mark" aria-hidden="true">?</div>
            <p className="role-reveal__kicker">Your match starts here</p>
            <h2>Who Will You Be?</h2>
            <p className="role-reveal__intro">Five public roles and one hidden Infected carrier are dealt each match. Your role comes with missions and an ability.</p>
            <button className="role-reveal__button role-reveal__button--primary" type="button" onClick={dealRole}>Deal My Role</button>
          </div>

          <div className="role-reveal__face role-reveal__back" aria-live="polite">
            <div className="role-reveal__role-header">
              <img src={role.image} alt="" />
              <div>
                <p className="role-reveal__round">Your role</p>
                <span className={`role-reveal__status${role.name === 'Infected' ? ' is-hidden-role' : ''}`}>{role.status}</span>
                <h2>{role.name}</h2>
              </div>
            </div>
            <p className="role-reveal__description">{role.description}</p>
            <div className="role-reveal__missions">
              <p className="role-reveal__section-label">Mission Checklist</p>
              <ul>{role.missions.map((mission) => <li key={mission}>{mission}</li>)}</ul>
            </div>
            <div className="role-reveal__ability">
              <button className="role-reveal__button role-reveal__button--ability" type="button" onClick={activateAbility}>{role.ability}</button>
              {notice && <p className="role-reveal__notice" role="status">{notice}</p>}
            </div>
            <div className="role-reveal__controls">
              <button className="role-reveal__button role-reveal__button--primary" type="button" onClick={drawAnother}>Draw Another Role</button>
              <button className="role-reveal__button role-reveal__button--quiet" type="button" onClick={hideCard}>Hide Card</button>
            </div>
          </div>
        </div>
      </div>
      <p className="role-reveal__hint">Tap Deal My Role to reveal a character and their mission.</p>
    </section>
  )
}

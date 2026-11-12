import { useEffect, useRef, useState } from 'react'
import './RoleMissionPreview.css'

export default function RoleMissionPreview({ role, onClose }) {
  const [checkedMissions, setCheckedMissions] = useState(() => role.missions.map(() => false))
  const [isAbilityActive, setIsAbilityActive] = useState(false)
  const [abilityMessage, setAbilityMessage] = useState('')
  const abilityTimer = useRef(null)
  const allMissionsComplete = checkedMissions.every(Boolean)

  useEffect(() => () => window.clearTimeout(abilityTimer.current), [])

  const toggleMission = (missionIndex) => {
    setCheckedMissions((current) => current.map((checked, index) => index === missionIndex ? !checked : checked))
  }

  const previewAbility = () => {
    if (isAbilityActive) return
    setIsAbilityActive(true)
    setAbilityMessage(role.abilityEffect)
    abilityTimer.current = window.setTimeout(() => {
      setIsAbilityActive(false)
      setAbilityMessage('')
    }, 1800)
  }

  return (
    <div className="role-preview" style={{ '--role-border': role.borderColor }}>
      <header className="role-preview__header">
        <img className="role-preview__portrait" src={role.image} alt={`${role.name} character`} />
        <div className="role-preview__identity">
          <span className={`role-preview__badge${role.isHidden ? ' is-hidden' : ''}`}>{role.badge}</span>
          <h3 id="card-detail-title">{role.name}</h3>
          <p>{role.description}</p>
        </div>
      </header>

      <section className="role-preview__mission-section" aria-label={`${role.name} mission checklist`}>
        <div className="role-preview__mission-heading">
          <h4>Mission Checklist</h4>
          {allMissionsComplete && <span className="role-preview__complete" role="status">Mission Complete!</span>}
        </div>
        <ul className="role-preview__missions">
          {role.missions.map((mission, index) => (
            <li key={mission}>
              <label className={checkedMissions[index] ? 'is-checked' : ''}>
                <input type="checkbox" checked={checkedMissions[index]} onChange={() => toggleMission(index)} />
                <span>{mission}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className={`role-preview__ability${isAbilityActive ? ' is-active' : ''}`} aria-label="Ability preview">
        <div className="role-preview__ability-copy">
          <p className="role-preview__eyebrow">Role ability <span aria-hidden="true">&#8226;</span> Cooldown: {role.cooldown}</p>
          <p className="role-preview__ability-effect" aria-live="polite">{abilityMessage || role.abilityEffect}</p>
        </div>
        <button className="role-preview__ability-button" type="button" onClick={previewAbility} disabled={isAbilityActive}>
          <span className="role-preview__cooldown-ring" aria-hidden="true" />
          {isAbilityActive ? 'Preview Active' : <>Preview {role.ability} <span className='role-preview__button-separator'>&#8226;</span> {role.cooldown}</>}
        </button>
      </section>
    </div>
  )
}

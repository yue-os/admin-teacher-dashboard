import { useState } from 'react'
import './ReplayabilityPanel.css'

const features = [
  { label: 'ASYMMETRIC ROLES & MISSIONS', example: 'One player hides an Infected identity behind a regular cover role.' },
  { label: 'ROTATING LOCATIONS & QUIZZES', example: 'Each round brings a quiz, supply shop, or memory match at a new spot.' },
  { label: 'FACE-TO-FACE TRADING & WHISPERS', example: 'Offer supplies in person, then whisper to compare clues privately.' },
  { label: 'DYNAMIC HEALTH & RISK LEVELS', example: 'Location exposure and illness shift players across four health bands.' },
  { label: 'INDIVIDUAL SCORES & HIGHLIGHTS', example: 'Role missions, quiz coins, and match actions shape player highlights.' }
]
const healthBands = [
  { name: 'Healthy', range: '80\u2013100', hp: 92, tone: 'healthy', description: "No visible symptoms; satisfies Student's Perfect Attendance goal." },
  { name: 'Weak', range: '50\u201379', hp: 65, tone: 'weak', description: 'Early symptoms appear; trading remains allowed.' },
  { name: 'Sick', range: '20\u201349', hp: 35, tone: 'sick', description: 'More visible illness; trade restrictions apply.' },
  { name: 'Critical', range: '0\u201319', hp: 10, tone: 'critical', description: 'Severe symptoms and cough effects; trade restrictions apply (no player elimination!).' }
]

export default function ReplayabilityPanel() {
  const [activeFeature, setActiveFeature] = useState(0)
  const [activeBand, setActiveBand] = useState(0)
  const band = healthBands[activeBand]
  return (
    <section className="random-section replayability-panel" aria-labelledby="random-title">
      <div className="random-copy replayability-panel__copy">
        <p className="home-eyebrow">No two rounds feel alike</p>
        <h2 id="random-title">Every round can be different.</h2>
        <p>Dynamic location risk, shifting health states, and hidden agendas make every match unpredictable.</p>
        <div className="health-preview" aria-label="Health state preview">
          <div className="health-preview__heading"><div><span className="home-eyebrow">Health State Preview</span><strong>{band.name} ({band.range})</strong></div><span className={`health-preview__hp health-preview__hp--${band.tone}`}>{band.hp} HP</span></div>
          <div className="health-preview__gauge" role="img" aria-label={`${band.hp} out of 100 health`}><span className={`health-preview__gauge-fill health-preview__gauge-fill--${band.tone}`} style={{ width: `${band.hp}%` }} /></div>
          <div className="health-preview__pills" role="group" aria-label="Choose a health state">
            {healthBands.map((item, index) => <button key={item.name} type="button" className={`health-preview__pill health-preview__pill--${item.tone}${activeBand === index ? ' is-active' : ''}`} onClick={() => setActiveBand(index)} aria-pressed={activeBand === index}>{item.name}<span>{item.range}</span></button>)}
          </div>
          <p className={`health-preview__description health-preview__description--${band.tone}`} aria-live="polite">{band.description}</p>
        </div>
      </div>
      <div className="replayability-panel__features" aria-label="Replayability features">
        {features.map((feature, index) => <button key={feature.label} type="button" className={`replayability-panel__feature${activeFeature === index ? ' is-active' : ''}`} onMouseEnter={() => setActiveFeature(index)} onFocus={() => setActiveFeature(index)} onClick={() => setActiveFeature(index)} aria-pressed={activeFeature === index}>
          <span className="replayability-panel__number">{String(index + 1).padStart(2, '0')}</span>
          <span className="replayability-panel__feature-copy"><strong>{feature.label}</strong>{activeFeature === index && <span className="replayability-panel__example">{feature.example}</span>}</span>
        </button>)}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import './HowYouPlayStepper.css'

const hudPreviews = [
  ['Role Card Flipped', 'Clock Paused Until All Ready'],
  ['Location Reveal', 'Quiz / Shop / Memory Match'],
  ['Face-to-Face Trade', 'Public Chat & Private Whispers'],
  ['Health Cues', 'Suspicious Cough Alert'],
  ['Mission Checklist', 'End-of-Match Leaderboard']
]
const timerLabels = ['60s', '45s', '30s', '15s', 'End of Round']

export default function HowYouPlayStepper({ steps }) {
  const [activeStep, setActiveStep] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const progress = ((activeStep + 1) / steps.length) * 100

  useEffect(() => {
    if (!isAutoPlaying) return undefined
    const intervalId = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length)
    }, 2800)
    return () => window.clearInterval(intervalId)
  }, [isAutoPlaying, steps.length])

  const selectStep = (index) => setActiveStep(index)

  return (
    <div className="round-stepper">
      <div className="round-stepper__toolbar">
        <div className="round-stepper__timer" aria-live="polite">
          <span className="round-stepper__timer-dot" aria-hidden="true" />
          <span>60s Round Timer</span>
          <strong>{timerLabels[activeStep]}</strong>
        </div>
        <button className="round-stepper__autoplay" type="button" aria-pressed={isAutoPlaying} onClick={() => setIsAutoPlaying((playing) => !playing)}>
          <span aria-hidden="true">{isAutoPlaying ? 'Ⅱ' : '▶'}</span>{isAutoPlaying ? 'Pause Auto-Preview' : 'Auto-Preview Round'}
        </button>
      </div>
      <div className="round-stepper__progress" role="progressbar" aria-label="Round timeline progress" aria-valuemin="1" aria-valuemax={steps.length} aria-valuenow={activeStep + 1}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="round-stepper__grid">
        {steps.map(([number, title, description], index) => (
          <button key={number} type="button" className={`round-stepper__step${activeStep === index ? ' is-active' : ''}`} onClick={() => selectStep(index)} aria-current={activeStep === index ? 'step' : undefined}>
            <span className="round-stepper__number">{number}</span>
            <span className="round-stepper__title">{title}</span>
            <span className="round-stepper__description">{description}</span>
            <span className="round-stepper__hud">{hudPreviews[index].map((label, detailIndex) => <span className="round-stepper__hud-part" key={label}>{detailIndex > 0 && <span className="round-stepper__separator" aria-hidden="true">&bull;</span>}{label}</span>)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

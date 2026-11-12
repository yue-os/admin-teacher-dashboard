import { useRef, useState } from 'react'
import './StudentProgressPanel.css'

const studentSteps = [
  'Join class lobbies and 10-round matches',
  'Complete role-based health missions',
  'Answer built-in and teacher-assigned quizzes',
  'Trade protective supplies and manage health',
  'Build real-world influenza prevention habits'
]
const portals = [
  {
    id: 'teacher', label: 'Teacher', heading: 'Classroom control room',
    capabilities: ['Author custom location quizzes for Rounds 3, 6, and 9', 'Host persistent classroom lobbies', 'Spectate live matches', 'Track class performance'],
    previewTitle: 'Room 6B - Live Match', stats: [['LOBBY', 'Persistent'], ['ROUND', '06 / 10'], ['QUIZZES', '3 authored']], bars: [72, 48, 88, 61]
  },
  {
    id: 'parent', label: 'Parent', heading: 'Student progress overview',
    capabilities: ['Link child accounts', 'Monitor influenza learning progress', 'Review match history', 'Follow health-awareness milestones'],
    previewTitle: 'Linked Student - This Week', stats: [['QUIZZES', '8 complete'], ['MATCHES', '4 played'], ['MILESTONES', '3 reached']], bars: [82, 64, 92, 56]
  },
  {
    id: 'admin', label: 'Admin', heading: 'Platform operations',
    capabilities: ['Manage school accounts and portal roles', 'Assign students and teachers to class sections', 'Inspect platform-wide analytics'],
    previewTitle: 'School Platform Summary', stats: [['ACCOUNTS', '1,248'], ['SECTIONS', '42 active'], ['MATCHES', '86 today']], bars: [68, 91, 74, 83]
  }
]

function DashboardPreview({ portal }) {
  return <div className={`student-progress__dashboard student-progress__dashboard--${portal.id}`}>
    <div className="student-progress__dashboard-head"><span className="student-progress__dashboard-dot" /><span>{portal.previewTitle}</span><span className="student-progress__dashboard-menu" aria-hidden="true">...</span></div>
    <div className="student-progress__stats">{portal.stats.map(([label, value]) => <div className="student-progress__stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="student-progress__chart" aria-label="Dashboard activity preview">{portal.bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
    <div className="student-progress__chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span></div>
  </div>
}

export default function StudentProgressPanel() {
  const [checked, setChecked] = useState(() => studentSteps.map(() => false))
  const [hoveredStep, setHoveredStep] = useState(null)
  const [activePortal, setActivePortal] = useState(0)
  const tabRefs = useRef([])
  const portal = portals[activePortal]
  const arrowActive = checked.some(Boolean) || hoveredStep !== null

  const toggleStep = (index) => setChecked((current) => current.map((isChecked, stepIndex) => stepIndex === index ? !isChecked : isChecked))
  const moveTab = (event, index) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + portals.length) % portals.length
    setActivePortal(next)
    tabRefs.current[next]?.focus()
  }

  return <div className="student-progress">
    <section className="student-progress__student" aria-labelledby="student-progress-title">
      <p className="connection-label" id="student-progress-title">Student Game</p>
      <p className="student-progress__hint">Select activities to preview the learning data they create.</p>
      <div className="student-progress__checklist">
        {studentSteps.map((step, index) => <button key={step} type="button" className={`student-progress__step${checked[index] ? ' is-checked' : ''}`} onClick={() => toggleStep(index)} onMouseEnter={() => setHoveredStep(index)} onMouseLeave={() => setHoveredStep(null)} onFocus={() => setHoveredStep(index)} onBlur={() => setHoveredStep(null)} aria-pressed={checked[index]}>
          <span className="student-progress__check" aria-hidden="true">{checked[index] ? <span>&#10003;</span> : String(index + 1).padStart(2, '0')}</span><span>{step}</span>
        </button>)}
      </div>
    </section>

    <div className={`student-progress__connector${arrowActive ? ' is-active' : ''}`} aria-hidden="true"><span className="student-progress__connector-line" /><span className="student-progress__connector-arrow">&#8595;</span></div>

    <section className="student-progress__monitoring" aria-labelledby="monitoring-system-title">
      <p className="connection-label" id="monitoring-system-title">Monitoring System</p>
      <div className="student-progress__tabs" role="tablist" aria-label="Monitoring system portals" style={{ '--tab-index': activePortal }}>
        <span className="student-progress__tab-highlight" aria-hidden="true" />
        {portals.map((item, index) => <button id={`portal-tab-${item.id}`} ref={(element) => { tabRefs.current[index] = element }} key={item.id} type="button" role="tab" aria-selected={activePortal === index} aria-controls="portal-panel" tabIndex={activePortal === index ? 0 : -1} onClick={() => setActivePortal(index)} onKeyDown={(event) => moveTab(event, index)}>{item.label}</button>)}
      </div>
      <div id="portal-panel" className="student-progress__portal-panel" role="tabpanel" aria-labelledby={`portal-tab-${portal.id}`} key={portal.id}>
        <div className="student-progress__portal-copy"><h3>{portal.heading}</h3><ul>{portal.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></div>
        <DashboardPreview portal={portal} />
      </div>
    </section>
  </div>
}

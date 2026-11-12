import { useEffect, useRef, useState } from 'react'
import bookImage from '../assets/BOOK.png'
import cleaningKitImage from '../assets/CLEANING KIT.png'
import maskImage from '../assets/MASK.png'
import medKitImage from '../assets/MED KIT.png'
import medicineImage from '../assets/MEDICINE.png'
import notebookImage from '../assets/NOTEBOOK.png'
import packedMealImage from '../assets/PACKED LUNCH.png'
import sanitizerImage from '../assets/SANITIZER.png'
import snackImage from '../assets/SNACK.png'
import vitaminsImage from '../assets/VITAMINS.png'
import waterImage from '../assets/WATER.png'
import './LocationPreview.css'

const info = {
  School: ['medium', 'Medium Risk', '5-question Influenza Awareness Quiz', 'Classroom mini-activity: answer health questions to earn coins and health.'],
  Clinic: ['low', 'Low Risk', 'Medical Supply Shop', 'A low-risk medical shop with recovery and protection supplies.'],
  Market: ['medium', 'Medium Risk', 'Randomized Supply Cards', 'Browse three randomized supply cards from the market pool.'],
  Park: ['teal', 'Low Risk', '6-Card Memory Match', 'A low-risk outdoor spot for a quick memory matching activity.'],
  Canteen: ['high', 'Very High Risk', 'Food & Recovery Shop', 'The highest outbreak risk location, with quick food recovery supplies.']
}
const clinic = [
  { name: 'Medicine', image: medicineImage, effect: 'Restores health; Doctors can trade it to Weak or Sick players.', price: 40 },
  { name: 'Mask', image: maskImage, effect: 'Reduces infection transmission risk during trades.', price: 40 },
  { name: 'Sanitizer', image: sanitizerImage, effect: 'Reduces infection transmission risk during trades.', price: 40 }
]
const marketPool = [
  { name: 'Book', image: bookImage, effect: 'Completes a Student school-supply mission.', price: 50 },
  { name: 'Mask', image: maskImage, effect: 'Reduces infection transmission risk during trades.', price: 50 },
  { name: 'Sanitizer', image: sanitizerImage, effect: 'Reduces infection transmission risk during trades.', price: 50 },
  { name: 'Notebook', image: notebookImage, effect: 'Completes a Student school-supply mission.', price: 50 },
  { name: 'Vitamins', image: vitaminsImage, effect: 'Restores health and supports medical-care missions.', price: 50 },
  { name: 'Cleaning Kit', image: cleaningKitImage, effect: 'Helps the Caretaker sanitize locations and complete role missions.', price: 50 },
  { name: 'Medical Kit', image: medKitImage, effect: 'Completes the Doctor medical-supply mission.', price: 50 }
]
const canteen = [
  { name: 'Snack', image: snackImage, effect: 'Quick food recovery and Vendor food-item mission progress.', price: 25 },
  { name: 'Drink', image: waterImage, effect: 'Quick hydration and Vendor food-item mission progress.', price: 25 },
  { name: 'Packed Meal', image: packedMealImage, effect: 'Food recovery and Vendor food-item mission progress.', price: 25 }
]
const shuffle = (items) => [...items].sort(() => Math.random() - .5)

function RiskGauge({ risk, tone, level }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [risk])
  return <section className="location-preview__risk" aria-label={`Infection risk ${risk.toFixed(1)}, ${level}`}>
    <div className="location-preview__risk-heading"><div><p className="location-preview__eyebrow">Infection Risk</p><h4>{level}</h4></div><span className={`location-preview__risk-value${tone === 'high' ? ' is-pulsing' : ''}`}>{risk.toFixed(1)}</span></div>
    <div className="location-preview__gauge" role="img" aria-label={`${Math.round(risk * 100)} percent infection risk`}><div className="location-preview__gauge-track"><span className={`location-preview__gauge-fill location-preview__gauge-fill--${tone}`} style={{ width: ready ? `${risk * 100}%` : '0%' }} /></div><span className="location-preview__gauge-needle" style={{ left: ready ? `${risk * 100}%` : '0%' }} /></div>
    <div className="location-preview__gauge-labels"><span>Low</span><span>Medium</span><span>High</span></div>
  </section>
}

function QuizPreview() {
  const [answer, setAnswer] = useState(null)
  const choices = ['Keep playing and wait for it to pass.', 'Tell your teacher and visit the school nurse.', 'Share your water bottle with a classmate.', 'Hide your symptoms from everyone.']
  return <section className="location-preview__activity"><p className="location-preview__eyebrow">Influenza Awareness Mini-Quiz</p><h4>What is the best action when you start feeling flu symptoms during class?</h4>
    <div className="location-preview__quiz-choices">{choices.map((choice, i) => <button key={choice} type="button" className={`location-preview__choice${answer === i ? (i === 1 ? ' is-correct' : ' is-wrong') : ''}`} onClick={() => setAnswer(i)} disabled={answer === 1}><span>{String.fromCharCode(65 + i)}</span>{choice}</button>)}</div>
    {answer === 1 && <div className="location-preview__quiz-success"><span className="location-preview__reward location-preview__pop">+15 Coins &amp; +2 Health</span><p>Tell a trusted adult and follow school health guidance. Staying home when ill and covering coughs can help protect classmates.</p></div>}
    {answer !== null && answer !== 1 && <div className="location-preview__quiz-tip" role="status"><p>Tip: Tell a trusted adult when you feel unwell and follow their health guidance.</p><button type="button" onClick={() => setAnswer(null)}>Try Again</button></div>}
  </section>
}

function MemoryPreview() {
  const [cards, setCards] = useState(() => shuffle([{ id: 'ma', pair: 'mask', name: 'Mask', image: maskImage }, { id: 'mb', pair: 'mask', name: 'Mask', image: maskImage }, { id: 'sa', pair: 'sanitizer', name: 'Sanitizer', image: sanitizerImage }, { id: 'sb', pair: 'sanitizer', name: 'Sanitizer', image: sanitizerImage }]))
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [locked, setLocked] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flip = (card) => {
    if (locked || flipped.includes(card.id) || matched.includes(card.id)) return
    const next = [...flipped, card.id]
    setFlipped(next)
    if (next.length < 2) return
    const pair = cards.filter((item) => next.includes(item.id))
    if (pair[0].pair === pair[1].pair) { setMatched((current) => [...current, ...next]); setFlipped([]) }
    else { setLocked(true); timer.current = setTimeout(() => { setFlipped([]); setLocked(false) }, 700) }
  }
  const reset = () => { clearTimeout(timer.current); setCards((current) => shuffle(current)); setFlipped([]); setMatched([]); setLocked(false) }
  const done = matched.length === 4
  return <section className="location-preview__activity"><div className="location-preview__activity-heading"><div><p className="location-preview__eyebrow">Park Memory Match</p><h4>Find the matching supply pairs</h4></div><span className="location-preview__match-count">{matched.length / 2} / 2 pairs</span></div>
    <div className="location-preview__memory-grid">{cards.map((card) => { const up = flipped.includes(card.id) || matched.includes(card.id); return <button key={card.id} type="button" className={`location-preview__memory-card${up ? ' is-face-up' : ''}${matched.includes(card.id) ? ' is-matched' : ''}`} onClick={() => flip(card)} aria-label={up ? card.name : 'Reveal a memory card'}><span className="location-preview__memory-inner"><span className="location-preview__memory-back">?</span><span className="location-preview__memory-front"><img src={card.image} alt="" /><small>{card.name}</small></span></span></button> })}</div>
    {done ? <span className="location-preview__reward location-preview__pop">+20 Coins + Random Item</span> : <button className="location-preview__text-button" type="button" onClick={reset}>Shuffle Cards</button>}
  </section>
}

function ShopPreview({ name }) {
  const [selected, setSelected] = useState(null)
  const [marketItems] = useState(() => shuffle(marketPool).slice(0, 3))
  const items = name === 'Clinic' ? clinic : name === 'Canteen' ? canteen : marketItems
  const note = name === 'Clinic' ? 'Also stocked: Vitamins and Medical Kit, 40 coins each. Doctors receive a Clinic healing bonus.' : name === 'Market' ? 'Vendors receive a market bonus.' : 'Food items provide quick health recovery.'
  const price = name === 'Clinic' ? 40 : name === 'Market' ? 50 : 25
  return <section className="location-preview__activity"><div className="location-preview__activity-heading"><div><p className="location-preview__eyebrow">{name} Mini Shop</p><h4>Select an item to preview</h4></div><span className="location-preview__shop-cost">{price} coins each</span></div>
    <div className="location-preview__shop-shelf">{items.map((item) => <button key={item.name} type="button" className={`location-preview__shop-item${selected?.name === item.name ? ' is-selected' : ''}`} onClick={() => setSelected(item)}><img src={item.image} alt="" /><strong>{item.name}</strong><span>{item.price} coins</span></button>)}</div>
    <p className="location-preview__shop-note">{note}</p>{selected && <div className="location-preview__item-preview" role="status"><strong>{selected.name} - {selected.price} coins</strong><span>{selected.effect}</span></div>}
  </section>
}

export default function LocationPreview({ location }) {
  const [tone, level, activity, description] = info[location.name]
  return <div className={`location-preview location-preview--${tone}`}>
    <header className="location-preview__header"><img src={location.image} alt="" /><div><p className="location-preview__eyebrow">Location Guide</p><h3 id="card-detail-title">{location.name}</h3><p>{description}</p></div></header>
    <RiskGauge risk={location.risk} tone={tone} level={level} /><div className="location-preview__activity-label"><span className="location-preview__eyebrow">Mini-Activity</span><strong>{activity}</strong></div>
    {location.name === 'School' ? <QuizPreview /> : location.name === 'Park' ? <MemoryPreview /> : <ShopPreview name={location.name} />}
  </div>
}

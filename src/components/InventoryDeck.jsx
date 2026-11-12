import { useEffect, useState } from 'react'
import './InventoryDeck.css'

const VISIBLE_CARDS = 4
const CYCLE_DURATION = 420
const STACK_OFFSETS = [
  { x: 0, compactX: 0, rotation: 0, compactRotation: 0 },
  { x: -0.72, compactX: -0.42, rotation: -4.5, compactRotation: -3.5 },
  { x: 0.72, compactX: 0.42, rotation: 4.5, compactRotation: 3.5 },
  { x: -0.35, compactX: -0.2, rotation: -2, compactRotation: -1.5 },
]

/** Displays item details alongside a borderless, interactive inventory stack. */
export default function InventoryDeck({ items }) {
  const [deckOrder, setDeckOrder] = useState(() => items.map((_, index) => index))
  const [cycleDirection, setCycleDirection] = useState('next')
  const [isCycling, setIsCycling] = useState(false)
  const visibleCount = Math.min(VISIBLE_CARDS, deckOrder.length)
  const backDepth = Math.max(visibleCount - 1, 0)
  const backOffset = STACK_OFFSETS[backDepth]
  const selectedItem = items[deckOrder[0]]

  useEffect(() => {
    if (!isCycling) return undefined

    const timeoutId = window.setTimeout(() => {
      setDeckOrder((order) =>
        cycleDirection === 'next'
          ? [...order.slice(1), order[0]]
          : [order[order.length - 1], ...order.slice(0, -1)],
      )
      setIsCycling(false)
    }, CYCLE_DURATION)

    return () => window.clearTimeout(timeoutId)
  }, [cycleDirection, isCycling, items.length])

  const cycleCards = (direction = 'next') => {
    if (isCycling || items.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDeckOrder((order) =>
        direction === 'next'
          ? [...order.slice(1), order[0]]
          : [order[order.length - 1], ...order.slice(0, -1)],
      )
      return
    }
    setCycleDirection(direction)
    setIsCycling(true)
  }

  if (!selectedItem) return null

  return (
    <div className="inventory-deck">
      <div className="inventory-deck__details" aria-live="polite">
        <p className="inventory-deck__eyebrow">Game inventory</p>
        <h3>Inventory</h3>
        <p className="inventory-deck__intro">
          Collect and trade supplies across six card families—including Protection & Recovery, Food, Student Supplies, Medical, Caretaker, and Guard gear—to complete missions and reduce transmission risk.
        </p>

        <div className="inventory-deck__selected" key={deckOrder[0]}>
          <span className="inventory-deck__item-count">
            Item {String(deckOrder[0] + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <h4>{selectedItem.name}</h4>
          <p>
            {selectedItem.description ??
              selectedItem.definition ??
              `Discover how ${selectedItem.name} can help during a round.`}
          </p>
        </div>

        <div className="inventory-deck__controls">
          <button
            type="button"
            onClick={() => cycleCards('previous')}
            disabled={isCycling || items.length < 2}
            aria-label="Show previous inventory item"
          >
            <span aria-hidden="true">&larr;</span> Previous Item
          </button>
          <button
            type="button"
            onClick={() => cycleCards('next')}
            disabled={isCycling || items.length < 2}
            aria-label="Show next inventory item"
          >
            Next Item <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>

      <div className="inventory-deck__visual">
        <div className="inventory-deck__stack" aria-label="Inventory card stack">
          {Array.from({ length: visibleCount }, (_, depth) => {
            const itemIndex = deckOrder[depth]
            const item = items[itemIndex]
            const offset = STACK_OFFSETS[depth]
            const isCyclingCard =
              isCycling &&
              (cycleDirection === 'next' ? depth === 0 : depth === backDepth)
            const cardStyle = {
              '--stack-x': `${offset.x}rem`,
              '--stack-y': `${depth * -0.5}rem`,
              '--stack-rotation': `${offset.rotation}deg`,
              '--stack-shadow-opacity': 0.12 + (visibleCount - depth) * 0.025,
              '--front-stack-x': '0rem',
              '--front-stack-y': '0rem',
              '--front-stack-rotation': '0deg',
              '--front-stack-scale': '1',
              '--compact-stack-x': `${offset.compactX}rem`,
              '--compact-stack-rotation': `${offset.compactRotation}deg`,
              '--stack-scale': 1 - depth * 0.06,
              '--stack-opacity': 1 - depth * 0.12,
              '--stack-index': VISIBLE_CARDS - depth,
              '--back-stack-x': `${backOffset.x}rem`,
              '--back-stack-y': `${backDepth * -0.5}rem`,
              '--back-stack-rotation': `${backOffset.rotation}deg`,
              '--back-stack-scale': 1 - backDepth * 0.045,
              '--compact-back-stack-x': `${backOffset.compactX}rem`,
              '--compact-back-stack-rotation': `${backOffset.compactRotation}deg`,
              '--compact-front-stack-x': '0rem',
              '--compact-front-stack-rotation': '0deg',
            }

            if (depth === 0) {
              return (
                <button
                  className={`inventory-deck__card inventory-deck__card--top${isCyclingCard ? ` is-cycling is-cycling-${cycleDirection}` : ''}`}
                  type="button"
                  key={item.name}
                  style={cardStyle}
                  onClick={() => cycleCards('next')}
                  disabled={isCycling || items.length < 2}
                  aria-label={`Draw ${item.name} and show the next inventory item`}
                >
                  <img src={item.image} alt="" draggable="false" />
                </button>
              )
            }

            return (
              <div
                className={`inventory-deck__card${isCyclingCard ? ` is-cycling is-cycling-${cycleDirection}` : ''}`}
                key={item.name}
                style={cardStyle}
                aria-hidden="true"
              >
                <img src={item.image} alt="" draggable="false" />
              </div>
            )
          })}
        </div>
        <p className="inventory-deck__hint">Click the top card or choose Next Item to draw</p>
      </div>
    </div>
  )
}

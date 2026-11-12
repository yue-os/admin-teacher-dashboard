import { useEffect, useState } from 'react'
import './FannedCardDeck.css'

/** Displays a fanned deck and a detail modal for the selected item. */
export default function FannedCardDeck({ items, renderCard, renderDetails, className = '' }) {
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    if (!selectedItem) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedItem(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedItem])

  return (
    <>
      <div className={`fanned-deck ${className}`.trim()}>
        {items.map((item, index) => {
          const offset = index - (items.length - 1) / 2
          const maxOffset = (items.length - 1) / 2 || 1
          const normalizedOffset = offset / maxOffset
          const fanLift =
            items.length > 1
              ? Math.sqrt(Math.max(0, 1 - normalizedOffset ** 2)) * 2.5
              : 0

          return (
            <button
              className="fanned-deck__card"
              type="button"
              key={item.id ?? item.name ?? index}
              style={{
                '--rest-x': `${offset * 6.65}rem`,
                '--hover-x': `${offset * 7.65}rem`,
                '--rest-rotation': `${offset * 5}deg`,
                '--hover-rotation': `${offset * 10}deg`,
                '--compact-rest-x': `${offset * 0.8}rem`,
                '--compact-hover-x': `${offset * 1.2}rem`,
                '--compact-rest-rotation': `${offset * 1.5}deg`,
                '--compact-hover-rotation': `${offset * 5}deg`,
                '--fan-lift': `${fanLift}rem`,
                '--card-index': index,
                '--role-border': item.borderColor ?? 'transparent',
              }}
              onClick={() => setSelectedItem(item)}
              aria-label={`View ${item.name} details`}
            >
              {renderCard(item, index)}
            </button>
          )
        })}
      </div>
      <p className="fanned-deck-hint">Click or tap a card to view details</p>

      {selectedItem && (
        <div
          className="card-detail-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedItem(null)
          }}
        >
          <section
            className={`card-detail-modal${renderDetails ? ' card-detail-modal-custom' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-detail-title"
          >
            <button
              className="card-detail-close"
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label="Close details"
            >
              &times;
            </button>

            {renderDetails ? renderDetails(selectedItem, () => setSelectedItem(null)) : (
              <>
                {selectedItem.image && <img className="card-detail-image" src={selectedItem.image} alt="" />}
                <div className="card-detail-copy">
                  <p className="card-detail-eyebrow">Game guide</p>
                  <h3 id="card-detail-title">{selectedItem.name}</h3>
                  <p>{selectedItem.description ?? selectedItem.definition ?? `Explore ${selectedItem.name} during the round.`}</p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

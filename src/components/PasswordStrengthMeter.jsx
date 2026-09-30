import { getPasswordChecks } from '../lib/passwordPolicy'

function PasswordStrengthMeter({ password, id = 'password-strength' }) {
  const checks = getPasswordChecks(password)
  const score = checks.filter((check) => check.valid).length
  const label = score === checks.length ? 'Strong' : score >= 3 ? 'Getting stronger' : 'Weak'

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength-heading">
        <span>{password ? `Password strength: ${label}` : 'Password requirements'}</span>
        <span>{score}/{checks.length}</span>
      </div>
      <progress
        id={id}
        className={`password-strength-bar password-strength-bar--${score}`}
        value={score}
        max={checks.length}
        aria-label="Password strength"
      />
      <ul className="password-strength-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.valid ? 'is-valid' : ''}>
            <span aria-hidden="true">{check.valid ? '✓' : '○'}</span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PasswordStrengthMeter

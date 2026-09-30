const SPECIAL_CHARACTERS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"

export const getPasswordChecks = (password = '') => {
  const value = String(password)
  return [
    { label: 'At least 8 characters', valid: Array.from(value).length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(value) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(value) },
    { label: 'One number', valid: /[0-9]/.test(value) },
    { label: 'One special character', valid: Array.from(value).some((character) => SPECIAL_CHARACTERS.includes(character)) },
  ]
}

export const isPasswordCompliant = (password = '') =>
  getPasswordChecks(password).every((check) => check.valid)

export const PASSWORD_POLICY_ERROR =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.'

/** Keeps only ASCII digits 0–9. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '')
}

export function validatePhoneNumber(
  number: string,
  countryCode: string
): { valid: boolean; error: string | null } {
  const digits = sanitizePhoneInput(number)

  if (digits.length === 0) {
    return { valid: false, error: null }
  }

  if (countryCode === '+34') {
    if (digits.length === 9) {
      return { valid: true, error: null }
    }
    return { valid: false, error: 'El teléfono español debe tener 9 dígitos' }
  }

  if (countryCode === '+57') {
    if (digits.length === 10) {
      return { valid: true, error: null }
    }
    return { valid: false, error: 'El teléfono colombiano debe tener 10 dígitos' }
  }

  if (digits.length >= 6 && digits.length <= 15) {
    return { valid: true, error: null }
  }

  return { valid: false, error: 'El teléfono debe tener entre 6 y 15 dígitos' }
}

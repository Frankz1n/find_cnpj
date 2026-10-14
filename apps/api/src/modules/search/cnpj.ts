const FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function calculateDigit(base: string, weights: readonly number[]): number {
  const sum = [...base].reduce((total, digit, index) => {
    const weight = weights[index];
    if (weight === undefined) {
      throw new Error("Peso do CNPJ ausente.");
    }

    return total + Number(digit) * weight;
  }, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const firstDigit = calculateDigit(value.slice(0, 12), FIRST_DIGIT_WEIGHTS);
  const secondDigit = calculateDigit(`${value.slice(0, 12)}${firstDigit}`, SECOND_DIGIT_WEIGHTS);
  return value === `${value.slice(0, 12)}${firstDigit}${secondDigit}`;
}

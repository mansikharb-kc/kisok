// src/lib/validation.ts

/**
 * Validate that a phone number consists of exactly 10 digits.
 * It strips any non-digit characters before validation.
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^\d{10}$/.test(digits);
}

/**
 * Simple email validation ensuring an '@' character is present.
 * This is a lightweight check; more complex validation can be added later.
 */
export function isValidEmail(email: string): boolean {
  return email.includes("@");
}

/**
 * Validate that a string is not empty after trimming whitespace.
 */
export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate that a pincode consists of exactly 6 digits.
 */
export function isValidPincode(pincode: string): boolean {
  const digits = pincode.replace(/\D/g, "");
  return /^\d{6}$/.test(digits);
}

/**
 * Validate that a string contains only alphabetic characters and spaces.
 */
export function isAlphabetic(value: string): boolean {
  return /^[A-Za-z\s]+$/.test(value.trim());
}

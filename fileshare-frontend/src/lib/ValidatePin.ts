const DEFAULT_PIN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_LENGTH = 6;

// Validate whether a candidate PIN belongs to the allowed characters + length.
export function validatePin(pin: string): boolean {
    const candidate = pin.trim().toUpperCase().normalize('NFKC');

    if (candidate.length !== PIN_LENGTH) return false;

    // Fast membership check: build a Set from chars once if you validate many pins.
    const allowed = new Set(DEFAULT_PIN_CHARS);
    for (let i = 0; i < candidate.length; i++) {
        if (!allowed.has(candidate[i])) return false;
    }
    return true;
}
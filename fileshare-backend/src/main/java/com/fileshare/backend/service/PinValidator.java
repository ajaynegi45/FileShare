package com.fileshare.backend.service;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class PinValidator {

    private static final String PIN_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int PIN_LENGTH = 6;

    private static final Set<Character> ALLOWED_CHARACTER_SET = buildAllowedCharSet();

    private static Set<Character> buildAllowedCharSet() {
        Set<Character> set = new HashSet<>();
        for (char c : PIN_CHARACTERS.toCharArray()) {
            set.add(c);
        }
        return Set.copyOf(set);
    }


    /**
     * Validates whether the given PIN is structurally valid.
     * Rules:
     * - must not be null
     * - must normalize cleanly (NFKC)
     * - must be exactly PIN_LENGTH characters
     * - must contain only allowed characters
     * - must not contain whitespace, control or surrogate characters
     * - all characters must be UPPERCASE
     */
    public boolean isValid(String pin) {
        if (pin == null) return false;
        if (pin.isBlank()) return false;

        String normalized = normalize(pin);

        if (normalized.length() != PIN_LENGTH)
            return false;

        for (int i = 0; i < normalized.length(); i++) {
            char character = normalized.charAt(i);

            if (Character.isWhitespace(character)) return false;

            if (Character.isISOControl(character) || Character.isSurrogate(character)) return false;

            if (Character.isLetter(character) && Character.isLowerCase(character)) return false;

            if (!ALLOWED_CHARACTER_SET.contains(character)) return false;
        }

        return true;
    }

    /**
     * Normalization is limited to Unicode safety only.
     * No case mutation happens here.
     */
    private String normalize(String pin) {
        return Normalizer.normalize(pin, Normalizer.Form.NFKC).trim();
    }


    public String canonicalize(String pin) {
        return Normalizer.normalize(pin, Normalizer.Form.NFKC).trim().toUpperCase(Locale.ROOT);
    }

}

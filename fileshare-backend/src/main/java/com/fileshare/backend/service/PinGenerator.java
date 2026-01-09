package com.fileshare.backend.service;

import java.security.SecureRandom;

public class PinGenerator {
    private static final String PIN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int PIN_LENGTH = 6;
    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder(PIN_LENGTH);
        for (int i = 0; i < PIN_LENGTH; i++) {
            sb.append(PIN_CHARS.charAt(random.nextInt(PIN_CHARS.length())));
        }
        return sb.toString();
    }
}

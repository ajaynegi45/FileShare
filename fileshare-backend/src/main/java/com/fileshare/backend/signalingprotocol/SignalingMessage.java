package com.fileshare.backend.signalingprotocol;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fileshare.backend.service.PinValidator;

/**
 * Sealed interface for type-safe signaling messages.
 *
 * Using sealed types provides:
 * 1. Exhaustive pattern matching in switch expressions
 * 2. Compile-time safety when adding new message types
 * 3. Clear documentation of the protocol
 *
 * All subtypes are records (immutable) to prevent mutation after parsing.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = SignalingMessage.Register.class, name = "register"),
        @JsonSubTypes.Type(value = SignalingMessage.Join.class, name = "join"),
        @JsonSubTypes.Type(value = SignalingMessage.Offer.class, name = "offer"),
        @JsonSubTypes.Type(value = SignalingMessage.Answer.class, name = "answer"),
        @JsonSubTypes.Type(value = SignalingMessage.Candidate.class, name = "candidate"),
        @JsonSubTypes.Type(value = SignalingMessage.Control.class, name = "control"),
        @JsonSubTypes.Type(value = SignalingMessage.Error.class, name = "error"),
        @JsonSubTypes.Type(value = SignalingMessage.PeerJoined.class, name = "peer-joined"),
        @JsonSubTypes.Type(value = SignalingMessage.Joined.class, name = "joined")
})
public sealed interface SignalingMessage {

    /**
     * Sender registers a PIN to create a session.
     * Receiver will use this PIN to join.
     */
    record Register( @JsonProperty("pin") String pin) implements SignalingMessage {
        public Register {
            if (!new PinValidator().isValid(pin)) {
                throw new IllegalArgumentException("Invalid PIN");
            }
            pin = new PinValidator().canonicalize(pin);
        }
    }

    /**
     * Receiver joins an existing session by PIN.
     */
    record Join( @JsonProperty("pin") String pin) implements SignalingMessage {

        public Join {
            if (!new PinValidator().isValid(pin) ) {
                throw new IllegalArgumentException("Invalid PIN");
            }
        }
    }

    /**
     * WebRTC SDP offer from sender to receiver.
     */
    record Offer( @JsonProperty("payload") Object payload) implements SignalingMessage {
        public Offer {
            if (payload == null) {
                throw new IllegalArgumentException("Offer payload cannot be null");
            }
        }
    }

    /**
     * WebRTC SDP answer from receiver to sender.
     */
    record Answer( @JsonProperty("payload") Object payload) implements SignalingMessage {
        public Answer {
            if (payload == null) {
                throw new IllegalArgumentException("Answer payload cannot be null");
            }
        }
    }

    /**
     * ICE candidate for peer connection.
     */
    record Candidate( @JsonProperty("payload") Object payload) implements SignalingMessage {
        public Candidate {
            if (payload == null) {
                throw new IllegalArgumentException("Candidate payload cannot be null");
            }
        }
    }

    /**
     * Control messages for flow control (pause/resume/ready).
     */
    record Control( @JsonProperty("action") String action, @JsonProperty("data") Object data) implements SignalingMessage {

        public static final String ACTION_READY = "ready";
        public static final String ACTION_PAUSE = "pause";
        public static final String ACTION_RESUME = "resume";

        public Control {
            if (action == null || action.isBlank()) {
                throw new IllegalArgumentException("Control action cannot be null or blank");
            }
            if (!action.equals(ACTION_READY) && !action.equals(ACTION_PAUSE) && !action.equals(ACTION_RESUME)) {
                throw new IllegalArgumentException("Unknown control action: " + action);
            }
        }
    }

    /**
     * Error message sent by server.
     */
    record Error( @JsonProperty("message") String message, @JsonProperty("code") String code) implements SignalingMessage {
        public Error {
            if (message == null) {
                throw new IllegalArgumentException("Error message cannot be null");
            }
        }

        public Error(String message) {
            this(message, "UNKNOWN");
        }

        // Common error codes
        public static final String CODE_PIN_IN_USE = "PIN_IN_USE";
        public static final String CODE_INVALID_PIN = "INVALID_PIN";
        public static final String CODE_SESSION_FULL = "SESSION_FULL";
        public static final String CODE_RATE_LIMITED = "RATE_LIMITED";
        public static final String CODE_CAPACITY_EXCEEDED = "CAPACITY_EXCEEDED";
        public static final String CODE_MALFORMED_MESSAGE = "MALFORMED_MESSAGE";
    }

    /**
     * Notification to sender that receiver has joined.
     */
    record PeerJoined() implements SignalingMessage {
    }

    /**
     * Notification to receiver that they successfully joined.
     */
    record Joined() implements SignalingMessage {
    }
}


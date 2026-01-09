package com.fileshare.backend.repository;

import java.util.Map;

public interface SessionRepository {
    String createSession(String senderConnectionId);

    Map<String, String> getSession(String pin);

    boolean joinSession(String pin, String receiverConnectionId);

    String getPinByConnectionId(String connectionId);

    void removeSession(String pin);
}

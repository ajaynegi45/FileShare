package com.fileshare.backend.repository;

import com.fileshare.backend.service.PinGenerator;
import redis.clients.jedis.JedisPooled;
import java.util.HashMap;
import java.util.Map;

public class RedisSessionRepository implements SessionRepository {

    private final JedisPooled jedis;
    private final PinGenerator pinGenerator;

    private static final int TTL_SECONDS = 600; // 10 minutes
    private static final String PIN_KEY_PREFIX = "pin:";
    private static final String CONN_KEY_PREFIX = "connection:";

    public RedisSessionRepository(PinGenerator pinGenerator) {
        this.pinGenerator = pinGenerator;

        // Initialize Jedis using environment variables
        String host = System.getenv("REDIS_HOST");
        String password = System.getenv("REDIS_PASSWORD");
        int port = 6379;

        if (host == null)
            host = "localhost";

        if (host.contains(":")) {
            String[] parts = host.split(":");
            host = parts[0];
            port = Integer.parseInt(parts[1]);
        }

        if (password != null && !password.isEmpty()) {
            this.jedis = new JedisPooled(host, port, null, password);
        } else {
            this.jedis = new JedisPooled(host, port);
        }
    }

    @Override
    public String createSession(String senderConnectionId) {
        String pin;
        do {
            pin = pinGenerator.generate();
        } while (jedis.exists(PIN_KEY_PREFIX + pin));

        String pinKey = PIN_KEY_PREFIX + pin;
        Map<String, String> sessionData = new HashMap<>();
        sessionData.put("senderConnId", senderConnectionId);

        jedis.hset(pinKey, sessionData);
        jedis.expire(pinKey, TTL_SECONDS);

        // Store reverse mapping
        jedis.setex(CONN_KEY_PREFIX + senderConnectionId, TTL_SECONDS, pin);

        return pin;
    }

    @Override
    public Map<String, String> getSession(String pin) {
        return jedis.hgetAll(PIN_KEY_PREFIX + pin);
    }

    @Override
    public boolean joinSession(String pin, String receiverConnectionId) {
        String pinKey = PIN_KEY_PREFIX + pin;
        if (!jedis.exists(pinKey))
            return false;

        jedis.hset(pinKey, "receiverConnId", receiverConnectionId);
        jedis.expire(pinKey, TTL_SECONDS); // Refresh TTL

        // Store reverse mapping
        jedis.setex(CONN_KEY_PREFIX + receiverConnectionId, TTL_SECONDS, pin);
        return true;
    }

    @Override
    public String getPinByConnectionId(String connectionId) {
        return jedis.get(CONN_KEY_PREFIX + connectionId);
    }

    @Override
    public void removeSession(String pin) {
        if (pin == null)
            return;

        Map<String, String> session = getSession(pin);
        if (session != null) {
            String sender = session.get("senderConnId");
            String receiver = session.get("receiverConnId");

            if (sender != null)
                jedis.del(CONN_KEY_PREFIX + sender);
            if (receiver != null)
                jedis.del(CONN_KEY_PREFIX + receiver);
        }
        jedis.del(PIN_KEY_PREFIX + pin);
    }
}


package com.fileshare.backend;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2WebSocketEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2WebSocketResponse;
import com.fileshare.backend.service.PinGenerator;
import com.fileshare.backend.repository.RedisSessionRepository;
import com.fileshare.backend.repository.SessionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fileshare.backend.service.PinValidator;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.apigatewaymanagementapi.ApiGatewayManagementApiClient;
import software.amazon.awssdk.services.apigatewaymanagementapi.model.PostToConnectionRequest;

import java.net.URI;
import java.util.Map;

public class WebSocketHandler implements RequestHandler<APIGatewayV2WebSocketEvent, APIGatewayV2WebSocketResponse> {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SessionRepository sessionRepository;
    private ApiGatewayManagementApiClient apiClient;

    public WebSocketHandler() {
        PinGenerator pinGenerator = new PinGenerator();
        this.sessionRepository = new RedisSessionRepository(pinGenerator);
        initializeApiClient();
    }

    private void initializeApiClient() {
        String endpoint = System.getenv("API_GATEWAY_ENDPOINT");
        if (endpoint != null && !endpoint.isEmpty()) {
            this.apiClient = ApiGatewayManagementApiClient.builder()
                    .httpClient(UrlConnectionHttpClient.builder().build())
                    .endpointOverride(URI.create(endpoint))
                    .region(Region.of(System.getenv("AWS_REGION")))
                    .build();
        }
    }

    @Override
    public APIGatewayV2WebSocketResponse handleRequest(APIGatewayV2WebSocketEvent event, Context context) {
        String routeKey = event.getRequestContext().getRouteKey();
        String connectionId = event.getRequestContext().getConnectionId();

        context.getLogger().log("Received event: " + routeKey + " from " + connectionId);

        try {
            APIGatewayV2WebSocketResponse response = new APIGatewayV2WebSocketResponse();
            switch (routeKey) {
                case "$connect":
                    response.setStatusCode(200);
                    return response;
                case "$disconnect":
                    handleDisconnect(connectionId);
                    response.setStatusCode(200);
                    return response;
                case "$default":
                    handleMessage(connectionId, event.getBody());
                    response.setStatusCode(200);
                    return response;
                default:
                    response.setStatusCode(404);
                    return response;
            }
        } catch (Exception e) {
            context.getLogger().log("Error processing request: " + e.getMessage());
            e.printStackTrace();
            APIGatewayV2WebSocketResponse errorResponse = new APIGatewayV2WebSocketResponse();
            errorResponse.setStatusCode(500);
            return errorResponse;
        }
    }

    private void handleDisconnect(String connectionId) {
        String pin = sessionRepository.getPinByConnectionId(connectionId);
        if (pin != null) {
            Map<String, String> session = sessionRepository.getSession(pin);
            String sender = session.get("senderConnId");
            String receiver = session.get("receiverConnId");

            // Notify the other party
            String targetId = connectionId.equals(sender) ? receiver : sender;
            if (targetId != null) {
                sendMessage(targetId, "{\"type\": \"peer-left\"}");
            }

            sessionRepository.removeSession(pin);
        }
    }

    private void handleMessage(String connectionId, String body) throws Exception {
        if (body == null)
            return;

        JsonNode message = objectMapper.readTree(body);
        // Supports "action" for route selection or "type" payload
        String type = message.has("type") ? message.get("type").asText()
                : (message.has("action") ? message.get("action").asText() : "unknown");

        switch (type) {
            case "register":
                String pin = sessionRepository.createSession(connectionId);
                sendMessage(connectionId, "{\"type\": \"register\", \"pin\": \"" + pin + "\"}");
                break;

            case "join":
                String joinPin = message.get("pin").asText();
                boolean success = sessionRepository.joinSession(joinPin, connectionId);
                if (success) {
                    Map<String, String> session = sessionRepository.getSession(joinPin);
                    String sender = session.get("senderConnId");

                    sendMessage(sender, "{\"type\": \"peer-joined\"}");
                    sendMessage(connectionId, "{\"type\": \"joined\"}");
                } else {
                    sendMessage(connectionId, "{\"type\": \"error\", \"message\": \"Invalid PIN\"}");
                }
                break;

            case "offer":
            case "answer":
            case "candidate":
                relayMessage(connectionId, message, type);
                break;
        }
    }

    private void relayMessage(String fromConnectionId, JsonNode messageData, String type) {
        String pin = sessionRepository.getPinByConnectionId(fromConnectionId);
        if (new PinValidator().isValid(pin)) {
            Map<String, String> session = sessionRepository.getSession(pin);
            String sender = session.get("senderConnId");
            String receiver = session.get("receiverConnId");

            String targetId = fromConnectionId.equals(sender) ? receiver : sender;
            if (targetId != null) {
                sendMessage(targetId, messageData.toString());
            }
        }
    }

    private void sendMessage(String connectionId, String data) {
        if (apiClient == null) return;

        try {
            apiClient.postToConnection(PostToConnectionRequest.builder()
                    .connectionId(connectionId)
                    .data(SdkBytes.fromUtf8String(data))
                    .build());
        } catch (Exception e) {
            System.err.println("Failed to send message to " + connectionId + ": " + e.getMessage());
        }
    }
}

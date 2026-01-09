export class SignalingService {

    private socket: WebSocket | null = null;
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    public connect(onOpen: () => void, onMessage: (msg: any) => void, onClose: () => void, onError: (error: Event) => void): WebSocket {
        if (this.socket) this.socket.close();

        const webSocket = new WebSocket(this.url);
        this.socket = webSocket;

        webSocket.onopen = onOpen;
        webSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                onMessage(msg);
            } catch (err) {
                console.error('Failed to parse signaling message: ', err);
            }
        };
        webSocket.onclose = onClose;
        webSocket.onerror = onError;
        return webSocket;
    }

    //  Sends a message to the signaling server.
    public send(action: string, payload: any): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // API Gateway expects "action" in the body for routing via $request.body.action
            const message = { action, ...payload };
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message: WebSocket is not open.');
        }
    }

    // Send for ICE candidates.
    public sendCandidate(candidate: RTCIceCandidate): void {
        this.send('candidate', { payload: candidate.toJSON() });
    }

    // Send for Session Descriptions (Offer/Answer).
    public sendSDP(type: 'offer' | 'answer', description: RTCSessionDescriptionInit): void {
        this.send(type, { payload: description });
    }

    // Properly closes the signaling socket.
    public disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    // Gets the current WebSocket state.
    public get isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}


// Get the signaling URL based on environment.
export const getSignalingUrl = () => {
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    // Default to the provided production URL if env is not set
    return 'wss://localhost:8080';
};
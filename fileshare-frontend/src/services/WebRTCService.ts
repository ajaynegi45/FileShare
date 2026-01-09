
// Handles PeerConnection and DataChannel setup
export class WebRTCService {
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private config: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };


    // Initializes a new PeerConnection
    public createPeerConnection( onIceCandidate: (candidate: RTCIceCandidate) => void, onConnectionStateChange: (state: RTCPeerConnectionState) => void, onDataChannel: (channel: RTCDataChannel) => void): RTCPeerConnection {

        if (this.peerConnection) this.close();

        const peerConnection = new RTCPeerConnection(this.config);
        this.peerConnection = peerConnection;

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) onIceCandidate(event.candidate);
        };

        peerConnection.onconnectionstatechange = () => {
            onConnectionStateChange(peerConnection.connectionState);
        };

        peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            onDataChannel(event.channel);
        };

        return peerConnection;
    }


    // Creates a data channel (Initiator only)
    public createDataChannel(label: string): RTCDataChannel {
        if (!this.peerConnection) throw new Error('PeerConnection not initialized');

        const dc = this.peerConnection.createDataChannel(label, { ordered: true });
        this.dataChannel = dc;
        return dc;
    }


    // Generates an SDP offer
    public async createOffer(): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) throw new Error('PeerConnection not initialized');
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        return offer;
    }


    // Processes an incoming SDP offer and generates an SDP answer
    public async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) throw new Error('PeerConnection not initialized');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        return answer;
    }


    // Processes an incoming SDP answer
    public async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection) throw new Error('PeerConnection not initialized');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }


    // Adds an incoming ICE candidate
    public async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection) throw new Error('PeerConnection not initialized');
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }


    // Closes the connection and channel
    public close(): void {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }


    public get getPeerConnection(): RTCPeerConnection | null {
        return this.peerConnection;
    }


    public get getDataChannel(): RTCDataChannel | null {
        return this.dataChannel;
    }
}
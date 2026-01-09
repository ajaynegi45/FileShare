'use client';

import {useCallback, useEffect, useRef} from 'react';
import {Sender} from '@/lib/transport/Sender';
import {Receiver} from '@/lib/transport/Receiver';
import {isProtocolMessage} from '@/lib/protocol/ChunkProtocol';
import {useTransferStore} from '@/store/useTransferStore';
import {getSignalingUrl, SignalingService} from '@/services/SignalingService';
import {WebRTCService} from '@/services/WebRTCService';
import {toast} from "sonner";

/**
 * Hook for P2P file transfer with WebRTC
 */
export const useP2P = () => {
    const {p2p, setProgress, setP2PState, resetAll} = useTransferStore();

    const signalingRef = useRef<SignalingService | null>(null);
    const webRTCRef = useRef<WebRTCService | null>(null);
    const senderRef = useRef<Sender | null>(null);
    const receiverRef = useRef<Receiver | null>(null);


    /** --- Cleans up all resources --- */
    const cleanup = useCallback(() => {
        webRTCRef.current?.close();
        signalingRef.current?.disconnect();
        receiverRef.current?.cleanup();

        senderRef.current = null;
        receiverRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);


    /** --- Sets up the data channel with transport layer --- */
    const setupDataChannel = useCallback((dataChannel: RTCDataChannel) => {
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.bufferedAmountLowThreshold = 256 * 1024; // 256KB

        dataChannel.onopen = () => {
            console.log('Data channel open');
            setP2PState({isConnected: true, isConnecting: false, status: 'Data channel ready'});

            const currentRole = useTransferStore.getState().p2p.role;
            if (currentRole === 'sender') {
                const sender = new Sender();
                sender.initialize(dataChannel, setProgress);
                senderRef.current = sender;
            } else {
                const receiver = new Receiver();
                receiver.initialize(dataChannel, setProgress);
                receiverRef.current = receiver;
            }
        };

        dataChannel.onclose = () => {
            setP2PState({status: 'Channel closed', isConnected: false});
        };

        dataChannel.onerror = () => {
            setP2PState({error: 'Data channel error'});
        };

        dataChannel.onmessage = (event) => {
            const currentRole = useTransferStore.getState().p2p.role;
            if (currentRole === 'sender' && senderRef.current && typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (isProtocolMessage(msg)) {
                        senderRef.current.handleMessage(msg);
                    }
                } catch { /* Ignore */
                }
            }
        };
    }, [setP2PState, setProgress]);


    /** --- Orchestrates the WebRTC connection creation --- */
    const initWebRTC = useCallback(() => {
        if (!webRTCRef.current) webRTCRef.current = new WebRTCService();

        return webRTCRef.current.createPeerConnection(
            (candidate) => signalingRef.current?.sendCandidate(candidate),
            (state) => {
                if (state === 'connected') {
                    setP2PState({isConnecting: false, status: 'P2P Connected'});
                } else if (state === 'failed' || state === 'disconnected') {
                    setP2PState({error: 'Connection lost', status: 'Disconnected', isConnected: false});
                }
            },
            (dc) => setupDataChannel(dc)
        );
    }, [setupDataChannel, setP2PState]);


    /** --- Connects to signaling server --- */
    const connectSignaling = useCallback(() => {
        if (signalingRef.current?.isConnected) return;

        if (!signalingRef.current) {
            signalingRef.current = new SignalingService(getSignalingUrl());
        }

        setP2PState({isConnecting: true, status: 'Connecting to server...'});

        signalingRef.current.connect(
            () => {
                setP2PState({status: 'Connected to server'});
            },
            async (msg) => {
                // ALWAYS get the latest state from the store inside async callbacks to avoid closure stale state issues.
                const currentP2P = useTransferStore.getState().p2p;

                // Support both "action" (new convention) and "type" (legacy/backend)
                const msgType = msg.action || msg.type;

                switch (msgType) {
                    case 'register':
                        // Server generated a PIN for us
                        if (currentP2P.role === 'sender') {
                            // Update the state with the received PIN
                            setP2PState({pin: msg.pin, status: 'Waiting for receiver...'});
                        }

                        toast.success('Session ready', {
                            description: `Share this PIN with your receiver: ${msg.pin}`,
                        });

                        break;

                    case 'peer-joined':
                        if (currentP2P.role === 'sender') {
                            initWebRTC();
                            const dataChannel = webRTCRef.current!.createDataChannel('fileTransfer');
                            setupDataChannel(dataChannel);
                            const offer = await webRTCRef.current!.createOffer();
                            signalingRef.current?.sendSDP('offer', offer);
                            setP2PState({status: 'Peer joined, connecting...'});

                            toast.info('Receiver joined', {
                                description: 'Establishing direct connection. Transfer will start once connected.',
                            });
                        }
                        break;

                    case 'joined':
                        setP2PState({status: 'Waiting for sender...'});
                        toast.info('Joined session', {
                            description: 'Connected to session. Waiting for the sender to start the transfer.',
                        });
                        break;

                    case 'offer':
                        if (currentP2P.role === 'receiver') {
                            initWebRTC();
                            toast.info('Offer received', {
                                description: 'Preparing answer and establishing a direct connection...',
                            });
                            const answer = await webRTCRef.current!.createAnswer(msg.payload);
                            signalingRef.current?.sendSDP('answer', answer);
                            setP2PState({status: 'Received offer, connecting...'});
                        }
                        break;

                    case 'answer':
                        if (currentP2P.role === 'sender') {
                            await webRTCRef.current?.setRemoteAnswer(msg.payload);
                            toast.success('Peer answered', {
                                description: 'Connection is being finalized. You can start sending files shortly.',
                            });
                        }
                        break;

                    case 'candidate':
                        await webRTCRef.current?.addCandidate(msg.payload);
                        break;

                    case 'error':
                        setP2PState({error: msg.message, isConnecting: false, status: 'Error: ' + msg.message});
                        toast.error(msg.message || 'An error occurred on the signaling server.');
                        break;
                }
            },
            () => {
                signalingRef.current = null;
                // toast.error('Disconnected from signaling server', {
                //   description: 'Signaling connection closed.',
                // });
            },
            () => {
                setP2PState({error: 'Failed to connect to server', isConnecting: false});
                toast.error('Failed to connect to signaling server', {
                    description: 'Check your network and try again.',
                });
            }
        );
    }, [p2p.role, setP2PState, initWebRTC, setupDataChannel]);


    /** --- Registers a new session (sender role) --- */
    const registerSession = useCallback(() => {
        setP2PState({role: 'sender', status: 'Registering session...', pin: ''}); // Clear PIN initially
        connectSignaling();

        const waitAndRegister = () => {
            if (signalingRef.current?.isConnected) {
                // Send register message WITHOUT pin to request one
                signalingRef.current.send('register', {pin: null});
                setP2PState({status: 'Requesting PIN...'});
            } else {
                setTimeout(waitAndRegister, 100);
            }
        };
        waitAndRegister();
    }, [connectSignaling, setP2PState]);


    /** --- Joins an existing session (receiver role) --- */
    const joinSession = useCallback((pin: string) => {
        setP2PState({role: 'receiver', status: 'Joining session...', pin});
        connectSignaling();

        const waitAndJoin = () => {
            if (signalingRef.current?.isConnected) {
                signalingRef.current.send('join', {pin});
            } else {
                setTimeout(waitAndJoin, 100);
            }
        };
        waitAndJoin();
    }, [connectSignaling, setP2PState]);


    /** --- Sends a file (sender only) --- */
    const sendFile = useCallback(async (file: File) => {
        if (!senderRef.current) {
            toast.error('Not connected as sender', {
                description: 'Start a session and wait for a receiver to join before sending files.',
            });
            throw new Error('Not connected as sender');
        }
        await senderRef.current.sendFile(file);
    }, []);


    /** --- Cancels the current transfer --- */
    const cancelTransfer = useCallback(() => {
        senderRef.current?.cancel();
        cleanup();
        resetAll();
    }, [cleanup, resetAll]);


    /** --- Pause/Resume (Receiver only) --- */
    const pauseTransfer = useCallback(() => receiverRef.current?.pause(), []);
    const resumeTransfer = useCallback(() => receiverRef.current?.resume(), []);


    return {registerSession, joinSession, sendFile, cancelTransfer, pauseTransfer, resumeTransfer,};
};

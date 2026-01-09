import { create } from 'zustand';
import { type TransferProgress, INITIAL_PROGRESS } from '@/lib/protocol/TransferState';

// Interface representing the P2P connection and session state
export interface P2PState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    status: string;
    role: 'sender' | 'receiver' | null;
    pin: string | null;
}

// Interface representing the file transfer state
export interface FileState {
    selectedFiles: File[];
    currentFileIndex: number;
    transferStarted: boolean;
    isComplete: boolean;
    totalFilesSize: number;
}

// Interface defining the complete transfer store state and actions
interface TransferStore {
    // State
    p2p: P2PState;
    file: FileState;
    progress: TransferProgress;

    // P2P Actions
    setP2PState: (state: Partial<P2PState>) => void;
    resetP2P: () => void;

    // File Actions
    setSelectedFiles: (files: File[]) => void;
    setCurrentFileIndex: (index: number) => void;
    setTransferStarted: (started: boolean) => void;
    setIsComplete: (complete: boolean) => void;
    resetFileState: () => void;

    // Progress Actions
    setProgress: (progress: TransferProgress) => void;
    resetProgress: () => void;

    // Composite Actions
    resetAll: () => void;
}

// Initial P2P state constant
const INITIAL_P2P_STATE: P2PState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    status: 'Idle',
    role: null,
    pin: null,
};

// Initial File state constant
const INITIAL_FILE_STATE: FileState = {
    selectedFiles: [],
    currentFileIndex: 0,
    transferStarted: false,
    isComplete: false,
    totalFilesSize: 0,
};


export const useTransferStore = create<TransferStore>((set) => ({
    // Initial States
    p2p: INITIAL_P2P_STATE,
    file: INITIAL_FILE_STATE,
    progress: INITIAL_PROGRESS,

    // P2P Actions
    setP2PState: (newState) => set((state) => ({ p2p: { ...state.p2p, ...newState } })),

    resetP2P: () => set({ p2p: INITIAL_P2P_STATE }),

    // File Actions
    setSelectedFiles: (files) => {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        set((state) => ({
            file: {
                ...state.file,
                selectedFiles: files,
                totalFilesSize: totalSize
            }
        }));
    },

    setCurrentFileIndex: (index) => set((state) => ({ file: { ...state.file, currentFileIndex: index } })),

    setTransferStarted: (started) => set((state) => ({ file: { ...state.file, transferStarted: started } })),

    setIsComplete: (complete) => set((state) => ({ file: { ...state.file, isComplete: complete } })),

    resetFileState: () => set({ file: INITIAL_FILE_STATE }),

    // Progress Actions
    setProgress: (progress) => set({ progress }),

    resetProgress: () => set({ progress: INITIAL_PROGRESS }),

    // Composite Actions
    resetAll: () => set({
        p2p: INITIAL_P2P_STATE,
        file: INITIAL_FILE_STATE,
        progress: INITIAL_PROGRESS
    }),
}));
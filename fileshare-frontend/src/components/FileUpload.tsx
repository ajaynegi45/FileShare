'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiFile } from 'react-icons/fi';
import { useP2P } from '../lib/useP2P';
import ShareLink from './ShareLink';
import TransferProgress from './TransferProgress';
import { formatBytes } from '@/lib/protocol/TransferState';
import { useTransferStore } from '@/store/useTransferStore';
import {ShimmeringText} from "@/components/ui/ShimmeringText";


export default function FileUpload() {

  const { p2p, file, progress, setSelectedFiles, setTransferStarted, setCurrentFileIndex, setIsComplete, resetAll } = useTransferStore();
  const { registerSession, sendFile, cancelTransfer } = useP2P()
  const [uploading, setUploading] = useState(false);

  /** --- Handle drop event from dropzone --- */
  const onDrop = useCallback((acceptedFiles: File[]) => {
      setUploading(true);
    if (acceptedFiles.length > 0) {
      setSelectedFiles(acceptedFiles);
      // Backend generates the PIN now
      registerSession();
    }
  }, [registerSession, setSelectedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: file.selectedFiles.length > 0,
  });

  /** --- Orchestrates the file transfer loop --- */
  const handleStartTransfer = useCallback(async () => {
    if (file.selectedFiles.length > 0 && p2p.isConnected && !file.transferStarted) {
      setTransferStarted(true);
      setCurrentFileIndex(0);
      setIsComplete(false);
      try {
        for (let i = 0; i < file.selectedFiles.length; i++) {
          if (!p2p.isConnected) throw new Error("Connection lost");
          setCurrentFileIndex(i);
          await sendFile(file.selectedFiles[i]);
        }
        setIsComplete(true);
      } catch (error) {
        console.error('Transfer failed:', error);
      }
    }
  }, [file.selectedFiles, p2p.isConnected, file.transferStarted, sendFile, setTransferStarted, setCurrentFileIndex, setIsComplete]);

  // Trigger transfer when connected
  useEffect(() => {
    if (p2p.isConnected && file.selectedFiles.length > 0 && !file.transferStarted) {
      handleStartTransfer();
    }
  }, [p2p.isConnected, file.selectedFiles, file.transferStarted, handleStartTransfer]);

  // Component-specific cleanup/reset
  const handleReset = () => {
    setUploading(false);
    cancelTransfer();
    resetAll();
  };

  const currentFile = file.selectedFiles[file.currentFileIndex];


  // UI State: Session Registration and PIN Generation
  if( uploading && !p2p.pin){
    return (
      <div className={" text-center flex flex-col justify-center align-center"}>
        <div className={"w-full h-full flex justify-center align-center mb-1"}>
          <svg width="60" height="60" viewBox="0 0 50 50" className="loading-dots">
            <circle cx="10" cy="25" r="2" className="dot">
              <animate attributeName="cy" values="25;20;25;30;25" dur="1s" begin="0s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0s" repeatCount="indefinite" />
            </circle>

            <circle cx="18" cy="25" r="2" className="dot">
              <animate attributeName="cy" values="25;20;25;30;25" dur="1s" begin="0.1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.1s" repeatCount="indefinite" />
            </circle>

            <circle cx="26" cy="25" r="2" className="dot">
              <animate attributeName="cy" values="25;20;25;30;25" dur="1s" begin="0.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.2s" repeatCount="indefinite" />
            </circle>

            <circle cx="34" cy="25" r="2" className="dot">
              <animate attributeName="cy" values="25;20;25;30;25" dur="1s" begin="0.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.3s" repeatCount="indefinite" />
            </circle>

            <circle cx="42" cy="25" r="2" className="dot">
              <animate attributeName="cy" values="25;20;25;30;25" dur="1s" begin="0.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.4s" repeatCount="indefinite" />
            </circle>
          </svg>

        </div>
        <ShimmeringText text="Loading" duration={2} repeatDelay={0.1} />
      </div>
    );
  }


  // UI State: Completed
  if (file.isComplete) {
    return (
      <div className="text-center space-y-6 animate-in fade-in duration-300">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-hover text-green-500 mb-2">
          <FiFile className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Transfer Complete</h3>
          <p className="text-sm text-secondary">
            {file.selectedFiles.length} file{file.selectedFiles.length > 1 ? 's' : ''} sent successfully.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="w-full py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
        >
          Send More
        </button>
      </div>
    );
  }

  // UI State: Transferring
  if (file.transferStarted && currentFile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
          <div className="text-secondary">
            <FiFile className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentFile.name}</p>
            <p className="text-xs text-secondary">
              {file.currentFileIndex + 1}/{file.selectedFiles.length} • {formatBytes(currentFile.size)}
            </p>
          </div>
        </div>
        <TransferProgress
          progress={progress}
          role="sender"
          onCancel={handleReset}
        />
      </div>
    );
  }

  // UI State: Files Selected (Waiting for Connection)
  if (file.selectedFiles.length > 0 && p2p.pin) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-surface rounded-lg p-1 max-h-32 overflow-y-auto border border-border">
          {file.selectedFiles.map((f, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 text-sm text-foreground">
              <FiFile className="w-4 h-4 text-secondary" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-secondary">{formatBytes(f.size)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center text-xs text-secondary px-1">
          <span className="hidden sm:block">{file.selectedFiles.length} {file.selectedFiles.length > 1 ? 'files' : 'file'} selected • Total size: {formatBytes(file.totalFilesSize)}</span>
          <span className="sm:hidden">{file.selectedFiles.length} {file.selectedFiles.length > 1 ? 'files' : 'file'} • {formatBytes(file.totalFilesSize)}</span>
          <button onClick={handleReset} className="hover:text-red-500 transition-colors cursor-pointer">Cancel</button>
        </div>

        <ShareLink pin={p2p.pin} />

        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-surface rounded-full text-xs text-secondary border border-border">
            <span className={`w-1.5 h-1.5 rounded-full ${p2p.isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
            {p2p.status}
          </span>
        </div>
      </div>
    );
  }

  // Default: Dropzone UI
  return (
    <div
      {...getRootProps()}
      className={`
        relative group cursor-copy flex flex-col items-center justify-center 
        w-full h-48 border border-dashed rounded-lg transition-all duration-300
        ${isDragActive
          ? 'border-accent bg-surface-hover'
          : 'border-border hover:border-secondary hover:bg-surface-hover'}
      `}
    >
      <input {...getInputProps()} />
      <div className="p-3 bg-surface rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 border border-border group-hover:border-secondary">
        <FiUpload className="w-5 h-5 text-secondary group-hover:text-foreground transition-colors" />
      </div>
      <p className="text-sm font-medium text-foreground">Drop files here</p>
      <p className="text-xs text-secondary mt-1">or click to browse</p>
    </div>
  );
}

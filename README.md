# FileShare: P2P File Sharing System

A high-performance, secure, and Peer-to-Peer (P2P) file sharing system using WebRTC for direct client-to-client transfers and AWS Lambda with Redis for signaling.

## Project Overview

FileShare consists of a modern React/Next.js frontend and a serverless Java-based signaling backend. It allows users to share files by simply sharing a PIN, establishing a peer-to-peer connection for faster and private data transfer.

## 🏗️ Architecture

The system follows a WebRTC-based architecture:
1. **Signaling Server (Backend)**: Handles user registration, PIN generation, and WebRTC handshake (offer/answer/ice candidates).
2. **Sender Client**: Initiates the share, generates a PIN, and waits for a receiver.
3. **Receiver Client**: Enters the PIN, connects to the sender, and receives the file in chunks.
4. **Data Transfer**: Once connected, files are transferred directly between browsers via `RTCDataChannel`.

## 📁 Repository Structure

```text
.
├── fileshare-frontend/    # Next.js Frontend (React, TypeScript, TailwindCSS)
├── fileshare-backend/     # AWS Lambda Signaling Server (Java, Spring Boot, Redis)
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Java 17+ and Maven (for backend)
- Redis instance (for backend signaling)

### Development Setup

#### Frontend
1. Navigate to `fileshare-frontend`:
   ```bash
   cd fileshare-frontend
   npm install
   npm run dev
   ```
2. Open `http://localhost:3000`.

#### Backend
1. Navigate to `fileshare-backend`:
   ```bash
   cd fileshare-backend
   mvn install
   ```
2. Deploy as an AWS Lambda or run locally with appropriate environment variables for Redis and API Gateway.

## ⚖️ Features

- **P2P Transfer**: Direct browser-to-browser transfer (WebRTC).
- **No File Size Limits**: Files are streamed in chunks.
- **PIN-based Pairing**: Simple 6-digit PIN for session discovery.
- **Serverless Backend**: Scalable signaling using AWS Lambda.
- **Modern UI**: Slick dark-themed interface built with Next.js.

---

For more detailed technical information, see [ARCHITECTURE.md](/ARCHITECTURE.md).

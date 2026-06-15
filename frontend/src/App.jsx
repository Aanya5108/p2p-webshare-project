import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer/simplepeer.min.js";
import "./App.css";

const socket = io("https://p2p-webshare-project-backend.onrender.com", {
  transports: ["websocket"],
});

function App() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");

  const [roomId, setRoomId] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");

  const [message, setMessage] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);

  const [transferProgress, setTransferProgress] =
    useState(0);

  const [transferStatus, setTransferStatus] =
    useState("");

    const [transferSpeed, setTransferSpeed] =
  useState("0 MB/s");

  const [dragActive, setDragActive] =
  useState(false);

  const [receivedFile, setReceivedFile] =
    useState(null);

  const [receivedFileName, setReceivedFileName] =
    useState("");

  const peerRef = useRef(null);

  const receivedChunksRef = useRef([]);

  const fileNameRef = useRef("");

  const fileTypeRef = useRef("");
  const expectedHashRef = useRef("");
  const receiveStartTimeRef = useRef(0);

  const generateHash = async (buffer) => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    buffer
  );

  const hashArray = Array.from(
    new Uint8Array(hashBuffer)
  );

  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
};

  useEffect(() => {
    if (socket.connected) {
      setConnected(true);
      setSocketId(socket.id);
    }

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setSocketId("");
    });

    socket.on("room-created", (room) => {
      setCurrentRoom(room);
      setMessage("Room created successfully");
    });

    socket.on("room-joined", (room) => {
  setCurrentRoom(room);
  setRoomId(room);
  setMessage("Joined room successfully");
});

    socket.on("room-not-found", () => {
      setMessage("Room does not exist");
    });

    // Initiating part

    socket.on("peer-joined", () => {
      setMessage(
        "Peer joined. Creating connection..."
      );

      const peer = new Peer({
        initiator: true,
        trickle: false,
      });

      peer.on("signal", (data) => {
        socket.emit("signal", {
          roomId: currentRoom,
          data,
        });
      });

      peer.on("connect", () => {
        console.log("WEBRTC CONNECTED");
        setMessage(
          "Peer-to-peer connection established"
        );
      });

      // Receiving file data part

      peer.on("data", handleIncomingData);

      peerRef.current = peer;
    });

    // Receiver part

    socket.on("signal", (data) => {
      if (!peerRef.current) {
        const peer = new Peer({
          initiator: false,
          trickle: false,
        });

        peer.on("signal", (signalData) => {
          socket.emit("signal", {
            roomId: roomId,
            data: signalData,
          });
        });

        peer.on("connect", () => {
          console.log("WEBRTC CONNECTED");
          setMessage(
            "Peer-to-peer connection established"
          );
        });

        // To receive file data

        peer.on("data", handleIncomingData);

        peer.signal(data);

        peerRef.current = peer;
      } else {
        peerRef.current.signal(data);
      }
    });

    socket.on("peer-disconnected", () => {
  setMessage("Peer disconnected");

  setTransferStatus("Transfer interrupted");

  setTransferProgress(0);

  if (peerRef.current) {
    peerRef.current.destroy();
    peerRef.current = null;
  }
});

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("room-not-found");
      socket.off("peer-joined");
      socket.off("signal");
      socket.off("peer-disconnected");
    };
  }, [currentRoom, roomId]);

  // To handle recieved data

const receivedSizeRef = useRef(0);

const totalFileSizeRef = useRef(0);

const handleIncomingData = (data) => {
  try {
    const parsed = JSON.parse(data);

    // Metadta

    if (parsed.type === "metadata") {
      fileNameRef.current = parsed.fileName;

      fileTypeRef.current = parsed.fileType;

      totalFileSizeRef.current = parsed.fileSize;

      receivedChunksRef.current = [];

      receivedSizeRef.current = 0;

      setTransferProgress(0);

      receiveStartTimeRef.current = Date.now();

      setTransferStatus("Receiving file...");
    }

    else if (parsed.type === "chunk") {
  expectedHashRef.current = parsed.hash;
}

    // Transfer completed

    else if (parsed.type === "done") {
      const receivedBlob = new Blob(
        receivedChunksRef.current,
        {
          type: fileTypeRef.current,
        }
      );

      setReceivedFile(receivedBlob);

      setReceivedFileName(fileNameRef.current);

      setTransferProgress(100);

      setTransferStatus(
        "File received successfully"
      );

      const downloadUrl = URL.createObjectURL(receivedBlob);

const downloadLink = document.createElement("a");

downloadLink.href = downloadUrl;
downloadLink.download = fileNameRef.current;

document.body.appendChild(downloadLink);

downloadLink.click();

downloadLink.remove();

URL.revokeObjectURL(downloadUrl);
    }
  } catch { verifyChunk(data); }
};

const verifyChunk = async (data) => {
  const receivedHash = await generateHash(data);

  if (receivedHash !== expectedHashRef.current) {
    setTransferStatus(
      "File corruption detected"
    );

    return;
  }

  receivedChunksRef.current.push(data);

  receivedSizeRef.current += data.byteLength;

  const progress = Math.floor(
    (receivedSizeRef.current /
      totalFileSizeRef.current) *
      100
  );

  setTransferProgress(progress);

  const elapsedSeconds =
  (Date.now() -
    receiveStartTimeRef.current) /
  1000;

const speedMBps =
  receivedSizeRef.current /
  1024 /
  1024 /
  elapsedSeconds;

setTransferSpeed(
  speedMBps.toFixed(2) + " MB/s"
);
};

  // Creating room part

  const createRoom = () => {
    const randomRoomId = Math.random()
      .toString(36)
      .substring(2, 8);

    socket.emit("create-room", randomRoomId);
  };

  // Joining room part

  const joinRoom = () => {
    if (!roomId) return;

    socket.emit("join-room", roomId);
  };

  // Sending file part

  const sendFile = () => {
    if (!selectedFile) {
      alert("Please choose a file");
      return;
    }

    if (!peerRef.current) {
      alert("Peer connection not established");
      return;
    }

    const chunkSize = 8 * 1024;

    const fileReader = new FileReader();

    let offset = 0;

    const startTime = Date.now();

    setTransferStatus("Sending file...");
    setTransferProgress(0);

    // Sending Metadata part

    peerRef.current.send(
      JSON.stringify({
        type: "metadata",
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
      })
    );

  fileReader.onload = async (e) => {
  const chunk = e.target.result;

  // Generating hash

  const hash = await generateHash(chunk);

  // Send chunck+hash

  peerRef.current.send(
    JSON.stringify({
      type: "chunk",
      hash,
    })
  );

  peerRef.current.send(chunk);

  offset += chunk.byteLength;

  const progress = Math.floor(
    (offset / selectedFile.size) * 100
  );

  setTransferProgress(progress);

  const elapsedSeconds =
  (Date.now() - startTime) / 1000;

const speedMBps =
  offset /
  1024 /
  1024 /
  elapsedSeconds;

setTransferSpeed(
  speedMBps.toFixed(2) + " MB/s"
);

  if (offset < selectedFile.size) {
    setTimeout(() => {
      readSlice(offset);
    }, 10);
  } else {
    peerRef.current.send(
      JSON.stringify({
        type: "done",
      })
    );

    setTransferStatus(
      "File sent successfully"
    );
  }
};

    const readSlice = (o) => {
      const slice = selectedFile.slice(
        o,
        o + chunkSize
      );

      fileReader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  };

  const handleDragOver = (e) => {
  e.preventDefault();

  setDragActive(true);
};

const handleDragLeave = (e) => {
  e.preventDefault();

  setDragActive(false);
};

const handleDrop = (e) => {
  e.preventDefault();

  setDragActive(false);

  const file = e.dataTransfer.files[0];

  if (file) {
    setSelectedFile(file);
  }
};

return (
  <div className="app-shell">
    <div className="background-glow glow-one"></div>
    <div className="background-glow glow-two"></div>

    <main className="app-card">
      <section className="hero-section">
        <div className="badge">WebRTC • Secure • Direct</div>

        <h1>P2P Web Share</h1>

        <p className="subtitle">
          Transfer files directly from one browser to another using encrypted
          peer-to-peer WebRTC data channels.
        </p>
      </section>

      <section className="status-grid">
        <div className="status-card">
          <span className="status-label">Backend</span>
          <strong className={connected ? "status-good" : "status-bad"}>
            {connected ? "Connected" : "Disconnected"}
          </strong>
        </div>

        <div className="status-card">
          <span className="status-label">Peer</span>
          <strong
            className={
              message.includes("established")
                ? "status-good"
                : message.includes("disconnected") ||
                  message.includes("interrupted")
                ? "status-bad"
                : "status-waiting"
            }
          >
            {message.includes("established")
              ? "Connected"
              : message.includes("disconnected") ||
                message.includes("interrupted")
              ? "Disconnected"
              : "Waiting"}
          </strong>
        </div>

        <div className="status-card socket-card">
          <span className="status-label">Socket ID</span>
          <strong>{socketId || "Not assigned"}</strong>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel room-panel">
          <div className="panel-header">
            <h2>Room Setup</h2>
            <p>Create a room or join an existing one using its room code.</p>
          </div>

          <button className="primary-btn" onClick={createRoom}>
            Create Room
          </button>

          <div className="join-row">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <button className="secondary-btn" onClick={joinRoom}>
              Join Room
            </button>
          </div>

          {currentRoom && (
            <div className="room-code-box">
              <span>Current Room</span>
              <strong>{currentRoom}</strong>
            </div>
          )}
        </div>

        <div className="panel transfer-panel">
          <div className="panel-header">
            <h2>File Transfer</h2>
            <p>Drop a file below or choose it manually, then send it directly.</p>
          </div>

          <div className="transfer-row">
            <div
              className={dragActive ? "drop-zone active" : "drop-zone"}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="drop-icon">⇪</div>

              <h3>Drag & Drop File Here</h3>

              <p>or choose manually</p>

              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />

              {selectedFile && (
                <div className="selected-file">
                  <span>Selected file</span>
                  <strong>{selectedFile.name}</strong>
                  <small>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                </div>
              )}
            </div>

            <button className="send-btn" onClick={sendFile}>
              Send File
            </button>
          </div>
        </div>
      </section>

      <section className="feedback-panel">
        {message && <p className="message-text">{message}</p>}

        {transferStatus && <p className="transfer-status">{transferStatus}</p>}

        {transferProgress > 0 && (
          <div className="progress-wrapper">
            <div className="progress-topline">
              <span>Transfer Progress</span>
              <strong>{transferProgress}%</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${transferProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {transferProgress > 0 && (
          <div className="speed-pill">
            Speed: <strong>{transferSpeed}</strong>
          </div>
        )}

        {receivedFile && (
          <a
            className="download-link"
            href={URL.createObjectURL(receivedFile)}
            download={receivedFileName}
          >
            CLICK HERE to Download received file manually if auto-download has not started
          </a>
        )}
      </section>

      <section className="feature-strip">
        <span>SHA-256 verified chunks</span>
        <span>Graceful disconnect handling</span>
        <span>No server-side file storage</span>
      </section>
    </main>
  </div>
);
}

export default App;

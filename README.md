# 🧘‍♂️ Mediasoup AI Pose Development Platform
**A real-time, 3-tier motor development application for children. This system uses WebRTC to stream video to a Mediasoup SFU, which routes raw frames to a Python AI engine for skeletal geometry analysis.**

https://github.com/user-attachments/assets/cbf253b1-91a1-41c2-8476-2163e46e1983

**🚀 System Architecture**
The project is divided into three main components:

1. **Client (React):** The interactive UI and game logic.

2. **Server (Node.js/Mediasoup):** The video router and signaling bridge.

3. **Python Engine (AI):** The computer vision brain using MediaPipe.
<img width="1919" height="862" alt="Screenshot 2026-04-02 215039" src="https://github.com/user-attachments/assets/e888591a-39f6-4ee9-a595-6c9aece205c5" />

## 🛠️ Setup & Installation
### 1. Python AI Backend (/python_engine):
This engine handles the pose estimation and action detection.

* **Open a new terminal:**
    ```bash
    cd python_engine
    pip install -r requirements.txt
    python processor.py
    ```
    *(Mac users may need to run `python3 processor.py`)*

### 2. Mediasoup Signaling Server (/server):
The bridge that connects the browser video to the Python engine.

* **Open a second terminal:**
    ```bash
    cd server
    npm install
    npm start
    ```

### 3. React Frontend (/client):
The user interface for the activities and Parent Dashboard.

* **Open a third terminal:**
    ```bash
    cd client
    npm install
    npm start
    ```

## ✨ Key Features Implemented
* **Continuous State Tracking:** Developed resilient evaluation logic with custom "grace period" algorithms to handle AI frame jitter, enabling accurate measurement of prolonged, time-based physical holds.
* **Advanced Pose Validation:** Implemented dynamic skeletal heuristics (like relative torso-to-hip ratios) within the Python engine to prevent false-positive detections caused by user proximity or varying camera angles.
* **Parent Dashboard:** A password-protected interface using the **Repository Pattern** and offline storage to track session history and child progress metrics.
* **Low-Latency Pipeline:** Real-time VP8 depacketization via UDP sockets to ensure sub-100ms feedback loops.

<img width="1919" height="869" alt="Screenshot 2026-04-02 215420" src="https://github.com/user-attachments/assets/7ae630f4-9a57-4f76-8748-7a91d26e3bc7" />


# 🧘‍♂️ Mediasoup AI Pose Development Platform
**A real-time, 3-tier motor development application for children. This system uses WebRTC to stream video to a Mediasoup SFU, which routes raw frames to a Python AI engine for skeletal geometry analysis.**

**🚀 System Architecture**
The project is divided into three main components:

Client (React): The interactive UI and game logic.

Server (Node.js/Mediasoup): The video router and signaling bridge.

Python Engine (AI): The computer vision brain using MediaPipe.

**🛠️ Setup & Installation**
* 1. Python AI Backend (/python_engine)
* This engine handles the pose estimation and action detection.

* Open a new terminal:

* cd python_engine
* pip install -r requirements.txt
* python processor.py

* 2. Mediasoup Signaling Server (/server)
* The bridge that connects the browser video to the Python engine.

* Open a second terminal:

* cd server
* npm install
* npm start

* 3. React Frontend (/client)
* The user interface for the activities and Parent Dashboard.

* Open a third terminal:

* cd client
* npm install
* npm start


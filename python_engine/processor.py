

# processor_aiortc.py
import asyncio
import socketio
import cv2
import numpy as np
import time
import socket
import struct
from dataclasses import dataclass
from typing import Optional
from av.codec import CodecContext
from av import Packet


import mediapipe as mp
mp_pose = mp.solutions.pose

class PoseEstimator:
    def __init__(self):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=0, 
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.prev_hip_y = None
        self.prev_ankle_y = None      
        self.was_in_frog_pose = False
        self.frog_charge_frames = 0
        self.jump_cooldown = 0
        self.prev_hand_state = None
        self.last_crawl_timestamp = 0
        self.crawls_done = 0
        self.squats_done = 0
        self.is_task_complete = False
        self.TARGET_CRAWLS = 4
        self.TARGET_SQUATS = 1

    def calculate_angle(self, a, b, c):
        a = np.array([a.x, a.y])
        b = np.array([b.x, b.y])
        c = np.array([c.x, c.y])
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        if angle > 180.0: angle = 360-angle
        return angle

    def calculate_inclination(self, p1, p2):
        import math
        dx = p2.x - p1.x
        dy = p2.y - p1.y
        theta = math.atan2(dy, dx)
        angle_deg = abs(math.degrees(theta))
        return abs(90 - angle_deg)

    def is_pose_stable(self, landmarks):
        l_hip = landmarks[23]
        r_hip = landmarks[24]
        l_shoulder = landmarks[11]
        r_shoulder = landmarks[12]
        if l_hip.visibility < 0.6 or r_hip.visibility < 0.6:
            return False, "Body Not Visible"
        shoulder_width = abs(l_shoulder.x - r_shoulder.x)
        if shoulder_width > 0.80: 
            return False, "Too Close!"
        return True, "Stable"

    def detect_action(self, landmarks):
        is_stable, status = self.is_pose_stable(landmarks)
        if not is_stable:
            return status
        nose = landmarks[0]
        l_wrist, r_wrist = landmarks[15], landmarks[16]
        l_hip, r_hip = landmarks[23], landmarks[24]
        l_knee, r_knee = landmarks[25], landmarks[26]
        l_ankle, r_ankle = landmarks[27], landmarks[28]
        l_shoulder, r_shoulder = landmarks[11], landmarks[12]
        l_elbow, r_elbow = landmarks[13], landmarks[14]
        
        angle_l_knee = self.calculate_angle(l_hip, l_knee, l_ankle)
        angle_r_knee = self.calculate_angle(r_hip, r_knee, r_ankle)
        
        mid_shoulder = type('obj', (object,), {'x': (l_shoulder.x + r_shoulder.x)/2, 'y': (l_shoulder.y + r_shoulder.y)/2})
        mid_hip = type('obj', (object,), {'x': (l_hip.x + r_hip.x)/2, 'y': (l_hip.y + r_hip.y)/2})
        spine_inclination = self.calculate_inclination(mid_shoulder, mid_hip)
        
        hands_below_shoulders = (l_wrist.y > l_shoulder.y) and (r_wrist.y > r_shoulder.y)
        knees_below_hips = (l_knee.y > l_hip.y) and (r_knee.y > r_hip.y)
        
        hips_too_low = mid_hip.y > 0.75 
        
        torso_length = mid_hip.y - mid_shoulder.y
        user_too_close = torso_length > 0.45
        
        ai_confident = l_ankle.visibility > 0.5 and r_ankle.visibility > 0.5
        
        legs_visible = ai_confident and not hips_too_low and not user_too_close
        detected_action = "Standing"
        current_time = time.time()
        is_crawling_pose = (spine_inclination > 40) and hands_below_shoulders and knees_below_hips

        if is_crawling_pose:
            self.last_crawl_timestamp = current_time
            diff_y = l_wrist.y - r_wrist.y
            diff_x = l_wrist.x - r_wrist.x
            current_hand_state = None
            if abs(diff_x) > abs(diff_y): 
                if diff_x > 0.05: current_hand_state = "Left/Right Cross"
                elif diff_x < -0.05: current_hand_state = "Right/Left Cross"
            else: 
                if diff_y > 0.05: current_hand_state = "Left Back"
                elif diff_y < -0.05: current_hand_state = "Right Back"
            if current_hand_state and self.prev_hand_state and current_hand_state != self.prev_hand_state:
                if self.crawls_done < self.TARGET_CRAWLS:
                    self.crawls_done += 1
            if current_hand_state:
                self.prev_hand_state = current_hand_state
            detected_action = f"Crawling 🐾 ({self.crawls_done}/{self.TARGET_CRAWLS})"
        elif legs_visible and spine_inclination < 35:
            if current_time - self.last_crawl_timestamp < 2.0:
                detected_action = "Rising..." 
            else:
                is_squatting = False
                if angle_l_knee < 130 and angle_r_knee < 130:
                    is_squatting = True
                    detected_action = "Squatting 📉"
                    if angle_l_knee < 90 and angle_r_knee < 90:
                         detected_action = "Deep Squat 🏋️"
                if is_squatting:
                    if self.crawls_done >= self.TARGET_CRAWLS:
                        if self.squats_done < self.TARGET_SQUATS:
                            self.squats_done += 1
                            detected_action = f"Squat Good! ✅ ({self.squats_done}/{self.TARGET_SQUATS})"
        curr_hip_y = mid_hip.y
        curr_ankle_y = (l_ankle.y + r_ankle.y) / 2
        avg_knee_angle = (angle_l_knee + angle_r_knee) / 2
        ankle_velocity = 0
        if self.prev_ankle_y is not None:
             ankle_velocity = self.prev_ankle_y - curr_ankle_y

        # 2. FROG CHARGE LOGIC
        hands_near_floor = l_wrist.y > l_knee.y and r_wrist.y > r_knee.y

        if avg_knee_angle < 140:
            if avg_knee_angle < 100:
                detected_action = "Deep Squat 🏋️" 
            else:
                detected_action = "Squatting 📉"
            
            if hands_near_floor:
                self.frog_charge_frames += 1
                if self.frog_charge_frames >= 5:
                    self.was_in_frog_pose = True
            else:
                self.frog_charge_frames = 0
        
        elif avg_knee_angle > 165:
            detected_action = "Standing"
            self.frog_charge_frames = 0
            if self.jump_cooldown == 0 and ankle_velocity < 0.01:
                self.was_in_frog_pose = False

        # 3. JUMP TRIGGER
        if self.prev_ankle_y is not None:

            if self.jump_cooldown == 0:
                if self.was_in_frog_pose and ankle_velocity > 0.03: 
                    
                    if ankle_velocity < 0.2: 
                        self.jump_cooldown = 15
                        detected_action = "JUMP! 🚀"
                        self.was_in_frog_pose = False 
                        print("🚀 JUMP DETECTED!")
            
            elif self.jump_cooldown > 0:
                self.jump_cooldown -= 1
                detected_action = "JUMP! 🚀"

        self.prev_ankle_y = curr_ankle_y
            
        if detected_action == "Standing" or detected_action == "JUMP! 🚀":
            if l_elbow.y < nose.y and r_elbow.y < nose.y:
                detected_action = "Hands Raised! 🙌"
            elif legs_visible and abs(l_ankle.y - r_ankle.y) > 0.1:
                    detected_action = "One Foot! ⚖️"
        if self.crawls_done >= self.TARGET_CRAWLS and self.squats_done >= self.TARGET_SQUATS:
            self.is_task_complete = True
        if self.is_task_complete and detected_action == "Standing":
            return "Task Complete! 🎉"
        return detected_action

    def process_ndarray(self, img_bgr):
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        results = self.pose.process(img_rgb)
        data = {}
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            data['landmarks'] = [{'x': lm.x, 'y': lm.y, 'z': lm.z, 'visibility': lm.visibility} for lm in landmarks]
            data['action'] = self.detect_action(landmarks)
            data['stats'] = {'crawls': self.crawls_done, 'squats': self.squats_done, 'target_crawls': self.TARGET_CRAWLS, 'target_squats': self.TARGET_SQUATS}
        return data


# Multi-user support
@dataclass
class RTPPacket:
    sequence: int
    timestamp: int
    marker: bool
    payload: bytes

def parse_rtp_packet(data: bytes) -> Optional[RTPPacket]:
    if len(data) < 12: return None
    byte0 = data[0]
    byte1 = data[1]
    
    extension = (byte0 >> 4) & 0x01
    csrc_count = byte0 & 0x0F
    marker = (byte1 >> 7) & 0x01    
    sequence = struct.unpack('!H', data[2:4])[0]
    timestamp = struct.unpack('!I', data[4:8])[0]
    
    header_size = 12 + (csrc_count * 4)
    if extension:
        if len(data) < header_size + 4: return None
        ext_len = struct.unpack('!H', data[header_size+2:header_size+4])[0]
        header_size += 4 + (ext_len * 4)
        
    return RTPPacket(sequence, timestamp, bool(marker), data[header_size:])

class VP8Decoder:
    def __init__(self):
        self.codec = CodecContext.create('vp8', 'r')
        self.frame_buffer = [] # Holds parts of a frame
        self.current_timestamp = None

    def _depacketize_vp8(self, payload: bytes) -> bytes:
        """Strips the VP8 Payload Descriptor (RFC 7741)"""
        if not payload: return b''
        
        byte0 = payload[0]
        use_extended = (byte0 & 0x80)
        
        desc_len = 1
        if use_extended:
            desc_len += 1
            if len(payload) > 1:
                byte1 = payload[1]
                if byte1 & 0x80: 
                    desc_len += 1
                    if len(payload) > 2 and (payload[2] & 0x80):
                        desc_len += 1
                if byte1 & 0x40: desc_len += 1
                if byte1 & 0x20: desc_len += 1
        
        if len(payload) <= desc_len: return b''
        return payload[desc_len:]

    def add_packet(self, packet: RTPPacket) -> Optional[np.ndarray]:
        if self.current_timestamp is not None and packet.timestamp != self.current_timestamp:
            frame = self._decode_buffer()
            self.frame_buffer = []
            self.current_timestamp = packet.timestamp
            self._add_to_buffer(packet)
            return frame 
        
        self.current_timestamp = packet.timestamp
        self._add_to_buffer(packet)
        
        if packet.marker:
            frame = self._decode_buffer()
            self.frame_buffer = []
            self.current_timestamp = None 
            return frame
        
        return None

    def _add_to_buffer(self, packet):
        raw_vp8 = self._depacketize_vp8(packet.payload)
        if raw_vp8:
            self.frame_buffer.append(raw_vp8)

    def _decode_buffer(self):
        if not self.frame_buffer: return None
        full_data = b''.join(self.frame_buffer)
        try:
            packets = [Packet(full_data)]
            frames = self.codec.decode(packets[0])
            if frames:
                return frames[0].to_ndarray(format='bgr24')
        except Exception as e:
            print(f"⚠️ Decode Error: {e}")
        return None

# --- SESSION & MAIN ---

async def run_worker_session(sio, user_id, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('127.0.0.1', port))
    sock.setblocking(False)
    
    # 2. NEW: Dummy RTCP Socket (Control Signals)
    # We must bind this port, otherwise Mediasoup gets "Connection Refused" errors
    rtcp_port = port + 1
    rtcp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    rtcp_sock.bind(('127.0.0.1', rtcp_port))
    rtcp_sock.setblocking(False) 
    
    decoder = VP8Decoder()
    estimator = PoseEstimator()
    
    print(f"🚀 Worker started for {user_id}")
    print(f"   Listening for Video RTP on: {port}")
    print(f"   Listening for Dummy RTCP on: {rtcp_port}")
    
    TARGET_FPS = 15          
    FRAME_INTERVAL = 1.0 / TARGET_FPS
    last_process = 0
    
    while True:
        try:
            data, _ = sock.recvfrom(4096) 
        except BlockingIOError:
            await asyncio.sleep(0.001)
            continue
        except Exception as e:
            print(f"Socket error: {e}")
            break

        packet = parse_rtp_packet(data)
        if not packet: continue
        
        img = decoder.add_packet(packet)
        if img is not None:
            now = time.time()
            if now - last_process >= FRAME_INTERVAL: # ~15 FPS
                last_process = now
                result = estimator.process_ndarray(img)
                await sio.emit('poseData', {'userId': user_id, 'data': result})
            else:
                pass
# ... Main Boilerplate ...
NODE_URL = "http://localhost:3000"
sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("✅ Connected to Mediasoup Node Server")
    await sio.emit('identify', {'type': 'python', 'userId': 'PROCESSOR'})

NEXT_AVAILABLE_PORT = 5000

@sio.on('newProducer')
async def on_new_producer(data):
    global NEXT_AVAILABLE_PORT
    print(f"🔔 New user detected: {data['userId']}")
    
    my_rtp_port = NEXT_AVAILABLE_PORT
    my_rtcp_port = NEXT_AVAILABLE_PORT + 1

    NEXT_AVAILABLE_PORT += 2
    print(f"   Assigning Ports - RTP: {my_rtp_port}, RTCP: {my_rtcp_port}")

    transport = await sio.call('createPlainTransport', {})
    
    
    # 1. CONNECT with TWO ports (Fixes the TypeError)
    await sio.emit('connectPlainTransport', {
        'ip': '127.0.0.1',
        'port': my_rtp_port,
        'rtcpPort': my_rtcp_port
    })
    
    # 2. CONSUME
    await sio.call('consume', {
        'userId': data['userId'],
        'producerId': data['producerId'],
        'rtpCapabilities': {'codecs': [{'kind':'video', 'mimeType':'video/VP8', 'clockRate':90000}]}
    })
    
    # 3. START
    asyncio.create_task(run_worker_session(sio, data['userId'], my_rtp_port))

async def main():
    await sio.connect(NODE_URL)
    await sio.wait()

if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
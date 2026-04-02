#!/usr/bin/env python3
import sys
import json
import base64
import numpy as np
import cv2
import mediapipe as mp

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def process_frame(frame_data, width, height):
    """Process a single frame and detect pose landmarks"""
    try:
        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_data)
        
        # Convert to numpy array (RGB24 format from FFmpeg)
        frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
        frame_rgb = frame_array.reshape((height, width, 3))
        
        # Process with MediaPipe
        results = pose.process(frame_rgb)
        
        if results.pose_landmarks:
            # Extract landmarks
            landmarks = []
            for idx, landmark in enumerate(results.pose_landmarks.landmark):
                landmarks.append({
                    'id': idx,
                    'name': mp_pose.PoseLandmark(idx).name,
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z,
                    'visibility': landmark.visibility
                })
            
            # Calculate pose angles (example: elbow, knee angles)
            angles = calculate_angles(results.pose_landmarks.landmark)
            
            return {
                'detected': True,
                'landmarks': landmarks,
                'angles': angles,
                'world_landmarks': extract_world_landmarks(results.pose_world_landmarks) if results.pose_world_landmarks else None
            }
        else:
            return {
                'detected': False,
                'landmarks': [],
                'angles': {},
                'world_landmarks': None
            }
            
    except Exception as e:
        raise Exception(f"Frame processing error: {str(e)}")

def calculate_angles(landmarks):
    """Calculate key body angles"""
    def angle_between_points(a, b, c):
        """Calculate angle at point b"""
        ba = np.array([a.x - b.x, a.y - b.y])
        bc = np.array([c.x - b.x, c.y - b.y])
        
        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
        
        return np.degrees(angle)
    
    angles = {}
    
    try:
        # Left elbow angle
        angles['left_elbow'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
            landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value],
            landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        )
        
        # Right elbow angle
        angles['right_elbow'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        )
        
        # Left knee angle
        angles['left_knee'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
            landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value],
            landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
        )
        
        # Right knee angle
        angles['right_knee'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
        )
        
        # Left shoulder angle
        angles['left_shoulder'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value],
            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
            landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
        )
        
        # Right shoulder angle
        angles['right_shoulder'] = angle_between_points(
            landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
        )
        
    except Exception as e:
        print(f"Error calculating angles: {e}", file=sys.stderr)
    
    return angles

def extract_world_landmarks(world_landmarks):
    """Extract world coordinates (3D positions in meters)"""
    if not world_landmarks:
        return None
    
    world_coords = []
    for idx, landmark in enumerate(world_landmarks.landmark):
        world_coords.append({
            'id': idx,
            'name': mp_pose.PoseLandmark(idx).name,
            'x': landmark.x,
            'y': landmark.y,
            'z': landmark.z,
            'visibility': landmark.visibility
        })
    
    return world_coords

def main():
    # Signal ready
    print(json.dumps({'type': 'ready'}), flush=True)
    
    # Read frames from stdin
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            request_id = request['id']
            width = request['width']
            height = request['height']
            frame_data = request['frame']
            
            # Process frame
            result = process_frame(frame_data, width, height)
            
            # Send result
            response = {
                'type': 'result',
                'id': request_id,
                'data': result
            }
            print(json.dumps(response), flush=True)
            
        except Exception as e:
            # Send error
            error_response = {
                'type': 'error',
                'id': request.get('id', -1) if 'request' in locals() else -1,
                'error': str(e)
            }
            print(json.dumps(error_response), flush=True)

if __name__ == '__main__':
    main()
# Phase 4: Live Streaming, Multi-Auth & Privacy Controls

## Overview
This phase adds enterprise social media features: live video broadcasting, multiple authentication providers, and granular privacy controls. These features transform the platform into a comprehensive social ecosystem capable of real-time engagement.

---

## 1. Live Streaming with Agora

### Features Implemented
- **Live Broadcasting**: Real-time video streaming to unlimited viewers
- **Agora RTC Integration**: Token-based authentication for secure streaming
- **Stream Management**: Start, end, and track active streams
- **Viewer Count Tracking**: Real-time viewer metrics
- **Stream Discovery**: Browse active live streams
- **Multi-Format Support**: Compatible with mobile and web platforms

### Backend Implementation

#### Models
```python
class LiveStreamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "general"

class LiveStream(BaseModel):
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str]
    channel_name: str
    title: str
    description: Optional[str]
    category: str
    viewer_count: int
    status: str  # live, ended
    started_at: str
    ended_at: Optional[str] = None

class AgoraTokenRequest(BaseModel):
    channel_name: str
    uid: Optional[int] = 0
    role: str = "publisher"  # publisher or subscriber
```

#### API Endpoints

**Generate Agora Token**
```
POST /api/live/token
Headers: Authorization: Bearer {jwt_token}
Body: {
  "channel_name": "live-user123-1234567890",
  "uid": 12345,
  "role": "publisher"  // or "subscriber"
}

Response: {
  "token": "agora_rtc_token_here",
  "app_id": "your_agora_app_id",
  "channel": "live-user123-1234567890",
  "uid": 12345,
  "expiration": 1234567890
}
```

**Start Live Stream**
```
POST /api/live/start
Headers: Authorization: Bearer {jwt_token}
Body: {
  "title": "My First Live Stream",
  "description": "Come hang out!",
  "category": "gaming"
}

Response: {
  ...stream_details,
  "agora_token": "token_for_broadcaster",
  "agora_app_id": "app_id"
}
```

**End Live Stream**
```
PUT /api/live/{stream_id}/end
Headers: Authorization: Bearer {jwt_token}

Response: {
  "message": "Stream ended"
}
```

**Get Active Streams**
```
GET /api/live/active?skip=0&limit=20

Response: [
  {
    "id": "stream_id",
    "username": "streamer123",
    "title": "Live Gaming Session",
    "viewer_count": 245,
    "status": "live",
    ...
  }
]
```

**Get Stream Details**
```
GET /api/live/{stream_id}

Response: {
  ...full_stream_details
}
```

**Update Viewer Count**
```
PUT /api/live/{stream_id}/viewer-count?count=150

Response: {
  "message": "Viewer count updated"
}
```

### Frontend Integration Guide

#### Install Agora SDK
```bash
# For React Web
yarn add agora-rtc-react agora-rtc-sdk-ng

# For React Native
npm install react-native-agora
```

#### Broadcaster Component (Web)
```javascript
import { useRTCClient, useLocalCameraTrack, useLocalMicrophoneTrack, usePublish } from "agora-rtc-react";
import { useState, useEffect } from "react";

export const LiveBroadcaster = ({ streamId }) => {
  const [agoraData, setAgoraData] = useState(null);
  const client = useRTCClient();
  const { localCameraTrack } = useLocalCameraTrack();
  const { localMicrophoneTrack } = useLocalMicrophoneTrack();
  
  useEffect(() => {
    const startStream = async () => {
      // Start stream on backend
      const response = await fetch(`${API}/live/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: "My Live Stream",
          description: "Join me!",
          category: "general"
        })
      });
      
      const data = await response.json();
      setAgoraData(data);
      
      // Join Agora channel
      await client.join(
        data.agora_app_id,
        data.channel_name,
        data.agora_token,
        data.uid
      );
    };
    
    startStream();
    
    return () => {
      client.leave();
    };
  }, []);
  
  usePublish([localCameraTrack, localMicrophoneTrack]);
  
  return (
    <div>
      <h2>You are live!</h2>
      <div style={{ width: "100%", height: "500px" }}>
        {localCameraTrack && (
          <div ref={(ref) => localCameraTrack.play(ref)} />
        )}
      </div>
    </div>
  );
};
```

#### Viewer Component (Web)
```javascript
import { useRTCClient, useRemoteUsers, useJoin } from "agora-rtc-react";

export const LiveViewer = ({ streamId }) => {
  const [streamData, setStreamData] = useState(null);
  const client = useRTCClient();
  const remoteUsers = useRemoteUsers();
  
  useEffect(() => {
    const joinStream = async () => {
      // Get stream details
      const streamRes = await fetch(`${API}/live/${streamId}`);
      const stream = await streamRes.json();
      
      // Get viewer token
      const tokenRes = await fetch(`${API}/live/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel_name: stream.channel_name,
          uid: 0,
          role: "subscriber"
        })
      });
      
      const tokenData = await tokenRes.json();
      setStreamData({ ...stream, ...tokenData });
    };
    
    joinStream();
  }, [streamId]);
  
  useJoin({
    appid: streamData?.app_id,
    channel: streamData?.channel,
    token: streamData?.token,
  });
  
  return (
    <div>
      <h2>{streamData?.title}</h2>
      <p>{streamData?.viewer_count} watching</p>
      <div className="remote-videos">
        {remoteUsers.map(user => (
          <div key={user.uid} ref={(ref) => user.videoTrack?.play(ref)} />
        ))}
      </div>
    </div>
  );
};
```

### Agora Setup Guide

1. **Create Agora Account**
   - Visit https://console.agora.io
   - Sign up for free account (10,000 minutes/month free)

2. **Create Project**
   - Dashboard → Create New Project
   - Enable "App Certificate" for security
   - Copy App ID and App Certificate

3. **Add Credentials to .env**
   ```
   AGORA_APP_ID="your_app_id_here"
   AGORA_APP_CERTIFICATE="your_certificate_here"
   ```

4. **Restart Backend**
   ```bash
   sudo supervisorctl restart backend
   ```

### Database Schema

**live_streams Collection**
```javascript
{
  id: String (UUID),
  user_id: String,
  username: String,
  user_avatar: String,
  channel_name: String (unique per stream),
  title: String,
  description: String,
  category: String,
  viewer_count: Integer,
  status: String (live|ended),
  started_at: String (ISO 8601),
  ended_at: String (ISO 8601, nullable)
}
```

---

## 2. Multi-Provider Authentication

### Supported Auth Providers
1. **Email/Password** (Already implemented)
2. **Google OAuth** (via Emergent Auth)
3. **Phone Number + SMS OTP** (Framework ready)
4. **Facebook OAuth** (Framework ready)
5. **Twitter/X OAuth** (Framework ready)

### Google OAuth Integration (Emergent-Managed)

#### Implementation Steps

1. **Update Landing Page**
```javascript
const handleGoogleLogin = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS
  const redirectUrl = window.location.origin + '/feed';
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

// Add button to Landing.js
<button onClick={handleGoogleLogin} className="btn-secondary">
  <GoogleIcon /> Sign in with Google
</button>
```

2. **Add Auth Callback Handler**
Create `/app/frontend/src/pages/AuthCallback.js`:
```javascript
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  
  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    
    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
    
    if (!sessionId) {
      navigate('/');
      return;
    }
    
    // Exchange session_id for user data
    axios.post(`${API}/auth/google-callback`, { session_id: sessionId })
      .then(response => {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/feed', { state: { user }, replace: true });
      })
      .catch(error => {
        console.error('Auth failed:', error);
        navigate('/');
      });
  }, [navigate]);
  
  return <div>Completing sign in...</div>;
};

export default AuthCallback;
```

3. **Add Backend Endpoint**
```python
@api_router.post("/auth/google-callback")
async def google_auth_callback(session_data: dict):
    """Handle Google OAuth callback via Emergent Auth."""
    session_id = session_data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            google_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"email": google_data["email"]})
            
            if existing_user:
                # Update user data
                user_id = existing_user["id"]
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "name": google_data.get("name"),
                        "avatar": google_data.get("picture"),
                        "auth_provider": "google"
                    }}
                )
            else:
                # Create new user
                user_id = str(uuid.uuid4())
                user_doc = {
                    "id": user_id,
                    "email": google_data["email"],
                    "username": google_data["email"].split("@")[0],
                    "password_hash": "",  # No password for OAuth users
                    "account_type": "personal",
                    "avatar": google_data.get("picture"),
                    "bio": None,
                    "verification_status": True,  # Google emails are verified
                    "wallet_balance": 0.0,
                    "total_views": 0,
                    "auth_provider": "google",
                    "privacy_settings": PrivacySettings().dict(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            
            # Generate JWT token
            token = create_token(user_id)
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
            
            return {
                "token": token,
                "user": User(**user)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth failed: {str(e)}")
```

4. **Update App Router**
```javascript
// In App.js, detect session_id before routing
function AppRouter() {
  const location = useLocation();
  
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      {/* existing routes */}
    </Routes>
  );
}
```

### Phone Authentication (SMS OTP)

**Framework Ready - Requires SMS Provider**

1. Install Twilio or similar SMS service
2. Add endpoint: `POST /api/auth/send-otp`
3. Add endpoint: `POST /api/auth/verify-otp`
4. Frontend: Phone input → OTP input → Login

---

## 3. Privacy Controls

### Features
- **Granular Visibility**: Control what personal info is public
- **Profile Privacy**: Public, followers-only, or private
- **Selective Sharing**: Show/hide email, phone, birthday, location
- **Follower Stats**: Control visibility of follower/following counts

### Backend Implementation

#### Privacy Settings Model
```python
class PrivacySettings(BaseModel):
    show_email: bool = False
    show_phone: bool = False
    show_birthday: bool = False
    show_location: bool = False
    show_followers_count: bool = True
    show_following_count: bool = True
    profile_visibility: str = "public"  # public, followers_only, private
```

#### API Endpoints

**Get Privacy Settings**
```
GET /api/users/me/privacy
Headers: Authorization: Bearer {jwt_token}

Response: {
  "show_email": false,
  "show_phone": false,
  "show_birthday": false,
  "show_location": false,
  "show_followers_count": true,
  "show_following_count": true,
  "profile_visibility": "public"
}
```

**Update Privacy Settings**
```
PUT /api/users/me/privacy
Headers: Authorization: Bearer {jwt_token}
Body: {
  "show_email": false,
  "show_phone": true,
  "show_birthday": false,
  "show_location": true,
  "show_followers_count": true,
  "show_following_count": false,
  "profile_visibility": "followers_only"
}

Response: {
  "message": "Privacy settings updated",
  "settings": {...}
}
```

**Update Extended Profile**
```
PUT /api/users/me/profile-extended
Headers: Authorization: Bearer {jwt_token}
Body: {
  "phone": "+1234567890",
  "birthday": "1995-05-15",
  "location": "San Francisco, CA"
}

Response: {
  "message": "Profile updated"
}
```

### Frontend Implementation

#### Privacy Settings Page
```javascript
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';

const PrivacySettings = () => {
  const [settings, setSettings] = useState({
    show_email: false,
    show_phone: false,
    show_birthday: false,
    show_location: false,
    show_followers_count: true,
    show_following_count: true,
    profile_visibility: 'public'
  });
  
  useEffect(() => {
    fetchSettings();
  }, []);
  
  const fetchSettings = async () => {
    const response = await fetch(`${API}/users/me/privacy`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setSettings(data);
  };
  
  const handleToggle = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    await fetch(`${API}/users/me/privacy`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newSettings)
    });
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Privacy Settings</h1>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Email</p>
            <p className="text-sm text-gray-500">Let others see your email address</p>
          </div>
          <Switch
            checked={settings.show_email}
            onCheckedChange={(val) => handleToggle('show_email', val)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Phone Number</p>
            <p className="text-sm text-gray-500">Display your phone on profile</p>
          </div>
          <Switch
            checked={settings.show_phone}
            onCheckedChange={(val) => handleToggle('show_phone', val)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Birthday</p>
            <p className="text-sm text-gray-500">Share your birth date</p>
          </div>
          <Switch
            checked={settings.show_birthday}
            onCheckedChange={(val) => handleToggle('show_birthday', val)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Location</p>
            <p className="text-sm text-gray-500">Display your city/country</p>
          </div>
          <Switch
            checked={settings.show_location}
            onCheckedChange={(val) => handleToggle('show_location', val)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Follower Count</p>
            <p className="text-sm text-gray-500">Display number of followers</p>
          </div>
          <Switch
            checked={settings.show_followers_count}
            onCheckedChange={(val) => handleToggle('show_followers_count', val)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Show Following Count</p>
            <p className="text-sm text-gray-500">Display who you follow</p>
          </div>
          <Switch
            checked={settings.show_following_count}
            onCheckedChange={(val) => handleToggle('show_following_count', val)}
          />
        </div>
        
        <div>
          <p className="font-semibold mb-3">Profile Visibility</p>
          <select
            className="w-full p-3 rounded-lg border"
            value={settings.profile_visibility}
            onChange={(e) => handleToggle('profile_visibility', e.target.value)}
          >
            <option value="public">Public - Anyone can see</option>
            <option value="followers_only">Followers Only</option>
            <option value="private">Private - Only you</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;
```

#### Profile Display Logic
```javascript
// Apply privacy settings when displaying user profile
const renderProfileField = (field, value, privacySettings) => {
  const isVisible = privacySettings[`show_${field}`];
  
  if (!isVisible && !isOwnProfile) {
    return <span className="text-gray-400 italic">Hidden</span>;
  }
  
  return value || 'Not provided';
};

// Example usage
<div>
  <label>Email:</label>
  {renderProfileField('email', user.email, user.privacy_settings)}
</div>

<div>
  <label>Phone:</label>
  {renderProfileField('phone', user.phone, user.privacy_settings)}
</div>

<div>
  <label>Followers:</label>
  {user.privacy_settings.show_followers_count 
    ? user.followers_count.toLocaleString()
    : 'Hidden'}
</div>
```

---

## Updated Database Schema

### Users Collection (Enhanced)
```javascript
{
  id: String,
  email: String,
  username: String,
  password_hash: String (empty for OAuth users),
  account_type: String,
  avatar: String,
  bio: String,
  phone: String,                           // NEW
  birthday: String,                        // NEW
  location: String,                        // NEW
  verification_status: Boolean,
  wallet_balance: Float,
  total_views: Integer,
  followers_count: Integer,                // NEW
  following_count: Integer,                // NEW
  auth_provider: String,                   // NEW: email, google, phone, facebook, twitter
  privacy_settings: {                      // NEW
    show_email: Boolean,
    show_phone: Boolean,
    show_birthday: Boolean,
    show_location: Boolean,
    show_followers_count: Boolean,
    show_following_count: Boolean,
    profile_visibility: String
  },
  created_at: String
}
```

---

## Environment Variables

Update `/app/backend/.env`:
```
# Existing variables...

# Agora Live Streaming
AGORA_APP_ID="your_agora_app_id"
AGORA_APP_CERTIFICATE="your_agora_certificate"

# Optional: SMS Provider (for phone auth)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

---

## Testing Guide

### Test Live Streaming
```bash
# 1. Start a stream
curl -X POST https://your-app.com/api/live/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Stream","description":"Testing","category":"tech"}'

# 2. Get token for viewer
curl -X POST https://your-app.com/api/live/token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel_name":"live-user123-1234","uid":0,"role":"subscriber"}'

# 3. List active streams
curl https://your-app.com/api/live/active

# 4. End stream
curl -X PUT https://your-app.com/api/live/{stream_id}/end \
  -H "Authorization: Bearer $TOKEN"
```

### Test Privacy Settings
```bash
# Get current settings
curl https://your-app.com/api/users/me/privacy \
  -H "Authorization: Bearer $TOKEN"

# Update settings
curl -X PUT https://your-app.com/api/users/me/privacy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"show_email":false,"show_phone":true,"profile_visibility":"followers_only"}'

# Update extended profile
curl -X PUT https://your-app.com/api/users/me/profile-extended \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","birthday":"1995-05-15","location":"NYC"}'
```

---

## Slogan Update

**Before**: "Upload vertical & horizontal videos"
**After**: "Share your story"

Updated in `/app/frontend/src/pages/Landing.js` - More inclusive and emotional, focusing on storytelling rather than technical video formats.

---

## Next Steps

1. **Agora Setup**:
   - Create account at https://console.agora.io
   - Get App ID and Certificate
   - Add to `.env` file

2. **Google OAuth** (Optional):
   - Already integrated via Emergent Auth
   - Follow integration playbook saved earlier
   - No additional API keys needed

3. **Phone Auth** (Optional):
   - Sign up for Twilio or similar
   - Implement OTP endpoints
   - Add SMS verification flow

4. **Privacy UI**:
   - Create Settings page in frontend
   - Add privacy toggles
   - Apply filters on profile display

5. **Live Streaming UI**:
   - Create broadcaster component
   - Create viewer component  
   - Add "Go Live" button to navigation
   - Display active streams feed

---

**Version**: 4.0.0
**Status**: Core Infrastructure Complete - UI Implementation Pending
**Date**: January 30, 2026

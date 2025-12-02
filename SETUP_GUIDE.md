# Complete Setup Guide - Location Tracking System

## Overview

This system allows you to:
1. **Admin Dashboard**: Enter phone numbers and generate tracking links
2. **Send SMS**: Send the generated link via SMS
3. **Track Locations**: When someone clicks the link, their location is automatically captured
4. **View Live Locations**: See all received locations on a map in real-time

---

## Files

- `admin.html` - Admin dashboard to create tracking links
- `get-location.html` - Page that captures location when clicked
- `example-backend.js` - Backend server (Node.js/Express)
- `package.json` - Dependencies

---

## Step 1: Install Dependencies

```powershell
npm install
```

This installs Express.js for the backend server.

---

## Step 2: Start Backend Server

```powershell
node example-backend.js
```

The server will run on `http://localhost:3000`

---

## Step 3: Host the HTML Files

You need to host both HTML files on a web server with HTTPS (required for geolocation).

### Option A: Local Testing (Python)
```powershell
# In a new terminal
python -m http.server 8000
```

Then access:
- Admin: `http://localhost:8000/admin.html`
- Tracking: `http://localhost:8000/get-location.html`

### Option B: Production Hosting
Upload both HTML files to:
- Netlify (free, HTTPS included)
- GitHub Pages
- Your own web server

**Important**: Update the backend URL in both files:
- `admin.html` line 308: Change `API_BASE` to your backend URL
- `get-location.html` line 112: The `API_BASE` auto-detects, but update for production

---

## Step 4: Configure Backend URL

### In `admin.html` (line 308):
```javascript
const API_BASE = 'http://localhost:3000'; // Change to your backend URL
```

### In `get-location.html`:
The code auto-detects localhost, but for production, update line 112:
```javascript
const API_BASE = 'https://your-backend.com';
```

### In `example-backend.js`:
Update line 8 to set where `get-location.html` is hosted:
```javascript
const FRONTEND_URL = 'https://yourdomain.com'; // Where get-location.html is hosted
```

---

## Step 5: Using the System

### 1. Open Admin Dashboard
Navigate to: `http://localhost:8000/admin.html`

### 2. Create Tracking Link
- Enter phone number (or any identifier)
- Enter reference/case number (optional)
- Click "Generate & Send Link"
- Copy the generated link

### 3. Send SMS
Send the link via SMS:
```
Please click this link: https://yourdomain.com/get-location.html?trackingId=TRK-1234567890-ABC123
```

### 4. Monitor Locations
- The admin dashboard automatically refreshes every 2 seconds
- When someone clicks the link and allows location access, you'll see:
  - Status changes to "Location Received"
  - Location appears on the map
  - Google Maps link is shown

---

## How It Works

1. **Admin creates link** → Backend generates unique `trackingId`
2. **Link sent via SMS** → Contains `trackingId` parameter
3. **User clicks link** → Opens `get-location.html?trackingId=XXX`
4. **Location requested** → Browser asks for permission
5. **Location sent** → POST to backend with coordinates
6. **Admin sees location** → Appears on dashboard and map

---

## API Endpoints

### POST `/api/create-link`
Create a new tracking link
```json
{
  "phoneNumber": "+1234567890",
  "reference": "CASE-001",
  "message": "Optional message"
}
```

### POST `/api/locations`
Receive location data (called by get-location.html)
```json
{
  "trackingId": "TRK-1234567890-ABC123",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "userAgent": "Mozilla/5.0..."
}
```

### GET `/api/tracking-links`
Get all tracking links and their locations (for admin dashboard)

### GET `/api/locations`
Get all received locations

---

## Production Deployment

### Backend
1. Deploy `example-backend.js` to a server (Heroku, AWS, DigitalOcean, etc.)
2. Set environment variable: `FRONTEND_URL=https://yourdomain.com`
3. Update CORS settings if needed

### Frontend
1. Upload `admin.html` and `get-location.html` to your web server
2. Update `API_BASE` in both files to point to your backend
3. Ensure HTTPS is enabled (required for geolocation)

---

## Google Maps Integration (Optional)

To show locations on a map in the admin dashboard:

1. Get Google Maps API key from: https://console.cloud.google.com/
2. In `admin.html` line 324, replace `YOUR_API_KEY` with your key
3. Uncomment or enable the Google Maps initialization

Without API key, locations are shown as Google Maps links.

---

## Troubleshooting

### Location not being captured
- Ensure HTTPS is used (geolocation requires secure context)
- Check browser console for errors
- Verify backend is running and accessible

### Admin dashboard not showing locations
- Check backend is running
- Verify API_BASE URL is correct
- Check browser console for CORS errors

### CORS errors
- Backend has CORS enabled for all origins (development)
- For production, restrict CORS to your domain

---

## Security Notes

- The receiver will see a location permission prompt
- They must click "Allow" for location to be captured
- Consider adding authentication to admin dashboard
- Use HTTPS in production
- Store sensitive data in a database (currently in-memory)

---

## Next Steps

- Add database (MongoDB, PostgreSQL) for persistent storage
- Add authentication to admin dashboard
- Add SMS sending integration (Twilio, etc.)
- Add email notifications when location is received
- Add user management and permissions


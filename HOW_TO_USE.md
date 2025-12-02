# How to Use Location Tracking System

## Complete Workflow

1. **You send SMS** with a link containing unique IDs
2. **Receiver clicks the link** → Opens in their browser
3. **Location is automatically captured** → Sent to your backend
4. **You receive the location** → As a Google Maps link in your backend

---

## Step 1: Host the HTML File

You need to upload `get-location.html` to a web server (HTTPS required for geolocation on mobile).

### Option A: Free Hosting (Quick Setup)
- **Netlify**: Drag & drop the file at https://netlify.com
- **GitHub Pages**: Upload to a GitHub repo and enable Pages
- **Vercel**: Upload and deploy instantly

### Option B: Your Own Server
- Upload `get-location.html` to your web server
- Make sure it's accessible via HTTPS

**Example URL after hosting:**
```
https://yourdomain.com/get-location.html
```

---

## Step 2: Update Backend URL

Edit `get-location.html` line 155 and change:
```javascript
const response = await fetch('https://my-backend.com/api/locations', {
```
to your actual backend URL:
```javascript
const response = await fetch('https://your-backend.com/api/locations', {
```

---

## Step 3: Send SMS with Link

Send a text message like this:

**Message Template:**
```
Hi, please click this link to verify your location: 
https://yourdomain.com/get-location.html?uid=USER123&ref=CASE456
```

**Parameters:**
- `uid` = Unique identifier for the person (phone number, ID, etc.)
- `ref` = Reference number (case number, incident ID, etc.)

**Example:**
```
Please click: https://yourdomain.com/get-location.html?uid=5551234567&ref=CASE2024001
```

---

## Step 4: What Happens When They Click

1. Link opens in their browser
2. Browser asks: "Allow location access?" 
3. If they click "Allow":
   - Location is captured (latitude, longitude)
   - Data is sent to your backend via POST request
   - They see a success message with Google Maps link
4. If they click "Block":
   - Error message is shown
   - No location is sent

---

## Step 5: Receive Location Data

Your backend at `https://your-backend.com/api/locations` will receive:

**POST Request Body:**
```json
{
  "uid": "5551234567",
  "ref": "CASE2024001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "userAgent": "Mozilla/5.0..."
}
```

**Your Backend Should:**
1. Save the location data
2. Generate Google Maps link: `https://www.google.com/maps?q=40.7128,-74.0060`
3. Send you notification (email, SMS, dashboard, etc.)

---

## Example Backend Endpoint (Node.js)

```javascript
app.post('/api/locations', async (req, res) => {
  const { uid, ref, latitude, longitude, userAgent } = req.body;
  
  // Save to database
  await saveLocation({ uid, ref, latitude, longitude, userAgent });
  
  // Generate Google Maps link
  const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  
  // Send notification to you
  await sendNotification(`Location received for ${uid}: ${mapsLink}`);
  
  res.json({ success: true, mapsLink });
});
```

---

## Tips for Better Results

1. **Use HTTPS**: Geolocation requires HTTPS (except localhost)
2. **Short URLs**: Use a URL shortener for SMS (bit.ly, tinyurl.com)
3. **Trustworthy Message**: Make the SMS look legitimate
4. **Mobile-Friendly**: The page works on all devices
5. **Backend Logging**: Log all requests to track who clicked

---

## Testing

1. Host the file on a server with HTTPS
2. Open: `https://yourdomain.com/get-location.html?uid=TEST123&ref=TEST456`
3. Allow location access
4. Check your backend logs for the received data

---

## Security Notes

- The receiver will see a location permission prompt
- They must click "Allow" for it to work
- The page shows a Google Maps link after sending (they can see their own location)
- Make sure your backend validates and secures the endpoint


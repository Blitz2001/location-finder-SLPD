# Testing Guide - Location Tracking System

## Quick Test Steps

### 1. Start Backend Server
```powershell
node example-backend.js
```

You should see:
```
🚀 Location tracking server running on http://localhost:3000
```

### 2. Test SMS API Format
Open browser and go to:
```
http://localhost:3000/api/test-sms
```

Or use Postman/curl:
```powershell
curl -X POST http://localhost:3000/api/test-sms -H "Content-Type: application/json" -d "{\"phoneNumber\":\"0771234567\"}"
```

This will show you the exact format being sent to the SMS API.

### 3. Test SMS Sending
1. Open `admin.html` in browser
2. Enter phone number: `0771234567` (or your test number)
3. Enter message: `Test message`
4. Click "Generate Link & Send SMS"
5. Click "Send SMS Now"
6. Check backend console for detailed logs

### 4. Test Location Tracking
1. After generating link, copy it
2. Open in browser (or send to your phone)
3. Allow location permission
4. Location should be captured and sent to backend
5. Check admin dashboard - location should appear

## Troubleshooting

### SMS Not Sending

**Check Backend Console:**
- Look for "=== SENDING SMS ===" logs
- Check the "Full Request URL" - verify password encoding
- Check "Request Body" - verify JSON format
- Check "SMS API Response" - see what API returns

**Common Issues:**
1. **Password encoding**: Password `DINE*@73#k` should be encoded as `DINE*@73%23k` in URL
2. **Phone format**: Must be `94XXXXXXXXX` (no +, no leading 0)
3. **API response**: Should return `{"message": "Message sent with queue"}`

**Manual Test:**
Test the SMS API directly:
```
POST https://kdenterprises.lk/api/client/sendsms?username=klnvas@kdenterprises.lk&password=DINE*@73%23k&apiKey=a4fd451ffc12efb07f51

Body (JSON):
{
  "mask": "KLNVAS",
  "number": 94771234567,
  "content": "Test message"
}
```

### Location Not Accurate

**Improvements Made:**
- Uses GPS (enableHighAccuracy: true)
- Tries up to 3 times for better accuracy
- Prefers positions with accuracy < 50 meters
- Longer timeout (15 seconds) for GPS lock

**On Mobile:**
- Make sure GPS/Location Services are enabled
- Allow location permission
- Wait a few seconds for GPS to lock
- Better accuracy outdoors

**Check Location Data:**
- Backend console shows received location
- Admin dashboard shows accuracy if available
- Google Maps link shows exact location

## Backend Logs to Check

When sending SMS, you should see:
```
=== SENDING SMS ===
Phone Number: 94771234567
Message Length: XX
Full Request URL: https://kdenterprises.lk/api/client/sendsms?username=...
Request Body: {"mask":"KLNVAS","number":94771234567,"content":"..."}
SMS API Response Status: 200
SMS API Response Body: {"message":"Message sent with queue"}
```

If you see "Route not found":
- Check URL format
- Verify credentials
- Check password encoding (# should be %23)

## Next Steps

1. **Test SMS**: Use test endpoint to verify format
2. **Send Real SMS**: Try with real phone number
3. **Test Location**: Click link and verify location is captured
4. **Check Dashboard**: Verify location appears in admin panel


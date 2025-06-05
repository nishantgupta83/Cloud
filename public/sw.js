// Service Worker for Kids Safety PWA
const CACHE_NAME = 'kids-safety-v1.2.0';
const EMERGENCY_CACHE = 'emergency-cache-v1';

// Essential files to cache for offline functionality
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/app.js',
  '/js/pwautils.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/safety-alert-192.png'
];

// Emergency pages that must always be available
const EMERGENCY_FILES = [
  '/emergency.html',
  '/emergency-contacts.html',
  '/offline-safety.html'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache essential files
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(ESSENTIAL_FILES);
      }),
      // Cache emergency files separately
      caches.open(EMERGENCY_CACHE).then((cache) => {
        return cache.addAll(EMERGENCY_FILES);
      })
    ]).then(() => {
      console.log('Service Worker installed and files cached');
      // Force activation
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== EMERGENCY_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (isEmergencyRequest(request)) {
    event.respondWith(handleEmergencyRequest(request));
  } else if (isSafetyAPIRequest(request)) {
    event.respondWith(handleSafetyAPIRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleGenericRequest(request));
  }
});

// Background sync for safety data
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-safety') {
    event.waitUntil(syncSafetyData());
  } else if (event.tag === 'background-sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'background-sync-alerts') {
    event.waitUntil(syncAlerts());
  }
});

// Push notifications for safety alerts
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  let notificationData = {
    title: 'Safety Alert',
    body: 'You have a new safety notification',
    icon: '/icons/safety-alert-192.png',
    badge: '/icons/badge-72.png'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: `🚨 ${data.type || 'Safety'} Alert`,
        body: data.message || data.body,
        icon: '/icons/safety-alert-192.png',
        badge: '/icons/badge-72.png',
        tag: data.tag || 'safety-alert',
        requireInteraction: data.level === 'critical',
        vibrate: [200, 100, 200, 100, 200],
        actions: [
          { action: 'open', title: 'Open App', icon: '/icons/open.png' },
          { action: 'safe', title: 'I\'m Safe', icon: '/icons/safe.png' },
          { action: 'help', title: 'Need Help', icon: '/icons/help.png' }
        ],
        data: data
      };
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === 'safe') {
    // Send "I'm safe" response
    event.waitUntil(sendSafeResponse(notificationData));
  } else if (action === 'help') {
    // Trigger help request
    event.waitUntil(triggerHelpRequest(notificationData));
  } else {
    // Default action - open app
    event.waitUntil(openApp('/safety-dashboard'));
  }
});

// Helper functions
function isEmergencyRequest(request) {
  return request.url.includes('/emergency') || 
         request.url.includes('/safety-alert') ||
         request.url.includes('/panic');
}

function isSafetyAPIRequest(request) {
  return request.url.includes('/api/safety') ||
         request.url.includes('/api/emergency') ||
         request.url.includes('/api/alerts');
}

function isStaticAsset(request) {
  return request.url.includes('/css/') ||
         request.url.includes('/js/') ||
         request.url.includes('/images/') ||
         request.url.includes('/icons/') ||
         request.url.includes('.png') ||
         request.url.includes('.jpg') ||
         request.url.includes('.css') ||
         request.url.includes('.js');
}

// Handle emergency requests - always try network first
async function handleEmergencyRequest(request) {
  try {
    // Emergency requests always go to network first
    const networkResponse = await fetch(request);
    
    // Cache successful emergency responses
    if (networkResponse.ok) {
      const cache = await caches.open(EMERGENCY_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Emergency request failed, trying cache:', error);
    
    // Fallback to cache for emergency pages
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Ultimate fallback for emergency
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Emergency Mode</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
        <h1>🚨 Emergency Mode</h1>
        <p>You are in offline emergency mode.</p>
        <p>Your safety data is being stored locally and will sync when connection returns.</p>
        <button onclick="window.location.href='/'" style="padding: 10px 20px; font-size: 16px;">
          Return to Safety Dashboard
        </button>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Handle safety API requests
async function handleSafetyAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('Safety API request failed:', error);
    
    // Store failed requests for later sync
    if (request.method === 'POST') {
      await storeFailedRequest(request);
    }
    
    // Return appropriate offline response
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Request stored for sync when online',
        timestamp: Date.now()
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Static asset failed to load:', error);
    
    // Return a placeholder for failed images
    if (request.url.includes('.png') || request.url.includes('.jpg')) {
      return new Response(
        '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em">📱</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    throw error;
  }
}

// Handle generic requests with network-first strategy
async function handleGenericRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline-safety.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    throw error;
  }
}

// Background sync functions
async function syncSafetyData() {
  try {
    const pendingRequests = await getStoredRequests('safety');
    
    for (const requestData of pendingRequests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          await removeStoredRequest(requestData.id);
          console.log('Safety data synced successfully');
        }
      } catch (error) {
        console.error('Failed to sync safety data:', error);
      }
    }
  } catch (error) {
    console.error('Safety data sync failed:', error);
  }
}

async function syncMessages() {
  console.log('Syncing messages...');
  // Implement message sync logic
}

async function syncAlerts() {
  console.log('Syncing alerts...');
  // Implement alert sync logic
}

// Notification action handlers
async function sendSafeResponse(data) {
  try {
    await fetch('/api/safety/safe-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertId: data.alertId,
        response: 'safe',
        timestamp: Date.now()
      })
    });
    
    // Notify main app
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SAFE_RESPONSE_SENT',
        data: data
      });
    });
  } catch (error) {
    console.error('Failed to send safe response:', error);
  }
}

async function triggerHelpRequest(data) {
  try {
    await fetch('/api/safety/help-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertId: data.alertId,
        response: 'help',
        timestamp: Date.now(),
        urgent: true
      })
    });
    
    // Open app to help page
    await openApp('/emergency-help');
  } catch (error) {
    console.error('Failed to send help request:', error);
  }
}

async function openApp(path = '/') {
  const clients = await self.clients.matchAll({ type: 'window' });
  
  // If app is already open, focus it
  if (clients.length > 0) {
    const client = clients[0];
    client.focus();
    client.navigate(path);
    return;
  }
  
  // Otherwise, open new window
  return self.clients.openWindow(path);
}

// Storage utilities for failed requests
async function storeFailedRequest(request) {
  const requestData = {
    id: Date.now() + Math.random(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
    type: 'safety'
  };
  
  // Store in IndexedDB or localStorage
  // Implementation depends on your storage preference
  console.log('Storing failed request for later sync:', requestData);
}

async function getStoredRequests(type) {
  // Retrieve stored requests from IndexedDB or localStorage
  // Return array of stored requests
  return [];
}

async function removeStoredRequest(id) {
  // Remove successfully synced request from storage
  console.log('Removing synced request:', id);
}

console.log('Service Worker loaded successfully');

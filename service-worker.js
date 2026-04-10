const CACHE_NAME = 'bus-counter-v1.2';
const STATIC_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Strategy: Cache First with Network Fallback
self.addEventListener('fetch', (event) => {
  // Skip for POST requests and non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip for API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }
        
        // If not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache the new response
            return caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
          })
          .catch((error) => {
            // Network request failed
            console.log('[Service Worker] Network request failed:', error);
            
            // Return custom offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            return new Response('Offline content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background Sync for feedback submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-feedback') {
    console.log('[Service Worker] Background sync: submit-feedback');
    event.waitUntil(submitPendingFeedback());
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'নতুন আপডেট পাওয়া গেছে!',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'open',
        title: 'এপটি খুলুন'
      },
      {
        action: 'close',
        title: 'বন্ধ করুন'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Bus Counter Directory', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Function to submit pending feedback
async function submitPendingFeedback() {
  try {
    const pendingFeedback = await getPendingFeedback();
    
    for (const feedback of pendingFeedback) {
      // Here you would send the feedback to your server
      console.log('Submitting feedback:', feedback);
      
      // Remove from local storage after successful submission
      await removePendingFeedback(feedback.id);
    }
    
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

// Helper functions for feedback management
async function getPendingFeedback() {
  const db = await openFeedbackDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['feedback'], 'readonly');
    const store = transaction.objectStore('feedback');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removePendingFeedback(id) {
  const db = await openFeedbackDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['feedback'], 'readwrite');
    const store = transaction.objectStore('feedback');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openFeedbackDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FeedbackDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('feedback')) {
        const store = db.createObjectStore('feedback', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
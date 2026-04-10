// Global Variables
const list = document.getElementById("list");
const search = document.getElementById("search");
const busSelect = document.getElementById("busSelect");
const counterSelect = document.getElementById("counterSelect");
const resultCount = document.getElementById("resultCount");
const clearBtn = document.getElementById("clearBtn");
const favFilterBtn = document.getElementById("favFilterBtn");
const callAllBtn = document.getElementById("callAllBtn");
const shareBtn = document.getElementById("shareBtn");
const feedbackBtn = document.getElementById("feedbackBtn");
const darkBtn = document.getElementById("darkBtn");
const locateBtn = document.getElementById("locateBtn");
const refreshMapBtn = document.getElementById("refreshMapBtn");
const feedbackModal = document.getElementById("feedbackModal");
const callOptionsModal = document.getElementById("callOptionsModal");
const offlineStatus = document.getElementById("offlineStatus");
const updateDate = document.getElementById("updateDate");

let BUS_DATA = [];
let favourites = JSON.parse(localStorage.getItem("favs") || "[]");
let showFavouritesOnly = false;
let map;
let userLocationMarker;
let currentCallOptions = [];

// Initialize app
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  await loadData();
  setupEventListeners();
  initMap();
  setupServiceWorker();
  checkOnlineStatus();
  populateFeedbackBusDropdown();
  updateLastUpdateDate();
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// Load data with offline support
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Network response was not ok');
    
    const json = await response.json();
    BUS_DATA = json.buses;
    console.log('Data loaded:', BUS_DATA.length, 'buses');
    populateBusDropdown();
    render();
  } catch (error) {
    console.error('Failed to load data:', error);
    resultCount.textContent = "ডাটা লোড করতে সমস্যা হয়েছে";
    
    // Try to load from cache
    try {
      const cache = await caches.open('bus-counter-v1.2');
      const cachedResponse = await cache.match('data.json');
      if (cachedResponse) {
        const json = await cachedResponse.json();
        BUS_DATA = json.buses;
        populateBusDropdown();
        render();
        resultCount.textContent = "অফলাইন মোডে ডাটা দেখানো হচ্ছে";
      }
    } catch (cacheError) {
      console.error('Failed to load from cache:', cacheError);
      showEmptyState("ডাটা লোড করতে সমস্যা হচ্ছে", "অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করুন");
    }
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Dark mode toggle
  darkBtn.addEventListener('click', toggleDarkMode);
  
  // Search and filters
  search.addEventListener("input", () => {
    console.log('Search input:', search.value);
    render(search.value.toLowerCase());
  });
  
  busSelect.addEventListener("change", () => {
    console.log('Bus selected:', busSelect.value);
    onBusChange();
  });
  
  counterSelect.addEventListener("change", () => {
    console.log('Counter selected:', counterSelect.value);
    render(search.value.toLowerCase());
  });
  
  clearBtn.addEventListener("click", clearFilters);
  favFilterBtn.addEventListener("click", toggleFavouritesFilter);
  callAllBtn.addEventListener("click", showCallOptions);
  
  // Action buttons
  shareBtn.addEventListener("click", shareApp);
  feedbackBtn.addEventListener("click", () => showModal(feedbackModal));
  locateBtn.addEventListener("click", locateUser);
  refreshMapBtn.addEventListener("click", refreshMap);
  
  // Modal close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
  
  // Feedback form
  document.getElementById('feedbackForm').addEventListener('submit', submitFeedback);
  
  // Initialize dark mode
  const isDarkMode = localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    document.body.classList.add('dark');
    darkBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// Toggle dark mode
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  darkBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  darkBtn.title = isDark ? 'লাইট মোড' : 'ডার্ক মোড';
}

// Initialize map
function initMap() {
  if (map) {
    map.remove();
  }
  
  map = L.map("map").setView([23.8103, 90.4125], 11);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);
  
  // Add markers from data
  addMarkersFromData();
}

// Add markers from data
function addMarkersFromData() {
  BUS_DATA.forEach(bus => {
    bus.routes.forEach(route => {
      route.counters.forEach(counter => {
        if (counter.location && counter.location.length === 2) {
          const marker = L.marker(counter.location).addTo(map);
          marker.bindPopup(`
            <div class="map-popup">
              <strong>${bus.name}</strong><br>
              <strong>${counter.name}</strong><br>
              ${counter.phone ? counter.phone.join(', ') : ''}<br>
              <small>${route.area}</small><br>
              <button onclick="window.callNumber('${counter.phone ? counter.phone[0] : ''}')" class="map-call-btn">
                <i class="fas fa-phone"></i> কল করুন
              </button>
            </div>
          `);
        }
      });
    });
  });
}

// Populate bus dropdown
function populateBusDropdown() {
  console.log('Populating bus dropdown with', BUS_DATA.length, 'buses');
  busSelect.innerHTML = '<option value="">সব বাস কোম্পানি</option>';
  
  // Get unique bus names
  const busNames = BUS_DATA.map(bus => bus.name).filter((name, index, self) => 
    self.indexOf(name) === index
  ).sort();
  
  busNames.forEach(busName => {
    const opt = document.createElement("option");
    opt.value = busName;
    opt.textContent = busName;
    busSelect.appendChild(opt);
  });
  
  console.log('Bus dropdown populated with', busNames.length, 'options');
}

// Populate feedback bus dropdown
function populateFeedbackBusDropdown() {
  const feedbackBusSelect = document.getElementById('busSelectFeedback');
  feedbackBusSelect.innerHTML = '<option value="">বাস নির্বাচন করুন</option>';
  
  // Get unique bus names
  const busNames = BUS_DATA.map(bus => bus.name).filter((name, index, self) => 
    self.indexOf(name) === index
  ).sort();
  
  busNames.forEach(busName => {
    const opt = document.createElement("option");
    opt.value = busName;
    opt.textContent = busName;
    feedbackBusSelect.appendChild(opt);
  });
}

// Filter counters when bus changes
function onBusChange() {
  console.log('Bus changed to:', busSelect.value);
  counterSelect.innerHTML = `<option value="">সব কাউন্টার</option>`;

  const bus = BUS_DATA.find(b => b.name === busSelect.value);
  if (bus) {
    const counterSet = new Set();
    bus.routes.forEach(r => r.counters.forEach(c => counterSet.add(c.name)));
    
    const counterNames = Array.from(counterSet).sort();
    console.log('Found', counterNames.length, 'counters for bus:', busSelect.value);
    
    counterNames.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      counterSelect.appendChild(opt);
    });
  }
  
  render(search.value.toLowerCase());
}

// Clear all filters
function clearFilters() {
  console.log('Clearing all filters');
  search.value = "";
  busSelect.value = "";
  counterSelect.value = "";
  showFavouritesOnly = false;
  favFilterBtn.classList.remove("active");
  render();
}

// Toggle favourites filter
function toggleFavouritesFilter() {
  showFavouritesOnly = !showFavouritesOnly;
  favFilterBtn.classList.toggle("active", showFavouritesOnly);
  console.log('Favourites filter:', showFavouritesOnly ? 'ON' : 'OFF');
  render(search.value.toLowerCase());
}

// Render results - COMPLETELY REWRITTEN
function render(text = "") {
  console.log('Rendering with search text:', text);
  console.log('Filters - Bus:', busSelect.value, 'Counter:', counterSelect.value, 'Favourites:', showFavouritesOnly);
  
  list.innerHTML = "";
  let count = 0;
  currentCallOptions = [];

  if (!BUS_DATA || BUS_DATA.length === 0) {
    console.log('No data available');
    showEmptyState("ডাটা লোড হচ্ছে...", "অনুগ্রহ করে অপেক্ষা করুন");
    return;
  }

  // Filter buses
  let filteredBuses = BUS_DATA;
  
  if (busSelect.value) {
    filteredBuses = filteredBuses.filter(bus => bus.name === busSelect.value);
  }

  filteredBuses.forEach(bus => {
    bus.routes.forEach(route => {
      // Filter counters for this route
      const filteredCounters = route.counters.filter(counter => {
        // Apply counter filter
        if (counterSelect.value && counter.name !== counterSelect.value) {
          return false;
        }
        
        // Apply favourites filter
        if (showFavouritesOnly && !favourites.includes(counter.name)) {
          return false;
        }
        
        // Apply search filter
        if (text) {
          const searchText = text.toLowerCase();
          const inBusName = bus.name.toLowerCase().includes(searchText);
          const inRouteArea = route.area.toLowerCase().includes(searchText);
          const inCounterName = counter.name.toLowerCase().includes(searchText);
          const inPhoneNumbers = counter.phone ? 
            counter.phone.some(phone => phone.toLowerCase().includes(searchText)) : false;
          
          if (!(inBusName || inRouteArea || inCounterName || inPhoneNumbers)) {
            return false;
          }
        }
        
        return true;
      });

      if (filteredCounters.length === 0) return;

      const section = document.createElement("div");
      section.className = "section";
      section.innerHTML = `<h2><i class="fas fa-route"></i> ${bus.name} — ${route.area}</h2>`;

      filteredCounters.forEach(counter => {
        count++;
        
        // Add to call options
        if (counter.phone && Array.isArray(counter.phone)) {
          counter.phone.forEach(phone => {
            currentCallOptions.push({
              bus: bus.name,
              counter: counter.name,
              phone: phone
            });
          });
        }

        const card = createCounterCard(bus, route, counter);
        section.appendChild(card);
      });

      list.appendChild(section);
    });
  });

  // Update result count
  if (count === 0) {
    console.log('No results found');
    showEmptyState("কোনো ফলাফল পাওয়া যায়নি", "অনুগ্রহ করে আপনার সার্চ কিওয়ার্ড পরিবর্তন করুন");
  } else {
    console.log('Found', count, 'counters');
    resultCount.innerHTML = `
      <i class="fas fa-check-circle"></i> ${count} টি কাউন্টার পাওয়া গেছে
      ${showFavouritesOnly ? '<span class="fav-badge">ফেভারিট</span>' : ''}
    `;
  }

  // Update call all button
  callAllBtn.disabled = currentCallOptions.length === 0;
  console.log('Call options available:', currentCallOptions.length);
}

// Create counter card
function createCounterCard(bus, route, counter) {
  const card = document.createElement("div");
  card.className = "card";
  
  const isFavourite = favourites.includes(counter.name);
  
  // Create phone list HTML
  let phoneListHTML = '';
  if (counter.phone && Array.isArray(counter.phone)) {
    phoneListHTML = counter.phone.map(phone => {
      const cleanPhone = phone.replace(/\s+/g, '');
      return `
        <div class="phone-item">
          <span class="phone-number">${formatPhoneNumber(phone)}</span>
          <div class="phone-actions">
            <button class="call-btn-small" onclick="callNumber('${cleanPhone}')" title="কল করুন">
              <i class="fas fa-phone"></i>
            </button>
            <button class="copy-btn" onclick="copyToClipboard('${cleanPhone}')" title="কপি করুন">
              <i class="fas fa-copy"></i>
            </button>
            <button class="share-btn-small" onclick="shareNumber('${cleanPhone}', '${counter.name.replace(/'/g, "\\'")}')" title="শেয়ার করুন">
              <i class="fas fa-share-alt"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    phoneListHTML = '<p class="phone-number">ফোন নম্বর নেই</p>';
  }

  card.innerHTML = `
    <div class="card-content">
      <div class="card-header">
        <span class="fav ${isFavourite ? "active" : ""}" 
              onclick="toggleFav('${counter.name.replace(/'/g, "\\'")}')"
              title="${isFavourite ? 'ফেভারিট থেকে সরান' : 'ফেভারিটে যোগ করুন'}">
          <i class="fas fa-star"></i>
        </span>
        <strong>${counter.name}</strong>
        <span class="phone-count">${counter.phone ? counter.phone.length : 0} টি ফোন</span>
      </div>
      <div class="phone-list">
        ${phoneListHTML}
      </div>
    </div>
    <div class="card-actions">
      <button class="action-btn call-all" onclick="callCounter('${counter.phone ? counter.phone.join(',') : ''}')">
        <i class="fas fa-phone"></i> কল করুন
      </button>
      <button class="action-btn share-counter" 
              onclick="shareCounter('${bus.name.replace(/'/g, "\\'")}', 
                      '${counter.name.replace(/'/g, "\\'")}', 
                      '${counter.phone ? counter.phone.join(', ') : ''}')">
        <i class="fas fa-share-alt"></i>
      </button>
    </div>
  `;

  return card;
}

// Show empty state
function showEmptyState(title, message) {
  list.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-search"></i>
      <h3>${title}</h3>
      <p>${message}</p>
      <button onclick="clearFilters()" class="action-btn">
        <i class="fas fa-redo"></i> সব ফিল্টার ক্লিয়ার করুন
      </button>
    </div>
  `;
  resultCount.innerHTML = `<i class="fas fa-info-circle"></i> ${title}`;
}

// Toggle favourite
function toggleFav(name) {
  const index = favourites.indexOf(name);
  if (index > -1) {
    favourites.splice(index, 1);
    showToast("ফেভারিট থেকে সরানো হয়েছে");
  } else {
    favourites.push(name);
    showToast("ফেভারিটে যোগ করা হয়েছে");
  }
  
  localStorage.setItem("favs", JSON.stringify(favourites));
  render(search.value.toLowerCase());
}

// Call a number
function callNumber(phone) {
  if (!phone || phone === 'undefined') {
    showToast("ফোন নম্বর নেই", "warning");
    return;
  }
  
  if (confirm(`আপনি কি ${formatPhoneNumber(phone)} নম্বরে কল করতে চান?`)) {
    window.location.href = `tel:${phone}`;
  }
}

// Call all numbers of a counter
function callCounter(phones) {
  if (!phones || phones === 'undefined') {
    showToast("ফোন নম্বর নেই", "warning");
    return;
  }
  
  const phoneArray = phones.split(',');
  
  if (phoneArray.length === 0 || !phoneArray[0]) {
    showToast("ফোন নম্বর নেই", "warning");
    return;
  }
  
  if (phoneArray.length === 1) {
    callNumber(phoneArray[0]);
  } else {
    const modalList = document.getElementById('callOptionsList');
    modalList.innerHTML = `
      <div class="call-header">
        <h4><i class="fas fa-phone-volume"></i> কলের অপশন নির্বাচন করুন</h4>
      </div>
      ${phoneArray.filter(phone => phone.trim()).map(phone => `
        <div class="call-option">
          <span class="call-phone">${formatPhoneNumber(phone.trim())}</span>
          <button onclick="callNumber('${phone.trim()}')" class="call-option-btn">
            <i class="fas fa-phone"></i> কল করুন
          </button>
        </div>
      `).join('')}
    `;
    showModal(callOptionsModal);
  }
}

// Show all call options
function showCallOptions() {
  if (currentCallOptions.length === 0) {
    showToast("কল করার জন্য কোনো ফোন নম্বর পাওয়া যায়নি", "warning");
    return;
  }
  
  const modalList = document.getElementById('callOptionsList');
  modalList.innerHTML = `
    <div class="call-header">
      <h4><i class="fas fa-phone-volume"></i> সকল কলের অপশন (${currentCallOptions.length})</h4>
    </div>
    ${currentCallOptions.map((option, index) => `
      <div class="call-option">
        <div class="call-info">
          <div class="call-bus">${option.bus}</div>
          <div class="call-counter">${option.counter}</div>
        </div>
        <div class="call-action">
          <span class="call-phone">${formatPhoneNumber(option.phone)}</span>
          <button onclick="callNumber('${option.phone}')" class="call-option-btn">
            <i class="fas fa-phone"></i>
          </button>
        </div>
      </div>
    `).join('')}
  `;
  
  showModal(callOptionsModal);
}

// Share app
async function shareApp() {
  const shareData = {
    title: 'Bus Counter Directory',
    text: 'বাংলাদেশের বাস কাউন্টারের ফোন নাম্বার ডিরেক্টরি অ্যাপ',
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      showToast("অ্যাপ শেয়ার করা হয়েছে");
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareData.url);
      showToast("লিংক ক্লিপবোর্ডে কপি করা হয়েছে");
    }
  } catch (error) {
    console.log('Sharing failed:', error);
  }
}

// Share specific number
function shareNumber(phone, counterName) {
  const shareText = `${counterName} এর ফোন নম্বর: ${formatPhoneNumber(phone)}\n\nBus Counter Directory থেকে শেয়ার করা হয়েছে।`;
  
  if (navigator.share) {
    navigator.share({
      title: 'বাস কাউন্টার ফোন নম্বর',
      text: shareText,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      showToast("ফোন নম্বর কপি করা হয়েছে");
    });
  }
}

// Share counter info
function shareCounter(busName, counterName, phones) {
  const shareText = `
${busName} - ${counterName}
ফোন নম্বর: ${phones}

Bus Counter Directory অ্যাপ থেকে শেয়ার করা হয়েছে।
${window.location.href}
  `.trim();

  if (navigator.share) {
    navigator.share({
      title: `${busName} - ${counterName}`,
      text: shareText
    });
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      showToast("কাউন্টার তথ্য কপি করা হয়েছে");
    });
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("কপি করা হয়েছে");
  });
}

// Format phone number
function formatPhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0,4)} ${cleaned.slice(4,7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

// Show modal
function showModal(modal) {
  if (modal) {
    modal.style.display = 'block';
  }
}

// Submit feedback
async function submitFeedback(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    type: document.getElementById('feedbackType').value,
    message: document.getElementById('message').value,
    bus: document.getElementById('busSelectFeedback').value,
    timestamp: new Date().toISOString()
  };
  
  if (!formData.message.trim()) {
    showToast("মেসেজ ফিল্ডটি পূরণ করুন", "warning");
    return;
  }
  
  // Save to IndexedDB for offline submission
  await saveFeedbackToDB(formData);
  
  // Try to submit online
  if (navigator.onLine) {
    await submitFeedbackToServer(formData);
  } else {
    // Schedule background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('submit-feedback');
      showToast("অফলাইন মোডে। ইন্টারনেট সংযোগ পেলে সাবমিট হবে", "info");
    } else {
      showToast("অফলাইন মোডে। সংযোগ পেলে অটোমেটিক সাবমিট হবে", "info");
    }
  }
  
  form.reset();
  feedbackModal.style.display = 'none';
  showToast("ফিডব্যাক সাবমিট করা হয়েছে");
}

// Save feedback to IndexedDB
async function saveFeedbackToDB(feedback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FeedbackDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('feedback')) {
        db.createObjectStore('feedback', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['feedback'], 'readwrite');
      const store = transaction.objectStore('feedback');
      const addRequest = store.add(feedback);
      
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Submit feedback to server (simulated)
async function submitFeedbackToServer(feedback) {
  // In a real app, you would send this to your backend
  console.log('Submitting feedback:', feedback);
  
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
}

// Locate user on map
function locateUser() {
  if (!navigator.geolocation) {
    showToast("জিওলোকেশন সাপোর্ট করে না", "warning");
    return;
  }
  
  locateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  locateBtn.disabled = true;
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      // Remove previous marker
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }
      
      // Add new marker
      userLocationMarker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("আপনার বর্তমান অবস্থান")
        .openPopup();
      
      // Center map
      map.setView([latitude, longitude], 13);
      
      locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
      locateBtn.disabled = false;
      showToast("আপনার অবস্থান ম্যাপে দেখানো হয়েছে");
    },
    (error) => {
      console.error('Geolocation error:', error);
      locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
      locateBtn.disabled = false;
      showToast("অবস্থান পাওয়া যায়নি", "warning");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Refresh map
function refreshMap() {
  if (map) {
    map.invalidateSize();
    showToast("ম্যাপ রিফ্রেশ করা হয়েছে");
  }
}

// Setup service worker
function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('service-worker.js');
        console.log('ServiceWorker registration successful:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast("নতুন আপডেট পাওয়া গেছে। পেজ রিফ্রেশ করুন", "info");
            }
          });
        });
      } catch (error) {
        console.log('ServiceWorker registration failed:', error);
      }
    });
  }
}

// Check and update online status
function checkOnlineStatus() {
  updateOnlineStatus();
}

function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineStatus.style.display = 'none';
  } else {
    offlineStatus.style.display = 'flex';
    showToast("আপনি অফলাইনে আছেন", "warning");
  }
}

// Update last update date
function updateLastUpdateDate() {
  const lastUpdate = localStorage.getItem('lastUpdate') || '২০২৪-০১-১৫';
  updateDate.textContent = lastUpdate;
  
  // Check for updates periodically
  if (navigator.onLine) {
    checkForUpdates();
  }
}

// Check for updates
async function checkForUpdates() {
  try {
    const response = await fetch('data.json?t=' + Date.now());
    const etag = response.headers.get('etag');
    const lastEtag = localStorage.getItem('dataEtag');
    
    if (etag && etag !== lastEtag) {
      localStorage.setItem('dataEtag', etag);
      localStorage.setItem('lastUpdate', new Date().toISOString().split('T')[0]);
      updateDate.textContent = localStorage.getItem('lastUpdate');
      showToast("নতুন ডাটা পাওয়া গেছে। পেজ রিফ্রেশ করুন", "info");
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

// Show toast notification
function showToast(message, type = "success") {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Make functions available globally
window.toggleFav = toggleFav;
window.callNumber = callNumber;
window.callCounter = callCounter;
window.shareNumber = shareNumber;
window.shareCounter = shareCounter;
window.copyToClipboard = copyToClipboard;
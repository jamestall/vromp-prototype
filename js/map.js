/**
 * Map module for Vromp
 * Handles Leaflet map initialization and user position display
 */

let map = null;
let userMarker = null;
let accuracyCircle = null;
let routeLine = null;

// Map configuration
const MAP_CONFIG = {
    defaultZoom: 17,
    maxZoom: 19,
    minZoom: 10,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap'
};

/**
 * Initialize the Leaflet map
 * @param {string} containerId - ID of the map container element
 */
function initMap(containerId) {
    map = L.map(containerId, {
        zoomControl: false,
        attributionControl: true,
        rotate: true,
        rotateControl: false,
        touchRotate: false,
        bearing: 0
    }).setView([0, 0], MAP_CONFIG.defaultZoom);

    L.tileLayer(MAP_CONFIG.tileUrl, {
        maxZoom: MAP_CONFIG.maxZoom,
        attribution: MAP_CONFIG.attribution
    }).addTo(map);

    // Create user arrow marker
    const arrowIcon = L.divIcon({
        className: 'user-arrow-container',
        html: '<div class="user-arrow" id="user-arrow"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    userMarker = L.marker([0, 0], {
        icon: arrowIcon,
        zIndexOffset: 1000
    });

    // Create accuracy circle (hidden initially)
    accuracyCircle = L.circle([0, 0], {
        radius: 0,
        className: 'accuracy-circle',
        interactive: false
    });

    console.log('Map initialized');
}

// Track last known heading for smooth updates
let lastHeading = null;

/**
 * Update the user's position on the map
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} heading - Heading in degrees (may be null)
 * @param {number} accuracy - Accuracy in meters
 */
function updateUserPosition(lat, lng, heading, accuracy) {
    const latlng = L.latLng(lat, lng);

    // Add marker to map if not already added
    if (!map.hasLayer(userMarker)) {
        userMarker.addTo(map);
        accuracyCircle.addTo(map);
    }

    // Update marker position
    userMarker.setLatLng(latlng);

    // Update accuracy circle
    accuracyCircle.setLatLng(latlng);
    accuracyCircle.setRadius(accuracy);

    // Handle heading/rotation
    if (heading !== null && heading !== undefined && !isNaN(heading)) {
        lastHeading = heading;

        // Rotate the map so direction of travel is "up"
        // Map bearing is opposite of heading (we rotate map, not marker)
        if (map.setBearing) {
            map.setBearing(-heading);
        }
    }

    // Center map on user with offset (user in lower third)
    centerMapOnUser(lat, lng);
}

/**
 * Center the map on the user's position
 * When map is rotated, we center directly on user to avoid drift
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
function centerMapOnUser(lat, lng) {
    // Simple center - works correctly with map rotation
    // The offset approach causes drift when map rotates
    map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.3 });
}

/**
 * Draw a route line segment on the map
 * @param {Array} points - Array of [lat, lng] points
 */
function drawRouteLine(points) {
    // Remove existing route line
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    if (!points || points.length < 2) return;

    // Convert to Leaflet LatLng format
    const latLngs = points.map(p => L.latLng(p[0], p[1]));

    routeLine = L.polyline(latLngs, {
        color: '#4a90d9',
        weight: 5,
        opacity: 0.7,
        dashArray: '10, 15',
        lineCap: 'round'
    }).addTo(map);
}

/**
 * Clear the route line from the map
 */
function clearRouteLine() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
}

/**
 * Add a destination marker to the map
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} name - Destination name
 */
function addDestinationMarker(lat, lng, name) {
    const destIcon = L.divIcon({
        className: 'destination-marker',
        html: '<div style="background: #e74c3c; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    L.marker([lat, lng], { icon: destIcon })
        .bindPopup(name)
        .addTo(map);
}

/**
 * Set map view to show user and destination
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} destLat
 * @param {number} destLng
 */
function fitBounds(userLat, userLng, destLat, destLng) {
    const bounds = L.latLngBounds(
        L.latLng(userLat, userLng),
        L.latLng(destLat, destLng)
    );
    map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * Get the current map instance
 */
function getMap() {
    return map;
}

/**
 * Main app module for Vromp
 * Handles state management and app lifecycle
 */

// Hardcoded test destinations
const destinations = [
    {
        id: "quarry",
        name: "The Quarry at Slate Canyon",
        coordinates: { lat: 40.2338, lng: -111.6585 },
        description: "A hidden swimming spot locals love",
        teaser: "~15 min drive",
        arrivalRadius: 75
    }
];

// App state
const state = {
    // Trip status
    tripActive: false,
    arrived: false,

    // User position
    currentPosition: { lat: null, lng: null },
    heading: null,
    accuracy: null,

    // Route data
    destination: null,
    routeGeometry: null,
    routeSteps: [],
    currentStepIndex: 0,

    // Calculated values
    distanceToNextManeuver: null,
    distanceToDestination: null,
    distanceToRoute: null,

    // Re-routing
    isOffRoute: false,
    offRouteStartTime: null,
    isRerouting: false,
    lastRerouteTime: null,

    // Geolocation
    watchId: null
};

// Screen elements
const screens = {
    start: document.getElementById('start-screen'),
    nav: document.getElementById('nav-screen'),
    arrival: document.getElementById('arrival-screen'),
    error: document.getElementById('error-screen')
};

/**
 * Initialize the app
 */
function init() {
    console.log('Vromp initializing...');

    // Set up destination
    state.destination = destinations[0];

    // Update teaser text
    const teaserEl = document.getElementById('teaser-text');
    if (teaserEl && state.destination.teaser) {
        teaserEl.textContent = state.destination.teaser;
    }

    // Initialize map
    initMap('map');

    // Set up event listeners
    setupEventListeners();

    // Request location permission early
    requestLocationPermission();

    console.log('Vromp ready');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', startTrip);

    // End button
    document.getElementById('end-btn').addEventListener('click', endTrip);

    // Done button (arrival screen)
    document.getElementById('done-btn').addEventListener('click', resetApp);

    // Retry button (error screen)
    document.getElementById('retry-btn').addEventListener('click', () => {
        showScreen('start');
        requestLocationPermission();
    });
}

/**
 * Request location permission
 */
function requestLocationPermission() {
    if (!navigator.geolocation) {
        showError('Geolocation Not Supported', 'Your browser does not support geolocation.');
        return;
    }

    console.log('Requesting location permission...');

    // Just get one position to trigger permission prompt
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('Location permission granted');
            updatePosition(position);
        },
        (error) => {
            console.warn('Location permission denied or error:', error.code, error.message);
            // Show error so user knows what's happening
            if (error.code === error.PERMISSION_DENIED) {
                showError('Location Required', 'Please allow location access. On iOS: Settings → Safari → Location → Allow. Then reload this page.');
            }
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * Start the mystery trip
 */
async function startTrip() {
    console.log('Starting trip...');

    // Start watching position
    state.watchId = navigator.geolocation.watchPosition(
        updatePosition,
        handleLocationError,
        {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 10000
        }
    );

    // Wait a moment for position to be available
    if (!state.currentPosition.lat) {
        console.log('Waiting for location...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!state.currentPosition.lat) {
        showError('Location Required', 'Could not get your location. Please enable location services and try again.');
        return;
    }

    // Show navigation screen
    showScreen('nav');

    // Tell Leaflet to recalculate map size
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);

    // Fetch route
    try {
        const route = await fetchRoute(
            state.currentPosition.lat,
            state.currentPosition.lng,
            state.destination.coordinates.lat,
            state.destination.coordinates.lng
        );

        state.routeGeometry = route.geometry;
        state.routeSteps = route.steps;
        state.currentStepIndex = 0;
        state.tripActive = true;

        console.log(`Route loaded: ${route.steps.length} steps, ${formatDistance(route.distance)}`);

        // Update UI
        updateNavigationUI();

    } catch (error) {
        console.error('Failed to fetch route:', error);
        showError('Route Error', 'Could not calculate route. Please check your connection and try again.');
    }
}

/**
 * Handle position updates from geolocation
 */
function updatePosition(position) {
    const { latitude, longitude, heading, accuracy } = position.coords;

    state.currentPosition = { lat: latitude, lng: longitude };
    state.heading = heading;
    state.accuracy = accuracy;

    // Update map
    updateUserPosition(latitude, longitude, heading, accuracy);

    // If trip is active, update navigation
    if (state.tripActive) {
        updateNavigation();
    }
}

/**
 * Update navigation state and UI
 */
function updateNavigation() {
    // Check for arrival first
    if (checkArrival(state)) {
        triggerArrival();
        return;
    }

    // Determine current step
    const newStepIndex = determineCurrentStep(state);
    if (newStepIndex !== state.currentStepIndex) {
        state.currentStepIndex = newStepIndex;
        console.log(`Now on step ${newStepIndex}`);
    }

    // Check if off-route
    checkOffRoute();

    // Update UI
    updateNavigationUI();
}

/**
 * Update navigation UI elements
 */
function updateNavigationUI() {
    // Get and display current instruction
    const instruction = getCurrentInstruction(state);
    updateInstructionUI(instruction);

    // Update trip stats
    updateTripStatsUI(state);

    // Draw route line for current segment
    const geometry = getCurrentStepGeometry(state);
    drawRouteLine(geometry);
}

/**
 * Check if user is off-route and handle re-routing
 */
async function checkOffRoute() {
    if (!state.routeGeometry || state.routeGeometry.length === 0) return;

    // Find closest point on route
    const closest = findClosestPointOnRoute(state.currentPosition, state.routeGeometry);
    state.distanceToRoute = closest.distance;

    const OFF_ROUTE_THRESHOLD = 75;
    const OFF_ROUTE_DURATION = 3000;

    if (closest.distance > OFF_ROUTE_THRESHOLD) {
        if (!state.offRouteStartTime) {
            state.offRouteStartTime = Date.now();
            state.isOffRoute = true;
            console.log('Off-route detected, starting timer...');
        } else {
            const offRouteDuration = Date.now() - state.offRouteStartTime;

            if (offRouteDuration >= OFF_ROUTE_DURATION && !state.isRerouting) {
                // Trigger re-route
                await handleReroute();
            }
        }
    } else {
        // Back on route
        if (state.isOffRoute) {
            console.log('Back on route');
        }
        state.isOffRoute = false;
        state.offRouteStartTime = null;
    }
}

/**
 * Handle re-routing
 */
async function handleReroute() {
    // Check debounce
    if (state.lastRerouteTime) {
        const timeSince = Date.now() - state.lastRerouteTime;
        if (timeSince < 10000) {
            console.log('Re-route debounced, waiting...');
            return;
        }
    }

    console.log('Re-routing...');
    state.isRerouting = true;
    showRecalculating();

    try {
        const newRoute = await performReroute(state);

        state.routeGeometry = newRoute.geometry;
        state.routeSteps = newRoute.steps;
        state.currentStepIndex = 0;
        state.lastRerouteTime = Date.now();
        state.offRouteStartTime = null;
        state.isOffRoute = false;

        console.log('Re-route complete');
        updateNavigationUI();

    } catch (error) {
        console.error('Re-route failed:', error);
        // Will retry after debounce period
    } finally {
        state.isRerouting = false;
        hideRecalculating();
    }
}

/**
 * Trigger arrival sequence
 */
function triggerArrival() {
    console.log('Arrived at destination!');

    state.tripActive = false;
    state.arrived = true;

    // Stop watching position
    if (state.watchId) {
        navigator.geolocation.clearWatch(state.watchId);
        state.watchId = null;
    }

    // Clear route line
    clearRouteLine();

    // Show destination marker
    addDestinationMarker(
        state.destination.coordinates.lat,
        state.destination.coordinates.lng,
        state.destination.name
    );

    // Update arrival screen
    document.getElementById('destination-name').textContent = state.destination.name;
    document.getElementById('destination-description').textContent = state.destination.description;

    // Show arrival screen
    showScreen('arrival');
}

/**
 * End the trip early
 */
function endTrip() {
    console.log('Trip ended by user');

    state.tripActive = false;

    if (state.watchId) {
        navigator.geolocation.clearWatch(state.watchId);
        state.watchId = null;
    }

    clearRouteLine();
    resetApp();
}

/**
 * Reset app to initial state
 */
function resetApp() {
    state.tripActive = false;
    state.arrived = false;
    state.routeGeometry = null;
    state.routeSteps = [];
    state.currentStepIndex = 0;
    state.isOffRoute = false;
    state.offRouteStartTime = null;
    state.isRerouting = false;

    showScreen('start');

    // Restart position watching for the map
    requestLocationPermission();
}

/**
 * Handle location errors
 */
function handleLocationError(error) {
    console.error('Geolocation error:', error);

    let title = 'Location Error';
    let message = 'An error occurred while getting your location.';

    switch (error.code) {
        case error.PERMISSION_DENIED:
            title = 'Location Required';
            message = 'Vromp needs your location to guide you. Please enable location access in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            title = 'Location Unavailable';
            message = 'Your location could not be determined. Please check your GPS signal.';
            break;
        case error.TIMEOUT:
            title = 'Location Timeout';
            message = 'Getting your location took too long. Please try again.';
            break;
    }

    if (state.tripActive) {
        // During navigation, just log - GPS might recover
        console.warn('Location error during navigation, will retry...');
    } else {
        showError(title, message);
    }
}

/**
 * Show a specific screen
 */
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });

    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

/**
 * Show error screen
 */
function showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    showScreen('error');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

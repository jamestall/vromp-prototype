/**
 * Routing module for Vromp
 * Handles OSRM API calls and route parsing
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch a route from OSRM
 * @param {number} startLat - Start latitude
 * @param {number} startLng - Start longitude
 * @param {number} endLat - End latitude
 * @param {number} endLng - End longitude
 * @returns {Promise<Object>} Parsed route data
 */
async function fetchRoute(startLat, startLng, endLat, endLng) {
    const url = `${OSRM_BASE_URL}/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=polyline`;

    console.log('Fetching route from OSRM...');

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }

        const route = data.routes[0];

        return parseRoute(route);
    } catch (error) {
        console.error('Route fetch error:', error);
        throw error;
    }
}

/**
 * Parse OSRM route response into app-friendly format
 * @param {Object} route - OSRM route object
 * @returns {Object} Parsed route data
 */
function parseRoute(route) {
    // Decode the full route geometry
    const geometry = decodePolyline(route.geometry);

    // Extract steps from the first (and only) leg
    const leg = route.legs[0];
    const steps = leg.steps.map((step, index) => {
        return {
            index: index,
            maneuver: {
                type: step.maneuver.type,
                modifier: step.maneuver.modifier || null,
                location: {
                    lat: step.maneuver.location[1],
                    lng: step.maneuver.location[0]
                }
            },
            name: step.name || 'Unnamed road',
            distance: step.distance, // meters
            duration: step.duration, // seconds
            geometry: step.geometry ? decodePolyline(step.geometry) : []
        };
    });

    return {
        distance: route.distance, // total distance in meters
        duration: route.duration, // total duration in seconds
        geometry: geometry,
        steps: steps
    };
}

/**
 * Check if we need to re-route based on distance from route
 * @param {Object} state - App state
 * @returns {boolean} True if re-route is needed
 */
function shouldReroute(state) {
    // Don't re-route if already re-routing
    if (state.isRerouting) return false;

    // Don't re-route if trip not active
    if (!state.tripActive) return false;

    // Don't re-route too frequently (minimum 10 seconds between re-routes)
    if (state.lastRerouteTime) {
        const timeSinceLastReroute = Date.now() - state.lastRerouteTime;
        if (timeSinceLastReroute < 10000) return false;
    }

    // Check if off-route
    const OFF_ROUTE_THRESHOLD = 75; // meters
    const OFF_ROUTE_DURATION = 3000; // 3 seconds

    if (state.distanceToRoute > OFF_ROUTE_THRESHOLD) {
        if (!state.offRouteStartTime) {
            // First detection of being off-route
            return false; // Will be set by caller, wait for duration
        }

        const offRouteDuration = Date.now() - state.offRouteStartTime;
        if (offRouteDuration >= OFF_ROUTE_DURATION) {
            return true;
        }
    }

    return false;
}

/**
 * Perform a re-route operation
 * @param {Object} state - App state
 * @returns {Promise<Object>} New route data
 */
async function performReroute(state) {
    console.log('Performing re-route...');

    const newRoute = await fetchRoute(
        state.currentPosition.lat,
        state.currentPosition.lng,
        state.destination.coordinates.lat,
        state.destination.coordinates.lng
    );

    return newRoute;
}

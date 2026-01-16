/**
 * Utility functions for Vromp
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate bearing from point 1 to point 2
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
function getBearing(lat1, lng1, lat2, lng2) {
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
}

/**
 * Convert degrees to radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDeg(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Decode an encoded polyline string into an array of coordinates
 * @param {string} encoded - Encoded polyline string from OSRM
 * @returns {Array} Array of [lat, lng] pairs
 */
function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
function formatDistance(meters) {
    const feet = meters * 3.28084;
    const miles = meters / 1609.34;

    if (miles >= 0.1) {
        return `${miles.toFixed(1)} mi`;
    } else {
        // Round to nearest 50 feet for cleaner display
        const roundedFeet = Math.round(feet / 50) * 50;
        return `${roundedFeet} ft`;
    }
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
}

/**
 * Find the closest point on a route polyline to the user's position
 * @param {Object} userPosition - {lat, lng}
 * @param {Array} routeGeometry - Array of [lat, lng] points
 * @returns {Object} {point, distance, segmentIndex}
 */
function findClosestPointOnRoute(userPosition, routeGeometry) {
    let minDistance = Infinity;
    let closestPoint = null;
    let segmentIndex = 0;

    for (let i = 0; i < routeGeometry.length - 1; i++) {
        const start = routeGeometry[i];
        const end = routeGeometry[i + 1];

        const result = getClosestPointOnSegment(
            userPosition,
            { lat: start[0], lng: start[1] },
            { lat: end[0], lng: end[1] }
        );

        if (result.distance < minDistance) {
            minDistance = result.distance;
            closestPoint = result.point;
            segmentIndex = i;
        }
    }

    return {
        point: closestPoint,
        distance: minDistance,
        segmentIndex: segmentIndex
    };
}

/**
 * Get the closest point on a line segment to a given point
 * @param {Object} point - {lat, lng}
 * @param {Object} lineStart - {lat, lng}
 * @param {Object} lineEnd - {lat, lng}
 * @returns {Object} {point, distance}
 */
function getClosestPointOnSegment(point, lineStart, lineEnd) {
    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let closestLat, closestLng;

    if (param < 0) {
        closestLat = lineStart.lat;
        closestLng = lineStart.lng;
    } else if (param > 1) {
        closestLat = lineEnd.lat;
        closestLng = lineEnd.lng;
    } else {
        closestLat = lineStart.lat + param * C;
        closestLng = lineStart.lng + param * D;
    }

    const distance = getDistanceMeters(point.lat, point.lng, closestLat, closestLng);

    return {
        point: { lat: closestLat, lng: closestLng },
        distance: distance
    };
}

/**
 * Get maneuver icon based on type and modifier
 * @param {string} type - Maneuver type from OSRM
 * @param {string} modifier - Maneuver modifier from OSRM
 * @returns {string} Icon character
 */
function getManeuverIcon(type, modifier) {
    if (type === 'arrive') return '⚑';
    if (type === 'depart') return '↑';
    if (type === 'roundabout' || type === 'rotary') return '⟳';

    switch (modifier) {
        case 'left':
        case 'sharp left':
            return '↰';
        case 'slight left':
            return '↖';
        case 'right':
        case 'sharp right':
            return '↱';
        case 'slight right':
            return '↗';
        case 'straight':
        case 'continue':
        default:
            return '↑';
    }
}

/**
 * Get human-readable maneuver text
 * @param {string} type - Maneuver type from OSRM
 * @param {string} modifier - Maneuver modifier from OSRM
 * @returns {string} Maneuver text
 */
function getManeuverText(type, modifier) {
    if (type === 'arrive') return 'Arrive at';
    if (type === 'depart') return 'Head toward';
    if (type === 'roundabout' || type === 'rotary') return 'Take the roundabout to';

    switch (modifier) {
        case 'left':
            return 'Turn left onto';
        case 'sharp left':
            return 'Sharp left onto';
        case 'slight left':
            return 'Bear left onto';
        case 'right':
            return 'Turn right onto';
        case 'sharp right':
            return 'Sharp right onto';
        case 'slight right':
            return 'Bear right onto';
        case 'straight':
            return 'Continue onto';
        default:
            return 'Continue onto';
    }
}

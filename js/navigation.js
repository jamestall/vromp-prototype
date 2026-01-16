/**
 * Navigation module for Vromp
 * Handles turn-by-turn logic and instruction display
 */

// Navigation thresholds
const NAV_CONFIG = {
    stepCompletionRadius: 30, // meters - when to advance to next step
    arrivalRadius: 75, // meters - when to trigger arrival
    offRouteThreshold: 75, // meters - when to consider user off-route
    longStretchDistance: 3218.69 // 2 miles in meters
};

/**
 * Determine which step the user is currently on
 * @param {Object} state - App state
 * @returns {number} Index of current step
 */
function determineCurrentStep(state) {
    if (!state.routeSteps || state.routeSteps.length === 0) {
        return 0;
    }

    const userPos = state.currentPosition;
    let currentIndex = state.currentStepIndex;

    // Check if we've passed the current step's maneuver point
    while (currentIndex < state.routeSteps.length - 1) {
        const step = state.routeSteps[currentIndex];
        const maneuverPoint = step.maneuver.location;

        const distanceToManeuver = getDistanceMeters(
            userPos.lat, userPos.lng,
            maneuverPoint.lat, maneuverPoint.lng
        );

        // If we're within the completion radius, advance to next step
        if (distanceToManeuver < NAV_CONFIG.stepCompletionRadius) {
            currentIndex++;
            console.log(`Advanced to step ${currentIndex}`);
        } else {
            break;
        }
    }

    return currentIndex;
}

/**
 * Get the distance to the next maneuver
 * @param {Object} state - App state
 * @returns {number} Distance in meters
 */
function getDistanceToNextManeuver(state) {
    if (!state.routeSteps || state.currentStepIndex >= state.routeSteps.length) {
        return 0;
    }

    const step = state.routeSteps[state.currentStepIndex];
    const maneuverPoint = step.maneuver.location;

    return getDistanceMeters(
        state.currentPosition.lat, state.currentPosition.lng,
        maneuverPoint.lat, maneuverPoint.lng
    );
}

/**
 * Get the current instruction to display
 * @param {Object} state - App state
 * @returns {Object} Instruction object {icon, text, distance}
 */
function getCurrentInstruction(state) {
    if (!state.routeSteps || state.routeSteps.length === 0) {
        return {
            icon: '↑',
            roadName: 'Calculating route...',
            distance: ''
        };
    }

    const stepIndex = state.currentStepIndex;

    // Check if this is the last step (arrival)
    if (stepIndex >= state.routeSteps.length - 1) {
        const distToDest = getDistanceMeters(
            state.currentPosition.lat, state.currentPosition.lng,
            state.destination.coordinates.lat, state.destination.coordinates.lng
        );

        return {
            icon: '⚑',
            roadName: 'Arrive at your destination',
            distance: formatDistance(distToDest)
        };
    }

    const currentStep = state.routeSteps[stepIndex];
    const nextStep = state.routeSteps[stepIndex + 1];

    // Calculate distance to next maneuver
    const distanceToNext = getDistanceMeters(
        state.currentPosition.lat, state.currentPosition.lng,
        nextStep.maneuver.location.lat, nextStep.maneuver.location.lng
    );

    // Get maneuver info for the NEXT step (what we're approaching)
    const icon = getManeuverIcon(nextStep.maneuver.type, nextStep.maneuver.modifier);

    // Determine instruction text based on distance
    let roadName;

    if (distanceToNext > NAV_CONFIG.longStretchDistance) {
        // Long stretch: "Continue on X for Y miles"
        roadName = `Continue on ${currentStep.name}`;
    } else if (nextStep.maneuver.type === 'arrive') {
        roadName = 'Your destination';
    } else {
        // Normal: show next turn
        roadName = nextStep.name || 'the road';
    }

    return {
        icon: icon,
        roadName: roadName,
        distance: formatDistance(distanceToNext)
    };
}

/**
 * Check if user has arrived at destination
 * @param {Object} state - App state
 * @returns {boolean} True if arrived
 */
function checkArrival(state) {
    if (!state.destination || !state.currentPosition.lat) {
        return false;
    }

    const distToDest = getDistanceMeters(
        state.currentPosition.lat, state.currentPosition.lng,
        state.destination.coordinates.lat, state.destination.coordinates.lng
    );

    const arrivalRadius = state.destination.arrivalRadius || NAV_CONFIG.arrivalRadius;

    return distToDest <= arrivalRadius;
}

/**
 * Get geometry for the current step (for drawing partial route line)
 * @param {Object} state - App state
 * @returns {Array} Array of [lat, lng] points
 */
function getCurrentStepGeometry(state) {
    if (!state.routeSteps || state.currentStepIndex >= state.routeSteps.length) {
        return [];
    }

    const currentStep = state.routeSteps[state.currentStepIndex];

    // If we have step geometry, use it
    if (currentStep.geometry && currentStep.geometry.length > 0) {
        // Prepend user's current position for smooth line
        return [
            [state.currentPosition.lat, state.currentPosition.lng],
            ...currentStep.geometry
        ];
    }

    // Fallback: line from user to next maneuver point
    const nextStepIndex = Math.min(state.currentStepIndex + 1, state.routeSteps.length - 1);
    const nextStep = state.routeSteps[nextStepIndex];

    return [
        [state.currentPosition.lat, state.currentPosition.lng],
        [nextStep.maneuver.location.lat, nextStep.maneuver.location.lng]
    ];
}

/**
 * Update UI with current instruction
 * @param {Object} instruction - Instruction object from getCurrentInstruction
 */
function updateInstructionUI(instruction) {
    const iconEl = document.getElementById('maneuver-icon');
    const roadNameEl = document.getElementById('road-name');
    const distanceEl = document.getElementById('distance-to-turn');

    if (iconEl) iconEl.textContent = instruction.icon;
    if (roadNameEl) roadNameEl.textContent = instruction.roadName;
    if (distanceEl) distanceEl.textContent = instruction.distance;
}

/**
 * Update trip stats UI
 * @param {Object} state - App state
 */
function updateTripStatsUI(state) {
    const timeEl = document.getElementById('time-remaining');
    const distanceEl = document.getElementById('distance-remaining');

    if (!state.destination || !state.currentPosition.lat) {
        return;
    }

    // Calculate remaining distance to destination
    const distRemaining = getDistanceMeters(
        state.currentPosition.lat, state.currentPosition.lng,
        state.destination.coordinates.lat, state.destination.coordinates.lng
    );

    // Estimate time based on average speed (assume 30 mph = 48 km/h = 13.4 m/s)
    const avgSpeedMps = 13.4;
    const timeRemaining = distRemaining / avgSpeedMps;

    if (timeEl) timeEl.textContent = formatDuration(timeRemaining);
    if (distanceEl) distanceEl.textContent = formatDistance(distRemaining);
}

/**
 * Show recalculating state
 */
function showRecalculating() {
    const recalcEl = document.getElementById('recalculating');
    if (recalcEl) recalcEl.classList.add('active');
}

/**
 * Hide recalculating state
 */
function hideRecalculating() {
    const recalcEl = document.getElementById('recalculating');
    if (recalcEl) recalcEl.classList.remove('active');
}

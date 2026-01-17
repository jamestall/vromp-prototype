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

    // Check if we've reached the current step's maneuver point
    // (meaning we should advance to show the next instruction)
    while (currentIndex < state.routeSteps.length - 1) {
        const currentStep = state.routeSteps[currentIndex];
        const maneuverPoint = currentStep.maneuver.location;

        const distanceToManeuver = getDistanceMeters(
            userPos.lat, userPos.lng,
            maneuverPoint.lat, maneuverPoint.lng
        );

        // Skip depart step immediately (we're already past the start)
        if (currentStep.maneuver.type === 'depart') {
            currentIndex++;
            console.log(`Skipped depart step, now on step ${currentIndex}`);
            continue;
        }

        // If we're within the completion radius of THIS step's maneuver,
        // we've made this turn, advance to next step
        if (distanceToManeuver < NAV_CONFIG.stepCompletionRadius) {
            currentIndex++;
            console.log(`Completed maneuver, advanced to step ${currentIndex}`);
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
    const currentStep = state.routeSteps[stepIndex];

    // Check if this is the last step (arrival)
    if (currentStep.maneuver.type === 'arrive') {
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

    // Calculate distance to THIS step's maneuver (the upcoming turn)
    const distanceToManeuver = getDistanceMeters(
        state.currentPosition.lat, state.currentPosition.lng,
        currentStep.maneuver.location.lat, currentStep.maneuver.location.lng
    );

    // Get maneuver info for CURRENT step (what we're approaching)
    const icon = getManeuverIcon(currentStep.maneuver.type, currentStep.maneuver.modifier);

    // Determine instruction text
    let roadName;

    // If it's a depart step, look ahead to next turn
    if (currentStep.maneuver.type === 'depart') {
        if (stepIndex + 1 < state.routeSteps.length) {
            const nextStep = state.routeSteps[stepIndex + 1];
            const distToNext = getDistanceMeters(
                state.currentPosition.lat, state.currentPosition.lng,
                nextStep.maneuver.location.lat, nextStep.maneuver.location.lng
            );
            return {
                icon: getManeuverIcon(nextStep.maneuver.type, nextStep.maneuver.modifier),
                roadName: nextStep.name || 'the road',
                distance: formatDistance(distToNext)
            };
        }
        roadName = currentStep.name || 'the road';
    } else if (distanceToManeuver > NAV_CONFIG.longStretchDistance) {
        // Long stretch: "Continue on X"
        roadName = `Continue on ${currentStep.name}`;
    } else {
        // Normal: show the turn and road name
        roadName = currentStep.name || 'the road';
    }

    return {
        icon: icon,
        roadName: roadName,
        distance: formatDistance(distanceToManeuver)
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

    // Calculate remaining route distance by summing remaining steps
    let distRemaining = 0;
    let timeRemaining = 0;

    if (state.routeSteps && state.routeSteps.length > 0) {
        // Sum distance/duration of remaining steps
        for (let i = state.currentStepIndex; i < state.routeSteps.length; i++) {
            distRemaining += state.routeSteps[i].distance || 0;
            timeRemaining += state.routeSteps[i].duration || 0;
        }

        // Subtract progress through current step (approximate)
        if (state.currentStepIndex < state.routeSteps.length) {
            const currentStep = state.routeSteps[state.currentStepIndex];
            const distToManeuver = getDistanceMeters(
                state.currentPosition.lat, state.currentPosition.lng,
                currentStep.maneuver.location.lat, currentStep.maneuver.location.lng
            );
            // Only count distance to the maneuver point for current step
            const stepDist = currentStep.distance || 0;
            if (stepDist > 0 && distToManeuver < stepDist) {
                distRemaining = distRemaining - stepDist + distToManeuver;
            }
        }
    } else {
        // Fallback to crow-flies if no route data
        distRemaining = getDistanceMeters(
            state.currentPosition.lat, state.currentPosition.lng,
            state.destination.coordinates.lat, state.destination.coordinates.lng
        );
        // Estimate time at 30 mph
        timeRemaining = distRemaining / 13.4;
    }

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

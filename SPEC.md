# Project Specification

# Vromp Mystery Navigation Prototype — Technical Spec

## Project Overview

Build a web-based "mystery navigation" app that guides users to a hidden destination via turn-by-turn directions, without revealing where they're going until they arrive.

**Core insight:** Traditional navigation shows the full route and destination. Vromp shows only the *next* instruction, preserving the mystery while remaining drivable.

### Success Criteria
- User can load the app on their phone, start a trip, and drive to an unknown destination
- They receive real turn-by-turn directions without seeing the final destination
- On arrival, the destination reveals itself with name and details
- The experience feels like being guided by someone who knows a secret

---

## User Experience Flow

### 1. Start Screen
- Simple screen with "Start Mystery Trip" button
- Maybe a brief teaser: "Ready for an adventure? ~15 min drive"

### 2. Active Navigation
- Map shows user's current position (moving blue dot)
- Map auto-centers and rotates to heading (driving orientation)
- **Next instruction only** displayed prominently: "In 0.4 miles, turn right on State Street"
- Short directional line from user's position toward the next turn point (NOT the full route)
- For long stretches (>2 miles): "Continue on Highway 89 for 12 miles"
- Distance/time remaining shown but NOT the destination name

### 3. Arrival
- Triggered when user is within ~50-100 meters of destination
- Navigation UI disappears
- Destination reveal: name, photo (if available), description
- Destination marker appears on map
- Celebratory moment (could be simple for MVP)

---

## Technical Architecture

### Stack
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend | HTML + CSS + Vanilla JS | No build tools, simple deployment |
| Maps | Leaflet + OpenStreetMap tiles | Free, no API key for tiles |
| Routing | OSRM public API | Free, returns turn-by-turn instructions |
| Geolocation | Browser Geolocation API | Built-in, no library needed |
| Hosting | GitHub Pages or Netlify | Free HTTPS, easy deployment |

### APIs Used

**OSRM (Open Source Routing Machine)**
- Endpoint: `https://router.project-osrm.org/route/v1/driving/{start};{end}?overview=full&steps=true`
- Returns: Full route geometry + turn-by-turn steps
- Rate limit: Public demo server, fine for prototype
- Docs: https://project-osrm.org/docs/v5.24.0/api/

**Browser Geolocation API**
- `navigator.geolocation.watchPosition()` for continuous updates
- Need to handle permission denial gracefully

### File Structure
```
vromp-prototype/
├── index.html      # Single page app
├── css/
│   └── style.css   # All styles
├── js/
│   ├── app.js      # Main app logic, state management
│   ├── map.js      # Leaflet map setup and manipulation
│   ├── routing.js  # OSRM API calls, route parsing
│   ├── navigation.js # Turn-by-turn logic, instruction display
│   └── utils.js    # Distance calculations, helpers
└── assets/
    └── (optional images/icons)
```

---

## Detailed Feature Breakdown

### Feature 1: Map with Live Location

**Requirements:**
- Initialize Leaflet map with OpenStreetMap tiles
- Request geolocation permission on load
- Show user's position as a directional arrow (not a dot)
- Update position in real-time using `watchPosition()`
- Map should auto-center on user's position (user in lower third of screen)
- Arrow marker should rotate to match user's heading
- Map should rotate so direction of travel is "up" (Google Maps style)

**Implementation notes:**
- Use `{ enableHighAccuracy: true }` for better GPS
- Handle the case where user denies permission (show error message)
- Heading comes from `coords.heading` in geolocation callback (may be null when stationary)
- For map rotation, use Leaflet's `map.setBearing()` or a plugin like Leaflet.RotatedMarker
- Consider showing accuracy radius circle around position (subtle, optional)
- Offset map center so user is in lower third — shows more of the road ahead

**Arrow marker:**
- Use a simple CSS triangle or SVG arrow
- Rotate via CSS transform based on heading
- When heading is null (stationary), point in direction of last known heading or hide rotation

**Test:** Open on phone, drive around, see arrow rotate smoothly to match direction of travel.

---

### Feature 2: Route Fetching (Hidden from User)

**Requirements:**
- On trip start, fetch route from OSRM
- Parse the response to extract:
  - Full route geometry (polyline)
  - Array of step-by-step instructions
  - Total distance and duration
- Store route data in app state but DO NOT display full route on map

**OSRM Response Structure (simplified):**
```javascript
{
  routes: [{
    distance: 12345,  // meters
    duration: 890,    // seconds
    geometry: "encoded_polyline_string",
    legs: [{
      steps: [
        {
          maneuver: {
            type: "turn",
            modifier: "right",
            location: [lng, lat]
          },
          name: "State Street",
          distance: 450,
          duration: 45,
          geometry: "step_polyline"
        },
        // ... more steps
      ]
    }]
  }]
}
```

**Implementation notes:**
- Decode the polyline using a library (Leaflet has plugins) or write decoder
- Store steps array for navigation logic
- May need to re-fetch route if user goes significantly off-course

---

### Feature 3: Turn-by-Turn Instruction Display

**Requirements:**
- Determine which step the user is currently on (based on position)
- Display ONLY the next instruction, e.g.:
  - "In 0.4 miles, turn right on State Street"
  - "Continue on Highway 89 for 12 miles"
  - "In 500 feet, arrive at your destination"
- Update distance to next maneuver in real-time as user moves
- Advance to next instruction when user completes current step

**Instruction formatting logic:**
```
If distance to next turn > 2 miles:
  "Continue on [current road] for [X] miles"
If distance to next turn > 500 feet:
  "In [X] miles, [maneuver] on [road name]"
If distance to next turn < 500 feet:
  "In [X] feet, [maneuver] on [road name]"
If this is the final step:
  "In [distance], arrive at your destination"
```

**Maneuver type mapping:**
- turn + right → "turn right"
- turn + left → "turn left"
- turn + slight right → "bear right"
- continue → "continue straight"
- roundabout → "take the roundabout"
- arrive → "arrive"

**Implementation notes:**
- Need to calculate user's distance to next maneuver point
- Need to detect when user has "passed" a maneuver and advance to next
- Consider a tolerance radius (~30-50m) for maneuver completion

---

### Feature 4: Off-Route Detection and Re-Routing

**Requirements:**
- Continuously check if user is still on the planned route
- If user deviates significantly, automatically fetch a new route
- Show brief "Recalculating..." feedback
- Seamlessly replace old route with new one

**Off-route detection logic:**
```
Every position update:
1. Find the closest point on the route polyline to user's position
2. Calculate distance from user to that closest point
3. If distance > OFF_ROUTE_THRESHOLD (75m):
   - Start a timer (or increment a counter)
4. If off-route for > 3 seconds (or 3 consecutive readings):
   - Trigger re-route
5. If user returns to within threshold:
   - Cancel the timer, continue normal navigation
```

**Re-routing logic:**
```
1. Show "Recalculating..." in instruction panel
2. Fetch new route from OSRM (current position → same destination)
3. Parse new route response
4. Replace routeGeometry, routeSteps in state
5. Reset currentStepIndex to 0
6. Hide "Recalculating...", show new first instruction
```

**Debounce/rate limiting:**
- Minimum 10 seconds between re-route attempts
- Don't re-route if a route fetch is already in progress
- If OSRM fails, wait 15 seconds before retry

**Implementation notes:**
- Finding closest point on polyline: iterate through segments, find perpendicular distance to each, take minimum
- GPS can jump around in urban canyons/tunnels — the 3-second delay prevents false triggers
- Store `lastRerouteTime` to enforce debounce

---

### Feature 5: Partial Route Line (Next Segment Only)

**Requirements:**
- Draw a line from user's current position to the next turn point
- Line should be subtle (not a bright full-route line)
- Line updates as user moves
- Do NOT show route beyond the next turn

**Implementation notes:**
- Extract geometry for current step only from route data
- Redraw line on each position update
- Style: maybe a dotted line or semi-transparent
- Consider showing a small arrow/chevron at the turn point

---

### Feature 6: Arrival Detection and Reveal

**Requirements:**
- Continuously check distance from user to final destination
- When within threshold (50-100m), trigger arrival sequence
- Arrival sequence:
  1. Stop navigation UI
  2. Show destination name prominently
  3. Show destination marker on map
  4. Optional: show description, photo, or details
  5. Optional: celebratory animation (confetti, sound, etc.)

**Implementation notes:**
- Use Haversine formula for distance calculation
- Threshold might need tuning based on GPS accuracy
- Consider a "You've arrived!" transition screen before reveal

---

### Feature 7: Hardcoded Test Destinations

For the prototype, destinations are hardcoded. Structure for easy expansion later.

**Destination data structure:**
```javascript
const destinations = [
  {
    id: "quarry",
    name: "The Quarry at Slate Canyon",
    coordinates: { lat: 40.2338, lng: -111.6585 },
    description: "A hidden swimming spot locals love",
    teaser: "~15 min drive • Bring a towel",
    arrivalRadius: 75,  // meters
    photo: null  // optional URL
  }
];

// For prototype, just pick one:
const activeDestination = destinations[0];
```

---

## State Management

Keep it simple — a single state object:

```javascript
const state = {
  // Trip status
  tripActive: false,
  arrived: false,
  
  // User position
  currentPosition: { lat: null, lng: null },
  heading: null,  // degrees, may be null
  accuracy: null, // meters
  
  // Route data (hidden from user)
  destination: null,        // destination object
  routeGeometry: null,      // full decoded polyline
  routeSteps: [],           // array of instruction steps
  currentStepIndex: 0,      // which step user is on
  
  // Calculated values
  distanceToNextManeuver: null,
  distanceToDestination: null,
  distanceToRoute: null,    // for off-route detection
  
  // Re-routing
  isOffRoute: false,
  offRouteStartTime: null,  // when we first detected off-route
  isRerouting: false,       // true while fetching new route
  lastRerouteTime: null,    // for debouncing
  
  // Geolocation
  watchId: null  // to stop watching later
};
```

---

## UI Layout (Mobile-First, Google Maps Style)

### Active Navigation Screen
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │  ↱  Turn right              │ │  ← Instruction card (top)
│ │     State Street            │ │     Dark background, white text
│ │     0.4 mi                  │ │     Large turn arrow icon
│ └─────────────────────────────┘ │
│                                 │
│        [Map fills screen]       │
│                                 │
│              ╲                  │
│               ╲                 │  ← Route line to next turn only
│                ◆                │  ← Next turn point
│               ╱                 │
│              ╱                  │
│             🔼                  │  ← User position (arrow oriented
│                                 │     to heading/road direction)
│                                 │
│                                 │
│  ┌──────┐          ┌──────┐    │
│  │ 12m  │          │  ✕   │    │  ← Floating buttons (bottom)
│  │4.2 mi│          │ End  │    │     Time/distance remaining
│  └──────┘          └──────┘    │     End trip button
└─────────────────────────────────┘
```

### Instruction Card (Top)
- Fixed position at top of screen
- Dark semi-transparent background (rgba(0,0,0,0.85))
- Large maneuver icon on left (arrow showing turn direction)
- Road name prominent
- Distance to maneuver below
- When recalculating: shows "Recalculating..." with spinner

**Maneuver icons needed:**
- ↱ Turn right
- ↰ Turn left
- ↗ Bear right / slight right
- ↖ Bear left / slight left
- ↑ Continue straight
- ⟳ Roundabout
- ⚑ Arrive / destination

### Map Behavior
- Map fills entire screen (instruction card overlays top)
- User position shown as directional arrow (not a dot)
- Arrow rotates to match device heading / direction of travel
- Map auto-rotates so "up" is direction of travel (north not always up)
- Map auto-centers on user with slight offset (user in lower third, more road ahead visible)
- Smooth animation as position/heading updates

### Floating Action Buttons (Bottom)
- Semi-transparent background
- Left: Trip stats (time remaining, distance remaining)
- Right: End trip button (X icon)
- Could add: mute/sound toggle, recenter button

### Start Screen
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│         🚗                      │
│                                 │
│    Ready for an adventure?      │
│                                 │
│    ┌───────────────────────┐    │
│    │   Start Mystery Trip  │    │
│    └───────────────────────┘    │
│                                 │
│      ~15 min drive              │
│      Bring comfortable shoes    │
│                                 │
│                                 │
└─────────────────────────────────┘
```

### Arrival / Reveal Screen
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│      You've arrived at...       │
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │      [Photo if avail]     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│    The Quarry at Slate Canyon   │
│                                 │
│    A hidden swimming spot       │
│    locals love                  │
│                                 │
│    ┌───────────────────────┐    │
│    │      Done / Rate      │    │
│    └───────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

### Recalculating State
- Instruction card shows "Recalculating..." with subtle spinner
- Map continues to update position normally
- Once new route received, instruction card updates smoothly

---

## Key Utility Functions Needed

### Distance Calculation (Haversine)
```javascript
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  // Returns distance in meters between two points
}
```

### Bearing Calculation
```javascript
function getBearing(lat1, lng1, lat2, lng2) {
  // Returns bearing in degrees (0-360) from point 1 to point 2
}
```

### Polyline Decoder
```javascript
function decodePolyline(encoded) {
  // OSRM returns encoded polylines
  // Returns array of [lat, lng] points
}
```

### Find Closest Point on Route
```javascript
function findClosestPointOnRoute(userPosition, routeGeometry) {
  // Used for off-route detection
  // Iterate through each segment of the route polyline
  // For each segment, calculate perpendicular distance from user to line
  // Returns { point, distance, segmentIndex }
}

function getDistanceToLineSegment(point, lineStart, lineEnd) {
  // Calculate perpendicular distance from point to line segment
  // Used by findClosestPointOnRoute
  // Returns distance in meters
}
```

### Format Distance for Display
```javascript
function formatDistance(meters) {
  // < 1000m → "800 feet"
  // >= 1000m → "1.2 miles"
}
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| User denies location permission | Show message explaining why it's needed, button to retry |
| GPS accuracy is poor | Show warning, maybe pause navigation |
| OSRM API fails | Show error, offer retry button |
| User goes off-route | Detect after 3 seconds, auto re-route |
| Re-route fetch fails | Show brief error, retry after 15 seconds |
| Network offline | Show offline message (route fetching won't work) |

For MVP, simple error messages are fine. Don't need sophisticated offline handling yet.

---

## Testing Checklist

### Before Driving Test
- [ ] App loads on mobile browser
- [ ] Location permission prompt appears
- [ ] Granting permission shows user position on map
- [ ] Position updates as phone moves
- [ ] "Start Trip" button is visible and clickable

### Navigation Test
- [ ] Starting trip fetches route without errors
- [ ] First instruction displays correctly
- [ ] Distance to next turn updates as you move
- [ ] Instruction advances when you complete a turn
- [ ] Partial route line shows correctly (only to next turn)
- [ ] Map stays centered on user position

### Arrival Test
- [ ] Arrival detected at reasonable distance
- [ ] Navigation UI hides on arrival
- [ ] Destination name reveals
- [ ] Destination marker appears on map

### Edge Cases
- [ ] App handles location permission denial
- [ ] App handles poor GPS signal
- [ ] Long stretches (>2 miles) show "Continue on X" correctly

### Re-Routing Test
- [ ] Intentionally miss a turn
- [ ] "Recalculating..." appears after a few seconds
- [ ] New route is fetched and displayed
- [ ] Navigation continues smoothly on new route
- [ ] Rapid off-route/on-route doesn't spam recalculations

---

## Implementation Order

**Phase 1: Foundation (Get something on screen)**
1. HTML/CSS skeleton with map container and instruction panel
2. Initialize Leaflet map with OSM tiles
3. Request location, show user position on map
4. Position updates in real-time

**Phase 2: Routing (Get directions working)**
5. Hardcode a test destination
6. Fetch route from OSRM on "Start Trip"
7. Parse and store route steps
8. Display first instruction (just text, not dynamic yet)

**Phase 3: Live Navigation (Make it work while moving)**
9. Calculate distance to next maneuver
10. Update instruction distance in real-time
11. Detect step completion, advance to next instruction
12. Draw partial route line (current segment only)

**Phase 3b: Re-Routing (Handle wrong turns)**
13. Calculate distance from user to route line
14. Detect off-route condition (>75m for >3 seconds)
15. Fetch new route when off-route detected
16. Show "Recalculating..." feedback
17. Replace route data and continue navigation

**Phase 4: Arrival (Complete the experience)**
18. Detect arrival at destination
19. Hide navigation UI
20. Show destination reveal

**Phase 5: Polish (Important for Google Maps feel)**
21. Map rotation to match heading (high priority — makes it feel like real nav)
22. User arrow marker rotation
23. Better styling / dark mode instruction card
24. Smooth animations
25. Sound or haptic on arrival

**Note on Phase 5:** Map and marker rotation are technically "polish" but they make a huge difference in feel. If Phases 1-4 go smoothly, prioritize items 21-22 before worrying about styling.

---

## Open Questions / Decisions for Build Time

1. **Arrival radius:** Start with 75m, adjust based on testing. Driving GPS can be jumpy.

2. **Step completion detection:** Simplest approach is distance to maneuver point < threshold (30m). More sophisticated: detect user has passed the point.

3. **Off-route threshold:** Start with 75m distance for 3+ seconds. May need tuning — urban areas with parallel streets might trigger false positives.

4. **Re-route debounce:** 10 seconds minimum between re-routes. Aggressive enough to feel responsive, conservative enough to not spam OSRM.

5. **Map rotation:** Nice to have but adds complexity. Get basic version working first.

6. **Unit preference:** Miles/feet for US users. Hardcode for now, parameterize later.

---

## Resources

- **Leaflet docs:** https://leafletjs.com/reference.html
- **OSRM API docs:** https://project-osrm.org/docs/v5.24.0/api/
- **Polyline decoder:** https://github.com/mapbox/polyline (or write simple version)
- **Geolocation API:** https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

---

## Notes for Claude Code

- User (James) is non-fluent in code but understands systems well. Explain decisions briefly.
- Test on mobile early and often — that's the real environment.
- Keep functions small and single-purpose for easier debugging.
- Console.log liberally during development for debugging position/route issues.
- OSRM public server is rate-limited but fine for prototyping. Don't hammer it.
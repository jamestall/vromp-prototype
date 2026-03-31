import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import {
  NavigationProvider,
  NavigationView,
  TravelMode,
  useNavigation,
} from '@googlemaps/react-native-navigation-sdk';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {TRIPS, type TripDay, type TripFamily} from './trips';
import RevealScreen from './RevealScreen';

const PROGRESS_KEY = 'vromp.progress.v1';

// Velocity trigger constants
const NEAR_STOP_RADIUS_METERS = 150;
const LOW_SPEED_THRESHOLD_MS = 2.2; // 5 mph in m/s
const LOW_SPEED_DURATION_MS = 15000;

type DayProgress = {
  currentStopIndex: number;
  visitedStops: string[];
  startedAt: string;
  tripState?: string; // persist EXPLORING so we can resume without replaying animation
};

type ProgressMap = Record<string, DayProgress>;

type AppScreen = 'SPLASH' | 'FAMILY' | 'DAY' | 'TRIP';
type TripState = 'IDLE' | 'NAVIGATING' | 'REVEALING' | 'EXPLORING' | 'TRIP_COMPLETE';

async function ensureLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch {
    return false;
  }
}

function haversineMeters(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function SplashScreen({onContinue}: {onContinue: () => void}) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.centered}>
        <Text style={styles.title}>Vromp</Text>
        <Text style={styles.subtitle}>Mystery trip player</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FamilySelectScreen({
  onPick,
}: {
  onPick: (family: TripFamily) => void;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.centered}>
        <Text style={styles.header}>Welcome to Vromp Beta — Who are you?</Text>
        {TRIPS.families.map(family => (
          <TouchableOpacity
            key={family.id}
            style={styles.selectButton}
            onPress={() => onPick(family)}>
            <Text style={styles.selectButtonText}>{family.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function DaySelectScreen({
  family,
  onPick,
  onBack,
}: {
  family: TripFamily;
  onPick: (day: TripDay) => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.centered}>
        <Text style={styles.header}>Welcome, {family.name}! Where to today?</Text>
        {family.days.map(day => (
          <TouchableOpacity
            key={day.id}
            style={styles.selectButton}
            onPress={() => onPick(day)}>
            <Text style={styles.selectButtonText}>{day.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.ghostButton} onPress={onBack}>
          <Text style={styles.ghostButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TripPlayer({
  family,
  day,
  onExit,
}: {
  family: TripFamily;
  day: TripDay;
  onExit: () => void;
}) {
  const {navigationController} = useNavigation();
  const [tripState, setTripState] = useState<TripState>('IDLE');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [visitedStops, setVisitedStops] = useState<string[]>([]);
  const [isNavReady, setIsNavReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [isNearStop, setIsNearStop] = useState(false);
  const mapControllerRef = useRef<any>(null);

  // Velocity tracking refs (not state — no re-render needed)
  const lastPositionRef = useRef<{lat: number; lng: number; time: number} | null>(null);
  const lowSpeedStartRef = useRef<number | null>(null);

  const currentStop = day.stops[currentStopIndex];

  const persistProgress = useCallback(
    async (nextIndex: number, nextVisited: string[], state?: string) => {
      const raw = await AsyncStorage.getItem(PROGRESS_KEY);
      const current = raw ? (JSON.parse(raw) as ProgressMap) : {};

      current[day.id] = {
        currentStopIndex: nextIndex,
        visitedStops: nextVisited,
        startedAt: current[day.id]?.startedAt ?? new Date().toISOString(),
        tripState: state,
      };

      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(current));
    },
    [day.id],
  );

  const clearProgress = useCallback(async () => {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return;
    }
    const current = JSON.parse(raw) as ProgressMap;
    delete current[day.id];
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(current));
  }, [day.id]);

  const initNavigation = useCallback(async () => {
    try {
      await navigationController.init();
      setIsNavReady(true);
    } catch (error) {
      Alert.alert('Navigation init failed', String(error));
    }
  }, [navigationController]);

  useEffect(() => {
    initNavigation();
  }, [initNavigation]);

  // KeepAwake during NAVIGATING, REVEALING, and EXPLORING
  useEffect(() => {
    if (
      tripState === 'NAVIGATING' ||
      tripState === 'REVEALING' ||
      tripState === 'EXPLORING'
    ) {
      KeepAwake.activate();
    } else {
      KeepAwake.deactivate();
    }

    return () => {
      KeepAwake.deactivate();
    };
  }, [tripState]);

  // Load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      const raw = await AsyncStorage.getItem(PROGRESS_KEY);
      const progress = raw ? (JSON.parse(raw) as ProgressMap) : {};
      const dayProgress = progress[day.id];

      if (!dayProgress) {
        setResumeChecked(true);
        return;
      }

      if (dayProgress.visitedStops.length >= day.stops.length) {
        setVisitedStops(dayProgress.visitedStops);
        setCurrentStopIndex(day.stops.length);
        setTripState('TRIP_COMPLETE');
        setResumeChecked(true);
        return;
      }

      Alert.alert('Welcome back', 'Pick up where you left off?', [
        {
          text: 'Start over',
          style: 'destructive',
          onPress: async () => {
            await clearProgress();
            setVisitedStops([]);
            setCurrentStopIndex(0);
            setTripState('IDLE');
            setResumeChecked(true);
          },
        },
        {
          text: 'Resume',
          onPress: () => {
            setVisitedStops(dayProgress.visitedStops);
            setCurrentStopIndex(dayProgress.currentStopIndex);
            // If was in REVEALING/EXPLORING, resume to EXPLORING (skip animation replay)
            if (
              dayProgress.tripState === 'REVEALING' ||
              dayProgress.tripState === 'EXPLORING'
            ) {
              setTripState('EXPLORING');
            } else {
              setTripState('IDLE');
            }
            setResumeChecked(true);
          },
        },
      ]);
    };

    loadProgress().catch(() => setResumeChecked(true));
  }, [clearProgress, day.id, day.stops.length]);

  const triggerReveal = useCallback(async () => {
    if (tripState !== 'NAVIGATING') {
      return;
    }
    try {
      await navigationController.stopGuidance();
    } catch {
      // Guidance may already be stopped
    }
    setTripState('REVEALING');
    await persistProgress(currentStopIndex, visitedStops, 'REVEALING');
  }, [tripState, navigationController, persistProgress, currentStopIndex, visitedStops]);

  const startGuidanceToCurrentStop = useCallback(async () => {
    if (isBusy) {
      return;
    }

    if (!currentStop || !isNavReady) {
      Alert.alert('Navigation not ready', 'Please wait a moment and try again.');
      return;
    }

    const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), 15000),
        ),
      ]);
    };

    setIsBusy(true);
    try {
      await withTimeout(
        navigationController.setDestinations(
          [
            {
              title: currentStop.id,
              position: {lat: currentStop.latitude, lng: currentStop.longitude},
            },
          ],
          {
            travelMode: TravelMode.DRIVING,
            avoidFerries: false,
            avoidTolls: false,
            avoidHighways: false,
          },
          {
            showDestinationMarkers: false,
            showStopSigns: true,
            showTrafficLights: true,
          },
        ),
        'Route planning',
      );

      await withTimeout(navigationController.startGuidance(), 'Guidance start');

      // Reset tracking state
      lastPositionRef.current = null;
      lowSpeedStartRef.current = null;
      setIsNearStop(false);

      setTripState('NAVIGATING');
      await persistProgress(currentStopIndex, visitedStops);
    } catch (error) {
      Alert.alert('Route start failed', String(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    currentStop,
    currentStopIndex,
    isBusy,
    isNavReady,
    navigationController,
    persistProgress,
    visitedStops,
  ]);

  // Velocity-based arrival detection polling
  useEffect(() => {
    if (tripState !== 'NAVIGATING' || !currentStop || !mapControllerRef.current) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const loc = await mapControllerRef.current.getMyLocation();
        const lat = loc?.lat ?? loc?.latitude;
        const lng = loc?.lng ?? loc?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return;
        }

        const now = Date.now();
        const meters = haversineMeters(
          {lat, lng},
          {lat: currentStop.latitude, lng: currentStop.longitude},
        );

        if (meters > NEAR_STOP_RADIUS_METERS) {
          // Outside geofence — reset everything
          setIsNearStop(false);
          lowSpeedStartRef.current = null;
        } else {
          // Inside 150m geofence
          setIsNearStop(true);

          // Compute speed from last position
          const prev = lastPositionRef.current;
          if (prev) {
            const dt = (now - prev.time) / 1000; // seconds
            if (dt > 0) {
              const dist = haversineMeters({lat, lng}, {lat: prev.lat, lng: prev.lng});
              const speed = dist / dt; // m/s

              if (speed < LOW_SPEED_THRESHOLD_MS) {
                if (lowSpeedStartRef.current === null) {
                  lowSpeedStartRef.current = now;
                } else if (now - lowSpeedStartRef.current >= LOW_SPEED_DURATION_MS) {
                  // Stationary for 15s within geofence — trigger reveal
                  triggerReveal();
                  return;
                }
              } else {
                // Moving too fast — reset timer
                lowSpeedStartRef.current = null;
              }
            }
          }
        }

        lastPositionRef.current = {lat, lng, time: now};
      } catch {
        // Ignore transient GPS errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentStop, tripState, triggerReveal]);

  // Transition from REVEALING to EXPLORING (RevealScreen animation handles itself;
  // we just persist the state so resume works)
  useEffect(() => {
    if (tripState === 'REVEALING') {
      // After a short delay, mark as EXPLORING in persistence
      // The RevealScreen IS the exploring mode once animation finishes
      const t = setTimeout(async () => {
        setTripState('EXPLORING');
        await persistProgress(currentStopIndex, visitedStops, 'EXPLORING');
      }, 3000); // slightly after animation completes (~2.5s total)

      return () => clearTimeout(t);
    }
  }, [tripState, persistProgress, currentStopIndex, visitedStops]);

  const continueJourney = async () => {
    if (!currentStop) {
      return;
    }

    const nextVisited = Array.from(new Set([...visitedStops, currentStop.id]));
    const nextIndex = currentStopIndex + 1;

    setVisitedStops(nextVisited);

    // Reset tracking
    lastPositionRef.current = null;
    lowSpeedStartRef.current = null;
    setIsNearStop(false);

    if (nextIndex >= day.stops.length) {
      setTripState('TRIP_COMPLETE');
      await persistProgress(nextIndex, nextVisited);
      try {
        await navigationController.stopGuidance();
      } catch {
        // Already stopped
      }
      return;
    }

    setCurrentStopIndex(nextIndex);
    await persistProgress(nextIndex, nextVisited);
    setTripState('IDLE');
  };

  const stopCountText = `${Math.min(currentStopIndex + 1, day.stops.length)} of ${day.stops.length}`;
  const estimatedMinutes = useMemo(
    () => day.stops.reduce((sum, stop) => sum + stop.estimatedDurationMinutes, 0),
    [day.stops],
  );

  const handleRecenter = useCallback(async () => {
    try {
      await mapControllerRef.current?.moveCamera({zoom: 17});
    } catch {
      // Ignore — camera will re-follow on next location update
    }
  }, []);

  const hint = currentStop
    ? `Next: ${
        currentStop.type === 'food'
          ? 'Something delicious'
          : currentStop.type === 'nature'
            ? 'A beautiful view'
            : 'A mystery moment'
      }`
    : '';

  // Full-screen reveal/exploring mode
  if (
    (tripState === 'REVEALING' || tripState === 'EXPLORING') &&
    currentStop
  ) {
    return (
      <RevealScreen
        stop={currentStop}
        stopNumber={currentStopIndex + 1}
        totalStops={day.stops.length}
        onReadyToGo={continueJourney}
        isLastStop={currentStopIndex + 1 >= day.stops.length}
      />
    );
  }

  return (
    <View style={styles.navContainer}>
      <NavigationView
        style={StyleSheet.absoluteFill}
        onNavigationViewControllerCreated={() => {}}
        onMapViewControllerCreated={mapController => {
          mapControllerRef.current = mapController;
          try {
            mapController.setScrollGesturesEnabled(false);
            mapController.setRotateGesturesEnabled(false);
            mapController.setTiltGesturesEnabled(false);
          } catch {
            // no-op — methods may not exist in all SDK versions
          }
        }}
      />


      {tripState === 'IDLE' ? (
        <View style={styles.revealCard}>
          <Text style={styles.revealTitle}>Ready to start?</Text>
          <Text style={styles.revealBody}>
            {family.name} · {day.label}
          </Text>
          <Text style={styles.revealBody}>
            {day.stops.length} stops · about {Math.round(estimatedMinutes / 60)}h {estimatedMinutes % 60}m
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={startGuidanceToCurrentStop}
            disabled={isBusy || !isNavReady || !resumeChecked}>
            <Text style={styles.primaryButtonText}>Let's Go</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {tripState === 'TRIP_COMPLETE' ? (
        <View style={styles.revealCard}>
          <Text style={styles.revealTitle}>Trip Complete 🎉</Text>
          <Text style={styles.revealBody}>You visited {visitedStops.length} stops today.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onExit}>
            <Text style={styles.primaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {tripState === 'NAVIGATING' ? (
        <>
          <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
            <Icon name="crosshairs-gps" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.bottomBar}>
            <Text style={styles.bottomBarText}>Stop {stopCountText}</Text>
            <Text style={styles.bottomBarHint}>{hint}</Text>
          </View>
          {isNearStop ? (
            <TouchableOpacity
              style={styles.imHereButton}
              onPress={triggerReveal}>
              <Icon name="map-marker-check" size={20} color="#fff" />
              <Text style={styles.imHereText}>I'm Here</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <TouchableOpacity style={styles.backButton} onPress={onExit}>
        <Icon name="arrow-left" size={18} color="#fff" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('SPLASH');
  const [selectedFamily, setSelectedFamily] = useState<TripFamily | null>(null);
  const [selectedDay, setSelectedDay] = useState<TripDay | null>(null);

  const termsOptions = useMemo(
    () => ({
      title: 'Vromp Navigation',
      companyName: 'Vromp',
      showOnlyDisclaimer: true,
    }),
    [],
  );

  return (
    <NavigationProvider termsAndConditionsDialogOptions={termsOptions}>
      {screen === 'SPLASH' ? <SplashScreen onContinue={() => setScreen('FAMILY')} /> : null}

      {screen === 'FAMILY' ? (
        <FamilySelectScreen
          onPick={family => {
            setSelectedFamily(family);
            setScreen('DAY');
          }}
        />
      ) : null}

      {screen === 'DAY' && selectedFamily ? (
        <DaySelectScreen
          family={selectedFamily}
          onBack={() => setScreen('FAMILY')}
          onPick={async day => {
            const approved = await ensureLocationPermission();
            if (!approved) {
              Alert.alert(
                'Location permission needed',
                'Please allow location access for Vromp to start navigation.',
              );
              return;
            }
            setSelectedDay(day);
            setScreen('TRIP');
          }}
        />
      ) : null}

      {screen === 'TRIP' && selectedFamily && selectedDay ? (
        <TripPlayer
          family={selectedFamily}
          day={selectedDay}
          onExit={() => {
            setScreen('FAMILY');
            setSelectedDay(null);
          }}
        />
      ) : null}
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1020',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    color: '#d1d3dc',
    marginBottom: 12,
  },
  header: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  selectButton: {
    minWidth: 280,
    backgroundColor: '#1f2237',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3f66',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 17,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  ghostButton: {
    marginTop: 8,
    borderRadius: 12,
    borderColor: '#3a3f66',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: '#d1d3dc',
    fontWeight: '700',
  },
  navContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  instructionCard: {
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(251,251,252,0.97)',
    borderRadius: 14,
    borderColor: '#c7c9cf',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  instructionTitle: {
    color: '#101114',
    fontSize: 16,
    fontWeight: '800',
  },
  instructionSub: {
    color: '#55585f',
    fontWeight: '600',
    marginTop: 2,
  },
  revealCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    backgroundColor: 'rgba(15,16,32,0.96)',
    borderRadius: 14,
    borderColor: '#3a3f66',
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  revealTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 24,
  },
  revealBody: {
    color: '#d4d8ea',
    lineHeight: 20,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#2f3559',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(251,251,252,0.98)',
    borderTopWidth: 1,
    borderColor: '#c7c9cf',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bottomBarText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 18,
  },
  bottomBarHint: {
    color: '#404348',
    marginTop: 2,
  },
  recenterButton: {
    position: 'absolute',
    right: 14,
    bottom: 70,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,17,20,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imHereButton: {
    position: 'absolute',
    left: 14,
    bottom: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e94560',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  imHereText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  backButton: {
    position: 'absolute',
    right: 12,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(17,17,20,0.8)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

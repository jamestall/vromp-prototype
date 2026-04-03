import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
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
const NEAR_STOP_RADIUS_METERS = 300;
const LOW_SPEED_THRESHOLD_MS = 2.2; // 5 mph in m/s
const LOW_SPEED_DURATION_MS = 15000;

type DayProgress = {
  currentStopIndex: number;
  visitedStops: string[];
  skippedStops?: string[];
  events?: Array<{event: string; stopId?: string; timestamp: string}>;
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
  const [skippedStops, setSkippedStops] = useState<string[]>([]);
  const [events, setEvents] = useState<Array<{event: string; stopId?: string; timestamp: string}>>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [etaToNextStop, setEtaToNextStop] = useState<string | null>(null);
  const [totalEta, setTotalEta] = useState<string | null>(null);
  const [isFindingGas, setIsFindingGas] = useState(false);
  const [pendingAutoStart, setPendingAutoStart] = useState(false);
  const [isNavReady, setIsNavReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [, setIsNearStop] = useState(false);
  const [isWithinManualRange, setIsWithinManualRange] = useState(false);
  const mapControllerRef = useRef<any>(null);

  const lockMapGestures = useCallback(() => {
    const mapController = mapControllerRef.current;
    if (!mapController) {
      return;
    }

    try {
      mapController.setScrollGesturesEnabled?.(false);
      mapController.setScrollGesturesEnabledDuringRotateOrZoom?.(false);
      mapController.setRotateGesturesEnabled?.(false);
      mapController.setTiltGesturesEnabled?.(false);
      mapController.setZoomGesturesEnabled?.(true);
      mapController.setZoomControlsEnabled?.(true);
    } catch {
      // no-op — methods may not exist in all SDK versions
    }
  }, []);

  // Velocity tracking refs (not state — no re-render needed)
  const lastPositionRef = useRef<{lat: number; lng: number; time: number} | null>(null);
  const lowSpeedStartRef = useRef<number | null>(null);

  const currentStop = day.stops[currentStopIndex];

  const formatEta = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }
    const totalMin = Math.round(seconds / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) {
      return `${h} hr ${m} min`;
    }
    return `${m} min`;
  };

  const logEvent = useCallback((event: string, stopId?: string) => {
    setEvents(prev => [...prev, {event, stopId, timestamp: new Date().toISOString()}]);
  }, []);

  const persistProgress = useCallback(
    async (
      nextIndex: number,
      nextVisited: string[],
      state?: string,
      nextSkipped: string[] = skippedStops,
      nextEvents: Array<{event: string; stopId?: string; timestamp: string}> = events,
    ) => {
      const raw = await AsyncStorage.getItem(PROGRESS_KEY);
      const current = raw ? (JSON.parse(raw) as ProgressMap) : {};

      current[day.id] = {
        currentStopIndex: nextIndex,
        visitedStops: nextVisited,
        skippedStops: nextSkipped,
        events: nextEvents,
        startedAt: current[day.id]?.startedAt ?? new Date().toISOString(),
        tripState: state,
      };

      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(current));
    },
    [day.id, events, skippedStops],
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
        setSkippedStops(dayProgress.skippedStops ?? []);
        setEvents(dayProgress.events ?? []);
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
            setSkippedStops([]);
            setEvents([]);
            setCurrentStopIndex(0);
            setTripState('IDLE');
            setResumeChecked(true);
          },
        },
        {
          text: 'Resume',
          onPress: () => {
            setVisitedStops(dayProgress.visitedStops);
            setSkippedStops(dayProgress.skippedStops ?? []);
            setEvents(dayProgress.events ?? []);
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
    logEvent('reveal', currentStop?.id);
    await persistProgress(currentStopIndex, visitedStops, 'REVEALING');
  }, [
    currentStop?.id,
    currentStopIndex,
    logEvent,
    navigationController,
    persistProgress,
    tripState,
    visitedStops,
  ]);

  const triggerManualReveal = useCallback(async () => {
    logEvent('manual_arrive', currentStop?.id);
    await triggerReveal();
  }, [currentStop?.id, logEvent, triggerReveal]);

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

    const planAndStart = async () => {
      const hasNavigateTo =
        typeof currentStop.navigateTo === 'string' && currentStop.navigateTo.trim().length > 0;

      const waypoint = hasNavigateTo
        ? {
            title: currentStop.navigateTo,
          }
        : {
            title: currentStop.id,
            position: {lat: currentStop.latitude, lng: currentStop.longitude},
          };

      const routingOptions = {
        travelMode: TravelMode.DRIVING,
        avoidFerries: false,
        avoidTolls: false,
        avoidHighways: false,
      };

      const displayOptions = {
        showDestinationMarkers: false,
        showStopSigns: true,
        showTrafficLights: true,
      };

      if (typeof navigationController.setDestination === 'function') {
        await withTimeout(
          navigationController.setDestination(waypoint, routingOptions, displayOptions),
          'Route planning',
        );
      } else {
        await withTimeout(
          navigationController.setDestinations([waypoint], routingOptions, displayOptions),
          'Route planning',
        );
      }

      await withTimeout(navigationController.startGuidance(), 'Guidance start');
    };

    setIsBusy(true);
    try {
      // Ensure we have a fresh location lock before route planning.
      if (mapControllerRef.current?.getMyLocation) {
        await withTimeout(mapControllerRef.current.getMyLocation(), 'Location fix');
      }

      await planAndStart();
      lockMapGestures();

      // Reset tracking state
      lastPositionRef.current = null;
      lowSpeedStartRef.current = null;
      setIsNearStop(false);

      setTripState('NAVIGATING');
      await persistProgress(currentStopIndex, visitedStops);
    } catch (error) {
      // One hard reset + retry to recover stuck native navigation state.
      try {
        await withTimeout(navigationController.cleanup(), 'Navigation reset');
        await withTimeout(navigationController.init(), 'Navigation re-init');
        await planAndStart();
        lockMapGestures();

        lastPositionRef.current = null;
        lowSpeedStartRef.current = null;
        setIsNearStop(false);
        setTripState('NAVIGATING');
        await persistProgress(currentStopIndex, visitedStops);
        return;
      } catch (retryError) {
        Alert.alert('Route start failed', String(retryError));
      }

      Alert.alert('Route start failed', String(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    currentStop,
    currentStopIndex,
    isBusy,
    isNavReady,
    lockMapGestures,
    navigationController,
    persistProgress,
    visitedStops,
  ]);

  useEffect(() => {
    if (!pendingAutoStart || tripState !== 'IDLE') {
      return;
    }
    setPendingAutoStart(false);
    startGuidanceToCurrentStop();
  }, [pendingAutoStart, startGuidanceToCurrentStop, tripState]);

  // Velocity-based arrival detection polling
  useEffect(() => {
    if (tripState !== 'NAVIGATING' || !currentStop || !mapControllerRef.current) {
      setIsWithinManualRange(false);
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

        const isApproachTrigger = currentStop.revealTrigger === 'approach';
        const geofenceRadius = isApproachTrigger
          ? 500
          : currentStop.arrivalRadiusMeters || NEAR_STOP_RADIUS_METERS;

        setIsWithinManualRange(meters <= 400);

        if (meters > geofenceRadius) {
          // Outside geofence — reset everything
          setIsNearStop(false);
          lowSpeedStartRef.current = null;
        } else if (isApproachTrigger) {
          // Scenic approach trigger: fire immediately when entering geofence
          setIsNearStop(true);
          triggerReveal();
          return;
        } else {
          // Park-and-arrive trigger: require low-speed dwell
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

  useEffect(() => {
    if (tripState !== 'NAVIGATING') {
      setEtaToNextStop(null);
      return;
    }

    const updateEta = async () => {
      try {
        const timeAndDistance = await navigationController.getCurrentTimeAndDistance?.();
        const next = formatEta(timeAndDistance?.seconds ?? 0);
        setEtaToNextStop(next);

        // beta approximation: next-stop eta + remaining stop dwell duration
        const remainingStops = Math.max(day.stops.length - (currentStopIndex + 1), 0);
        const remainderMinutes = remainingStops * 20;
        if (next && timeAndDistance?.seconds) {
          const totalSec = timeAndDistance.seconds + remainderMinutes * 60;
          setTotalEta(formatEta(totalSec));
        } else {
          setTotalEta(null);
        }
      } catch {
        setEtaToNextStop(null);
        setTotalEta(null);
      }
    };

    updateEta();
    const interval = setInterval(updateEta, 15000);
    return () => clearInterval(interval);
  }, [currentStopIndex, day.stops.length, navigationController, tripState]);

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

  const openGasSearch = useCallback(async () => {
    try {
      setIsFindingGas(true);
      const appUrl = 'comgooglemaps://?q=gas+station+near+me';
      const webUrl = 'https://maps.google.com/?q=gas+station+near+me';
      const canOpenApp = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpenApp ? appUrl : webUrl);
    } catch {
      Alert.alert('Gas search unavailable', 'Unable to open Google Maps right now.');
    } finally {
      setIsFindingGas(false);
    }
  }, []);

  const endNavigation = useCallback(() => {
    Alert.alert('End navigation?', "This will end today's Vromp trip.", [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          logEvent('end_navigation', currentStop?.id);
          try {
            await navigationController.stopGuidance();
          } catch {
            // no-op
          }
          await persistProgress(currentStopIndex, visitedStops, 'IDLE');
          onExit();
        },
      },
    ]);
  }, [currentStop?.id, currentStopIndex, logEvent, navigationController, onExit, persistProgress, visitedStops]);

  const skipCurrentStop = useCallback(() => {
    if (!currentStop || currentStopIndex >= day.stops.length - 1) {
      return;
    }

    Alert.alert('Skip this stop?', "You'll head straight to the next one.", [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Skip',
        style: 'destructive',
        onPress: async () => {
          const nextSkipped = Array.from(new Set([...skippedStops, currentStop.id]));
          const nextEvents = [
            ...events,
            {event: 'skip_stop', stopId: currentStop.id, timestamp: new Date().toISOString()},
          ];
          setSkippedStops(nextSkipped);
          setEvents(nextEvents);
          setCurrentStopIndex(prev => prev + 1);
          setTripState('IDLE');
          setPendingAutoStart(true);
          setIsMenuOpen(false);
          await persistProgress(currentStopIndex + 1, visitedStops, 'IDLE', nextSkipped, nextEvents);
        },
      },
    ]);
  }, [currentStop, currentStopIndex, day.stops.length, events, persistProgress, skippedStops, visitedStops]);

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
          lockMapGestures();
          setTimeout(lockMapGestures, 300);
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
          <View style={styles.controlsBar}>
            <View style={styles.stopPill}>
              <Text style={styles.stopPillText}>Stop {stopCountText}</Text>
            </View>
            <View style={styles.controlsRight}>
              <TouchableOpacity
                style={styles.iconCircleButton}
                onPress={openGasSearch}
                disabled={isFindingGas}>
                <Icon name="gas-station-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircleButton} onPress={() => setIsMenuOpen(true)}>
                <Icon name="dots-vertical" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.etaCard}>
            <Text style={styles.etaPrimaryText}>
              {etaToNextStop ? `${etaToNextStop} to next stop` : 'ETA to next stop unavailable'}
            </Text>
            {totalEta ? <Text style={styles.etaSecondaryText}>~{totalEta} total remaining today</Text> : null}
          </View>

          {isWithinManualRange ? (
            <TouchableOpacity style={styles.imHereButton} onPress={triggerManualReveal}>
              <Icon name="map-marker-check" size={20} color="#fff" />
              <Text style={styles.imHereText}>I'm Here</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <Modal visible={isMenuOpen} transparent animationType="slide" onRequestClose={() => setIsMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setIsMenuOpen(false)}>
          <TouchableOpacity style={styles.menuSheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); setIsListOpen(true); }}>
              <Icon name="format-list-bulleted" size={20} color="#f4f4f4" />
              <Text style={styles.menuItemText}>View list</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, currentStopIndex >= day.stops.length - 1 && styles.menuItemDisabled]}
              onPress={skipCurrentStop}
              disabled={currentStopIndex >= day.stops.length - 1}>
              <Icon name="arrow-right" size={20} color="#f4f4f4" />
              <Text style={styles.menuItemText}>Skip stop</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={endNavigation}>
              <Icon name="stop-circle-outline" size={20} color="#e24b4a" />
              <Text style={styles.menuItemDangerText}>End navigation</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isListOpen} animationType="slide" onRequestClose={() => setIsListOpen(false)}>
        <SafeAreaView style={styles.listRoot}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.listHeaderSubtitle}>DAY</Text>
              <Text style={styles.listHeaderTitle}>{day.label}</Text>
            </View>
            <TouchableOpacity style={styles.listCloseButton} onPress={() => setIsListOpen(false)}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={day.stops}
            keyExtractor={item => item.id}
            renderItem={({item, index}) => {
              const isCurrent = index === currentStopIndex && tripState === 'NAVIGATING';
              const isRevealed = visitedStops.includes(item.id);
              const isSkipped = skippedStops.includes(item.id);
              const isFuture = !isCurrent && !isRevealed && !isSkipped;
              const isMeal = isFuture && item.type === 'food';
              const isLodging = isFuture && /hotel|lodging|camp/i.test(item.name);

              return (
                <View style={[styles.listRow, isCurrent && styles.listRowCurrent]}>
                  <View style={[styles.listIndexBubble, isCurrent && styles.listIndexBubbleCurrent]}>
                    <Text style={[styles.listIndexText, isCurrent && styles.listIndexTextCurrent]}>{index + 1}</Text>
                  </View>
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle}>
                      {isRevealed ? item.name : isCurrent ? 'Current stop' : isSkipped ? 'Skipped' : isMeal ? 'Meal stop' : isLodging ? 'Lodging' : 'Mystery stop'}
                    </Text>
                    <Text style={styles.listRowSubtitle}>
                      {isRevealed ? item.subtitle : isCurrent ? 'Navigating…' : isSkipped ? 'Skipped' : isMeal ? 'Meal' : isLodging ? 'Lodging' : 'Hidden until reveal'}
                    </Text>
                  </View>
                  <View>
                    {isRevealed ? <Icon name="check" size={18} color="#1D9E75" /> : null}
                    {isCurrent ? <Icon name="record-circle" size={18} color="#1D9E75" /> : null}
                    {isMeal ? <Text style={styles.rowTag}>meal</Text> : null}
                    {isLodging ? <Text style={styles.rowTag}>lodging</Text> : null}
                  </View>
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
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
  controlsBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17,17,20,0.74)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stopPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopPillText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  controlsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,8,10,0.92)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  etaPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 30,
  },
  etaSecondaryText: {
    color: '#c5c8d2',
    marginTop: 2,
    fontSize: 14,
  },
  imHereButton: {
    position: 'absolute',
    left: 14,
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1D9E75',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  imHereText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#2b2b2d',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  menuHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8b8d95',
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemText: {
    color: '#f4f4f4',
    fontSize: 22,
    fontWeight: '600',
  },
  menuItemDangerText: {
    color: '#E24B4A',
    fontSize: 22,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#4d4f56',
  },
  listRoot: {
    flex: 1,
    backgroundColor: '#232B23',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeaderSubtitle: {
    color: '#b4b8c5',
    fontSize: 12,
    fontWeight: '700',
  },
  listHeaderTitle: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  listCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listRowCurrent: {
    backgroundColor: 'rgba(29,158,117,0.16)',
  },
  listIndexBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dbeee8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listIndexBubbleCurrent: {
    backgroundColor: '#1D9E75',
  },
  listIndexText: {
    color: '#085041',
    fontWeight: '800',
  },
  listIndexTextCurrent: {
    color: '#fff',
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '600',
  },
  listRowSubtitle: {
    color: '#b8bdc9',
    marginTop: 2,
    fontSize: 22,
  },
  rowTag: {
    color: '#d9dce5',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    textTransform: 'lowercase',
  },
});

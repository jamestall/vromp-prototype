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

const PROGRESS_KEY = 'vromp.progress.v1';

type DayProgress = {
  currentStopIndex: number;
  visitedStops: string[];
  startedAt: string;
};

type ProgressMap = Record<string, DayProgress>;

type AppScreen = 'SPLASH' | 'FAMILY' | 'DAY' | 'TRIP';
type TripState = 'IDLE' | 'NAVIGATING' | 'ARRIVING' | 'REVEALED' | 'TRIP_COMPLETE';

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
  const [, setStatusText] = useState('Ready to start today’s adventure.');
  const [isNavReady, setIsNavReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [, setConsecutiveInRadius] = useState(0);
  const mapControllerRef = useRef<any>(null);

  const currentStop = day.stops[currentStopIndex];

  const persistProgress = useCallback(
    async (nextIndex: number, nextVisited: string[]) => {
      const raw = await AsyncStorage.getItem(PROGRESS_KEY);
      const current = raw ? (JSON.parse(raw) as ProgressMap) : {};

      current[day.id] = {
        currentStopIndex: nextIndex,
        visitedStops: nextVisited,
        startedAt: current[day.id]?.startedAt ?? new Date().toISOString(),
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
      setStatusText('Initializing navigation…');
      await navigationController.init();
      setIsNavReady(true);
      setStatusText('Navigation ready.');
    } catch (error) {
      setStatusText(`Navigation init failed: ${String(error)}`);
      Alert.alert('Navigation init failed', String(error));
    }
  }, [navigationController]);

  useEffect(() => {
    initNavigation();
  }, [initNavigation]);

  useEffect(() => {
    if (tripState === 'NAVIGATING') {
      KeepAwake.activate();
    } else {
      KeepAwake.deactivate();
    }

    return () => {
      KeepAwake.deactivate();
    };
  }, [tripState]);

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
        setStatusText('Trip already completed.');
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
            setTripState('IDLE');
            setResumeChecked(true);
          },
        },
      ]);
    };

    loadProgress().catch(() => setResumeChecked(true));
  }, [clearProgress, day.id, day.stops.length]);

  const startGuidanceToCurrentStop = useCallback(async () => {
    if (!currentStop || !isNavReady) {
      return;
    }

    setIsBusy(true);
    try {
      await navigationController.setDestinations(
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
      );
      await navigationController.startGuidance();
      setTripState('NAVIGATING');
      setStatusText(`Navigating to stop ${currentStopIndex + 1} of ${day.stops.length}`);
      await persistProgress(currentStopIndex, visitedStops);
    } catch (error) {
      setStatusText(`Route start failed: ${String(error)}`);
      Alert.alert('Route start failed', String(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    currentStop,
    currentStopIndex,
    day.stops.length,
    isNavReady,
    navigationController,
    persistProgress,
    visitedStops,
  ]);

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

        const meters = haversineMeters(
          {lat, lng},
          {lat: currentStop.latitude, lng: currentStop.longitude},
        );

        if (meters <= currentStop.arrivalRadiusMeters) {
          setConsecutiveInRadius(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setTripState('ARRIVING');
              setStatusText('You have arrived at a mystery stop…');
            }
            return next;
          });
        } else {
          setConsecutiveInRadius(0);
        }
      } catch {
        // Ignore transient GPS errors.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentStop, tripState]);

  useEffect(() => {
    if (tripState !== 'ARRIVING') {
      return;
    }

    const t = setTimeout(() => {
      setTripState('REVEALED');
      setStatusText('Mystery revealed.');
    }, 1500);

    return () => clearTimeout(t);
  }, [tripState]);

  const continueJourney = async () => {
    if (!currentStop) {
      return;
    }

    const nextVisited = Array.from(new Set([...visitedStops, currentStop.id]));
    const nextIndex = currentStopIndex + 1;

    setVisitedStops(nextVisited);
    setConsecutiveInRadius(0);

    if (nextIndex >= day.stops.length) {
      setTripState('TRIP_COMPLETE');
      setStatusText('You’ve arrived! End of today’s adventure.');
      await persistProgress(nextIndex, nextVisited);
      await navigationController.stopGuidance();
      return;
    }

    setCurrentStopIndex(nextIndex);
    await persistProgress(nextIndex, nextVisited);
    setTripState('IDLE');
    setStatusText('Ready for the next stop.');
  };

  const stopCountText = `${Math.min(currentStopIndex + 1, day.stops.length)} of ${day.stops.length}`;
  const estimatedMinutes = useMemo(
    () => day.stops.reduce((sum, stop) => sum + stop.estimatedDurationMinutes, 0),
    [day.stops],
  );

  const hint = currentStop
    ? `Next: ${
        currentStop.type === 'food'
          ? 'Something delicious'
          : currentStop.type === 'nature'
            ? 'A beautiful view'
            : 'A mystery moment'
      }`
    : '';

  return (
    <View style={styles.navContainer}>
      <NavigationView
        style={StyleSheet.absoluteFill}
        onNavigationViewControllerCreated={() => {}}
        onMapViewControllerCreated={mapController => {
          mapControllerRef.current = mapController;
          try {
            mapController.setZoomGesturesEnabled(false);
            mapController.setScrollGesturesEnabled(false);
            mapController.setRotateGesturesEnabled(false);
            mapController.setTiltGesturesEnabled(false);
          } catch {
            // no-op
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
            <Text style={styles.primaryButtonText}>Let’s Go</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {tripState === 'REVEALED' && currentStop ? (
        <View style={styles.revealCard}>
          <Text style={styles.revealTitle}>{currentStop.name}</Text>
          <View style={styles.typeBadge}>
            <Icon name="map-marker-star-outline" size={16} color="#fff" />
            <Text style={styles.typeBadgeText}>{currentStop.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.revealBody}>{currentStop.description}</Text>
          <Text style={styles.revealBody}>
            Spend about {currentStop.estimatedDurationMinutes} minutes here.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={continueJourney}>
            <Text style={styles.primaryButtonText}>Continue Journey</Text>
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
        <View style={styles.bottomBar}>
          <Text style={styles.bottomBarText}>Stop {stopCountText}</Text>
          <Text style={styles.bottomBarHint}>{hint}</Text>
        </View>
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

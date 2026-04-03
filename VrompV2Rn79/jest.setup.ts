jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('react-native-keep-awake', () => ({
  activate: jest.fn(),
  deactivate: jest.fn(),
}));


jest.mock('@googlemaps/react-native-navigation-sdk', () => {
  const navigationController = {
    init: jest.fn(async () => undefined),
    setDestinations: jest.fn(async () => undefined),
    startGuidance: jest.fn(async () => undefined),
    stopGuidance: jest.fn(async () => undefined),
    getRouteSegments: jest.fn(async () => []),
  };

  const mapController = {
    getMyLocation: jest.fn(async () => ({lat: 0, lng: 0})),
    setZoomGesturesEnabled: jest.fn(),
    setScrollGesturesEnabled: jest.fn(),
    setRotateGesturesEnabled: jest.fn(),
    setTiltGesturesEnabled: jest.fn(),
  };

  const NavigationView = (props: any) => {
    if (props?.onMapViewControllerCreated) {
      props.onMapViewControllerCreated(mapController);
    }
    if (props?.onNavigationViewControllerCreated) {
      props.onNavigationViewControllerCreated({});
    }
    return null;
  };

  return {
    NavigationProvider: ({children}: any) => children,
    NavigationView,
    TravelMode: {DRIVING: 'DRIVING'},
    useNavigation: () => ({navigationController}),
    __mockNavigationController: navigationController,
    __mockMapController: mapController,
  };
});

import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import App from '../App';

const navModule = jest.requireMock('@googlemaps/react-native-navigation-sdk');

describe('App flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('goes from splash to family selection', async () => {
    const {getByText} = render(<App />);

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Welcome to Vromp Beta — Who are you?')).toBeTruthy();
      expect(getByText('The Billings')).toBeTruthy();
    });
  });

  it('selects Billings day and shows trip idle state', async () => {
    const {getByText} = render(<App />);

    fireEvent.press(getByText('Continue'));
    fireEvent.press(getByText('The Billings'));

    await waitFor(() => {
      expect(getByText('Welcome, The Billings! Where to today?')).toBeTruthy();
    });

    fireEvent.press(getByText('Kemmerer → Cody'));

    await waitFor(() => {
      expect(getByText('Ready to start?')).toBeTruthy();
      expect(getByText('Let’s Go')).toBeTruthy();
    });
  });

  it('starts guidance when Let’s Go is pressed', async () => {
    const {getByText} = render(<App />);

    fireEvent.press(getByText('Continue'));
    fireEvent.press(getByText('The Billings'));
    fireEvent.press(getByText('Kemmerer → Cody'));

    await waitFor(() => {
      expect(getByText('Let’s Go')).toBeTruthy();
    });

    fireEvent.press(getByText('Let’s Go'));

    await waitFor(() => {
      expect(navModule.__mockNavigationController.setDestinations).toHaveBeenCalled();
      expect(navModule.__mockNavigationController.startGuidance).toHaveBeenCalled();
    });
  });
});

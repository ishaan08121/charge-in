import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiSavePushToken } from '../api/users';

// Show notification banner even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function usePushNotifications(navigation) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotifications();

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Already shown as banner — no extra action needed
      console.log('Notification received:', notification.request.content.title);
    });

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data?.type || !navigation) return;

      switch (data.type) {
        case 'BOOKING_REQUEST':
          // Host tapped — go to booking requests
          navigation.navigate('ProfileTab', { screen: 'BookingRequests' });
          break;
        case 'BOOKING_CONFIRMED':
        case 'BOOKING_DECLINED':
          // User tapped — go to booking detail
          if (data.bookingId) {
            navigation.navigate('BookingsTab', {
              screen: 'BookingDetail',
              params: { bookingId: data.bookingId },
            });
          }
          break;
        case 'SESSION_ENDED':
          navigation.navigate('BookingsTab', { screen: 'Bookings' });
          break;
        case 'BOOKING_CANCELLED':
          navigation.navigate('ProfileTab', { screen: 'BookingRequests' });
          break;
        default:
          break;
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [navigation]);
}

async function registerForPushNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // User denied — silently skip (don't block the app)
      return;
    }

    // Get projectId from EAS config or app config
    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('Push registration skipped: no projectId configured (run `eas init` to set up)');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Save to server
    await apiSavePushToken(token);

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Charge.in',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00c853',
      });
    }
  } catch (err) {
    // Non-critical — push notifications are a nice-to-have
    console.log('Push registration skipped:', err.message);
  }
}

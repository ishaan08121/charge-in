import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { apiGetBookings } from '../api/bookings';

import MapScreen from '../screens/MapScreen';
import ChargerDetailScreen from '../screens/ChargerDetailScreen';
import BookSlotScreen from '../screens/BookSlotScreen';
import BookingConfirmedScreen from '../screens/BookingConfirmedScreen';
import BookingsScreen from '../screens/BookingsScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import ActiveSessionScreen from '../screens/ActiveSessionScreen';
import SessionCompleteScreen from '../screens/SessionCompleteScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ListChargerScreen from '../screens/host/ListChargerScreen';
import MyChargersScreen from '../screens/host/MyChargersScreen';
import EditChargerScreen from '../screens/host/EditChargerScreen';
import BookingRequestsScreen from '../screens/host/BookingRequestsScreen';
import EarningsScreen from '../screens/host/EarningsScreen';
import EVProfileScreen from '../screens/EVProfileScreen';
import ChargingCalculatorScreen from '../screens/ChargingCalculatorScreen';

import { useColors } from '../constants/colors';

const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();
const BookingsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function MapStackNavigator() {
  const c = useColors();
  const screenOptions = {
    headerStyle: { backgroundColor: c.card },
    headerTintColor: c.textPrimary,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: c.bg },
  };
  return (
    <MapStack.Navigator screenOptions={screenOptions}>
      <MapStack.Screen name="Map" component={MapScreen} options={{ title: 'Charge.in ⚡' }} />
      <MapStack.Screen name="ChargerDetail" component={ChargerDetailScreen} options={{ title: 'Charger Details' }} />
      <MapStack.Screen name="BookSlot" component={BookSlotScreen} options={{ title: 'Book a Slot' }} />
      <MapStack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} options={{ headerShown: false }} />
    </MapStack.Navigator>
  );
}

function BookingsStackNavigator() {
  const c = useColors();
  const screenOptions = {
    headerStyle: { backgroundColor: c.card },
    headerTintColor: c.textPrimary,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: c.bg },
  };
  return (
    <BookingsStack.Navigator screenOptions={screenOptions}>
      <BookingsStack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'My Bookings' }} />
      <BookingsStack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking Details' }} />
      <BookingsStack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Live Session ⚡' }} />
      <BookingsStack.Screen name="SessionComplete" component={SessionCompleteScreen} options={{ title: 'Session Complete', headerShown: false }} />
      <BookingsStack.Screen name="BookingRequests" component={BookingRequestsScreen} options={{ title: 'Booking Requests' }} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const c = useColors();
  const screenOptions = {
    headerStyle: { backgroundColor: c.card },
    headerTintColor: c.textPrimary,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: c.bg },
  };
  return (
    <ProfileStack.Navigator screenOptions={screenOptions}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="ListCharger" component={ListChargerScreen} options={{ title: 'Add your Charger' }} />
      <ProfileStack.Screen name="MyChargers" component={MyChargersScreen} options={{ title: 'My Chargers' }} />
      <ProfileStack.Screen name="EditCharger" component={EditChargerScreen} options={{ title: 'Edit Charger' }} />
      <ProfileStack.Screen name="BookingRequests" component={BookingRequestsScreen} options={{ title: 'Booking Requests' }} />
      <ProfileStack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Earnings' }} />
      <ProfileStack.Screen name="EVProfile" component={EVProfileScreen} options={{ title: 'My EV Profile' }} />
      <ProfileStack.Screen name="ChargingCalculator" component={ChargingCalculatorScreen} options={{ title: 'Charging Calculator' }} />
    </ProfileStack.Navigator>
  );
}

export default function AppNavigator() {
  const c = useColors();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    async function checkActive() {
      try {
        const [userRes, hostRes] = await Promise.all([
          apiGetBookings('user'), apiGetBookings('host'),
        ]);
        const all = [...(userRes.data.bookings || []), ...(hostRes.data.bookings || [])];
        const unique = [...new Map(all.map(b => [b.id, b])).values()];
        const active = unique.filter(b => ['pending', 'confirmed', 'active'].includes(b.status));
        setActiveCount(active.length);
      } catch {}
    }
    checkActive();
    const interval = setInterval(checkActive, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.cardBorder,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: c.tabActive,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapStackNavigator}
        options={{ title: 'Map', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚡</Text> }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsStackNavigator}
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>📋</Text>
              {activeCount > 0 && (
                <View style={{
                  position: 'absolute', top: -4, right: -8,
                  backgroundColor: c.danger, borderRadius: 8,
                  minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{activeCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

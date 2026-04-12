import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

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

import { colors } from '../constants/colors';

const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();
const BookingsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '700' },
  contentStyle: { backgroundColor: colors.bg },
};

function MapStackNavigator() {
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
  return (
    <BookingsStack.Navigator screenOptions={screenOptions}>
      <BookingsStack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'My Bookings' }} />
      <BookingsStack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking Details' }} />
      <BookingsStack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Live Session ⚡' }} />
      <BookingsStack.Screen name="SessionComplete" component={SessionCompleteScreen} options={{ title: 'Session Complete', headerShown: false }} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
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
        options={{ title: 'Bookings', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

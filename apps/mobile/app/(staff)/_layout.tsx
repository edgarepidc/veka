import { Stack } from 'expo-router';

export default function StaffLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="maintenance" />
    </Stack>
  );
}

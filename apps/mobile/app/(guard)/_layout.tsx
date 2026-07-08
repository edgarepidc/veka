import { Stack } from 'expo-router';

export default function GuardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="security" />
    </Stack>
  );
}

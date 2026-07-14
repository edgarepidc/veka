import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    process.env.EAS_PROJECT_ID?.trim() ||
    undefined;

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...((config.extra as { eas?: Record<string, unknown> } | undefined)?.eas ?? {}),
        ...(projectId ? { projectId } : {}),
      },
    },
  } as ExpoConfig;
};

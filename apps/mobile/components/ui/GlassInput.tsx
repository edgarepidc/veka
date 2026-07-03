import { BlurView } from 'expo-blur';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassOverlay,
} from '@/constants/glass';
import { useTheme } from '@/hooks/useTheme';

const DONE_ACCESSORY_ID = 'glass-input-done';

function needsDoneAccessory(keyboardType: TextInputProps['keyboardType']): boolean {
  return (
    Platform.OS === 'ios' &&
    (keyboardType === 'phone-pad' ||
      keyboardType === 'number-pad' ||
      keyboardType === 'decimal-pad' ||
      keyboardType === 'numeric')
  );
}

export function GlassInput({ style, keyboardType, inputAccessoryViewID, ...props }: TextInputProps) {
  const theme = useTheme();
  const showDoneAccessory = needsDoneAccessory(keyboardType);
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <>
      <View style={[styles.wrap, { borderColor: glassBorderColor(theme) }]}>
        {useBlur ? (
          <BlurView
            intensity={glassBlurIntensity(theme, 'input')}
            tint={glassBlurTint(theme)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay(theme, 'input') }]}
        />
        <TextInput
          placeholderTextColor={theme.textSubtle}
          keyboardType={keyboardType}
          inputAccessoryViewID={showDoneAccessory ? DONE_ACCESSORY_ID : inputAccessoryViewID}
          style={[
            styles.input,
            {
              color: theme.text,
              fontFamily: theme.sansFamily,
            },
            style,
          ]}
          {...props}
        />
      </View>
      {showDoneAccessory ? (
        <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
          <View style={[styles.accessory, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
            <Pressable onPress={Keyboard.dismiss} style={styles.doneBtn} hitSlop={8}>
              <Text style={[styles.doneLabel, { color: theme.accent }]}>Listo</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: GLASS_RADIUS.input,
    overflow: 'hidden',
    marginBottom: 10,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  accessory: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  doneLabel: { fontSize: 16, fontWeight: '600' },
});

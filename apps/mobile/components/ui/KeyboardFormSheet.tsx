import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassOverlay,
} from '@/constants/glass';
import { useTheme } from '@/hooks/useTheme';

interface KeyboardFormSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
}

/** Bottom sheet modal with keyboard avoidance, scroll, and dismiss gestures. */
export function KeyboardFormSheet({
  visible,
  onClose,
  title,
  titleStyle,
  children,
  sheetStyle,
}: KeyboardFormSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismissArea} onPress={Keyboard.dismiss} />
        <View
          style={[
            styles.sheet,
            { borderColor: glassBorderColor(theme), paddingBottom: insets.bottom + 12 },
            sheetStyle,
          ]}
        >
          {Platform.OS === 'ios' || Platform.OS === 'android' ? (
            <BlurView
              intensity={glassBlurIntensity(theme, 'bar')}
              tint={glassBlurTint(theme)}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay(theme, 'bar') }]}
          />
          <View style={[styles.handle, { backgroundColor: theme.textSubtle }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.sheetScroll}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View>
                {title ? (
                  <Text style={[styles.title, { color: theme.text }, titleStyle]}>{title}</Text>
                ) : null}
                {children}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const keyboardFormSheetStyles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  dismissArea: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetScroll: { position: 'relative', zIndex: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12, opacity: 0.35 },
  scrollContent: { paddingBottom: 8, gap: 0 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

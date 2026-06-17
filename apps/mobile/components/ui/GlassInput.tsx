import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function GlassInput({ style, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSubtle}
      style={[
        styles.input,
        {
          backgroundColor: theme.input,
          borderColor: theme.inputBorder,
          color: theme.text,
          fontFamily: theme.sansFamily,
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
});

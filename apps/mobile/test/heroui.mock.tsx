import type { PropsWithChildren } from 'react';
import { Pressable, Switch as NativeSwitch, Text as NativeText, TextInput, View } from 'react-native';

function Button({
  children,
  isDisabled,
  onPress,
  accessibilityLabel,
}: PropsWithChildren<{
  isDisabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}>) {
  return (
    <Pressable
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      onPress={onPress}
    >
      {typeof children === 'string' ? <NativeText>{children}</NativeText> : children}
    </Pressable>
  );
}

function Card({ children }: PropsWithChildren) {
  return <View>{children}</View>;
}
Card.Body = View;
Card.Title = NativeText;
Card.Description = NativeText;

function Chip({ children }: PropsWithChildren) {
  return <NativeText>{children}</NativeText>;
}
Chip.Label = NativeText;

function Provider({ children }: PropsWithChildren) {
  return children;
}

export const buttonModule = { Button };
export const cardModule = { Card };
export const chipModule = { Chip };
export const descriptionModule = { Description: NativeText };
export const inputModule = { Input: TextInput };
export const labelModule = { Label: NativeText };
export const providerModule = { HeroUINativeProvider: Provider };
export const switchModule = {
  Switch: ({ isSelected, isDisabled }: { isSelected?: boolean; isDisabled?: boolean }) => (
    <NativeSwitch value={isSelected} disabled={isDisabled} />
  ),
};
export const textModule = { Text: NativeText };
export const textFieldModule = { TextField: View };

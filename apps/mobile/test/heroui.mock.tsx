import type { PropsWithChildren } from 'react';
import type { PressableProps } from 'react-native';
import { Image, Pressable, Switch as NativeSwitch, Text as NativeText, TextInput, View } from 'react-native';

function Button({
  children,
  isDisabled,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}: PropsWithChildren<{
  isDisabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
}>) {
  return (
    <Pressable
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      onPress={onPress}
    >
      {typeof children === 'string' ? <NativeText>{children}</NativeText> : children}
    </Pressable>
  );
}
Button.Label = NativeText;

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

function Checkbox({ isSelected, onSelectedChange, accessibilityLabel }: {
  isSelected?: boolean;
  onSelectedChange?(selected: boolean): void;
  accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked: Boolean(isSelected) }} onPress={() => onSelectedChange?.(!isSelected)} />;
}

function Provider({ children }: PropsWithChildren) {
  return children;
}

function BottomSheet({ children, isOpen }: PropsWithChildren<{ isOpen?: boolean }>) {
  return isOpen ? <View>{children}</View> : null;
}
BottomSheet.Portal = View;
BottomSheet.Overlay = View;
BottomSheet.Content = View;
BottomSheet.Title = NativeText;
BottomSheet.Close = Pressable;

function BottomSheetScrollView({ children }: PropsWithChildren) {
  return <View>{children}</View>;
}

function BottomSheetFlatList({ data = [], renderItem, ListEmptyComponent }: any) {
  return <View>{data.length
    ? data.map((item: any, index: number) => <View key={item.packageName ?? index}>{renderItem({ item, index })}</View>)
    : ListEmptyComponent}</View>;
}

function Surface({ children, testID, ...props }: PropsWithChildren<{ testID?: string }>) {
  return <View testID={testID ?? 'hero-surface'} {...props}>{children}</View>;
}

function PressableFeedback({ children, testID, isDisabled, ...props }: PropsWithChildren<any>) {
  return <Pressable testID={testID ?? 'hero-pressable-feedback'} disabled={isDisabled} {...props}>{children}</Pressable>;
}
PressableFeedback.Scale = View;
PressableFeedback.Highlight = View;
PressableFeedback.Ripple = View;

const AccordionContext = require('react').createContext({ values: [] as string[], onValueChange: (_values: string[]) => undefined });
const AccordionItemContext = require('react').createContext('');

function Accordion({ children, value = [], onValueChange }: PropsWithChildren<{ value?: string[]; onValueChange?(value: string[]): void }>) {
  return <AccordionContext.Provider value={{ values: value, onValueChange: onValueChange ?? (() => undefined) }}><View testID="hero-accordion">{children}</View></AccordionContext.Provider>;
}
Accordion.Item = ({ children, value }: PropsWithChildren<{ value: string }>) => <AccordionItemContext.Provider value={value}><View>{children}</View></AccordionItemContext.Provider>;
Accordion.Trigger = ({ children, ...props }: PropsWithChildren<any>) => {
  const context = require('react').useContext(AccordionContext);
  const value = require('react').useContext(AccordionItemContext);
  return <Pressable {...props} onPress={() => context.onValueChange(context.values.includes(value) ? context.values.filter((item: string) => item !== value) : [...context.values, value])}>{children}</Pressable>;
};
Accordion.Content = ({ children }: PropsWithChildren) => {
  const context = require('react').useContext(AccordionContext);
  const value = require('react').useContext(AccordionItemContext);
  return context.values.includes(value) ? <View>{children}</View> : null;
};
Accordion.Indicator = View;

function Avatar({ children, ...props }: PropsWithChildren<any>) {
  return <View {...props}>{children}</View>;
}
Avatar.Image = (props: any) => <Image {...props} />;
Avatar.Fallback = ({ children, ...props }: PropsWithChildren<any>) => <View {...props}>{children}</View>;

function ListGroup({ children, ...props }: PropsWithChildren<any>) {
  return <View {...props}>{children}</View>;
}
ListGroup.Item = ({ children, ...props }: PropsWithChildren<any>) => <View {...props}>{children}</View>;
ListGroup.ItemPrefix = ({ children, ...props }: PropsWithChildren<any>) => <View {...props}>{children}</View>;
ListGroup.ItemContent = ({ children, ...props }: PropsWithChildren<any>) => <View {...props}>{children}</View>;
ListGroup.ItemTitle = ({ children, ...props }: PropsWithChildren<any>) => <NativeText {...props}>{children}</NativeText>;
ListGroup.ItemDescription = ({ children, ...props }: PropsWithChildren<any>) => <NativeText {...props}>{children}</NativeText>;
ListGroup.ItemSuffix = ({ children, ...props }: PropsWithChildren<any>) => <View {...props}>{children}</View>;

function Separator(props: any) {
  return <View {...props} />;
}

export const buttonModule = { Button };
export const cardModule = { Card };
export const chipModule = { Chip };
export const checkboxModule = { Checkbox };
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
export const bottomSheetModule = { BottomSheet };
export const gorhomBottomSheetModule = { BottomSheetScrollView, BottomSheetFlatList };
export const surfaceModule = { Surface };
export const pressableFeedbackModule = { PressableFeedback };
export const accordionModule = { Accordion };
export const avatarModule = { Avatar };
export const listGroupModule = { ListGroup };
export const separatorModule = { Separator };

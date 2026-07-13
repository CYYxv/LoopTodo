import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Switch as NativeSwitch, Text as NativeText, TextInput, useColorScheme, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export function HeroUINativeProvider({ children }: PropsWithChildren<{ config?: unknown }>) {
  return children;
}

export function Text({ type = 'body', color = 'default', weight, align, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  const dark = useColorScheme() === 'dark';
  return <NativeText {...props} style={[styles.text, textTypes[type], dark ? darkTextColors[color] : textColors[color], weight ? textWeights[weight] : null, align ? { textAlign: align === 'start' ? 'left' : align } : null, classStyle, style]} />;
}

export function Button({ children, isDisabled, variant = 'primary', size = 'md', className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  const dark = useColorScheme() === 'dark';
  return <Pressable {...props} disabled={isDisabled} accessibilityRole={props.accessibilityRole ?? 'button'} accessibilityState={{ ...props.accessibilityState, disabled: Boolean(isDisabled) }} style={({ pressed }) => [styles.button, dark ? darkButtonVariants[variant] ?? buttonVariants.primary : buttonVariants[variant] ?? buttonVariants.primary, buttonSizes[size] ?? buttonSizes.md, classStyle, isDisabled && styles.disabled, pressed && styles.pressed, typeof style === 'function' ? style({ pressed }) : style]}>{typeof children === 'string' ? <NativeText style={[styles.buttonText, ['secondary', 'danger-soft'].includes(variant) && (dark ? styles.secondaryTextDark : styles.secondaryText)]}>{children}</NativeText> : children}</Pressable>;
}

function CardRoot({ children, variant, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  const dark = useColorScheme() === 'dark';
  return <View {...props} style={[styles.card, dark && styles.cardDark, variant === 'secondary' && (dark ? styles.cardSecondaryDark : styles.cardSecondary), classStyle, style]}>{children}</View>;
}
function CardBody({ children, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <View {...props} style={[styles.cardBody, classStyle, style]}>{children}</View>;
}
function CardTitle(props: any) { return <Text type="h4" weight="semibold" {...props} />; }
function CardDescription(props: any) { return <Text type="body-sm" color="muted" {...props} />; }
function CardSection({ children, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <View {...props} style={[classStyle, style]}>{children}</View>;
}
export const Card = Object.assign(CardRoot, { Body: CardBody, Title: CardTitle, Description: CardDescription, Header: CardSection, Footer: CardSection });

function ChipRoot({ children, color = 'default', className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <View {...props} style={[styles.chip, chipColors[color] ?? chipColors.default, classStyle, style]}>{typeof children === 'string' ? <NativeText style={styles.chipText}>{children}</NativeText> : children}</View>;
}
function ChipLabel({ className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <NativeText {...props} style={[styles.chipText, classStyle, style]} />;
}
export const Chip = Object.assign(ChipRoot, { Label: ChipLabel });

export function Input({ className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  const dark = useColorScheme() === 'dark';
  return <TextInput {...props} placeholderTextColor={dark ? '#8F949E' : '#8A8A8A'} style={[styles.input, dark && styles.inputDark, classStyle, style]} />;
}

export function Label({ className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  const dark = useColorScheme() === 'dark';
  return <NativeText {...props} style={[styles.label, dark && styles.labelDark, classStyle, style]} />;
}

export function Description(props: any) {
  return <Text type="body-xs" color="muted" {...props} />;
}

export function TextField({ children, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <View {...props} style={[styles.field, classStyle, style]}>{children}</View>;
}

export function Switch({ isSelected, onSelectedChange, isDisabled, className = '', style, ...props }: any) {
  const classStyle = useResolveClassNames(className);
  return <NativeSwitch {...props} value={isSelected} disabled={isDisabled} onValueChange={onSelectedChange} style={[classStyle, style]} />;
}

const styles = StyleSheet.create({
  text: { color: '#171717' },
  button: { minHeight: 44, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryText: { color: '#222222' },
  secondaryTextDark: { color: '#F5F5F5' },
  disabled: { backgroundColor: '#A3A3A3', opacity: 0.72 },
  pressed: { opacity: 0.78 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8D8D8', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cardSecondary: { backgroundColor: '#F5F5F5' },
  cardDark: { borderColor: '#383B42', backgroundColor: '#1B1D22' },
  cardSecondaryDark: { backgroundColor: '#24272D' },
  cardBody: { padding: 16 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E8E8E8' },
  chipText: { color: '#252525', fontSize: 12, fontWeight: '600' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', backgroundColor: '#FFFFFF', color: '#171717', paddingHorizontal: 12, fontSize: 15 },
  inputDark: { borderColor: '#4A4E57', backgroundColor: '#17191D', color: '#F5F5F5' },
  label: { color: '#252525', fontSize: 13, fontWeight: '600' },
  labelDark: { color: '#E5E7EB' },
  field: { gap: 6 },
});

const textTypes: Record<string, object> = {
  h1: { fontSize: 40, lineHeight: 48 }, h2: { fontSize: 30, lineHeight: 38 }, h3: { fontSize: 24, lineHeight: 32 }, h4: { fontSize: 20, lineHeight: 27 },
  body: { fontSize: 16, lineHeight: 23 }, 'body-sm': { fontSize: 14, lineHeight: 20 }, 'body-xs': { fontSize: 12, lineHeight: 17 },
};
const textColors: Record<string, object> = { default: { color: '#171717' }, muted: { color: '#666666' }, accent: { color: '#1D4ED8' }, danger: { color: '#B91C1C' } };
const darkTextColors: Record<string, object> = { default: { color: '#F5F5F5' }, muted: { color: '#A7ABB4' }, accent: { color: '#93C5FD' }, danger: { color: '#FCA5A5' } };
const textWeights: Record<string, object> = { normal: { fontWeight: '400' }, medium: { fontWeight: '500' }, semibold: { fontWeight: '600' }, bold: { fontWeight: '700' } };
const buttonVariants: Record<string, object> = { primary: { backgroundColor: '#2563EB' }, secondary: { backgroundColor: '#E9E9E9' }, danger: { backgroundColor: '#DC2626' }, 'danger-soft': { backgroundColor: '#FECACA' } };
const darkButtonVariants: Record<string, object> = { primary: { backgroundColor: '#2563EB' }, secondary: { backgroundColor: '#343841' }, danger: { backgroundColor: '#DC2626' }, 'danger-soft': { backgroundColor: '#7F1D1D' } };
const buttonSizes: Record<string, object> = { sm: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 8 }, md: {}, lg: { minHeight: 52, paddingVertical: 14 } };
const chipColors: Record<string, object> = { default: { backgroundColor: '#E8E8E8' }, accent: { backgroundColor: '#DBEAFE' }, success: { backgroundColor: '#DCFCE7' }, warning: { backgroundColor: '#FEF3C7' }, danger: { backgroundColor: '#FEE2E2' } };

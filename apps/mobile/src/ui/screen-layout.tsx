import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Text } from '@/ui/hero-runtime';
import { theme } from '@/ui/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const backgroundColor = scheme === 'dark' ? theme.colors.darkBackground : theme.colors.lightBackground;
  const contentStyle = [styles.content, { paddingHorizontal: width < 380 ? 12 : 16 }];
  return <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor }]}><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />{scroll ? <ScrollView style={styles.flex} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[styles.flex, styles.content, { paddingHorizontal: width < 380 ? 12 : 16 }]}>{children}</View>}</SafeAreaView>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <View style={styles.header}><View style={styles.headerCopy}><Text type="h3" weight="bold">{title}</Text>{description ? <Text type="body-sm" color="muted">{description}</Text> : null}</View>{action}</View>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, flex: { flex: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16, paddingTop: 16, paddingBottom: 32 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, headerCopy: { flex: 1, gap: 4 } });

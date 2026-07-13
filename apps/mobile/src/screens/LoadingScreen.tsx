import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/ui/hero-runtime';
import { Screen } from '@/ui/screen-layout';

export function LoadingScreen({ label }: { label: string }) {
  return <Screen scroll={false}><View style={styles.center}><ActivityIndicator size="large" /><Text type="body-sm" color="muted" align="center">{label}</Text></View></Screen>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 } });

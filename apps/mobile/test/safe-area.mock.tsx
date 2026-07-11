import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function SafeAreaProvider({ children }: PropsWithChildren) {
  return children;
}

export function SafeAreaView({ children }: PropsWithChildren) {
  return <View>{children}</View>;
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: 844 };
}

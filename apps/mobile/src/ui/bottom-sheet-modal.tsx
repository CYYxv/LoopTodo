import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import { Text } from '@/ui/hero-runtime';

export function BottomSheetModal({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose(): void }>) {
  const translateY = useRef(new Animated.Value(0)).current;
  const dark = useColorScheme() === 'dark';
  const { height } = useWindowDimensions();
  useEffect(() => { if (visible) translateY.setValue(0); }, [translateY, visible]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 90 || gesture.vy > 1.2) onClose();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [onClose, translateY]);
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><View style={styles.root}><Pressable accessibilityRole="button" accessibilityLabel="关闭弹层" style={styles.backdrop} onPress={onClose} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}><Animated.View style={[styles.sheet, dark && styles.sheetDark, { maxHeight: height * 0.85, transform: [{ translateY }] }]}><View style={styles.handleArea} {...panResponder.panHandlers}><View style={[styles.handle, dark && styles.handleDark]} /><Text type="h4" weight="semibold">{title}</Text></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{children}</ScrollView></Animated.View></KeyboardAvoidingView></View></Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.42)' },
  keyboard: { justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7F8FA', overflow: 'hidden' },
  sheetDark: { backgroundColor: '#101114' },
  handleArea: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  handle: { width: 42, height: 5, borderRadius: 999, backgroundColor: '#C7C7C7' },
  handleDark: { backgroundColor: '#5B606A' },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 28 },
});

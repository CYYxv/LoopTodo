import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native/provider';

import { useSettingsStore } from '@/modules/settings/settings.store';
import { applyThemePreference } from '@/ui/theme';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <HeroUINativeProvider config={{
          textProps: { allowFontScaling: true, maxFontSizeMultiplier: 2 },
          toast: { defaultProps: { placement: 'bottom', isSwipeable: true } },
          devInfo: { stylingPrinciples: false },
        }}><ThemeController />{children}</HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemeController() {
  const preference = useSettingsStore((state) => state.value?.themePreference ?? 'system');
  const load = useSettingsStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

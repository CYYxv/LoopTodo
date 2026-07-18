import type { PropsWithChildren } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from 'heroui-native/bottom-sheet';

export function BottomSheetModal({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose(): void }>) {
  const { height } = useWindowDimensions();
  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress className="bg-backdrop" />
        <BottomSheet.Content
          enableDynamicSizing
          enablePanDownToClose
          maxDynamicContentSize={height * 0.85}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          backgroundClassName="bg-overlay rounded-t-3xl"
          handleIndicatorClassName="bg-muted/45"
          contentContainerClassName="pb-2"
        >
          <View className="flex-row items-center justify-between gap-3 px-4 pb-2">
            <BottomSheet.Title className="flex-1 text-xl font-semibold text-overlay-foreground">{title}</BottomSheet.Title>
            <BottomSheet.Close accessibilityLabel="关闭弹层" />
          </View>
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingBottom: 28 }}
          >
            {children}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

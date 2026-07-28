import { useMemo, useState } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheet } from 'heroui-native/bottom-sheet';
import { Checkbox } from 'heroui-native/checkbox';

import { track } from '@/modules/analytics/analytics';
import type { InstalledApp } from '@/modules/lock-engine/lock-engine.types';
import { Button, Input, Text, TextField } from '@/ui/hero-runtime';

export function ApplicationPicker({ apps, selected, onChange, title = '选择软件', source = 'settings', listId, triggerLabel }: {
  apps: InstalledApp[];
  selected: string[];
  onChange(packages: string[]): void | boolean | Promise<void | boolean>;
  title?: string;
  source?: 'settings' | 'task';
  listId?: string;
  triggerLabel?: string;
}) {
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const visible = useMemo(
    () => [...apps]
      .filter((app) => app.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN')),
    [apps, query],
  );
  const selectedApps = useMemo(
    () => selected.map((packageName) => apps.find((app) => app.packageName === packageName)).filter((app): app is InstalledApp => Boolean(app)).slice(0, 5),
    [apps, selected],
  );

  const show = () => {
    setDraft([...selected]);
    setQuery('');
    setSaveFailed(false);
    setOpen(true);
    track('whitelist_picker_opened', pickerAnalytics(source, listId, selected.length));
  };
  const toggle = (packageName: string) => {
    setDraft((current) => current.includes(packageName)
      ? current.filter((item) => item !== packageName)
      : [...current, packageName]);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const result = await onChange(draft);
      if (result === false) {
        setSaveFailed(true);
        return;
      }
      setOpen(false);
      track('whitelist_saved', pickerAnalytics(source, listId, draft.length));
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Button variant="secondary" accessibilityLabel={triggerLabel ?? `选择软件，已选 ${selected.length} 个`} onPress={show}>
      <View className="min-h-6 flex-row items-center justify-center gap-2">
        {selectedApps.map((app) => <AppIcon key={app.packageName} app={app} testID={`selected-app-icon-${app.packageName}`} size="small" />)}
        <Text weight="semibold">{triggerLabel ?? (selected.length ? `已选择 ${selected.length} 个软件` : '选择软件')}</Text>
      </View>
    </Button>
    <BottomSheet isOpen={open} onOpenChange={setOpen}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress className="bg-backdrop" />
        <BottomSheet.Content
          snapPoints={[Math.round(height * 0.88)]}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose
          keyboardBehavior="extend"
          backgroundClassName="bg-overlay rounded-t-3xl"
          handleIndicatorClassName="bg-muted/45"
          contentContainerClassName="h-full"
        >
          <View className="flex-row items-center justify-between gap-3 px-4 pb-3">
            <BottomSheet.Title className="flex-1 text-xl font-semibold text-overlay-foreground">{title}</BottomSheet.Title>
            <Text type="body-sm" color="muted">已选 {draft.length} 个</Text>
            <BottomSheet.Close accessibilityLabel="关闭软件选择" />
          </View>
          <View className="px-4 pb-3">
            <TextField><Input placeholder="搜索本机软件" value={query} onChangeText={setQuery} /></TextField>
          </View>
          <BottomSheetFlatList
            data={visible}
            keyExtractor={(app) => app.packageName}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            ListEmptyComponent={<Text type="body-sm" color="muted" className="py-6 text-center">没有找到软件</Text>}
            renderItem={({ item }) => {
              const checked = draft.includes(item.packageName);
              return <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={item.label}
                accessibilityState={{ checked }}
                className="min-h-14 flex-row items-center gap-3 border-b border-divider py-2"
                onPress={() => toggle(item.packageName)}
              >
                <AppIcon app={item} testID={`app-icon-${item.packageName}`} />
                <Text className="flex-1" numberOfLines={2}>{item.label}</Text>
                <Checkbox isSelected={checked} pointerEvents="none" importantForAccessibility="no-hide-descendants" />
              </Pressable>;
            }}
          />
          <View className="border-t border-divider px-4 pb-6 pt-3">
            {saveFailed ? <Text type="body-sm" color="danger" className="pb-2">保存失败，请重试</Text> : null}
            <Button isDisabled={saving} accessibilityLabel={saveFailed ? '重试保存已选软件' : '保存已选软件'} onPress={() => void save()}>
              {saveFailed ? `重试保存（${draft.length}）` : `保存（${draft.length}）`}
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  </>;
}

function pickerAnalytics(source: 'settings' | 'task', listId: string | undefined, selectedCount: number) {
  return { source, ...(listId ? { listId } : {}), selectedCount };
}

export function AppIcon({ app, testID, size = 'normal' }: { app: InstalledApp; testID?: string; size?: 'small' | 'normal' }) {
  const sizeClass = size === 'small' ? 'size-6 rounded-md' : 'size-10 rounded-xl';
  return app.iconDataUrl
    ? <Image testID={testID} source={{ uri: app.iconDataUrl }} className={sizeClass} />
    : <View testID={testID} className={`${sizeClass} items-center justify-center bg-accent-soft`}>
        <Text type={size === 'small' ? 'body-xs' : 'body-sm'} weight="semibold" color="accent">{app.label.slice(0, 1)}</Text>
      </View>;
}

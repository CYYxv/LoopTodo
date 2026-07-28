import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import type { InstalledApp } from '@/modules/lock-engine/lock-engine.types';
import { taskStore } from '@/modules/tasks/task.store';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useWhitelistStore } from '../whitelist.store';
import type { WhitelistList } from '../whitelist.types';
import { AppIcon, ApplicationPicker } from './ApplicationPicker';

export function WhitelistManager() {
  const lists = useWhitelistStore((state) => state.lists);
  const loading = useWhitelistStore((state) => state.loading);
  const error = useWhitelistStore((state) => state.error);
  const loadError = useWhitelistStore((state) => state.loadError);
  const hydrate = useWhitelistStore((state) => state.hydrate);
  const create = useWhitelistStore((state) => state.create);
  const update = useWhitelistStore((state) => state.update);
  const setDefault = useWhitelistStore((state) => state.setDefault);
  const getReferenceCount = useWhitelistStore((state) => state.getReferenceCount);
  const archive = useWhitelistStore((state) => state.archive);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [packages, setPackages] = useState<string[]>([]);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ list: WhitelistList; referenceCount: number } | null>(null);

  const loadApps = useCallback(async () => {
    setAppsError(null);
    try {
      setApps(await lockEngine.listLaunchableApps());
    } catch {
      setApps([]);
      setAppsError('本机软件读取失败，请重试');
    }
  }, []);

  useEffect(() => {
    void hydrate();
    void loadApps();
  }, [hydrate, loadApps]);

  const resetEditor = () => {
    setEditingId(null);
    setName('');
    setPackages([]);
    setSaveFailed(false);
  };
  const save = async () => {
    setSaveFailed(false);
    const editing = lists.find((list) => list.id === editingId);
    const saved = editing
      ? await update({ ...editing, name: name.trim(), packages })
      : await create(name, packages);
    if (saved) resetEditor();
    else setSaveFailed(true);
  };
  const edit = (list: WhitelistList) => {
    setEditingId(list.id);
    setName(list.name);
    setPackages(list.packages);
    setSaveFailed(false);
  };
  const copy = (list: WhitelistList) => {
    setEditingId(null);
    setName(`${list.name} 副本`);
    setPackages([...list.packages]);
    setSaveFailed(false);
  };
  const requestRemove = async (list: WhitelistList) => {
    const referenceCount = await getReferenceCount(list);
    if (referenceCount != null) setPendingDelete({ list, referenceCount });
  };
  const confirmRemove = async () => {
    if (!pendingDelete) return;
    const replacement = lists.find((item) => item.isDefault && item.id !== pendingDelete.list.id) ?? null;
    const replacementId = pendingDelete.referenceCount > 0 ? replacement?.id ?? null : null;
    const removed = await archive(pendingDelete.list, replacementId, pendingDelete.referenceCount);
    if (!removed) return;
    if (replacementId) await taskStore.getState().hydrate();
    setPendingDelete(null);
  };

  return <View className="gap-4">
    <Card variant="secondary"><Card.Body className="gap-3">
      <Card.Title>{editingId ? '编辑场景白名单' : '新建场景白名单'}</Card.Title>
      <TextField><Label>场景白名单名称</Label><Input value={name} onChangeText={setName} placeholder="例如：上课" /></TextField>
      <ApplicationPicker title={name.trim() ? `编辑“${name.trim()}”` : editingId ? '编辑场景白名单' : '新建场景白名单'}
        source="settings" listId={editingId ?? undefined} apps={apps} selected={packages} onChange={setPackages} />
      <View className="flex-row gap-2">
        <Button className="flex-1" isDisabled={!name.trim()} onPress={() => void save()}>
          {saveFailed ? '重试保存' : editingId ? '保存场景白名单' : '创建场景白名单'}
        </Button>
        {editingId ? <Button className="flex-1" variant="secondary" onPress={resetEditor}>取消编辑</Button> : null}
      </View>
    </Card.Body></Card>

    {lists.map((list) => {
      const previewApps = list.packages
        .map((packageName) => apps.find((app) => app.packageName === packageName))
        .filter((app): app is InstalledApp => Boolean(app))
        .slice(0, 4);
      return <Card key={list.id}><Card.Body className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><Card.Title>{list.name}</Card.Title><Card.Description>{list.packages.length} 个软件{list.isDefault ? ' · 默认场景白名单' : ''}</Card.Description></View>
        {!list.isDefault ? <Button size="sm" variant="secondary" accessibilityLabel={`设${list.name}为默认`} onPress={() => void setDefault(list)}>设为默认</Button> : null}
      </View>
      {previewApps.length ? <View className="flex-row gap-2">
        {previewApps.map((app) => <AppIcon key={app.packageName} app={app} size="small" testID={`whitelist-list-icon-${list.id}-${app.packageName}`} />)}
      </View> : null}
      <View className="flex-row gap-2">
        <Button className="flex-1" size="sm" variant="secondary" accessibilityLabel={`编辑${list.name}`} onPress={() => edit(list)}>编辑</Button>
        <Button className="flex-1" size="sm" variant="secondary" accessibilityLabel={`复制${list.name}`} onPress={() => copy(list)}>复制</Button>
        {!list.isDefault ? <Button className="flex-1" size="sm" variant="danger-soft" accessibilityLabel={`删除${list.name}`} onPress={() => void requestRemove(list)}>删除</Button> : null}
      </View>
      {list.isDefault && lists.length > 1 ? <Text type="body-xs" color="muted">先将其他场景白名单设为默认后才能删除</Text> : null}
    </Card.Body></Card>})}

    {loading ? <Text type="body-sm" color="muted">正在读取场景白名单…</Text> : null}
    {loadError ? <View className="gap-2">
      <Text type="body-sm" color="danger" accessibilityRole="alert">{loadError}</Text>
      <Button size="sm" variant="secondary" accessibilityLabel="重试读取场景白名单" onPress={() => void hydrate(true)}>重试读取场景白名单</Button>
    </View> : null}
    {error && error !== loadError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}
    {appsError ? <View className="gap-2">
      <Text type="body-sm" color="danger" accessibilityRole="alert">{appsError}</Text>
      <Button size="sm" variant="secondary" accessibilityLabel="重试读取本机软件" onPress={() => void loadApps()}>重试读取本机软件</Button>
    </View> : null}
    <BottomSheetModal visible={Boolean(pendingDelete)} title="删除场景白名单" onClose={() => setPendingDelete(null)}>
      {pendingDelete ? <View className="gap-3">
        <Text>{pendingDelete.referenceCount > 0
          ? `${pendingDelete.referenceCount} 个任务正在使用“${pendingDelete.list.name}”`
          : `确认删除“${pendingDelete.list.name}”？`}</Text>
        {pendingDelete.referenceCount > 0 ? <Text type="body-sm" color="muted">这些任务将改用默认场景白名单。</Text> : null}
        <Button variant="danger-soft" accessibilityLabel={pendingDelete.referenceCount > 0 ? '改用默认场景白名单并删除' : '确认删除场景白名单'}
          onPress={() => void confirmRemove()}>{pendingDelete.referenceCount > 0 ? '改用默认场景白名单并删除' : '删除场景白名单'}</Button>
        <Button variant="secondary" onPress={() => setPendingDelete(null)}>取消</Button>
      </View> : null}
    </BottomSheetModal>
  </View>;
}

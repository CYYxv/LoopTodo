import { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from 'heroui-native/text';

import { isNavigationAllowed } from '../resource-pass.policy';
import type { ResourcePass } from '../resource-pass.types';

export function RestrictedWebView({ resource }: { resource: ResourcePass }) {
  const [blocked, setBlocked] = useState<string | null>(null);
  const initial = resource.type === 'domain' ? `https://${resource.value}` : resource.value;
  return <View className="h-96 overflow-hidden rounded-panel-inner border border-border"><WebView source={{ uri: initial }}
    originWhitelist={['https://*']} setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
    allowsBackForwardNavigationGestures={false} onShouldStartLoadWithRequest={(request) => {
      const allowed = isNavigationAllowed(resource, request.url); if (!allowed) setBlocked(request.url); return allowed;
    }} onFileDownload={() => setBlocked('下载已被资源通行证阻止')} />
    {blocked ? <View className="absolute bottom-0 left-0 right-0 bg-danger-50 p-2"><Text type="body-xs">已拦截：{blocked}</Text></View> : null}</View>;
}

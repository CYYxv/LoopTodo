import * as DocumentPicker from 'expo-document-picker';

export async function pickLocalResource(kind: 'local_video' | 'local_file') {
  const result = await DocumentPicker.getDocumentAsync({ type: kind === 'local_video' ? 'video/*' : '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { value: asset.uri, displayName: asset.name };
}

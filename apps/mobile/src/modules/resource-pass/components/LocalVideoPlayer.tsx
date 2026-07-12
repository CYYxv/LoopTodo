import { useVideoPlayer, VideoView } from 'expo-video';

export function LocalVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{ width: '100%', height: 320 }} nativeControls contentFit="contain" fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />;
}

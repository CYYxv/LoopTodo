import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type TabIconName = 'today' | 'focus' | 'data' | 'me';

export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  return <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{name === 'today' ? <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M8 3v4M16 3v4M3 10h18M8 15l2 2 5-5" /></> : null}{name === 'focus' ? <><Circle cx={12} cy={13} r={8} /><Path d="M9 2h6M12 5v2M12 13l3-2" /></> : null}{name === 'data' ? <><Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> : null}{name === 'me' ? <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6" /></> : null}</Svg>;
}

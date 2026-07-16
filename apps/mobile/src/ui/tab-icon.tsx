import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type TabIconName = 'tasks' | 'habits' | 'statistics' | 'me';

export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  return <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{name === 'tasks' ? <><Rect x={4} y={3} width={16} height={18} rx={2} /><Path d="M8 8h8M8 12h8M8 16h5" /></> : null}{name === 'habits' ? <><Path d="M12 21c5-2.2 8-6.2 8-11V5l-8-2-8 2v5c0 4.8 3 8.8 8 11Z" /><Path d="m9 12 2 2 4-5" /></> : null}{name === 'statistics' ? <><Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> : null}{name === 'me' ? <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6" /></> : null}</Svg>;
}

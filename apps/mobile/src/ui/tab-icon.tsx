import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type TabIconName = 'tasks' | 'habits' | 'statistics' | 'social' | 'me' | 'more';

export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  return <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{name === 'tasks' ? <><Rect x={4} y={3} width={16} height={18} rx={2} /><Path d="M8 8h8M8 12h8M8 16h5" /></> : null}{name === 'habits' ? <><Path d="M12 21c5-2.2 8-6.2 8-11V5l-8-2-8 2v5c0 4.8 3 8.8 8 11Z" /><Path d="m9 12 2 2 4-5" /></> : null}{name === 'statistics' ? <><Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> : null}{name === 'social' ? <><Circle cx={8} cy={9} r={3} /><Circle cx={17} cy={8} r={2.5} /><Path d="M2.5 20c.6-3.4 2.5-5 5.5-5s5 1.6 5.5 5M14 14c3.8 0 6.2 1.8 6.8 5" /></> : null}{name === 'me' ? <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6" /></> : null}{name === 'more' ? <><Circle cx={5} cy={12} r={1} fill={color} stroke="none" /><Circle cx={12} cy={12} r={1} fill={color} stroke="none" /><Circle cx={19} cy={12} r={1} fill={color} stroke="none" /></> : null}</Svg>;
}

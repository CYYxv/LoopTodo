import { Children, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Button as HeroButton } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip as HeroChip } from 'heroui-native/chip';
import { Description } from 'heroui-native/description';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Switch as HeroSwitch } from 'heroui-native/switch';
import { Text as HeroText } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

export { Card, Description, Input, Label, TextField };
export { HeroUINativeProvider } from 'heroui-native/provider';

export function Text({ color = 'default', className = '', ...props }: any) {
  const semanticClassName = color === 'accent' ? 'text-accent' : color === 'danger' ? 'text-danger' : '';
  return <HeroText {...props} color={color === 'muted' ? 'muted' : 'default'} className={`${semanticClassName} ${className}`.trim()} />;
}

export function Button({ children, feedbackVariant, animation, ...props }: any) {
  const textContent = textualChildContent(children);
  return (
    <HeroButton
      {...props}
      feedbackVariant={feedbackVariant ?? (Platform.OS === 'android' ? 'scale-ripple' : 'scale-highlight')}
      animation={animation ?? { scale: { value: 0.985, timingConfig: { duration: 180 } } }}
    >
      {textContent != null ? <HeroButton.Label>{textContent}</HeroButton.Label> : children}
    </HeroButton>
  );
}

export function Chip({ children, ...props }: any) {
  const textContent = textualChildContent(children);
  return <HeroChip {...props}>{textContent != null ? <HeroChip.Label>{textContent}</HeroChip.Label> : children}</HeroChip>;
}
Chip.Label = HeroChip.Label;

export function Switch(props: any) {
  return <HeroSwitch {...props}><HeroSwitch.Thumb /></HeroSwitch>;
}

function textualChildContent(children: ReactNode) {
  const childArray = Children.toArray(children);
  return childArray.length > 0 && childArray.every((child) => typeof child === 'string' || typeof child === 'number')
    ? childArray.join('')
    : null;
}

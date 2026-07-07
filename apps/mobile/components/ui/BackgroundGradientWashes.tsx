import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

type Wash = {
  id: string;
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  color: string;
  peak: number;
};

interface BackgroundGradientWashesProps {
  washes: Wash[];
}

export function BackgroundGradientWashes({ washes }: BackgroundGradientWashesProps) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        {washes.map((wash) => (
          <RadialGradient
            key={wash.id}
            id={wash.id}
            cx={wash.cx}
            cy={wash.cy}
            rx={wash.rx}
            ry={wash.ry}
          >
            <Stop offset="0%" stopColor={wash.color} stopOpacity={wash.peak} />
            <Stop offset="45%" stopColor={wash.color} stopOpacity={wash.peak * 0.4} />
            <Stop offset="100%" stopColor={wash.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {washes.map((wash) => (
        <Rect key={`${wash.id}-fill`} width="100%" height="100%" fill={`url(#${wash.id})`} />
      ))}
    </Svg>
  );
}

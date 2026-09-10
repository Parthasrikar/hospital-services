export type IconSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | number;

export interface UiIconOptions {
  name: string;
  size?: IconSize;
  color?: string;
  border?: boolean;
  backgroundShade?: string;
}

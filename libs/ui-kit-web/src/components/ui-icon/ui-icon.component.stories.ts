import { Meta, StoryObj } from '@storybook/angular';
import { UiIconComponent } from './ui-icon.component';

const meta: Meta<UiIconComponent> = {
  title: 'Design System/UiIcon',
  component: UiIconComponent,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge'],
    },
    color: { control: 'color' },
    border: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<UiIconComponent>;

export const Default: Story = {
  args: {
    name: 'calendar.svg',
    size: 'medium',
    border: false,
  },
};

export const Bordered: Story = {
  args: {
    name: 'add.svg',
    size: 'large',
    border: true,
  },
};

export const CustomColor: Story = {
  args: {
    name: 'check.svg',
    size: 'xlarge',
    color: '#3b82f6',
  },
};

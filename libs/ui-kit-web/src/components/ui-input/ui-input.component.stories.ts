import { Meta, StoryObj } from '@storybook/angular';
import { UiInputComponent } from './ui-input.component';

const meta: Meta<UiInputComponent> = {
  title: 'Design System/UiInput',
  component: UiInputComponent,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'tel'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<UiInputComponent>;

export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'admin@hospital.com',
    type: 'email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    placeholder: '••••••••',
    type: 'password',
    errorMessage: 'Password is required (min 6 characters)',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Username',
    placeholder: 'Disabled input',
    disabled: true,
  },
};

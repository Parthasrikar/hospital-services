export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel';

export interface UiInputOptions {
  label?: string;
  placeholder?: string;
  type?: InputType;
  errorMessage?: string;
  disabled?: boolean;
}

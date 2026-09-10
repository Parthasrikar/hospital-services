# Design System & UI Architecture Documentation

This document outlines the architecture, usage, and extension guidelines for `@hospital-services/ui-kit-web` and `@hospital-services/icons-kit-web`.

---

## 1. Overview of Architecture

The design system is divided into two decoupled Nx shared libraries under `libs/`:

1. **`@hospital-services/ui-kit-web`** (`libs/ui-kit-web`):
   * Global SCSS design tokens (colors, sizing, spacing, widths, heights, layout, root scaling, typography, utilities, PrimeNG overrides).
   * Standalone Angular UI components (`UiIconComponent`, `UiButtonComponent`, etc.).
2. **`@hospital-services/icons-kit-web`** (`libs/icons-kit-web`):
   * Domain-organized SVG asset catalog (`master-data/`, `safety-management/`, `schedule/`, `general/`).
   * Automated SVG-to-TypeScript compilation script (`generate-icons.js`).

---

## 2. Style Architecture & Design Tokens

Styles are layered in `libs/ui-kit-web/src/styles/`:

```text
libs/ui-kit-web/src/styles/
├── colors.scss          # Layer A: Primitive palette (hex SCSS vars + :root custom props)
├── color-tokens.scss    # Layer B: Semantic tokens ($stag, $mod, $global-colors mixin)
├── sizes.scss           # Unitless sizing maps ($icon-size-value, $corner-radius-value, $spacing-value, $max-width-value)
├── functions.scss       # rem() calculation helper
├── size-tokens.scss     # Generates --icon-size-*, --corner-radius-*, --spacing-*, --max-w-* CSS custom props
├── root-scaling.scss    # Responsive scale knob clamp(13px, 100vw / 90, 18px)
├── typography.scss     # Font family CSS vars & typography utility classes
├── core.scss            # Stamped out utility classes (spacing, dimensions, flexbox, grid, opacity, truncate)
├── primeng-override.scss# PrimeNG component class overrides
└── index.scss           # Global @forward barrel
```

### Layer A — Primitive Palette (`colors.scss`)
Defines raw hex values for hues (`$blue-gray-25...900`, `$primary-50...900`, `$success-*`, `$warning-*`, `$error-*`). These are emitted into `:root` as flat CSS custom properties (`--primary-500`, `--blue-gray-50`).

### Layer B — Semantic Tokens (`color-tokens.scss`)
Organized into three nested Sass maps:
* **`$stag`**: Static roles for non-interactive UI (`background.white.base`, `border.gray.subtle`, `text.primary`).
* **`$mod`**: Interactive state modifiers for hover/focus/active/disabled states (`background.brand.normal`, `background.brand.spotlight`).
* **`$global-colors`**: Brand accent colors.

A recursive Sass mixin (`generate-css-vars`) flattens these maps into `:root` custom properties (`--stag-background-white-base`, `--mod-background-brand-spotlight`).

> **Rule**: Components **never** consume hex values or Layer A directly. Components consume `--stag-*` and `--mod-*` CSS variables. Retheming is performed strictly at Layer A.

### Root Scaling Knob (`root-scaling.scss`)
```scss
html {
  font-size: clamp(13px, 100vw / 90, 18px);
}
```
All design tokens and utility classes use `rem()`. Adjusting the root `font-size` dynamically scales UI density smoothly based on logical viewport width.

### Widths, Heights, Spacing & Layout Utilities (`core.scss`)
The design system includes built-in rem-calculated layout and dimension utilities:
* **Spacing**: `.m-0`...`.m-24`, `.mt-*`, `.mb-*`, `.mx-*`, `.my-*`, `.p-0`...`.p-24`, `.px-*`, `.py-*`, `.gap-0`...`.gap-24`.
* **Widths & Heights**: `.w-full`, `.w-screen`, `.w-auto`, `.w-fit`, `.h-full`, `.h-screen`, `.min-h-screen`, `.max-w-xs`...`.max-w-7xl`, `.max-w-full`.
* **Flexbox & Grid**: `.flex`, `.flex-row`, `.flex-col`, `.flex-wrap`, `.flex-1`, `.items-center`, `.justify-between`, `.grid`, `.grid-cols-1`...`.grid-cols-12`.

---

## 3. How to Consume Tokens & Components in Angular Apps

### Global SCSS Injection (Zero SCSS `@use` Needed)
`libs/ui-kit-web/src/styles/index.scss` is registered in each Angular app's `project.json` `styles` array:

```json
"styles": [
  "apps/hospital-admin/src/styles.scss",
  "libs/ui-kit-web/src/styles/index.scss"
]
```

Therefore, all CSS variables (`--stag-*`, `--mod-*`, `--icon-size-*`, `--spacing-*`, `--max-w-*`) and utility classes (`.heading-lg`, `.flex`, `.items-center`, `.justify-between`, `.gap-4`, `.w-full`, `.max-w-xl`) are available globally across every component template and SCSS file without `@use` or `@import`.

### Using Components in Angular Components
Import standalone components directly from `@hospital-services/ui-kit-web`:

```typescript
import { Component } from '@angular/core';
import { UiIconComponent } from '@hospital-services/ui-kit-web';

@Component({
  selector: 'app-patient-card',
  standalone: true,
  imports: [UiIconComponent],
  templateUrl: './patient-card.component.html',
})
export class PatientCardComponent {}
```

In Template:
```html
<div class="flex items-center justify-between p-4 corner-radius-8 w-full max-w-xl">
  <ui-icon name="calendar.svg" size="medium" color="#3b82f6"></ui-icon>
  <ui-icon name="add.svg" size="large" [border]="true"></ui-icon>
</div>
```

---

## 4. How to Add a New Reusable Component to `ui-kit-web`

Every component in `libs/ui-kit-web/src/components/` **must follow the 5-file convention**:

### Folder Structure Example: `libs/ui-kit-web/src/components/ui-button/`
```text
ui-button/
├── ui-button.component.ts
├── ui-button.component.html
├── ui-button.component.scss
├── ui-button.component.types.ts
└── ui-button.component.stories.ts
```

### 1. `ui-button.component.types.ts`
```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'error';
export type ButtonSize = 'small' | 'medium' | 'large';
```

### 2. `ui-button.component.ts`
```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonVariant, ButtonSize } from './ui-button.component.types';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-button.component.html',
  styleUrls: ['./ui-button.component.scss'],
})
export class UiButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'medium';
  @Input() disabled = false;
}
```

### 3. `ui-button.component.html`
```html
<button
  class="ui-button"
  [class]="'ui-button--' + variant + ' ui-button--' + size"
  [disabled]="disabled"
>
  <ng-content></ng-content>
</button>
```

### 4. `ui-button.component.scss`
```scss
.ui-button {
  font-family: var(--font-family-base);
  border-radius: var(--corner-radius-medium);
  border: none;
  cursor: pointer;

  &--primary {
    background-color: var(--mod-background-brand-normal);
    color: var(--mod-text-white-normal);
    &:hover { background-color: var(--mod-background-brand-spotlight); }
  }
}
```

### 5. `ui-button.component.stories.ts`
```typescript
import { Meta, StoryObj } from '@storybook/angular';
import { UiButtonComponent } from './ui-button.component';

const meta: Meta<UiButtonComponent> = {
  title: 'Design System/UiButton',
  component: UiButtonComponent,
};
export default meta;

export const Primary: StoryObj<UiButtonComponent> = {
  args: { variant: 'primary', size: 'medium' },
};
```

### 6. Export from Barrel (`libs/ui-kit-web/src/index.ts`)
```typescript
export * from './components/ui-icon/ui-icon.component';
export * from './components/ui-icon/ui-icon.component.types';

export * from './components/ui-button/ui-button.component';
export * from './components/ui-button/ui-button.component.types';
```

---

## 5. How to Add a New SVG Icon to `icons-kit-web`

1. **Add SVG Asset**:
   Place the `.svg` file inside the appropriate domain folder under `libs/icons-kit-web/src/assets/`:
   e.g. `libs/icons-kit-web/src/assets/patient/heart.svg`

2. **Run Icon Generation Script**:
   ```bash
   node libs/icons-kit-web/scripts/generate-icons.js
   ```
   This script recursively scans `src/assets`, inlines all SVG markup, and updates `libs/icons-kit-web/src/assets/icons.ts`.

3. **Consume the Icon**:
   ```html
   <ui-icon name="heart.svg" size="large" color="#e11d48"></ui-icon>
   ```

---

## 6. Build & Verification Commands

```bash
# Build Frontend Applications
npx nx build hospital-admin
npx nx build patient-web

# Regenerate Icon TS Map
node libs/icons-kit-web/scripts/generate-icons.js
```

import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DEFAULT_ICONS } from '../../../../icons-kit-web/src/assets/icons';
import { IconSize } from './ui-icon.component.types';

@Component({
  selector: 'ui-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-icon.component.html',
  styleUrls: ['./ui-icon.component.scss'],
})
export class UiIconComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);

  @Input() name = 'circle.svg';
  @Input() size: IconSize = 'medium';
  @Input() color?: string;
  @Input() border = false;
  @Input() backgroundShade?: string;

  svgContent: SafeHtml = '';
  computedSize = '1.25rem'; // default medium 20px / 16 = 1.25rem

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name']) {
      this.updateSvgContent();
    }
    if (changes['size']) {
      this.updateSize();
    }
  }

  private updateSvgContent(): void {
    const iconName = this.name.endsWith('.svg') ? this.name : `${this.name}.svg`;
    const rawSvg =
      DEFAULT_ICONS[iconName] ||
      DEFAULT_ICONS['circle.svg'] ||
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>';

    this.svgContent = this.sanitizer.bypassSecurityTrustHtml(rawSvg);
  }

  private updateSize(): void {
    if (typeof this.size === 'number') {
      this.computedSize = `${this.size / 16}rem`;
      return;
    }

    const sizeMap: Record<string, string> = {
      xsmall: '0.75rem',  // 12px
      small: '1rem',      // 16px
      medium: '1.25rem',  // 20px
      large: '1.5rem',    // 24px
      xlarge: '2rem',     // 32px
      xxlarge: '3rem',    // 48px
    };

    this.computedSize = sizeMap[this.size] || '1.25rem';
  }
}

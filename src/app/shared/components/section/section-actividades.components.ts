import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BannerVariant = 'vino' | 'azul' | 'negro';

@Component({
  selector: 'app-section-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section *ngIf="show" class="section-banner" [attr.data-variant]="variant">
      <div class="section-banner__inner">
        <h2 class="section-banner__title">{{ title }}</h2>
        <p class="section-banner__subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
    </section>
    <img *ngIf="show && imageUrl" class="actividades-img" [src]="imageUrl" alt="" />
  `,
  styleUrls: ['./section-components.css'],
})
export class SectionBannerComponent {
  @Input() show = true;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() variant: BannerVariant = 'vino';
  @Input() imageUrl?: string;

}

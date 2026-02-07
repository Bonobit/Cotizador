import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer-aprobacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer-aprobacion.components.html',
  styleUrls: ['./footer-aprobacion.components.css'],
})
export class FooterAprobacionComponent {
  @Input() nombre: string = '';
  @Output() imageLoaded = new EventEmitter<void>();

  onImgLoad() {
    this.imageLoaded.emit();
  }
}

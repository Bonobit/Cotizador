import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cotizacion-preview-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cotizacion-preview.page.html',
  styleUrls: ['./cotizacion-preview.page.css'],
})
export class CotizacionPreviewPage {
  constructor(private router: Router) {}

  volver() {
    this.router.navigate(['/']);
  }
}

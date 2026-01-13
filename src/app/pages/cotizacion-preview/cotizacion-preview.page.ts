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

  portadaUrl = 'https://dngqawqeaifyfhbklova.supabase.co/storage/v1/object/public/Portada/Portada%20Cotizador.png';

  asesorNombre = '';
  asesorImg = '';

  ngOnInit() {
    this.asesorNombre = localStorage.getItem('asesor_nombre') ?? '';
    this.asesorImg = localStorage.getItem('asesor_img') ?? '';
  }

  constructor(private router: Router) {}

  volver() {
    this.router.navigate(['/']);
  }
}

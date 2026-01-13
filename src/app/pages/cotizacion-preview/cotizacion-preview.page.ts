import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    this.router.navigate(['/cotizacion-form']);
  }

  async generarPDF() {
    const el = document.getElementById('pdf-content');
    if (!el) return;

    // ✅ mejora calidad (más nítido)
    const scale = 2;

    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,          // para imágenes de Supabase
      backgroundColor: null,  // sin fondo extra
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);

    // PDF tamaño A4 en px usando jsPDF con "mm"
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // dimensiones de la imagen en mm, ajustada para ocupar TODO el ancho
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // ✅ Si cabe en 1 página, la metemos full
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // ✅ Multi-página sin espacios blancos (corta por altura)
      let y = 0;
      let heightLeft = imgHeight;

      while (heightLeft > 0) {
        pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        y -= pageHeight;

        if (heightLeft > 0) pdf.addPage();
      }
    }

    pdf.save('cotizacion.pdf');
  }

}

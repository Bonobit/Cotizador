import { Routes } from '@angular/router';
import { CotizacionFormPage } from './pages/cotizacion-form/cotizacion-form.page';
import { CotizacionPreviewPage } from './pages/cotizacion-preview/cotizacion-preview.page';

export const routes: Routes = [
  { path: '', component: CotizacionFormPage },
  { path: 'preview', component: CotizacionPreviewPage },
  { path: '**', redirectTo: '' },
];

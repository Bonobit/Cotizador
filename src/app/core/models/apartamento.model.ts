export interface Apartamentos {
  id: string; // uuid
  proyecto_id: number;
  torre: string;
  numero_apto: string;
  area_total: number | null;
  precio_lista: number | null;
  fecha_entrega: string | null; // date string
  estado: string;
  apartamento_img: string | null;
  plano_img: string | null;
}

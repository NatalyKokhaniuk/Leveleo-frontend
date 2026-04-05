import { RenderMode, ServerRoute } from '@angular/ssr';
 
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'catalog', renderMode: RenderMode.Server },
  { path: 'products', renderMode: RenderMode.Server },
  { path: 'products/brand/**', renderMode: RenderMode.Server },
  { path: 'products/category/**', renderMode: RenderMode.Server },
  { path: 'favorites', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server }
];

import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DeliveryPointDto } from '../nova-poshta.types';
import { NovaPoshtaService } from '../nova-poshta.service';

export interface SelectDeliveryMapDialogData {
  settlementRef: string;
  cityName: string;
  /** Query `type` для `/delivery-points`: branch | postomat */
  npType: 'branch' | 'postomat';
}

@Component({
  selector: 'app-select-delivery-map-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './select-delivery-map-dialog.component.html',
  styleUrl: './select-delivery-map-dialog.component.scss',
})
export class SelectDeliveryMapDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost') mapHost?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly np = inject(NovaPoshtaService);
  readonly ref = inject(MatDialogRef<SelectDeliveryMapDialogComponent, DeliveryPointDto | undefined>);
  readonly data = inject<SelectDeliveryMapDialogData>(MAT_DIALOG_DATA);

  loading = signal(true);
  points = signal<DeliveryPointDto[]>([]);
  selected = signal<DeliveryPointDto | null>(null);
  loadError = signal(false);

  private leaflet: typeof import('leaflet') | null = null;
  private map: import('leaflet').Map | null = null;
  private markersLayer: import('leaflet').LayerGroup | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;

  pointsWithCoords = signal<DeliveryPointDto[]>([]);
  pointsWithoutCoords = signal<DeliveryPointDto[]>([]);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    void this.bootstrapMap();
  }

  ngOnDestroy(): void {
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.map?.remove();
    this.map = null;
    this.markersLayer = null;
  }

  selectPoint(p: DeliveryPointDto): void {
    this.selected.set(p);
  }

  confirm(): void {
    const p = this.selected();
    this.ref.close(p ?? undefined);
  }

  cancel(): void {
    this.ref.close(undefined);
  }

  private async bootstrapMap(): Promise<void> {
    const host = this.mapHost?.nativeElement;
    if (!host) return;
    if (!this.leaflet) {
      this.leaflet = await import('leaflet');
    }
    const L = this.leaflet;

    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(host, { scrollWheelZoom: true }).setView([49.0, 32.0], 6);
    this.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    this.markersLayer = L.layerGroup().addTo(map);

    map.on('moveend', () => {
      if (this.moveTimer) clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => this.reloadForViewport(), 450);
    });

    await this.loadPoints(undefined, true);
  }

  private async reloadForViewport(): Promise<void> {
    if (!this.map) return;
    const b = this.map.getBounds();
    const bbox = `${b.getSouthWest().lat},${b.getSouthWest().lng},${b.getNorthEast().lat},${b.getNorthEast().lng}`;
    await this.loadPoints(bbox, false);
  }

  private async loadPoints(bbox: string | undefined, fitToMarkers: boolean): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const list = await firstValueFrom(
        this.np.getDeliveryPoints(this.data.settlementRef, {
          type: this.data.npType,
          bbox,
        }),
      );
      const prevSel = this.selected();
      if (prevSel && !list.some((x) => x.ref === prevSel.ref)) {
        this.selected.set(null);
      }

      this.points.set(list);
      const withC = list.filter(hasMapCoords);
      const withoutC = list.filter((p) => !hasMapCoords(p));
      this.pointsWithCoords.set(withC);
      this.pointsWithoutCoords.set(withoutC);
      this.renderMarkers(withC);
      if (fitToMarkers && withC.length > 0 && this.map && this.leaflet) {
        const bounds = this.leaflet.latLngBounds(withC.map((p) => [p.lat, p.lng] as [number, number]));
        this.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private renderMarkers(withC: DeliveryPointDto[]): void {
    if (!this.map || !this.markersLayer || !this.leaflet) return;
    const L = this.leaflet;
    this.markersLayer.clearLayers();
    const selectedRef = this.selected()?.ref;

    for (const p of withC) {
      const marker = L.marker([p.lat, p.lng]);
      marker.bindPopup(`<strong>${this.escapeHtml(p.name)}</strong><br/>${this.escapeHtml(p.shortAddress)}`);
      marker.on('click', () => this.selected.set(p));
      if (p.ref === selectedRef) {
        marker.openPopup();
      }
      marker.addTo(this.markersLayer);
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

function hasMapCoords(p: DeliveryPointDto): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

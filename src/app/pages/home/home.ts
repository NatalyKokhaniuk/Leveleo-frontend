import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HomeBrandStripComponent } from './brand-strip/brand-strip.component';
import { CarouselComponent } from './carousel/carousel';
import { QuickLinksComponent } from './quick-links/quick-links';
import { AuthHandlerService } from '../../core/auth/services/auth-handler.service';
import { HomeLatestProductsStripComponent } from './latest-products-strip/latest-products-strip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TranslateModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    CarouselComponent,
    HomeBrandStripComponent,
    HomeLatestProductsStripComponent,
    QuickLinksComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private authHandler = inject(AuthHandlerService);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.authHandler.handleAuthActions(this.route);
  }
}

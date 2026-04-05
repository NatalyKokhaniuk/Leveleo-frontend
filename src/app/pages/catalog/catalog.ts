import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HomeCatalogSidebarComponent } from '../home/home-catalog-sidebar/home-catalog-sidebar.component';

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [TranslateModule, HomeCatalogSidebarComponent],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogPage {}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './about.html',
})
export class AboutComponent {
  private router = inject(Router);
  currentTheme = inject(ThemeService).theme;

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
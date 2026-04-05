import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthHandlerService } from '../../auth/services/auth-handler.service';
import { AuthService } from '../../auth/services/auth.service';
import { FavoritesStateService } from '../../favorites/favorites-state.service';
import { catchError, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule, TranslateModule, MatDivider],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
})
export class UserMenuComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private authHandler = inject(AuthHandlerService);
  private favorites = inject(FavoritesStateService);

  currentUser = this.auth.currentUser;

  logout() {
    const chain = this.auth.isAuthenticated()
      ? this.favorites.exportServerFavoritesToLocalStorage().pipe(
          catchError(() => of(void 0)),
          switchMap(() => this.auth.logout()),
        )
      : this.auth.logout();
    chain.subscribe(() => this.router.navigate(['/']));
  }

  changePassword() {
    this.authHandler.openChangePassword();
  }

  // deleteAccount() {
  //   if (confirm('Ви впевнені? Це незворотна дія.')) {
  //     this.auth.deleteAccount().subscribe(() => this.router.navigate(['/']));
  //   }
  // }
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}

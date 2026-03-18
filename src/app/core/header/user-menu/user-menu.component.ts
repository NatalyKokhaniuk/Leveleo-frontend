import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../auth/services/auth.service';

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
  private dialog = inject(MatDialog);

  currentUser = this.auth.currentUser;

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/']));
  }

  deleteAccount() {
    if (confirm('Ви впевнені? Це незворотна дія.')) {
      this.auth.deleteAccount().subscribe(() => this.router.navigate(['/']));
    }
  }

  open2FASetup() {
    // Тут можна відкрити окремий діалог TwoFactorSetupDialogComponent
    console.log('2FA setup — можна додати пізніше');
  }

  changePassword() {
    // Аналогічно — окремий діалог
    console.log('Change password');
  }
}

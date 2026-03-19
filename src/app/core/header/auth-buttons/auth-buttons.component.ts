import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { AuthDialogComponent } from '../../auth/auth-dialog/auth-dialog.component';

@Component({
  selector: 'app-auth-buttons',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslateModule, MatFormFieldModule, MatInputModule],
  templateUrl: './auth-buttons.component.html',
  styleUrl: './auth-buttons.component.scss',
})
export class AuthButtonsComponent {
  private dialog = inject(MatDialog);

  openAuth(tab: 'login' | 'register') {
    this.dialog.open(AuthDialogComponent, {
      panelClass: 'auth-dialog',
      maxHeight: '90vh',
      //disableClose: true,
      data: { defaultTab: tab },
    });
  }
}

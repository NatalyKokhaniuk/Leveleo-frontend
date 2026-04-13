import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-order-checkout',
  standalone: true,
  imports: [TranslateModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './order-checkout.html',
  styleUrl: './order-checkout.scss',
})
export class OrderCheckoutPage {}

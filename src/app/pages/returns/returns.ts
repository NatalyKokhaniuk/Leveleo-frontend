import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './returns.html',
})
export class ReturnsComponent {}
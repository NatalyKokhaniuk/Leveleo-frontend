import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './products.html',
})
export class Products {}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-internal-server-error',
  standalone: true,
  imports: [RouterLink, MatButtonModule, TranslateModule],
  templateUrl: './internal-server-error.html',
  styleUrl: './internal-server-error.scss',
})
export class InternalServerErrorPage {}

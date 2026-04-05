import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';import { isPlatformBrowser } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { AuthHandlerService } from '../../core/auth/services/auth-handler.service';

import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, TranslateModule, MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIcon,
    MatTabGroup,
    MatTab,],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}

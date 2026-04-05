import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryResponseDto } from '../../../features/categories/category.types';
import { categoryLocalizedName } from '../../../features/categories/category-display-i18n';

export interface CategoryTreeNode {
  category: CategoryResponseDto;
  children: CategoryTreeNode[];
}

@Component({
  selector: 'app-home-category-node',
  standalone: true,
  imports: [RouterLink, HomeCategoryNodeComponent],
  templateUrl: './home-category-node.component.html',
})
export class HomeCategoryNodeComponent {
  @Input({ required: true }) node!: CategoryTreeNode;
  @Input() lang = 'uk';

  label(c: CategoryResponseDto): string {
    return categoryLocalizedName(c, this.lang);
  }
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import {
  ConclusionBadge,
  ConclusionField,
  ConclusionGroup,
  ConsultationConclusionViewModel,
} from './consultation-conclusion.helpers';

@Component({
  selector: 'app-consultation-conclusion-report',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './consultation-conclusion-report.component.html',
  styleUrl: './consultation-conclusion-report.component.css',
})
export class ConsultationConclusionReportComponent {
  @Input() viewModel: ConsultationConclusionViewModel | null = null;
  @Input() isPrintView = false;
  @Input() displayMode: 'full' | 'compact' = 'full';
  @Output() badgeClick = new EventEmitter<ConclusionBadge>();

  protected patientRows(fields: ConclusionField[]): ConclusionField[][] {
    const rows: ConclusionField[][] = [];
    for (let index = 0; index < fields.length; index += 3) {
      rows.push(fields.slice(index, index + 3));
    }
    return rows;
  }

  protected trackGroup(_: number, group: ConclusionGroup): string {
    return group.title;
  }

  protected trackBadge(_: number, badge: ConclusionBadge): string {
    return `${badge.tone}:${badge.label}:${badge.meta ?? ''}`;
  }

  protected onBadgeClick(badge: ConclusionBadge, event: Event): void {
    if (badge.imageUrl) {
      event.preventDefault();
      event.stopPropagation();
      this.badgeClick.emit(badge);
    }
  }

  protected hasClickAction(badge: ConclusionBadge): boolean {
    return !!badge.imageUrl;
  }
}

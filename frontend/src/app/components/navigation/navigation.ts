import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navigation.html'
})
export class NavigationComponent {
  @Input() activeTab: string = 'dashboard';
  @Input() role: 'Student' | 'Teacher' | 'Librarian' = 'Student';
  
  @Output() tabChange = new EventEmitter<string>();
  @Output() addBookTriggered = new EventEmitter<void>();

  selectTab(tab: string): void {
    if (tab === 'add-book') {
      this.addBookTriggered.emit();
    } else {
      this.tabChange.emit(tab);
    }
  }
}

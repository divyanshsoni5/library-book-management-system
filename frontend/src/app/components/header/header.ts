import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { LibraryService } from '../../services/library.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html'
})
export class HeaderComponent {
  userService = inject(UserService);
  libraryService = inject(LibraryService);

  logout(): void {
    this.userService.logout();
  }
}

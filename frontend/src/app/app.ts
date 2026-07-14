import { Component, inject, signal, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from './services/user.service';
import { HeaderComponent } from './components/header/header';
import { NavigationComponent } from './components/navigation/navigation';
import { BooksListComponent } from './components/books-list/books-list';
import { MyBooksComponent } from './components/my-books/my-books';
import { ProfileComponent } from './components/profile/profile';
import { IssueBookComponent } from './components/issue-book/issue-book';
import { ReturnBookComponent } from './components/return-book/return-book';
import { UsersComponent } from './components/users/users';
import { DashboardComponent } from './components/dashboard/dashboard';
import { ReportsComponent } from './components/reports/reports';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    NavigationComponent,
    BooksListComponent,
    MyBooksComponent,
    ProfileComponent,
    IssueBookComponent,
    ReturnBookComponent,
    UsersComponent,
    DashboardComponent,
    ReportsComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  userService = inject(UserService);

  // Active navigation tab managed by a reactive signal
  activeTab = signal<string>('dashboard');

  // Query for the BooksListComponent in the template to open modals programmatically
  @ViewChild(BooksListComponent) booksListRef?: BooksListComponent;

  constructor() {
    // Automatically reset tab to 'dashboard' when user changes (e.g. login/logout)
    effect(() => {
      const user = this.userService.currentUser();
      this.activeTab.set('dashboard');
    });
  }

  /**
   * Switch the active tab selection.
   */
  onTabChange(tab: string): void {
    this.activeTab.set(tab);
  }

  /**
   * Action triggered when Librarian clicks "Add Book" on the navigation bar.
   * Switches to 'all-books' first, then triggers the modal popup.
   */
  onAddBookTriggered(): void {
    this.activeTab.set('all-books');
    setTimeout(() => {
      if (this.booksListRef) {
        this.booksListRef.openAddModal();
      }
    }, 100);
  }
}

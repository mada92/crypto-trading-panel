import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './components/layout/sidebar.component';

@Component({
  standalone: true,
  imports: [RouterModule, SidebarComponent],
  selector: 'app-root',
  template: `
    <div class="app-container">
      <app-sidebar />
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        min-height: 100vh;
        background: #0f0f0f;
      }

      .main-content {
        flex: 1;
        padding: 24px;
        margin-left: 260px;
        overflow-x: hidden;
      }
    `,
  ],
})
export class App {
  title = 'AI Trading System';
}

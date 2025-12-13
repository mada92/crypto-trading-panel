import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-sidebar',
  template: `
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">📈</span>
        <span class="logo-text">AI Trading</span>
      </div>

      <nav class="nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🏠</span>
          <span>Dashboard</span>
        </a>
        <a routerLink="/strategies" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📊</span>
          <span>Strategie</span>
        </a>
        <a routerLink="/backtests" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🔬</span>
          <span>Backtesty</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="status-indicator">
          <span class="status-dot online"></span>
          <span>System Online</span>
        </div>
      </div>
    </aside>
  `,
  styles: [
    `
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 260px;
        background: #1a1a1a;
        border-right: 1px solid #2a2a2a;
        display: flex;
        flex-direction: column;
        z-index: 100;
      }

      .logo {
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #2a2a2a;
      }

      .logo-icon {
        font-size: 28px;
      }

      .logo-text {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
      }

      .nav {
        padding: 16px 12px;
        flex: 1;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        color: #888;
        text-decoration: none;
        transition: all 0.2s;
        margin-bottom: 4px;
      }

      .nav-item:hover {
        background: #252525;
        color: #fff;
      }

      .nav-item.active {
        background: #2563eb;
        color: #fff;
      }

      .nav-icon {
        font-size: 18px;
      }

      .sidebar-footer {
        padding: 16px 24px;
        border-top: 1px solid #2a2a2a;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #888;
        font-size: 13px;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .status-dot.online {
        background: #22c55e;
        box-shadow: 0 0 8px #22c55e;
      }
    `,
  ],
})
export class SidebarComponent {}

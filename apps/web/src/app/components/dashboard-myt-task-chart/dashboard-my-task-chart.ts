import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'; 
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
export interface MyTasksChartStats {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}
@Component({
  selector: 'df-dashboard-my-task-chart',
changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'df-my-tasks-chart' },
  imports: [MatCardModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './dashboard-my-task-chart.html',
  styleUrl: './dashboard-my-task-chart.css',
}) 

export class DashboardMyTaskChart implements AfterViewInit, OnDestroy {
  readonly stats = input.required<MyTasksChartStats>();
  readonly projects = input.required<Project[]>();
  readonly selectedProjectId = input<string>('');
  readonly projectChange = output<string>();

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart?: Chart;
  private viewReady = false;

  constructor() {
    effect(() => {
      this.stats();
      if (this.viewReady) {
        this.updateChart();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.updateChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  selectedProjectName(): string {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return 'All projects';
    }
    return this.projects().find((p) => p.id === projectId)?.name ?? 'Project';
  }

  onProjectSelect(projectId: string): void {
    this.projectChange.emit(projectId);
  }

  private updateChart(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const stats = this.stats();
    const labels = ['To Do', 'In Progress', 'Done'];
    const data = [stats.todo, stats.in_progress, stats.done];
    const colors = ['#2563eb', '#d97706', '#16a34a'];

    if (this.chart) {
      this.chart.data.datasets[0].data = data;
      this.chart.update();
      return;
    }

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Tasks',
            data,
            backgroundColor: colors,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.y} tasks`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
            grid: { color: '#f1f5f9' },
            border: { display: false },
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }
}

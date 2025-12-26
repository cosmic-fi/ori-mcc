/**
 * Performance monitoring and metrics collection for Ori-MCC
 * Tracks launch times, memory usage, and download performance
 */

export interface PerformanceMetrics {
	launchTime: number;
	downloadTime: number;
	totalFiles: number;
	totalSize: number;
	averageDownloadSpeed: number;
	peakMemoryUsage: number;
	memoryEfficiency: number;
}

export class PerformanceMonitor {
	private static instance: PerformanceMonitor;
	private metrics: Map<string, number[]> = new Map();
	private startTime: number = 0;
	private downloadStartTime: number = 0;
	private peakMemoryUsage: number = 0;
	private memorySamples: number[] = [];
	private downloadSpeeds: number[] = [];
	private totalDownloaded: number = 0;
	private memoryCheckInterval: NodeJS.Timeout | null = null;

	private constructor() {}

	public static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	/**
	 * Start monitoring launch performance
	 */
	public startLaunchMonitoring(): void {
		this.startTime = Date.now();
		this.peakMemoryUsage = process.memoryUsage().heapUsed;
		this.memorySamples = [];
		
		// Monitor memory usage every 100ms during launch
		this.memoryCheckInterval = setInterval(() => {
			const currentMemory = process.memoryUsage().heapUsed;
			this.memorySamples.push(currentMemory);
			if (currentMemory > this.peakMemoryUsage) {
				this.peakMemoryUsage = currentMemory;
			}
		}, 100);
	}

	/**
	 * Start monitoring download performance
	 */
	public startDownloadMonitoring(): void {
		this.downloadStartTime = Date.now();
		this.downloadSpeeds = [];
		this.totalDownloaded = 0;
	}

	/**
	 * Record download progress
	 */
	public recordDownloadProgress(downloaded: number, timeElapsed: number): void {
		this.totalDownloaded += downloaded;
		if (timeElapsed > 0) {
			const speed = downloaded / timeElapsed;
			this.downloadSpeeds.push(speed);
		}
	}

	/**
	 * Stop monitoring and get performance metrics
	 */
	public stopMonitoring(): PerformanceMetrics {
		if (this.memoryCheckInterval) {
			clearInterval(this.memoryCheckInterval);
			this.memoryCheckInterval = null;
		}

		const totalTime = Date.now() - this.startTime;
		const downloadTime = this.downloadStartTime ? Date.now() - this.downloadStartTime : 0;
		
		const averageDownloadSpeed = this.downloadSpeeds.length > 0 
			? this.downloadSpeeds.reduce((a, b) => a + b, 0) / this.downloadSpeeds.length 
			: 0;

		const averageMemoryUsage = this.memorySamples.length > 0
			? this.memorySamples.reduce((a, b) => a + b, 0) / this.memorySamples.length
			: 0;

		// Calculate memory efficiency (lower is better)
		const memoryEfficiency = this.peakMemoryUsage > 0 && averageMemoryUsage > 0
			? (this.peakMemoryUsage - averageMemoryUsage) / this.peakMemoryUsage
			: 0;

		return {
			launchTime: totalTime,
			downloadTime,
			totalFiles: 0, // Will be set by downloader
			totalSize: this.totalDownloaded,
			averageDownloadSpeed,
			peakMemoryUsage: this.peakMemoryUsage,
			memoryEfficiency
		};
	}

	/**
	 * Record a custom metric
	 */
	public recordMetric(name: string, value: number): void {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}
		this.metrics.get(name)!.push(value);
	}

	/**
	 * Get average value for a metric
	 */
	public getAverageMetric(name: string): number {
		const values = this.metrics.get(name);
		if (!values || values.length === 0) return 0;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	/**
	 * Get all metrics
	 */
	public getAllMetrics(): Map<string, number[]> {
		return new Map(this.metrics);
	}

	/**
	 * Reset all metrics
	 */
	public reset(): void {
		this.metrics.clear();
		this.startTime = 0;
		this.downloadStartTime = 0;
		this.peakMemoryUsage = 0;
		this.memorySamples = [];
		this.downloadSpeeds = [];
		this.totalDownloaded = 0;
		
		if (this.memoryCheckInterval) {
			clearInterval(this.memoryCheckInterval);
			this.memoryCheckInterval = null;
		}
	}

	/**
	 * Get current memory usage
	 */
	public getCurrentMemoryUsage(): number {
		return process.memoryUsage().heapUsed;
	}

	/**
	 * Log performance summary
	 */
	public logPerformanceSummary(): void {
		const metrics = this.stopMonitoring();
		console.log('[PerformanceMonitor] Launch Performance Summary:');
		console.log(`  - Total launch time: ${metrics.launchTime}ms`);
		console.log(`  - Download time: ${metrics.downloadTime}ms`);
		console.log(`  - Average download speed: ${(metrics.averageDownloadSpeed / 1024 / 1024).toFixed(2)} MB/s`);
		console.log(`  - Peak memory usage: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
		console.log(`  - Memory efficiency: ${(metrics.memoryEfficiency * 100).toFixed(1)}%`);
	}
}

export default PerformanceMonitor;
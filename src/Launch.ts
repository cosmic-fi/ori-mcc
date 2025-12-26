/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

import jsonMinecraft from './Minecraft/Minecraft-Json.js';
import librariesMinecraft from './Minecraft/Minecraft-Libraries.js';
import assetsMinecraft from './Minecraft/Minecraft-Assets.js';
import loaderMinecraft from './Minecraft/Minecraft-Loader.js';
import javaMinecraft from './Minecraft/Minecraft-Java.js';
import bundleMinecraft from './Minecraft/Minecraft-Bundle.js';
import argumentsMinecraft from './Minecraft/Minecraft-Arguments.js';

import { isold } from './utils/Index.js';
import Downloader from './utils/Downloader.js';
import { MemoryManager, StringBuilder } from './utils/MemoryManager.js';
import PerformanceMonitor from './utils/PerformanceMonitor.js';

type loader = {
	/**
	 * Path to loader directory. Relative to absolute path to Minecraft's root directory (config option `path`).
	 * 
	 * If `undefined`, defaults to `.minecraft/loader/<loader_type>`.
	 * 
	 * Example: `'fabricfiles'`.
	 */
	path?: string,
	/**
	 * Loader type. 
	 * 
	 * Acceptable values: `'forge'`, `'neoforge'`, `'fabric'`, `'legacyfabric'`, `'quilt'`.
	 */
	type?: string,
	/**
	 * Loader build (version).
	 * 
	 * Acceptable values: `'latest'`, `'recommended'`, actual version.
	 * 
	 * Example: `'0.16.3'`
	 */
	build?: string,
	/**
	 * Should the launcher use a loader?
	 */
	enable?: boolean
}

/**
 * Screen options.
 */
type screen = {
	width?: number,
	height?: number,
	/**
	 * Should Minecraft be started in fullscreen mode?
	 */
	fullscreen?: boolean
}

/**
 * Memory limits
 */
type memory = {
	/**
	 * Sets the `-Xms` JVM argument. This is the initial memory usage.
	 */
	min?: string,
	/**
	 * Sets the `-Xmx` JVM argument. This is the limit of memory usage.
	 */
	max?: string
}

/** 
 * Java download options
 */
type javaOPTS = {
	/**
	 * Absolute path to Java binaries directory. 
	 * 
	 * If set, expects Java to be already downloaded. If `undefined`, downloads Java and sets it automatically.
	 * 
	 * Example: `'C:\Program Files\Eclipse Adoptium\jdk-21.0.2.13-hotspot\bin'`
	 */
	path?: string,
	/** 
	 * Java version number.
	 * 
	 * If set, fetched from https://api.adoptium.net.
	 * If `undefined`, fetched from [Mojang](https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json).
	 * 
	 * Example: `21`
	 */
	version?: string,
	/** 
	 * Java image type. Acceptable values: `'jdk'`, `'jre'`, `'testimage'`, `'debugimage'`, `'staticlibs'`, `'sources'`, `'sbom'`.
	 * 
	 * Using `jre` is recommended since it only has what's needed.
	 */
	type: string
}

/** 
 * Launch options.
 */
export type LaunchOPTS = {
	/**
	 * URL to the launcher backend. Refer to [Selvania Launcher Wiki](https://github.com/luuxis/Selvania-Launcher/blob/master/docs/wiki_EN-US.md) for setup instructions.
	 */
	url?: string | null,
	/**
	 * Something to Authenticate the player. 
	 * 
	 * Refer to `Mojang`, `Microsoft` or `AZauth` classes.
	 * 
	 * Example: `await Mojang.login('Luuxis')`
	 */
	authenticator: any,
	/**
	 * Connection timeout in milliseconds.
	 */
	timeout?: number,
	/**
	 * Absolute path to Minecraft's root directory.
	 * 
	 * Example: `'%appdata%/.minecraft'`
	 */
	path: string,
	/** 
	 * Minecraft version.
	 * 
	 * Example: `'1.20.4'`
	 */
	version: string,
	/**
	 * Path to instance directory. Relative to absolute path to Minecraft's root directory (config option `path`).
	 * This separates game files (e.g. versions, libraries, assets) from game data (e.g. worlds, resourcepacks, options).
	 * 
	 * Example: `'PokeMoonX'`
	 */
	instance?: string,
	/**
	 * Should Minecraft process be independent of launcher?
	 */
	detached?: boolean,
	/**
	 * How many concurrent downloads can be in progress at once.
	 */
	downloadFileMultiple?: number,
	/**
	 * Should the launcher bypass offline mode?
	 * 
	 * If `true`, the launcher will not check if the user is online.
	 */
	bypassOffline?: boolean,
	intelEnabledMac?: boolean,
	/**
	 * Loader config
	 */
	loader: loader,
	/**
	 * MCPathcer directory. (idk actually luuxis please verify this)
	 * 
	 * If `instance` if set, relative to it.
	 * If `instance` is `undefined`, relative to `path`.
	 */
	mcp: any,
	/**
	 * Should game files be verified each launch?
	 */
	verify: boolean,
	/**
	 * Files to ignore from instance. (idk actually luuxis please verify this)
	 */
	ignored: string[],
	/**
	 * Custom JVM arguments. Read more on [wiki.vg](https://wiki.vg/Launching_the_game#JVM_Arguments)
	 */
	JVM_ARGS: string[],
	/**
	 * Custom game arguments. Read more on [wiki.vg](https://wiki.vg/Launching_the_game#Game_Arguments)
	 */
	GAME_ARGS: string[],
	/**
	 * Java options.
	 */
	java: javaOPTS,
	/**
	 * Screen options.
	 */
	screen: screen,
	/**
	 * Memory limit options.
	 */
	memory: memory,
	/**
	 * Resource packs to enable.
	 */
	resourcePacks?: Array<{
		name: string,
		fileName: string,
		filePath: string
	}>;
};

import { 
    OriCoreError, 
    NetworkError, 
    DownloadError, 
    isRecoverableError,
    ErrorCodes 
} from './utils/Errors.js';

export default class Launch extends EventEmitter {
	options: LaunchOPTS;
	private minecraftProcess: ChildProcess | null = null;
	private downloader: Downloader | null = null;
	private isCancelled: boolean = false;
	private isLaunching: boolean = false;
	private abortController: AbortController | null = null;
	private memoryManager: MemoryManager;
	private stringBuilderPool: StringBuilder[] = [];
	private performanceMonitor: PerformanceMonitor;

	constructor() {
		super();
		this.memoryManager = MemoryManager.getInstance();
		this.performanceMonitor = PerformanceMonitor.getInstance();
	}

	async Launch(opt: LaunchOPTS) {
		const defaultOptions: LaunchOPTS = {
			url: null,
			authenticator: null,
			timeout: 10000,
			path: '.Minecraft',
			version: 'latest_release',
			instance: null,
			detached: false,
			intelEnabledMac: false,
			downloadFileMultiple: 5,
			bypassOffline: false,

			loader: {
				path: './loader',
				type: null,
				build: 'latest',
				enable: false,
			},

			mcp: null,

			verify: false,
			ignored: [],
			JVM_ARGS: [],
			GAME_ARGS: [],

			java: {
				path: null,
				version: null,
				type: 'jre',
			},

			screen: {
				width: null,
				height: null,
				fullscreen: false,
			},

			memory: {
				min: '1G',
				max: '2G'
			},
			...opt,
		};

		this.options = defaultOptions;
		this.options.path = path.resolve(this.options.path).replace(/\\/g, '/');
		
		// Debug logging for version
		console.log(`[Launch] Original version from options: ${opt?.version}`);
		console.log(`[Launch] Final version after defaults: ${this.options.version}`);

		if (this.options.mcp) {
			if (this.options.instance) this.options.mcp = `${this.options.path}/instances/${this.options.instance}/${this.options.mcp}`
			else this.options.mcp = path.resolve(`${this.options.path}/${this.options.mcp}`).replace(/\\/g, '/')
		}

		if (this.options.loader.type) {
			this.options.loader.type = this.options.loader.type.toLowerCase()
			this.options.loader.build = this.options.loader.build.toLowerCase()
		}

		if (!this.options.authenticator) {
			const error = { error: "Authenticator not found" };
			this.emit("error", error);
			return error;
		}
		if (this.options.downloadFileMultiple < 1) this.options.downloadFileMultiple = 1
		if (this.options.downloadFileMultiple > 30) this.options.downloadFileMultiple = 30
		if (typeof this.options.loader.path !== 'string') this.options.loader.path = `./loader/${this.options.loader.type}`;
		this.start();
	}


	async start() {
		try {
			this.isCancelled = false;
			this.isLaunching = true;
			this.abortController = new AbortController();
			
			// Start performance monitoring
			this.performanceMonitor.startLaunchMonitoring();
			
			if (this.isCancelled) {
				this.isLaunching = false;
				return;
			}
			let data: any = await this.DownloadGame();
			if (this.isCancelled) return;
			if (data.error) {
				this.emit('error', data);
				this.isLaunching = false;
				return;
			}
			let { minecraftJson, minecraftLoader, minecraftVersion, minecraftJava } = data;
			console.log(`[Launch] DownloadGame returned version: ${minecraftVersion}`);
			if (this.isCancelled) return;
			let minecraftArguments: any = await new argumentsMinecraft(this.options).GetArguments(minecraftJson, minecraftLoader);
			if (this.isCancelled) return;
			if (minecraftArguments.error) {
				this.emit('error', minecraftArguments);
				this.isLaunching = false;
				return;
			}
			let loaderArguments: any = await new loaderMinecraft(this.options).GetArguments(minecraftLoader, minecraftVersion);
			if (this.isCancelled) return;
			if (loaderArguments.error) {
				this.emit('error', loaderArguments);
				this.isLaunching = false;
				return;
			}
			let Arguments: any = [
				...minecraftArguments.jvm,
				...minecraftArguments.classpath,
				...loaderArguments.jvm,
				minecraftArguments.mainClass,
				...minecraftArguments.game,
				...loaderArguments.game
			];
			let java: any = this.options.java.path ? this.options.java.path : minecraftJava.path;
			let logs = this.options.instance ? `${this.options.path}/instances/${this.options.instance}` : this.options.path;
			if (!fs.existsSync(logs)) fs.mkdirSync(logs, { recursive: true });
			
			// Use StringBuilder for efficient string building
			const stringBuilder = this.memoryManager.getFromPool('StringBuilder', () => new StringBuilder());
			try {
				stringBuilder.append('Launching with arguments ');
				stringBuilder.append(Arguments.join(' '));
				let argumentsLogs = stringBuilder.toString();
				argumentsLogs = argumentsLogs.replaceAll(this.options.authenticator?.access_token, '????????');
				argumentsLogs = argumentsLogs.replaceAll(this.options.authenticator?.client_token, '????????');
				argumentsLogs = argumentsLogs.replaceAll(this.options.authenticator?.uuid, '????????');
				argumentsLogs = argumentsLogs.replaceAll(this.options.authenticator?.xboxAccount?.xuid, '????????');
				argumentsLogs = argumentsLogs.replaceAll(`${this.options.path}/`, '');
				this.emit('data', argumentsLogs);
			} finally {
				stringBuilder.clear();
				this.memoryManager.returnToPool('StringBuilder', stringBuilder, (obj) => obj.clear());
			}
			if (this.isCancelled) return;
			this.minecraftProcess = spawn(java, Arguments, { cwd: logs, detached: this.options.detached });
			
			// Track process start time for crash detection
			const processStartTime = Date.now();
			let hasExitedNormally = false;
			let lastOutputTime = Date.now();
			
			this.minecraftProcess.stdout.on('data', (data) => {
				lastOutputTime = Date.now();
				this.emit('data', data.toString('utf-8'));
			});
			
			this.minecraftProcess.stderr.on('data', (data) => {
				lastOutputTime = Date.now();
				this.emit('data', data.toString('utf-8'));
			});
			
			this.minecraftProcess.on('close', (code, signal) => {
				const runtime = Date.now() - processStartTime;
				const timeSinceLastOutput = Date.now() - lastOutputTime;
				
				// Determine if this was a crash
				const isCrash = this.detectCrash(code, signal, runtime, timeSinceLastOutput, hasExitedNormally);
				
				this.emit('close', {
					message: 'Minecraft closed',
					code: code,
					signal: signal,
					runtime: runtime,
					isCrash: isCrash,
					timeSinceLastOutput: timeSinceLastOutput,
					instanceId: this.options.instance
				});
			});
			
			// Monitor for graceful shutdown signals
			this.minecraftProcess.on('exit', (code, signal) => {
				if (signal === 'SIGTERM' || code === 0) {
					hasExitedNormally = true;
				}
			});

			// Wait a bit to ensure game is actually running
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// Get performance metrics and emit them with completion
			const performanceMetrics = this.performanceMonitor.stopMonitoring();
			
			// Only emit complete after everything is done
			this.emit('complete', { 
				message: 'Minecraft launched successfully', 
				process: this.minecraftProcess.pid,
				performance: performanceMetrics
			});
			this.isLaunching = false;
		} catch (error) {
			this.isLaunching = false;
			this.emit('error', error);
		}
	}

	async DownloadGame() {
		if (this.isCancelled) return;
		console.log(`[DownloadGame] Starting with version: ${this.options.version}`);
		let InfoVersion = await new jsonMinecraft(this.options).GetInfoVersion();
		if (this.isCancelled) return;
		let loaderJson: any = null;
		if ('error' in InfoVersion) {
			this.emit('error', InfoVersion);
			return InfoVersion;
		}
		let { json, version } = InfoVersion;
		let libraries = new librariesMinecraft(this.options);
		let bundle = new bundleMinecraft(this.options);
		let java = new javaMinecraft(this.options);
		java.on('progress', (progress: any, size: any, element: any) => {
			this.emit('progress', progress, size, element);
		});
		java.on('extract', (progress: any) => {
			this.emit('extract', progress);
		});
		let gameLibraries: any = await libraries.Getlibraries(json);
		if (this.isCancelled) return;
		let gameAssetsOther: any = await libraries.GetAssetsOthers(this.options.url);
		if (this.isCancelled) return;
		let gameAssets: any = await new assetsMinecraft(this.options).getAssets(json);
		if (this.isCancelled) return;
		let gameJava: any = this.options.java.path ? { files: [] } : await java.getJavaFiles(json);
		if (this.isCancelled) return;
		if (gameJava.error) return gameJava;
		let filesList: any = await bundle.checkBundle([...gameLibraries, ...gameAssetsOther, ...gameAssets, ...gameJava.files]);
		if (this.isCancelled) return;
		// In DownloadGame method, after downloadFileMultiple completes:
		if (filesList.length > 0) {
			this.downloader = new Downloader();
			let totsize = await bundle.getTotalSize(filesList);
			
			// Start download performance monitoring
			this.performanceMonitor.startDownloadMonitoring();
			
			this.downloader.on("progress", (DL: any, totDL: any, element: any) => {
				this.emit("progress", DL, totDL, element);
				// Record download progress for performance monitoring
				this.performanceMonitor.recordDownloadProgress(DL, 100); // Use a fixed interval for now
			});
			
			this.downloader.on("speed", (speed: any) => {
				this.emit("speed", speed);
				// Record speed metrics
				this.performanceMonitor.recordMetric('download_speed', speed);
			});
			
			this.downloader.on("estimated", (time: any) => {
				this.emit("estimated_time", time);
			});
			
			this.downloader.on("error", (e: any) => {
				// Emit specific error types instead of generic "error"
				if (e instanceof DownloadError) {
					this.emit("download_error", e);
				} else if (e instanceof NetworkError) {
					this.emit("network_error", e);
				} else if (e instanceof OriCoreError) {
					this.emit("ori_error", e);
				} else {
					this.emit("error", e);
				}
				
				// Also emit the generic error for backward compatibility
				this.emit("error", e);
			});

			try {
				await this.downloader.downloadFileMultiple(filesList, totsize, this.options.downloadFileMultiple, this.options.timeout, this.abortController?.signal);
				this.emit('downloads_complete', { message: 'All downloads finished', fileCount: filesList.length });
			} catch (error: any) {
				// Handle recoverable vs non-recoverable errors
				if (isRecoverableError(error)) {
					this.emit("recoverable_error", error);
				} else {
					this.emit("fatal_error", error);
				}
				throw error;
			}
			
			if (this.isCancelled) return;
		}
		if (this.options.loader.enable === true) {
			let loaderInstall = new loaderMinecraft(this.options);
			loaderInstall.on('extract', (extract: any) => {
				this.emit('extract', extract);
			});
			loaderInstall.on('progress', (progress: any, size: any, element: any) => {
				this.emit('progress', progress, size, element);
			});
			loaderInstall.on('check', (progress: any, size: any, element: any) => {
				this.emit('check', progress, size, element);
			});
			loaderInstall.on('patch', (patch: any) => {
				this.emit('patch', patch);
			});
			let jsonLoader = await loaderInstall.GetLoader(version, this.options.java.path ? this.options.java.path : gameJava.path)
				.then((data: any) => data)
				.catch((err: any) => err);
			if (this.isCancelled) return;
			if (jsonLoader.error) return jsonLoader;
			loaderJson = jsonLoader;
		}
		if (this.options.verify) await bundle.checkFiles([...gameLibraries, ...gameAssetsOther, ...gameAssets, ...gameJava.files]);
		if (this.isCancelled) return;
		let natives = await libraries.natives(gameLibraries);
		if (this.isCancelled) return;
		if (natives.length === 0) json.nativesList = false;
		else json.nativesList = true;
		if (isold(json)) new assetsMinecraft(this.options).copyAssets(json);
		
		// Configure resource packs if provided
		if (this.options.resourcePacks && this.options.resourcePacks.length > 0) {
			this.configureResourcePacks();
		}
		
		console.log(`[DownloadGame] Returning version: ${version}`);
		return {
			minecraftJson: json,
			minecraftLoader: loaderJson,
			minecraftVersion: version,
			minecraftJava: gameJava
		};
	}

	public async cancel(): Promise<void> {
		const wasLaunching = this.isLaunching;
		const hadProcess = !!this.minecraftProcess;
		
		this.isCancelled = true;
		this.isLaunching = false;
		
		if (this.abortController) {
			this.abortController.abort();
		}
		
		if (this.minecraftProcess) {
			try {
				if (this.minecraftProcess.exitCode === null && this.minecraftProcess.signalCode === null) {
					this.minecraftProcess.kill('SIGTERM');
					await new Promise(resolve => setTimeout(resolve, 1000));
					if (this.minecraftProcess.exitCode === null && this.minecraftProcess.signalCode === null) {
						this.minecraftProcess.kill('SIGKILL');
					}
				}
			} catch (error) {
				console.warn('Error killing Minecraft process:', error);
			}
			this.minecraftProcess = null;
		}
		
		if (this.downloader) {
			this.downloader = null;
		}
		
		// Clean up memory pools
		this.memoryManager.clearPools();
		
		// Enhanced messaging based on state
		let message = 'Launch process has been cancelled';
		if (hadProcess) {
			message += ' and Minecraft process was terminated';
		} else if (wasLaunching) {
			message += ' during launch preparation';
		}
		
		this.emit('cancelled', {
			message,
			wasLaunching,
			hadProcess,
			timestamp: new Date().toISOString()
		});
	}

	public get launching(): boolean {
		return this.isLaunching;
	}

	public get cancelled(): boolean {
		return this.isCancelled;
	}

	public getMemoryStats(): { pools: number; totalObjects: number; heapUsed: number } {
		return this.memoryManager.getMemoryStats();
	}

	public forceGarbageCollection(): void {
		this.memoryManager.forceGC();
	}

	/**
	 * Configures resource packs by updating the options.txt file to enable them.
	 * This ensures that resource packs appear on the right side (enabled) in Minecraft's resource pack menu.
	 */
	private configureResourcePacks(): void {
		if (!this.options.resourcePacks || this.options.resourcePacks.length === 0) {
			return;
		}

		const optionsPath = `${this.options.path}/options.txt`;
		let optionsContent = '';

		// Read existing options.txt if it exists
		if (fs.existsSync(optionsPath)) {
			try {
				optionsContent = fs.readFileSync(optionsPath, 'utf-8');
			} catch (error) {
				console.warn(`[ResourcePacks] Failed to read options.txt: ${error}`);
			}
		}

		// Extract existing resourcePacks setting
		const lines = optionsContent.split('\n');
		const resourcePackLines = lines.filter(line => line.startsWith('resourcePacks:'));
		const existingResourcePacks = resourcePackLines.length > 0 ? resourcePackLines[0].split(':')[1] : '';
		
		// Parse existing resource packs (format: ["pack1.zip","pack2.zip"])
		let existingPacks: string[] = [];
		if (existingResourcePacks) {
			try {
				existingPacks = JSON.parse(existingResourcePacks);
			} catch (error) {
				console.warn(`[ResourcePacks] Failed to parse existing resourcePacks setting: ${error}`);
			}
		}

		// Add our enabled resource packs
		const newResourcePacks = this.options.resourcePacks.map(rp => rp.fileName);
		const combinedPacks = [...new Set([...existingPacks, ...newResourcePacks])]; // Remove duplicates

		// Create the new resourcePacks line
		const newResourcePackLine = `resourcePacks:${JSON.stringify(combinedPacks)}`;

		// Update or add the resourcePacks line
		let updatedLines = lines.filter(line => !line.startsWith('resourcePacks:'));
		updatedLines.push(newResourcePackLine);

		// Write the updated options.txt
		try {
			fs.writeFileSync(optionsPath, updatedLines.join('\n'));
			console.log(`[ResourcePacks] Updated options.txt with ${combinedPacks.length} resource packs`);
		} catch (error) {
			console.error(`[ResourcePacks] Failed to write options.txt: ${error}`);
		}
	}

	/**
	 * Detects if the game process crashed based on exit code, signal, runtime, and other factors
	 * @param code - Exit code from the process
	 * @param signal - Signal that terminated the process
	 * @param runtime - How long the process ran in milliseconds
	 * @param timeSinceLastOutput - Time since last stdout/stderr output in milliseconds
	 * @param hasExitedNormally - Whether the process received a normal exit signal
	 * @returns true if the process likely crashed, false otherwise
	 */
	private detectCrash(code: number | null, signal: string | null, runtime: number, timeSinceLastOutput: number, hasExitedNormally: boolean): boolean {
		// If exited normally via signal, not a crash
		if (hasExitedNormally) {
			return false;
		}

		// Exit code 0 typically means normal exit
		if (code === 0) {
			return false;
		}

		// If killed by user (SIGTERM, SIGINT), not a crash
		if (signal === 'SIGTERM' || signal === 'SIGINT') {
			return false;
		}

		// Common crash exit codes for Java applications
		const crashExitCodes = [
			-1,    // General error
			1,     // General error
			255,   // Java VM error
			4294967295, // Unsigned equivalent of -1 (common Java crash)
			-805306369, // Windows access violation
			-1073741819, // Windows access violation (0xC0000005)
			-1073740777, // Windows heap corruption
			134,   // SIGABRT (abort signal)
			139,   // SIGSEGV (segmentation fault)
			137,   // SIGKILL (often OOM killer)
			143    // SIGTERM (but not our controlled SIGTERM)
		];

		if (code !== null && crashExitCodes.includes(code)) {
			return true;
		}

		// If process ran for very short time (< 10 seconds) and exited with non-zero code, likely a crash
		if (runtime < 10000 && code !== 0) {
			return true;
		}

		// If no output for a long time (> 30 seconds) and then exited, might be a hang/crash
		if (timeSinceLastOutput > 30000 && code !== 0) {
			return true;
		}

		// If killed by signal and not user-initiated, likely a crash
		if (signal && !['SIGTERM', 'SIGINT'].includes(signal)) {
			return true;
		}

		// Default: not a crash
		return false;
	}
}
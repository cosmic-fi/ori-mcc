/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import fs from 'fs';
import { EventEmitter } from 'events';
import { fromAnyReadable } from './Index.js';
import { 
    DownloadError, 
    TimeoutError, 
    ConnectionError, 
    FileSystemError, 
    ValidationError,
    ErrorCodes,
    wrapError
} from './Errors.js';

/**
 * Describes a single file to be downloaded by the Downloader class.
 */
export interface DownloadOptions {
	/** The URL to download from */
	url: string;
	/** Local path (including filename) where the file will be saved */
	path: string;
	/** The total length of the file (in bytes), if known */
	length?: number;
	/** Local folder in which the file's path resides */
	folder: string;
	/** Optional type descriptor, used when emitting 'progress' events */
	type?: string;
}

/**
 * A class responsible for downloading single or multiple files,
 * emitting events for progress, speed, estimated time, and errors.
 */
export default class Downloader extends EventEmitter {
	/**
	 * Downloads a single file from the given URL to the specified local path.
	 * Emits "progress" events with the number of bytes downloaded and total size.
	 *
	 * @param url - The remote URL to download from
	 * @param dirPath - Local folder path where the file is saved
	 * @param fileName - Name of the file (e.g., "mod.jar")
	 */
	public async downloadFile(url: string, dirPath: string, fileName: string): Promise<void> {
		try {
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}
		} catch (err: any) {
			const fsError = new FileSystemError(
				`Failed to create directory: ${err.message}`,
				dirPath,
				'mkdir',
				false,
				ErrorCodes.DIRECTORY_CREATE_FAILED
			);
			this.emit('error', fsError);
			throw fsError;
		}

		const writer = fs.createWriteStream(`${dirPath}/${fileName}`);
		let response: Response;

		try {
			response = await fetch(url);
			
			if (!response.ok) {
				const downloadError = new DownloadError(
					`HTTP ${response.status}: Failed to download ${fileName}`,
					url,
					response.status,
					ErrorCodes.HTTP_ERROR
				);
				this.emit('error', downloadError);
				throw downloadError;
			}
		} catch (err: any) {
			writer.destroy();
			
			if (err instanceof DownloadError) {
				throw err;
			}
			
			const wrappedError = wrapError(err, { url, fileName });
			this.emit('error', wrappedError);
			throw wrappedError;
		}

		const contentLength = response.headers.get('content-length');
		const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

		let downloaded = 0;

		return new Promise<void>((resolve, reject) => {
			const body = fromAnyReadable(response.body as any);

			body.on('data', (chunk: Buffer) => {
				downloaded += chunk.length;
				this.emit('progress', downloaded, totalSize);
				try {
					writer.write(chunk);
				} catch (err: any) {
					const fsError = new FileSystemError(
						`Failed to write to file: ${err.message}`,
						`${dirPath}/${fileName}`,
						'write',
						false,
						ErrorCodes.DISK_FULL
					);
					writer.destroy();
					this.emit('error', fsError);
					reject(fsError);
				}
			});

			body.on('end', () => {
				writer.end();
				resolve();
			});

			body.on('error', (err: Error) => {
				writer.destroy();
				const wrappedError = wrapError(err, { url, fileName, downloaded, totalSize });
				this.emit('error', wrappedError);
				reject(wrappedError);
			});

			writer.on('error', (err: Error) => {
				writer.destroy();
				const fsError = new FileSystemError(
					`File write error: ${err.message}`,
					`${dirPath}/${fileName}`,
					'write',
					false
				);
				this.emit('error', fsError);
				reject(fsError);
			});
		});
	}

	/**
	 * Downloads multiple files concurrently (up to the specified limit).
	 * Emits "progress" events with cumulative bytes downloaded vs. total size,
	 * as well as "speed" and "estimated" events for speed and ETA calculations.
	 */
	public async downloadFileMultiple(
		files: DownloadOptions[],
		size: number,
		limit: number = 1,
		timeout: number = 10000,
		abortSignal?: AbortSignal
	): Promise<void> {
		if (limit > files.length) limit = files.length;
		let completed = 0;
		let downloaded = 0;
		let queued = 0;
		let start = Date.now();
		let before = 0;
		const speeds: number[] = [];
		let aborted = false;
		const errors: Error[] = [];

		// Handle abort signal
		if (abortSignal) {
			abortSignal.addEventListener('abort', () => {
				aborted = true;
			});
		}

		const estimated = setInterval(() => {
			if (aborted) return;
			const duration = (Date.now() - start) / 1000;
			const chunkDownloaded = downloaded - before;
			if (speeds.length >= 5) speeds.shift();
			speeds.push(chunkDownloaded / duration);

			const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
			this.emit('speed', avgSpeed);

			const timeRemaining = (size - downloaded) / avgSpeed;
			this.emit('estimated', timeRemaining);

			start = Date.now();
			before = downloaded;
		}, 500);

		const downloadNext = async (): Promise<void> => {
			if (aborted || queued >= files.length) return;

			const file = files[queued++];
			
			try {
				if (!fs.existsSync(file.folder)) {
					fs.mkdirSync(file.folder, { recursive: true, mode: 0o777 });
				}
			} catch (err: any) {
				const fsError = new FileSystemError(
					`Failed to create directory: ${err.message}`,
					file.folder,
					'mkdir',
					false,
					ErrorCodes.DIRECTORY_CREATE_FAILED
				);
				errors.push(fsError);
				this.emit('error', fsError);
				completed++;
				downloadNext();
				return;
			}

			const writer = fs.createWriteStream(file.path, { flags: 'w', mode: 0o777 });
			const controller = new AbortController();
			const timeoutId = setTimeout(() => {
				controller.abort();
				const timeoutError = new TimeoutError(
					`Download timeout for ${file.url}`,
					timeout,
					ErrorCodes.NETWORK_TIMEOUT
				);
				errors.push(timeoutError);
				this.emit('error', timeoutError);
			}, timeout);

			try {
				if (aborted) {
					const abortError = new DownloadError('Download aborted by user', file.url, undefined, ErrorCodes.DOWNLOAD_INTERRUPTED);
					throw abortError;
				}

				const response = await fetch(file.url, { signal: controller.signal });
				clearTimeout(timeoutId);

				if (!response.ok) {
					const downloadError = new DownloadError(
						`HTTP ${response.status}: Failed to download from ${file.url}`,
						file.url,
						response.status,
						ErrorCodes.HTTP_ERROR
					);
					throw downloadError;
				}

				const stream = fromAnyReadable(response.body as any);

				stream.on('data', (chunk: Buffer) => {
					if (aborted) return;
					downloaded += chunk.length;
					this.emit('progress', downloaded, size, file.type);
					try {
						writer.write(chunk);
					} catch (err: any) {
						const fsError = new FileSystemError(
							`Failed to write chunk: ${err.message}`,
							file.path,
							'write',
							false
						);
						errors.push(fsError);
						this.emit('error', fsError);
					}
				});

				stream.on('end', () => {
					writer.end();
					completed++;
					downloadNext();
				});

				stream.on('error', (err) => {
					writer.destroy();
					const wrappedError = wrapError(err, { url: file.url, path: file.path });
					errors.push(wrappedError);
					this.emit('error', wrappedError);
					completed++;
					downloadNext();
				});

			} catch (e: any) {
				writer.destroy();
				clearTimeout(timeoutId);
				
				let error: Error;
				if (e instanceof Error) {
					error = e;
				} else {
					error = wrapError(new Error(String(e)), { url: file.url, path: file.path });
				}
				
				errors.push(error);
				this.emit('error', error);
				completed++;
				downloadNext();
			}
		};

		for (let i = 0; i < limit; i++) {
			downloadNext();
		}

		return new Promise((resolve, reject) => {
			const checkCompletion = () => {
				if (aborted) {
					clearInterval(estimated);
					reject(new DownloadError('Download aborted', '', undefined, ErrorCodes.DOWNLOAD_INTERRUPTED));
					return;
				}
				
				if (completed === files.length) {
					clearInterval(estimated);
					
					// Ensure all streams are properly closed
					setTimeout(() => {
						const criticalErrors = errors.filter(err => !err.hasOwnProperty('recoverable') || !(err as any).recoverable);
						if (criticalErrors.length > 0) {
							reject(criticalErrors[0]);
						} else {
							resolve();
						}
					}, 100); // Small delay to ensure all streams are closed
					return;
				}
			};
			
			const interval = setInterval(checkCompletion, 100);
			
			// Also check immediately
			checkCompletion();
		});
	}

	/**
	 * Performs a HEAD request on the given URL to check if it is valid (status=200)
	 * and retrieves the "content-length" if available.
	 *
	 * @param url The URL to check
	 * @param timeout Time in ms before the request times out
	 * @returns An object containing { size, status } or rejects with false
	 */
	public async checkURL(
		url: string,
		timeout: number = 10000
	): Promise<{ size: number; status: number } | false> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const res = await fetch(url, {
				method: 'HEAD',
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (res.status === 200) {
				const contentLength = res.headers.get('content-length');
				const size = contentLength ? parseInt(contentLength, 10) : 0;
				return { size, status: 200 };
			}
			return false;
		} catch (e: any) {
			clearTimeout(timeoutId);
			return false;
		}
	}



	/**
	 * Tries each mirror in turn, constructing an URL (mirror + baseURL). If a valid
	 * response is found (status=200), it returns the final URL and size. Otherwise, returns false.
	 *
	 * @param baseURL The relative path (e.g. "group/id/artifact.jar")
	 * @param mirrors An array of possible mirror base URLs
	 * @returns An object { url, size, status } if found, or false if all mirrors fail
	 */
	public async checkMirror(
		baseURL: string,
		mirrors: string[]
	): Promise<{ url: string; size: number; status: number } | false> {

		for (const mirror of mirrors) {
			const testURL = `${mirror}/${baseURL}`;
			const res = await this.checkURL(testURL);

			if (res !== false && res.status === 200) {
				return {
					url: testURL,
					size: res.size,
					status: 200
				};
			}
		}
		return false;
	}
}

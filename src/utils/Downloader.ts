/**
 * @author Cosmic-fi
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0/
 */

import fs from 'fs';
import nodeFetch from 'node-fetch';
import { EventEmitter } from 'events';

interface DownloadOptions {
    url: string;
    path: string;
    length: number;
    folder: string;
    type?: string; // Added missing type property
}

interface DownloadEvents {
    'progress': (downloaded: number, total: number, element?: string) => void;
    'speed': (speed: number) => void;
    'estimated': (time: number) => void;
    'error': (error: Error) => void;
}

export default class Downloader extends EventEmitter {
    constructor() {
        super(); // Proper EventEmitter inheritance
    }

    async downloadFile(url: string, path: string, fileName: string): Promise<void> {
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        const writer = fs.createWriteStream(path + '/' + fileName);
        
        try {
            const response = await nodeFetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const size = response.headers.get('content-length');
            let downloaded = 0;

            return new Promise<void>((resolve, reject) => {
                response.body.on('data', (chunk: Buffer) => {
                    downloaded += chunk.length;
                    this.emit('progress', downloaded, size ? parseInt(size) : 0);
                    writer.write(chunk);
                });

                response.body.on('end', () => {
                    writer.end();
                    resolve();
                });

                response.body.on('error', (err) => {
                    writer.end();
                    this.emit('error', err);
                    reject(err);
                });
                
                writer.on('error', (err) => {
                    this.emit('error', err);
                    reject(err);
                });
            });
        } catch (error) {
            writer.end();
            throw error;
        }
    }

    async downloadFileMultiple(files: DownloadOptions[], totalSize: number, limit: number = 1, timeout: number = 10000): Promise<void> {
        if (limit > files.length) limit = files.length;
        
        let completed = 0;
        let downloaded = 0;
        
        // Speed calculation setup
        let start = new Date().getTime();
        let before = 0;
        let speeds: number[] = [];

        const speedInterval = setInterval(() => {
            const duration = (new Date().getTime() - start) / 1000;
            const loaded = (downloaded - before) * 8;
            if (speeds.length >= 5) speeds = speeds.slice(1);
            speeds.push((loaded / duration) / 8);
            let speed = 0;
            for (let s of speeds) speed += s;
            speed /= speeds.length;
            this.emit("speed", speed);
            const time = (totalSize - downloaded) / speed;
            this.emit("estimated", time);
            start = new Date().getTime();
            before = downloaded;
        }, 500);
        
        const downloadFile = async (file: DownloadOptions): Promise<void> => {
            if (!fs.existsSync(file.folder)) {
                fs.mkdirSync(file.folder, { recursive: true, mode: 0o777 });
            }
            
            const writer = fs.createWriteStream(file.path, { flags: 'w', mode: 0o777 });
            
            try {
                const response = await nodeFetch(file.url, { timeout });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return new Promise<void>((resolve, reject) => {
                    response.body.on('data', (chunk: Buffer) => {
                        downloaded += chunk.length;
                        this.emit('progress', downloaded, totalSize, file.type);
                        writer.write(chunk);
                    });
                    
                    response.body.on('end', () => {
                        writer.end();
                        completed++;
                        resolve();
                    });
                    
                    response.body.on('error', (err) => {
                        writer.end();
                        reject(err);
                    });
                    
                    writer.on('error', (err) => {
                        reject(err);
                    });
                });
            } catch (error) {
                writer.end();
                completed++;
                this.emit('error', error);
                throw error;
            }
        };
        
        try {
            // Process files with controlled concurrency
            for (let i = 0; i < files.length; i += limit) {
                const batch = files.slice(i, i + limit);
                const batchPromises = batch.map(file => downloadFile(file));
                await Promise.all(batchPromises);
            }
        } finally {
            clearInterval(speedInterval);
        }
    }

    async checkURL(url: string, timeout: number = 10000): Promise<{ size: number; status: number } | false> {
        try {
            const response = await nodeFetch(url, { method: 'HEAD', timeout });
            if (response.status === 200) {
                const contentLength = response.headers.get('content-length');
                return {
                    size: contentLength ? parseInt(contentLength) : 0,
                    status: response.status
                };
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async checkMirror(baseURL: string, mirrors: string[]): Promise<{ url: string; size: number; status: number } | false> {
        for (const mirror of mirrors) {
            const url = `${mirror}/${baseURL}`;
            const result = await this.checkURL(url);

            if (result && result.status === 200) {
                return {
                    url,
                    size: result.size,
                    status: result.status
                };
            }
        }
        return false;
    }
}
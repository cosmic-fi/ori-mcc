/**
 * Memory management utilities for Ori-MCC
 * Provides memory pooling and optimization for better performance
 */

export class MemoryManager {
    private static instance: MemoryManager;
    private objectPool: Map<string, any[]> = new Map();
    private maxPoolSize = 100;
    
    private constructor() {}
    
    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }
    
    /**
     * Get an object from the pool or create a new one
     */
    public getFromPool<T>(type: string, factory: () => T): T {
        const pool = this.objectPool.get(type);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return factory();
    }
    
    /**
     * Return an object to the pool for reuse
     */
    public returnToPool<T>(type: string, obj: T, reset?: (obj: T) => void): void {
        if (!this.objectPool.has(type)) {
            this.objectPool.set(type, []);
        }
        
        const pool = this.objectPool.get(type)!;
        if (pool.length < this.maxPoolSize) {
            if (reset) {
                reset(obj);
            }
            pool.push(obj);
        }
    }
    
    /**
     * Clear all pools to free memory
     */
    public clearPools(): void {
        this.objectPool.clear();
    }
    
    /**
     * Force garbage collection if available (Node.js with --expose-gc)
     */
    public forceGC(): void {
        if (global.gc) {
            global.gc();
        }
    }
    
    /**
     * Get memory usage statistics
     */
    public getMemoryStats(): { pools: number; totalObjects: number; heapUsed: number } {
        let totalObjects = 0;
        for (const pool of this.objectPool.values()) {
            totalObjects += pool.length;
        }
        
        return {
            pools: this.objectPool.size,
            totalObjects,
            heapUsed: process.memoryUsage().heapUsed
        };
    }
}

/**
 * Buffered file reader for efficient file operations
 */
export class BufferedFileReader {
    private buffer: Buffer;
    private position = 0;
    private chunkSize: number;
    
    constructor(buffer: Buffer, chunkSize = 64 * 1024) { // 64KB default
        this.buffer = buffer;
        this.chunkSize = chunkSize;
    }
    
    public readChunk(): Buffer | null {
        if (this.position >= this.buffer.length) {
            return null;
        }
        
        const end = Math.min(this.position + this.chunkSize, this.buffer.length);
        const chunk = this.buffer.subarray(this.position, end);
        this.position = end;
        return chunk;
    }
    
    public reset(): void {
        this.position = 0;
    }
    
    public getProgress(): number {
        return this.position / this.buffer.length;
    }
}

/**
 * Optimized string builder for reducing memory allocations
 */
export class StringBuilder {
    private parts: string[] = [];
    private totalLength = 0;
    
    public append(str: string): this {
        this.parts.push(str);
        this.totalLength += str.length;
        return this;
    }
    
    public appendLine(str: string = ''): this {
        return this.append(str + '\n');
    }
    
    public toString(): string {
        return this.parts.join('');
    }
    
    public clear(): this {
        this.parts = [];
        this.totalLength = 0;
        return this;
    }
    
    public get length(): number {
        return this.totalLength;
    }
}

export default MemoryManager;
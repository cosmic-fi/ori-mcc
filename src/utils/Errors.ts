/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

/**
 * Base class for all Ori-Core-Java library errors
 */
export abstract class OriCoreError extends Error {
    public readonly code: string;
    public readonly recoverable: boolean;
    public readonly context?: any;

    constructor(message: string, code: string, recoverable: boolean = false, context?: any) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.recoverable = recoverable;
        this.context = context;
        
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            recoverable: this.recoverable,
            context: this.context,
            stack: this.stack
        };
    }
}

/**
 * Network-related errors (connection issues, timeouts, etc.)
 * These are typically recoverable with retry logic
 */
export class NetworkError extends OriCoreError {
    constructor(message: string, code: string = 'NETWORK_ERROR', context?: any) {
        super(message, code, true, context);
    }
}

/**
 * Download-specific errors that can be retried
 */
export class DownloadError extends NetworkError {
    public readonly url: string;
    public readonly statusCode?: number;

    constructor(message: string, url: string, statusCode?: number, code: string = 'DOWNLOAD_ERROR') {
        super(message, code, { url, statusCode });
        this.url = url;
        this.statusCode = statusCode;
    }
}

/**
 * Timeout errors - recoverable with retry
 */
export class TimeoutError extends NetworkError {
    public readonly timeout: number;

    constructor(message: string, timeout: number, code: string = 'TIMEOUT_ERROR') {
        super(message, code, { timeout });
        this.timeout = timeout;
    }
}

/**
 * Connection-specific errors (DNS, refused connections, etc.)
 */
export class ConnectionError extends NetworkError {
    constructor(message: string, code: string = 'CONNECTION_ERROR', context?: any) {
        super(message, code, context);
    }
}

/**
 * File system errors (permissions, disk space, etc.)
 * Some may be recoverable depending on the specific issue
 */
export class FileSystemError extends OriCoreError {
    public readonly path: string;
    public readonly operation: string;

    constructor(message: string, path: string, operation: string, recoverable: boolean = false, code: string = 'FILESYSTEM_ERROR') {
        super(message, code, recoverable, { path, operation });
        this.path = path;
        this.operation = operation;
    }
}

/**
 * Authentication/authorization errors
 * Generally not recoverable without user intervention
 */
export class AuthenticationError extends OriCoreError {
    public readonly authType: string;

    constructor(message: string, authType: string, code: string = 'AUTH_ERROR') {
        super(message, code, false, { authType });
        this.authType = authType;
    }
}

/**
 * Configuration or validation errors
 * Not recoverable without fixing the configuration
 */
export class ConfigurationError extends OriCoreError {
    public readonly field?: string;
    public readonly value?: any;

    constructor(message: string, field?: string, value?: any, code: string = 'CONFIG_ERROR') {
        super(message, code, false, { field, value });
        this.field = field;
        this.value = value;
    }
}

/**
 * Version or compatibility errors
 * Not recoverable without changing versions
 */
export class VersionError extends OriCoreError {
    public readonly requestedVersion?: string;
    public readonly availableVersions?: string[];

    constructor(message: string, requestedVersion?: string, availableVersions?: string[], code: string = 'VERSION_ERROR') {
        super(message, code, false, { requestedVersion, availableVersions });
        this.requestedVersion = requestedVersion;
        this.availableVersions = availableVersions;
    }
}

/**
 * Java runtime errors
 * May be recoverable by downloading different Java version
 */
export class JavaError extends OriCoreError {
    public readonly javaVersion?: string;
    public readonly javaPath?: string;

    constructor(message: string, javaVersion?: string, javaPath?: string, recoverable: boolean = true, code: string = 'JAVA_ERROR') {
        super(message, code, recoverable, { javaVersion, javaPath });
        this.javaVersion = javaVersion;
        this.javaPath = javaPath;
    }
}

/**
 * Loader-specific errors (Forge, Fabric, etc.)
 * May be recoverable by trying different loader versions
 */
export class LoaderError extends OriCoreError {
    public readonly loaderType: string;
    public readonly loaderVersion?: string;

    constructor(message: string, loaderType: string, loaderVersion?: string, recoverable: boolean = true, code: string = 'LOADER_ERROR') {
        super(message, code, recoverable, { loaderType, loaderVersion });
        this.loaderType = loaderType;
        this.loaderVersion = loaderVersion;
    }
}

/**
 * Launch process errors
 * Some may be recoverable, others not
 */
export class LaunchError extends OriCoreError {
    public readonly phase: string;

    constructor(message: string, phase: string, recoverable: boolean = false, code: string = 'LAUNCH_ERROR') {
        super(message, code, recoverable, { phase });
        this.phase = phase;
    }
}

/**
 * Validation errors for file integrity, checksums, etc.
 * Usually recoverable by re-downloading
 */
export class ValidationError extends OriCoreError {
    public readonly expectedValue?: string;
    public readonly actualValue?: string;
    public readonly filePath?: string;

    constructor(message: string, expectedValue?: string, actualValue?: string, filePath?: string, code: string = 'VALIDATION_ERROR') {
        super(message, code, true, { expectedValue, actualValue, filePath });
        this.expectedValue = expectedValue;
        this.actualValue = actualValue;
        this.filePath = filePath;
    }
}

/**
 * Error codes for specific scenarios
 */
export const ErrorCodes = {
    // Network errors
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    CONNECTION_REFUSED: 'CONNECTION_REFUSED',
    DNS_LOOKUP_FAILED: 'DNS_LOOKUP_FAILED',
    HTTP_ERROR: 'HTTP_ERROR',
    
    // Download errors
    DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
    DOWNLOAD_INTERRUPTED: 'DOWNLOAD_INTERRUPTED',
    DOWNLOAD_CORRUPTED: 'DOWNLOAD_CORRUPTED',
    MIRROR_UNAVAILABLE: 'MIRROR_UNAVAILABLE',
    
    // File system errors
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DISK_FULL: 'DISK_FULL',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    DIRECTORY_CREATE_FAILED: 'DIRECTORY_CREATE_FAILED',
    
    // Authentication errors
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    AUTH_SERVER_ERROR: 'AUTH_SERVER_ERROR',
    
    // Configuration errors
    INVALID_PATH: 'INVALID_PATH',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_VERSION_FORMAT: 'INVALID_VERSION_FORMAT',
    
    // Version errors
    VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
    UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
    
    // Java errors
    JAVA_NOT_FOUND: 'JAVA_NOT_FOUND',
    JAVA_VERSION_INCOMPATIBLE: 'JAVA_VERSION_INCOMPATIBLE',
    JAVA_DOWNLOAD_FAILED: 'JAVA_DOWNLOAD_FAILED',
    
    // Loader errors
    LOADER_NOT_FOUND: 'LOADER_NOT_FOUND',
    LOADER_INCOMPATIBLE: 'LOADER_INCOMPATIBLE',
    LOADER_INSTALL_FAILED: 'LOADER_INSTALL_FAILED',
    
    // Launch errors
    LAUNCH_FAILED: 'LAUNCH_FAILED',
    PROCESS_CRASHED: 'PROCESS_CRASHED',
    
    // Validation errors
    CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
    FILE_CORRUPTED: 'FILE_CORRUPTED'
} as const;

/**
 * Helper function to determine if an error is recoverable
 */
export function isRecoverableError(error: Error): boolean {
    if (error instanceof OriCoreError) {
        return error.recoverable;
    }
    
    // For non-OriCore errors, check common patterns
    if (error.message.includes('ECONNRESET') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')) {
        return true;
    }
    
    return false;
}

/**
 * Helper function to create appropriate error from generic errors
 */
export function wrapError(error: Error, context?: any): OriCoreError {
    const message = error.message;
    
    // Network-related errors
    if (message.includes('ECONNRESET') || message.includes('ECONNREFUSED')) {
        return new ConnectionError(message, ErrorCodes.CONNECTION_REFUSED, context);
    }
    
    if (message.includes('ETIMEDOUT')) {
        return new TimeoutError(message, context?.timeout || 10000);
    }
    
    if (message.includes('ENOTFOUND')) {
        return new ConnectionError(message, ErrorCodes.DNS_LOOKUP_FAILED, context);
    }
    
    // File system errors
    if (message.includes('ENOENT')) {
        return new FileSystemError(message, context?.path || '', 'read', false, ErrorCodes.FILE_NOT_FOUND);
    }
    
    if (message.includes('EACCES') || message.includes('EPERM')) {
        return new FileSystemError(message, context?.path || '', context?.operation || 'access', false, ErrorCodes.PERMISSION_DENIED);
    }
    
    if (message.includes('ENOSPC')) {
        return new FileSystemError(message, context?.path || '', 'write', false, ErrorCodes.DISK_FULL);
    }
    
    // Default to generic OriCore error
    return new class extends OriCoreError {
        constructor() {
            super(message, 'UNKNOWN_ERROR', false, context);
        }
    }();
}
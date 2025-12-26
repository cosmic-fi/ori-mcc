/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import os from 'os';
import MinecraftNativeLinuxARM from './Minecraft-Lwjgl-Native.js';

/**
 * Helper function to perform fetch with retries
 */
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
	let lastError;
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url);
			if (response.ok) return response;
			// If server error (5xx), throw to trigger retry
			if (response.status >= 500) {
				throw new Error(`Server returned ${response.status}`);
			}
			// If client error (4xx), don't retry, just return response (caller handles it)
			return response;
		} catch (error) {
			lastError = error;
			if (i < retries - 1) {
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}
	throw lastError;
}

/**
 * Basic structure for options passed to the Json class.
 * Modify or expand based on your actual usage.
 */
export interface JsonOptions {
	version: string;     // The targeted Minecraft version (e.g. "1.19", "latest_release", etc.)
	[key: string]: any;  // Include any additional fields needed by your code
}

/**
 * Represents a single version entry from Mojang's version manifest.
 */
export interface VersionEntry {
	id: string;
	type: string;
	url: string;
	time: string;
	releaseTime: string;
}

/**
 * Structure of the Mojang version manifest (simplified).
 */
export interface MojangVersionManifest {
	latest: {
		release: string;
		snapshot: string;
	};
	versions: VersionEntry[];
}

/**
 * Structure returned by the getInfoVersion method on success.
 */
export interface GetInfoVersionResult {
	InfoVersion: VersionEntry;
	json: any;       // The specific version JSON fetched from Mojang
	version: string; // The final resolved version (e.g., "1.19" if "latest_release" was given)
}

/**
 * Structure returned by getInfoVersion if an error occurs (version not found).
 */
export interface GetInfoVersionError {
	error: true;
	message: string;
}

/**
 * This class retrieves Minecraft version information from Mojang's
 * version manifest, and optionally processes the JSON for ARM-based Linux.
 */
export default class Json {
	private readonly options: JsonOptions;

	constructor(options: JsonOptions) {
		this.options = options;
	}

	/**
	 * Fetches the Mojang version manifest, resolves the intended version (release, snapshot, etc.),
	 * and returns the associated JSON object for that version.
	 * If the system is Linux ARM, it will run additional processing on the JSON.
	 *
	 * @returns An object containing { InfoVersion, json, version }, or an error object.
	 */
	public async GetInfoVersion(): Promise<GetInfoVersionResult | GetInfoVersionError> {
		let { version } = this.options;
		
		// Debug logging
		console.log(`[Minecraft-Json] GetInfoVersion called with version: ${version}`);

		// Fetch the version manifest
		let response;
		try {
			response = await fetchWithRetry(
				`https://launchermeta.mojang.com/mc/game/version_manifest_v2.json?_t=${new Date().toISOString()}`
			);
		} catch (error: any) {
			console.error('[Minecraft-Json] Failed to fetch version manifest:', error);
			return {
				error: true,
				message: `Failed to fetch version manifest: ${error.message || error}`
			};
		}

		if (!response.ok) {
			return {
				error: true,
				message: `Failed to fetch version manifest: Status ${response.status}`
			};
		}

		const manifest: MojangVersionManifest = await response.json();

		// Resolve "latest_release"/"latest_snapshot" shorthands
		console.log(`[Minecraft-Json] Resolving version shorthand: ${version}`);
		if (version === 'latest_release' || version === 'r' || version === 'lr') {
			version = manifest.latest.release;
			console.log(`[Minecraft-Json] Resolved to latest release: ${version}`);
		} else if (version === 'latest_snapshot' || version === 's' || version === 'ls') {
			version = manifest.latest.snapshot;
			console.log(`[Minecraft-Json] Resolved to latest snapshot: ${version}`);
		} else {
			console.log(`[Minecraft-Json] Using specified version: ${version}`);
		}
		
		// Debug logging after resolution
		console.log(`[Minecraft-Json] Version after resolution: ${version}`);

		// Find the matching version info from the manifest
		const matchedVersion = manifest.versions.find((v) => v.id === version);
		if (!matchedVersion) {
			return {
				error: true,
				message: `Minecraft ${version} is not found.`
			};
		}

		// Fetch the detailed version JSON from Mojang
		let jsonResponse;
		try {
			jsonResponse = await fetchWithRetry(matchedVersion.url);
		} catch (error: any) {
			console.error(`[Minecraft-Json] Failed to fetch version JSON for ${version}:`, error);
			return {
				error: true,
				message: `Failed to fetch version JSON for ${version}: ${error.message || error}`
			};
		}

		if (!jsonResponse.ok) {
			return {
				error: true,
				message: `Failed to fetch version JSON for ${version}: Status ${jsonResponse.status}`
			};
		}

		let versionJson = await jsonResponse.json();

		// If on Linux ARM, run additional processing
		if (os.platform() === 'linux' && os.arch().startsWith('arm')) {
			versionJson = await new MinecraftNativeLinuxARM(this.options).ProcessJson(versionJson);
		}

		// Debug logging before return
		console.log(`[Minecraft-Json] Returning version: ${version}`);
		
		return {
			InfoVersion: matchedVersion,
			json: versionJson,
			version
		};
	}
}

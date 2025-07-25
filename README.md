##### v4 • **ori-mcc**
[![License: CC‑BY‑NC 4.0](https://img.shields.io/badge/License-CC--BY--NC%204.0-yellow.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
![stable version](https://img.shields.io/npm/v/ori-mcc?logo=nodedotjs)

**ori-mcc** (Ori Minecraft Core) is a powerful **NodeJS/TypeScript** library designed to simplify Minecraft Java Edition launcher development. It provides a complete solution for game launching, authentication, mod loading, and asset management without the complexity of handling manifests, libraries, or Java runtimes manually.

## 🎯 What is ori-mcc?

ori-mcc eliminates the tedious work of building Minecraft launchers from scratch. Whether you're creating a custom launcher for a modpack, building a server management tool, or developing a gaming platform, ori-mcc handles all the low-level Minecraft launching logic so you can focus on your user experience.

## ✨ Key Features

- 🚀 **One-line game launching** - Launch any Minecraft version with minimal configuration
- 🔐 **Multi-platform authentication** - Microsoft, Mojang, and custom auth server support
- 🔧 **Universal mod loader support** - Forge, NeoForge, Fabric, Quilt, and Legacy Fabric
- 📦 **Intelligent asset management** - Automatic download, verification, and caching
- ⚡ **High-performance downloads** - Parallel downloading with progress tracking
- 🎯 **Smart Java detection** - Automatic JVM discovery and version management
- 📊 **Real-time events** - Progress, speed, extraction, and error events
- 🛡️ **Robust file handling** - SHA-1 verification, resume support, and error recovery
- 🖥️ **Cross-platform ready** - Windows, macOS, and Linux compatibility
- 🎮 **Instance management** - Support for multiple game profiles and configurations

---

### Getting support
Need help or just want to chat? Join the community Discord!

<p align="center">
    <a href="http://discord.luuxis.fr">
        <img src="https://invidget.switchblade.xyz/e9q7Yr2cuQ">
    </a>
</p>

---

### Installing

```bash
npm i ori-mcc
# or
yarn add ori-mcc
```

*Requirements:* Node ≥ 18, TypeScript (only if you import *.ts*), 7‑Zip embedded binary.

---

### Quick Start Example (ESM)
```ts
import { Launch, Microsoft } from 'ori-mcc';

// ⚠️  In production, perform auth **before** initialising the launcher
//     so you can handle refresh / error flows cleanly.
const auth = await Microsoft.auth({
  client_id: '00000000-0000-0000-0000-000000000000',
  type: 'terminal' // 'electron' | 'nwjs'
});

const launcher = new Launch();

launcher.on('progress', p => console.log(`[DL] ${p}%`))
        .on('data', line => process.stdout.write(line))
        .on('close', () => console.log('Game exited.'));

await launcher.launch({
  root: './minecraft',
  authenticator: auth,
  version: '1.20.4',
  loader: { type: 'fabric', build: '0.15.9' },
  memory: { min: '2G', max: '4G' }
});
```

This completely rewrites the description to focus on the "ori-mcc" branding and provides a clearer value proposition for developers looking to build Minecraft launchers.
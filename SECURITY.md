# Security Policy

## 🔒 Security Principles

**SuperAi & RAKKYXD** is built with a **local-first and privacy-focused** philosophy:

1. **No External Telemetry / Key Snooping**:
   * API keys, session tokens, and passwords remain strictly on your local machine.
   * Credentials are stored encrypted using system-level secure storage.
   * SuperAi operates zero third-party telemetry servers or tracking beacons.
2. **Local AI Execution & Sandboxing**:
   * All file operations and shell commands executed by AI agents run locally under your user permissions.
   * Dangerous commands and tool invocations require user approval through the **Tool Permission** system (`auto`, `ask`, `read`, `edit`).
   * Project access is restricted to the specific folder directories you open and trust.

---

## 🛡️ Supported Versions

We actively maintain and provide security patches for the following versions:

| Version | Supported |
| :--- | :---: |
| 1.0.x (Latest Release) | ✅ |
| < 1.0.0 | ❌ |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability or potential privacy issue in SuperAi & RAKKYXD, please do **NOT** open a public GitHub issue.

Instead, please report it privately:
* **Email**: `rakgorak@gmail.com` or contact the maintainer directly via GitHub profile.
* **Include**:
  * Description of the vulnerability.
  * Steps to reproduce or proof-of-concept.
  * Potential impact.

We will acknowledge receipt within 48 hours and work with you to remediate and publish a patch promptly.

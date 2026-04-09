# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public issue.** Instead, email **security@garu.com.br** with:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact assessment

We will acknowledge your report within **3 business days** and aim to provide a fix or mitigation within **14 days** for critical issues.

## Scope

The following are in scope:

- Authentication bypass or credential leakage
- Command injection or arbitrary code execution
- Path traversal in credential storage
- Supply chain issues (dependency compromise, npm package tampering)
- Insecure file permissions on stored credentials

The following are out of scope:

- Denial of service via CLI argument fuzzing (local tool)
- Issues requiring physical access to the machine
- Social engineering

## Credential Storage

The CLI stores API keys at `~/.config/garu/credentials.json` with file mode `0600` (owner read/write only). If you discover a scenario where credentials are exposed beyond this, please report it.
